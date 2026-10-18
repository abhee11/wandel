import {recordingStore} from './recordings';
import {guestPlan} from './guestAI';
import {workflowStore} from './workflows';
import {provisionIdentity,type IdentityProvider} from './clerk';
import {randomUUID,createHash} from 'node:crypto';
import {z} from 'zod';
import {WorkflowSchema,type Workflow} from '../../extension/shared/model';
import {validateWorkflow,createWorkflow,workflowDepth} from '../../extension/prototype/engine';
import {BatchSchema} from '../../extension/ai/planSchema';
import type {DB} from './db';
import {one,all} from './db';
import type {Config} from './config';
import {APIError,checkPassword,hashPassword,rateLimit,secret,tokenHash} from './security';
import {Entitlements} from './entitlements';
import {MockBillingProvider,type BillingProvider,type Checkout} from './billing';
import {LocalAnalytics,type Analytics} from './analytics';
import {AIProviderError,type AIProvider,type MailProvider} from './providers';
interface User {id:string;email:string;name:string|null;password_hash:string;created_at:string;updated_at:string;}
interface Prototype {id:string;user_id:string;name:string;description:string;target_domain:string;current_version:number;revision:number;created_at:string;updated_at:string;definition?:string;}
const email=z.string().trim().email().max(254).transform(x=>x.toLowerCase());
const password=z.string().min(10).max(128);
const signup=z.object({email,password,name:z.string().trim().max(100).optional(),client:z.literal('extension').optional()}).strict();
const metadata=z.object({name:z.string().trim().min(1).max(300),description:z.string().max(2000).default(''),targetDomain:z.string().url().max(1000),definition:WorkflowSchema.optional()}).strict();
const update=z.object({name:z.string().trim().min(1).max(300).optional(),description:z.string().max(2000).optional(),definition:WorkflowSchema.optional(),revision:z.number().int().positive()}).strict();
const publicUser=(u:User)=>({id:u.id,email:u.email,name:u.name,createdAt:u.created_at,updatedAt:u.updated_at});
const publicPrototype=(p:Prototype)=>({id:p.id,name:p.name,description:p.description,targetDomain:p.target_domain,currentVersion:p.current_version,revision:p.revision,createdAt:p.created_at,updatedAt:p.updated_at,...(p.definition?{definition:JSON.parse(p.definition)}:{})});
const json=(data:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
export function createPlatform(options:{db:DB;config:Config;ai:AIProvider;mail:MailProvider;clock?:()=>Date;analytics?:Analytics;billing?:BillingProvider;identity?:IdentityProvider}){
 const {db,config,ai,mail}=options,clock=options.clock||(()=>new Date()),entitlements=new Entitlements(db,config,clock),analytics=options.analytics||new LocalAnalytics(db,clock),billing:BillingProvider=options.billing||new MockBillingProvider(db,config,clock);
 const recordings=recordingStore(db,config.publicAPIOrigin||config.origin,clock);
 const workflows=workflowStore(db,entitlements,clock);
 const now=()=>clock().toISOString();
 const track=(name:string,id:string,properties:Record<string,string|number|boolean>={})=>analytics.track(name,id,properties);
 const cookie=(token:string,clear=false)=>`wandel_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${clear?0:2592000}${config.production?'; Secure':''}`;
 function issue(userId:string,kind:'web'|'extension') {const token=secret();db.prepare('INSERT INTO sessions VALUES (?,?,?,?,?)').run(tokenHash(token,config.pepper),userId,kind,new Date(clock().getTime()+2592000000).toISOString(),now());return token;}
 function credential(req:Request){const bearer=req.headers.get('authorization');if(bearer?.startsWith('Bearer '))return {raw:bearer.slice(7),kind:'extension'};return {raw:req.headers.get('cookie')?.match(/(?:^|;\s*)wandel_session=([^;]+)/)?.[1]||'',kind:'web'};}
 async function user(req:Request){const c=credential(req);if(config.authMode==='clerk'){if(!options.identity)throw new APIError(503,'AUTH_NOT_CONFIGURED','Clerk is not configured. Temporary local saves are available.');if(!req.headers.get('authorization')?.startsWith('Bearer '))throw new APIError(401,'AUTH_REQUIRED','Sign in to save to your account.');const identity=await options.identity.verify(c.raw,req.headers.get('origin'));const id=provisionIdentity(db,identity,now());return one<User>(db,'SELECT * FROM users WHERE id=?',id)!;}const u=one<User>(db,'SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.kind=? AND s.expires_at>?',tokenHash(c.raw,config.pepper),c.kind,now());if(!u)throw new APIError(401,'AUTH_REQUIRED','Please log in to continue.');return u;}
 function owned(userId:string,id:string,definition=false){const p=one<Prototype>(db,definition?'SELECT p.*,d.definition FROM prototypes p JOIN prototype_definitions d ON d.prototype_id=p.id WHERE p.id=? AND p.user_id=?':'SELECT * FROM prototypes WHERE id=? AND user_id=?',id,userId);if(!p)throw new APIError(404,'NOT_FOUND','Prototype not found.');return p;}
 function definition(input:Workflow,domain:string,userId:string,previous?:Workflow){let w:Workflow;let origin:string;try{w=validateWorkflow(input);origin=new URL(w.origin).origin;}catch{throw new APIError(400,'INVALID_DEFINITION','The workflow definition has invalid states, interactions, or origin.');}if(origin!==domain)throw new APIError(400,'INVALID_TARGET','Workflow origin must match the target domain.');const depth=workflowDepth(w),limit=entitlements.get(userId).limits.maxDepth;
  if(limit!==null&&depth>limit){const old=previous?workflowDepth(previous):0;if(depth>old)throw new APIError(403,'DEPTH_LIMIT_REACHED',`Your plan allows ${limit} steps beyond the original page.`,{upgradeUrl:'/pricing'});}return w;
 }
 async function body(req:Request){const raw=await req.text();if(Buffer.byteLength(raw)>1048576)throw new APIError(413,'BODY_TOO_LARGE','Request must be under 1 MB.');try{return JSON.parse(raw||'{}');}catch{throw new APIError(400,'INVALID_JSON','Invalid JSON request.');}}
 async function route(req:Request,ip:string):Promise<Response>{
  const path=new URL(req.url).pathname,method=req.method;
  if(path==='/api/billing/webhook'&&method==='POST'){if(!billing.webhook)throw new APIError(503,'BILLING_UNAVAILABLE','Stripe is not configured.');await billing.webhook(await req.text(),req.headers.get('stripe-signature')||'');return json({received:true});}
  const playback=path.match(/^\/api\/playback\/([a-f0-9]{64})(\/video)?$/);
  if(playback&&['GET','HEAD'].includes(method)){rateLimit(db,`video-view:${tokenHash(ip,config.pepper)}`,120,clock().getTime(),60000);return recordings.public(req,playback[1],!!playback[2]);}
  if(path==='/api/plans'&&method==='GET')return json({plans:config.plans,proPriceCents:config.priceCents,currency:config.currency,mockBilling:!billing.mode&&config.mockBilling,billingMode:billing.mode||'mock',authMode:config.authMode,aiMode:config.aiMode});
  if(config.authMode==='clerk'&&path.startsWith('/api/auth/'))throw new APIError(410,'CLERK_AUTH_REQUIRED','Use Clerk to manage your account.');
  if(path.startsWith('/api/auth/')&&method==='POST')rateLimit(db,`auth:ip:${ip}`,25,clock().getTime());
  if(path==='/api/auth/signup'&&method==='POST'){
   const data=signup.parse(await body(req));const hash=await hashPassword(data.password),id=randomUUID();
   if(one(db,'SELECT 1 FROM users WHERE email=?',data.email))throw new APIError(409,'ACCOUNT_EXISTS','An account with this email already exists. Try logging in or resetting your password.');
   db.transaction(()=>{db.prepare('INSERT INTO users (id,email,name,password_hash,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(id,data.email,data.name||null,hash,now(),now());db.prepare("INSERT INTO subscriptions VALUES (?,'none',NULL,NULL,'FREE','free',NULL,NULL,0,?)").run(id,now());}).immediate();
   track('user_signed_up',id);if(data.client==='extension')return json({user:publicUser(one<User>(db,'SELECT * FROM users WHERE id=?',id)!),token:issue(id,'extension')},201);return json({user:publicUser(one<User>(db,'SELECT * FROM users WHERE id=?',id)!)},201,{'Set-Cookie':cookie(issue(id,'web'))});
  }
  if(path==='/api/auth/login'&&method==='POST'){
   const data=z.object({email,password:z.string().min(1).max(128),client:z.literal('extension').optional()}).strict().parse(await body(req));rateLimit(db,`auth:email:${tokenHash(data.email,config.pepper)}`,10,clock().getTime());
   const u=one<User>(db,'SELECT * FROM users WHERE email=?',data.email);
   // Run the KDF for missing accounts too, keeping the error uniform.
   const valid=u?await checkPassword(data.password,u.password_hash):(await hashPassword(data.password),false);
   if(!valid||!u||one<{password_hash:string}>(db,'SELECT password_hash FROM users WHERE id=?',u.id)?.password_hash!==u.password_hash)throw new APIError(401,'INVALID_CREDENTIALS','Email or password is incorrect.');
   track('user_logged_in',u.id);if(data.client==='extension')return json({user:publicUser(u),token:issue(u.id,'extension')});return json({user:publicUser(u)},200,{'Set-Cookie':cookie(issue(u.id,'web'))});
  }
  if(path==='/api/auth/forgot-password'&&method==='POST'){
   const data=z.object({email}).strict().parse(await body(req));rateLimit(db,`reset:${tokenHash(data.email,config.pepper)}`,3,clock().getTime());const u=one<User>(db,'SELECT * FROM users WHERE email=?',data.email);
   if(u){const token=secret();db.transaction(()=>{db.prepare('DELETE FROM password_resets WHERE user_id=?').run(u.id);db.prepare('INSERT INTO password_resets VALUES (?,?,?)').run(tokenHash(token,config.pepper),u.id,new Date(clock().getTime()+1800000).toISOString());}).immediate();try{await mail.reset(u.email,`${config.origin}/reset-password#token=${token}`);}catch{console.error(JSON.stringify({event:'reset_delivery_failed'}));}}
   return json({message:'If an account exists, a password reset email has been sent.'});
  }
  if(path==='/api/auth/reset-password'&&method==='POST'){
   const data=z.object({token:z.string().min(20).max(200),password}).strict().parse(await body(req));const hash=await hashPassword(data.password);
   db.transaction(()=>{const reset=one<{user_id:string}>(db,'SELECT user_id FROM password_resets WHERE token_hash=? AND expires_at>?',tokenHash(data.token,config.pepper),now());if(!reset)throw new APIError(400,'INVALID_RESET','This reset link is invalid or expired.');db.prepare('UPDATE users SET password_hash=?,updated_at=? WHERE id=?').run(hash,now(),reset.user_id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(reset.user_id);db.prepare('DELETE FROM password_resets WHERE user_id=?').run(reset.user_id);}).immediate();
   return json({message:'Password updated. Please log in.'},200,{'Set-Cookie':cookie('',true)});
  }
  if(path==='/api/ai/guest-plan'&&method==='POST'){rateLimit(db,`guest-request:${tokenHash(ip,config.pepper)}`,12,clock().getTime(),60000);const raw=await req.text();if(Buffer.byteLength(raw)>2400)throw new APIError(413,'BODY_TOO_LARGE','Free preview requests must be under 2.4 KB.');let data:unknown;try{data=JSON.parse(raw);}catch{throw new APIError(400,'INVALID_JSON','Invalid request.');}return json(await guestPlan(db,ai,config.pepper,ip,data,clock()));}
  const u=await user(req);
  if(path==='/api/recordings'&&method==='GET')return json({recordings:recordings.list(u.id)});
  if(path==='/api/recordings'&&method==='POST'){rateLimit(db,`video-upload:${u.id}`,5,clock().getTime(),60000);return json({recording:await recordings.create(u.id,req)},201);}
  const recording=path.match(/^\/api\/recordings\/([a-f0-9-]{36})$/);
  if(recording&&method==='DELETE'){recordings.revoke(u.id,recording[1]);return json({ok:true});}
  if(path==='/api/auth/logout'&&method==='POST'){db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash(credential(req).raw,config.pepper));return json({ok:true},200,{'Set-Cookie':cookie('',true)});}
  if(path==='/api/auth/token'&&method==='POST'){const data=z.object({password}).strict().parse(await body(req));if(!await checkPassword(data.password,u.password_hash))throw new APIError(401,'INVALID_CREDENTIALS','Password is incorrect.');return json({token:issue(u.id,'extension'),expiresIn:2592000});}
  if(path==='/api/auth/tokens'&&method==='DELETE'){db.prepare("DELETE FROM sessions WHERE user_id=? AND kind='extension'").run(u.id);return json({ok:true});}
  if(path==='/api/workflows'&&method==='GET')return json({workflows:workflows.list(u.id)});
  if(path==='/api/workflows'&&method==='POST')return json(workflows.save(u.id,await body(req)));
  if(path.startsWith('/api/workflows/')&&method==='GET')return json(workflows.read(u.id,decodeURIComponent(path.slice('/api/workflows/'.length))));
  if(path==='/api/me'&&method==='GET')return json({user:publicUser(u),entitlements:entitlements.get(u.id)});
  if(path==='/api/entitlements'&&method==='GET')return json(entitlements.get(u.id));
  if(path==='/api/usage'&&method==='GET')return json(entitlements.get(u.id).usage);
  if(path==='/api/prototypes'&&method==='GET')return json({prototypes:all<Prototype>(db,'SELECT * FROM prototypes WHERE user_id=? ORDER BY updated_at DESC',u.id).map(publicPrototype)});
  if(path==='/api/prototypes'&&method==='POST'){
   const data=metadata.parse(await body(req)),url=new URL(data.targetDomain);if(!['https:','http:'].includes(url.protocol))throw new APIError(400,'INVALID_TARGET','Use an http(s) target URL.');const id=randomUUID();
   const w=definition(data.definition||createWorkflow(url,data.name),url.origin,u.id);w.name=data.name;
   db.transaction(()=>{entitlements.requireCreate(u.id);db.prepare('INSERT INTO prototypes (id,user_id,name,description,target_domain,current_version,revision,created_at,updated_at) VALUES (?,?,?,?,?,0,1,?,?)').run(id,u.id,data.name,data.description,url.origin,now(),now());db.prepare('INSERT INTO prototype_definitions VALUES (?,?)').run(id,JSON.stringify(w));}).immediate();track('prototype_created',u.id);return json(publicPrototype(owned(u.id,id,true)),201);
  }
  const match=path.match(/^\/api\/prototypes\/([^/]+)(?:\/(duplicate|versions|restore)(?:\/(\d+))?)?$/);
  if(match){const [,id,action,version]=match;const p=owned(u.id,id,true);
   if(!action&&method==='GET')return json(publicPrototype(p));
   if(!action&&method==='DELETE'){db.prepare('DELETE FROM prototypes WHERE id=? AND user_id=?').run(id,u.id);return json({ok:true});}
   if(!action&&method==='PUT'){
    const data=update.parse(await body(req)),previous=JSON.parse(p.definition!);const w=data.definition?definition(data.definition,p.target_domain,u.id,previous):previous;w.name=data.name||p.name;
    db.transaction(()=>{const changed=db.prepare('UPDATE prototypes SET name=?,description=?,revision=revision+1,updated_at=? WHERE id=? AND user_id=? AND revision=?').run(data.name||p.name,data.description??p.description,now(),id,u.id,data.revision);if(!changed.changes)throw new APIError(409,'REVISION_CONFLICT','A newer save exists. Reload this prototype before saving.');db.prepare('UPDATE prototype_definitions SET definition=? WHERE prototype_id=?').run(JSON.stringify(w),id);}).immediate();track('prototype_saved',u.id);return json(publicPrototype(owned(u.id,id,true)));
   }
   if(action==='duplicate'&&method==='POST'){
    const copyId=randomUUID(),w=definition(JSON.parse(p.definition!),p.target_domain,u.id);w.id=randomUUID();w.name=`${p.name.slice(0,290)} — copy`;w.createdAt=now();w.updatedAt=now();
    db.transaction(()=>{entitlements.requireCreate(u.id);db.prepare('INSERT INTO prototypes (id,user_id,name,description,target_domain,current_version,revision,created_at,updated_at) VALUES (?,?,?,?,?,0,1,?,?)').run(copyId,u.id,w.name,p.description,p.target_domain,now(),now());db.prepare('INSERT INTO prototype_definitions VALUES (?,?)').run(copyId,JSON.stringify(w));}).immediate();track('prototype_created',u.id,{duplicated:true});return json(publicPrototype(owned(u.id,copyId,true)),201);
   }
   if(action==='versions'&&method==='POST'){
    const expected=z.object({revision:z.number().int().positive()}).strict().parse(await body(req));
    db.transaction(()=>{const latest=owned(u.id,id,true);if(latest.revision!==expected.revision)throw new APIError(409,'REVISION_CONFLICT','Reload before saving this version.');const limit=entitlements.get(u.id).limits.savedVersions;const count=one<{n:number}>(db,'SELECT count(*) n FROM prototype_versions WHERE prototype_id=?',id)!.n;if(limit!==null&&count>=limit)throw new APIError(403,'VERSION_LIMIT_REACHED',`Your plan allows ${limit} saved versions.`,{upgradeUrl:'/pricing'});
    const next=latest.current_version+1;db.prepare('INSERT INTO prototype_versions VALUES (?,?,?,?)').run(id,next,latest.definition,now());db.prepare('UPDATE prototypes SET current_version=?,revision=revision+1,updated_at=? WHERE id=?').run(next,now(),id);}).immediate();return json(publicPrototype(owned(u.id,id,true)),201);
   }
   if(action==='versions'&&method==='GET'){entitlements.requireHistory(u.id);return json({versions:all(db,'SELECT version,created_at AS createdAt FROM prototype_versions WHERE prototype_id=? ORDER BY version DESC',id)});}
   if(action==='restore'&&method==='POST'&&version){entitlements.requireHistory(u.id);const data=z.object({revision:z.number().int().positive()}).strict().parse(await body(req));const v=one<{definition:string}>(db,'SELECT definition FROM prototype_versions WHERE prototype_id=? AND version=?',id,Number(version));if(!v)throw new APIError(404,'NOT_FOUND','Version not found.');
    db.transaction(()=>{const changed=db.prepare('UPDATE prototypes SET revision=revision+1,updated_at=? WHERE id=? AND revision=?').run(now(),id,data.revision);if(!changed.changes)throw new APIError(409,'REVISION_CONFLICT','Reload before restoring.');db.prepare('UPDATE prototype_definitions SET definition=? WHERE prototype_id=?').run(v.definition,id);}).immediate();return json(publicPrototype(owned(u.id,id,true)));}
  }
  if(path==='/api/ai/plan'&&method==='POST'){
   rateLimit(db,`ai:${u.id}`,10,clock().getTime(),60000);
   const data=z.object({prompt:z.string().trim().min(1).max(2000),selection:z.object({tag:z.string().max(40),label:z.string().max(300)}).strict(),requestId:z.string().min(8).max(100)}).strict().parse(await body(req));
   const fingerprint=createHash('sha256').update(JSON.stringify({prompt:data.prompt,selection:data.selection})).digest('hex'),actionId=randomUUID();
   let cached:unknown;
   try{db.transaction(()=>{const old=one<{status:string;fingerprint:string;result:string}>(db,'SELECT * FROM ai_actions WHERE user_id=? AND request_key=?',u.id,data.requestId);if(old){if(old.fingerprint!==fingerprint)throw new APIError(409,'IDEMPOTENCY_CONFLICT','Use a new request ID for a different prompt.');if(old.status==='succeeded'){cached=JSON.parse(old.result);return;}throw new APIError(409,'REQUEST_ALREADY_EXISTS','This request is pending or failed. For a retry, use a new request ID.');}
    entitlements.requireAI(u.id);const usage=entitlements.get(u.id).usage;db.prepare('INSERT INTO ai_actions VALUES (?,?,?,?,?,?,\'pending\',NULL,?,?)').run(actionId,u.id,data.requestId,fingerprint,usage.periodStart,usage.resetsAt,now(),now());}).immediate();}catch(e){if(e instanceof APIError&&e.code==='AI_LIMIT_REACHED')track('ai_limit_reached',u.id);throw e;}
   if(cached)return json({plan:cached,usage:entitlements.get(u.id).usage});track('ai_edit_requested',u.id);
   try{const plan=BatchSchema.parse(await ai.plan({prompt:data.prompt,selection:data.selection}));db.prepare("UPDATE ai_actions SET status='succeeded',result=?,updated_at=? WHERE id=?").run(JSON.stringify(plan),now(),actionId);return json({plan,usage:entitlements.get(u.id).usage});}
   catch(error){db.prepare("UPDATE ai_actions SET status='failed',updated_at=? WHERE id=?").run(now(),actionId);if(error instanceof AIProviderError){console.warn(JSON.stringify({event:'ai_request_failed',code:error.code}));throw new APIError(503,error.code,error.message+' No edit was charged.');}throw new APIError(502,'AI_UNAVAILABLE','AI could not complete the request. No edit was charged. Please retry.');}
  }
  if(path==='/api/billing'&&method==='GET')return json({subscription:entitlements.subscription(u.id),entitlements:entitlements.get(u.id),priceCents:config.priceCents,currency:config.currency,mock:!billing.mode&&config.mockBilling,billingMode:billing.mode||'mock'});
  if(path==='/api/billing/checkout'&&method==='POST'){rateLimit(db,`checkout:${u.id}`,10,clock().getTime());if(entitlements.get(u.id).plan==='PRO')throw new APIError(409,'ALREADY_SUBSCRIBED','You already have Pro.');track('upgrade_clicked',u.id);const checkout=await billing.start(u.id);track('checkout_started',u.id);return json(checkout,201);}
  const checkout=path.match(/^\/api\/billing\/checkout\/([^/]+)(\/complete)?$/);
  if(checkout){const c=one<Checkout>(db,'SELECT * FROM checkouts WHERE id=? AND user_id=?',checkout[1],u.id);if(!c)throw new APIError(404,'NOT_FOUND','Checkout not found.');if(method==='GET'&&!checkout[2])return json({id:c.id,status:c.status,priceCents:c.price_cents,currency:c.currency,expiresAt:c.expires_at,mock:c.provider==='mock'});
   if(method==='POST'&&checkout[2]){z.object({confirmTestPurchase:z.literal(true)}).strict().parse(await body(req));if(await billing.complete(u.id,c.id))track('subscription_started',u.id);return json({entitlements:entitlements.get(u.id),redirect:'/account/billing?success=1'});}
  }
  if(path==='/api/billing/cancel'&&method==='POST'){await billing.cancelAtPeriodEnd(u.id);track('subscription_canceled',u.id);return json({subscription:entitlements.subscription(u.id),entitlements:entitlements.get(u.id)});}
  if(path==='/api/billing/portal'&&method==='POST')return json(await billing.manage(u.id));
  throw new APIError(404,'NOT_FOUND','Endpoint not found.');
 }
 return {entitlements,async handle(req:Request,ip='local'):Promise<Response>{const requestId=randomUUID(),origin=req.headers.get('origin'),allowed=origin===config.origin||!!origin&&(config.extensionOrigins.includes(origin)||!config.production&&/^chrome-extension:\/\/[a-p]{32}$/.test(origin));let response:Response;
  try{
   if(origin&&!allowed)throw new APIError(403,'ORIGIN_DENIED','This origin is not allowed.');
   if(req.method==='OPTIONS'){if(!allowed)throw new APIError(403,'ORIGIN_DENIED','This origin is not allowed.');response=new Response(null,{status:204});}
   else {if(!['GET','HEAD'].includes(req.method)&&!req.headers.get('authorization')&&!allowed&&new URL(req.url).pathname!=='/api/billing/webhook')throw new APIError(403,'CSRF_REJECTED','A trusted Origin header is required.');response=await route(req,ip);}
  }catch(error){if(error instanceof APIError)response=json({error:{code:error.code,message:error.message,...error.details},requestId},error.status,error.status===429?{'Retry-After':String(error.details.retryAfter||60)}:{});else if(error instanceof z.ZodError)response=json({error:{code:'INVALID_INPUT',message:'Check the request fields.',fields:error.issues.map(x=>({path:x.path.join('.'),message:x.message}))},requestId},400);else{console.error(JSON.stringify({requestId,error:'unhandled_api_error'}));response=json({error:{code:'INTERNAL_ERROR',message:'Something went wrong. Please retry.'},requestId},500);}}
  response.headers.set('X-Request-Id',requestId);response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('Referrer-Policy','no-referrer');if(allowed&&origin){response.headers.set('Access-Control-Allow-Origin',origin);response.headers.set('Access-Control-Allow-Credentials','true');response.headers.set('Vary','Origin');response.headers.set('Access-Control-Allow-Headers','Content-Type, Authorization');response.headers.set('Access-Control-Allow-Methods','GET, POST, PUT, DELETE, OPTIONS');}
  console.info(JSON.stringify({requestId,method:req.method,path:new URL(req.url).pathname.replace(/^(\/api\/playback\/)[^/]+/,'$1[redacted]'),status:response.status}));return response;
 }};
}
