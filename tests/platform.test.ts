import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {database,type DB} from '../platform/server/db';
import {createPlatform} from '../platform/server/app';
import {configuration} from '../platform/server/config';
import {MockAIProvider,type AIProvider} from '../platform/server/providers';
import {createWorkflow,addCapturedScreen} from '../extension/prototype/engine';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
let db:DB,app:ReturnType<typeof createPlatform>,now:Date,resetURL:string,provider:AIProvider;
let cfg:ReturnType<typeof configuration>;
beforeEach(()=>{vi.spyOn(console,'info').mockImplementation(()=>{});db=database(':memory:');now=new Date('2026-10-03T12:00:00Z');resetURL='';provider=new MockAIProvider();cfg=configuration({WANDEL_AI_MODE:'mock',WANDEL_AUTH_MODE:'legacy'},'test-pepper-with-at-least-32-characters');cfg.plans.FREE.aiActionsPerMonth=2;app=createPlatform({db,config:cfg,clock:()=>now,ai:provider,mail:{reset:async(_email,url)=>{resetURL=url;}}});});
afterEach(()=>{db.close();vi.restoreAllMocks();});
async function request(path:string,method='GET',data?:unknown,cookie?:string,extra:Record<string,string>={}){const response=await app.handle(new Request('http://localhost'+path,{method,headers:{Origin:cfg.origin,...(cookie?{Cookie:cookie}:{}),...extra},...(data?{body:JSON.stringify(data)}:{})}));return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0],headers:response.headers};}
async function signup(email='free@example.com'){const r=await request('/api/auth/signup','POST',{email,password:'correct horse battery',name:'Alex'});expect(r.status).toBe(201);return r.cookie!;}
async function create(cookie:string,name='Risk analysis'){return request('/api/prototypes','POST',{name,targetDomain:'https://example.com/customers'},cookie);}
async function pro(cookie:string){const c=await request('/api/billing/checkout','POST',{},cookie);expect(c.status).toBe(201);const r=await request(`/api/billing/checkout/${c.body.id}/complete`,'POST',{confirmTestPurchase:true},cookie);expect(r.status).toBe(200);return c.body.id;}
it('creates a free account, stores hashed credentials, persists a session, and logs out',async()=>{
 const cookie=await signup();expect((await request('/api/me','GET',undefined,cookie)).body.entitlements.plan).toBe('FREE');
 const row=db.prepare('SELECT * FROM users').get() as any;expect(row.password_hash).toMatch(/^scrypt\$/);expect(row.password_hash).not.toContain('correct horse');expect((db.prepare('SELECT token_hash FROM sessions').get() as any).token_hash).not.toBe(cookie.split('=')[1]);
 expect((await request('/api/auth/logout','POST',{},cookie)).status).toBe(200);expect((await request('/api/me','GET',undefined,cookie)).status).toBe(401);
 expect((await request('/api/auth/login','POST',{email:'FREE@example.com',password:'correct horse battery'})).status).toBe(200);
});
it('enforces ownership for reading, changing, copying, restoring and deleting',async()=>{
 const a=await signup(),b=await signup('other@example.com'),p=(await create(a)).body;
 for(const [suffix,method,data] of [['','GET',undefined],['','PUT',{revision:1,name:'Stolen'}],['','DELETE',undefined],['/duplicate','POST',{}],['/versions','POST',{revision:1}],['/restore/1','POST',{revision:1}]] as const){expect((await request('/api/prototypes/'+p.id+suffix,method,data,b)).status).toBe(404);}
 expect((await request('/api/prototypes','GET',undefined,b)).body.prototypes).toHaveLength(0);
});
it('enforces create and duplicate limits through direct API calls; deletion frees a slot',async()=>{
 const cookie=await signup();const first=(await create(cookie)).body;
 await create(cookie);await create(cookie);expect((await create(cookie)).body.error.code).toBe('WORKFLOW_LIMIT_REACHED');
 expect((await request('/api/prototypes/'+first.id+'/duplicate','POST',{},cookie)).body.error.code).toBe('WORKFLOW_LIMIT_REACHED');
 await request('/api/prototypes/'+first.id,'DELETE',undefined,cookie);expect((await create(cookie)).status).toBe(201);
});
it('saves definitions, prevents lost updates, and gates version history independently of drafts',async()=>{
 const cookie=await signup();let p=(await create(cookie)).body;
 p=(await request('/api/prototypes/'+p.id,'PUT',{name:'Updated',revision:p.revision},cookie)).body;expect(p.name).toBe('Updated');
 expect((await request('/api/prototypes/'+p.id,'PUT',{name:'Old tab',revision:1},cookie)).body.error.code).toBe('REVISION_CONFLICT');
 for(let i=0;i<3;i++)p=(await request('/api/prototypes/'+p.id+'/versions','POST',{revision:p.revision},cookie)).body;
 expect((await request('/api/prototypes/'+p.id+'/versions','POST',{revision:p.revision},cookie)).body.error.code).toBe('VERSION_LIMIT_REACHED');
 expect((await request('/api/prototypes/'+p.id+'/versions','GET',undefined,cookie)).body.error.code).toBe('PRO_REQUIRED');
 await pro(cookie);expect((await request('/api/prototypes/'+p.id+'/versions','GET',undefined,cookie)).body.versions).toHaveLength(3);
 expect((await request('/api/prototypes/'+p.id+'/restore/1','POST',{revision:p.revision},cookie)).status).toBe(200);
});
it('checks AI auth, monthly quota, idempotency and reset month on direct API calls',async()=>{
 const cookie=await signup();const edit={prompt:'Add a next button',selection:{tag:'button',label:'Continue'},requestId:randomUUID()};
 expect((await request('/api/ai/plan','POST',edit)).status).toBe(401);
 expect((await request('/api/ai/plan','POST',edit,cookie)).status).toBe(200);
 expect((await request('/api/ai/plan','POST',edit,cookie)).body.usage.used).toBe(1);
 expect((await request('/api/ai/plan','POST',{...edit,prompt:'Different'},cookie)).body.error.code).toBe('IDEMPOTENCY_CONFLICT');
 await request('/api/ai/plan','POST',{...edit,requestId:randomUUID()},cookie);
 expect((await request('/api/ai/plan','POST',{...edit,requestId:randomUUID()},cookie)).body.error.code).toBe('AI_LIMIT_REACHED');
 now=new Date('2026-11-01T00:00:00Z');expect((await request('/api/usage','GET',undefined,cookie)).body.used).toBe(0);
});
it('reserves AI quota atomically for concurrent requests and refunds failures',async()=>{
 const cookie=await signup();cfg.plans.FREE.aiActionsPerMonth=1;let release:(x:unknown)=>void=()=>{};
 vi.spyOn(provider,'plan').mockImplementation(()=>new Promise(resolve=>{release=resolve;}));const edit={prompt:'Next',selection:{tag:'button',label:'Continue'},requestId:randomUUID()};
 const pending=request('/api/ai/plan','POST',edit,cookie);await new Promise(r=>setTimeout(r,0));
 expect((await request('/api/ai/plan','POST',{...edit,requestId:randomUUID()},cookie)).body.error.code).toBe('AI_LIMIT_REACHED');release({invalid:true});expect((await pending).status).toBe(502);expect((await request('/api/usage','GET',undefined,cookie)).body.used).toBe(0);
});
it('upgrades via an owned mock checkout, handles repeated completion, and unlocks immediately',async()=>{
 const cookie=await signup(),other=await signup('other@example.com');const c=(await request('/api/billing/checkout','POST',{},cookie)).body;
 expect((await request(`/api/billing/checkout/${c.id}/complete`,'POST',{confirmTestPurchase:true},other)).status).toBe(404);
 expect((await request(`/api/billing/checkout/${c.id}/complete`,'POST',{confirmTestPurchase:true,card:'4242424242424242'},cookie)).status).toBe(400);
 await request(`/api/billing/checkout/${c.id}/complete`,'POST',{confirmTestPurchase:true},cookie);const billing=(await request('/api/billing','GET',undefined,cookie)).body;
 expect(billing.entitlements.capabilities.canUseVersionHistory).toBe(true);
 await request(`/api/billing/checkout/${c.id}/complete`,'POST',{confirmTestPurchase:true},cookie);expect((await request('/api/billing','GET',undefined,cookie)).body.subscription.current_period_end).toBe(billing.subscription.current_period_end);
 expect((db.prepare("SELECT count(*) n FROM analytics_events WHERE name='subscription_started'").get() as any).n).toBe(1);
});
it('preserves Pro access until cancellation expiry, retains excess workflows, and blocks new ones',async()=>{
 const cookie=await signup();await pro(cookie);for(let i=0;i<5;i++)await create(cookie);
 await request('/api/billing/cancel','POST',{},cookie);expect((await request('/api/entitlements','GET',undefined,cookie)).body.plan).toBe('PRO');
 now=new Date('2026-11-04T12:00:00Z');const login=await request('/api/auth/login','POST',{email:'free@example.com',password:'correct horse battery'});const renewed=login.cookie!;
 expect((await request('/api/entitlements','GET',undefined,renewed)).body.plan).toBe('FREE');expect((await request('/api/prototypes','GET',undefined,renewed)).body.prototypes).toHaveLength(5);
 expect((await create(renewed)).body.error.code).toBe('WORKFLOW_LIMIT_REACHED');const p=(await request('/api/prototypes','GET',undefined,renewed)).body.prototypes[0];expect((await request('/api/prototypes/'+p.id,'PUT',{revision:p.revision,name:'Still editable'},renewed)).status).toBe(200);
});
it('requires a valid single-use reset token and revokes old sessions',async()=>{
 const cookie=await signup();const forgotten=await request('/api/auth/forgot-password','POST',{email:'free@example.com'});expect(forgotten.body).not.toHaveProperty('token');const token=new URLSearchParams(new URL(resetURL).hash.slice(1)).get('token');
 expect((await request('/api/auth/reset-password','POST',{token,password:'new secure password'})).status).toBe(200);expect((await request('/api/me','GET',undefined,cookie)).status).toBe(401);
 expect((await request('/api/auth/reset-password','POST',{token,password:'another password'})).body.error.code).toBe('INVALID_RESET');expect((await request('/api/auth/login','POST',{email:'free@example.com',password:'new secure password'})).status).toBe(200);
});
it('enforces origins, extension token kind, expiration, and revocation',async()=>{
 const cookie=await signup();expect((await request('/api/prototypes','POST',{name:'Bad',targetDomain:'https://example.com'},cookie,{Origin:'https://evil.example'})).status).toBe(403);
 const issued=await request('/api/auth/token','POST',{password:'correct horse battery'},cookie);const auth={Authorization:'Bearer '+issued.body.token};expect((await request('/api/me','GET',undefined,undefined,auth)).status).toBe(200);
 expect((await request('/api/me','GET',undefined,undefined,{Authorization:'Bearer '+cookie.split('=')[1]})).status).toBe(401);
 await request('/api/auth/tokens','DELETE',undefined,cookie);expect((await request('/api/me','GET',undefined,undefined,auth)).status).toBe(401);
});
it('enforces auth rate limiting and rejects untrusted requests without Origin',async()=>{
 const denied=await app.handle(new Request('http://localhost/api/auth/signup',{method:'POST',body:'{}'}));expect(denied.status).toBe(403);
 for(let i=0;i<25;i++)await request('/api/auth/login','POST',{});
 expect((await request('/api/auth/login','POST',{})).body.error.code).toBe('RATE_LIMITED');
});
it('enforces depth without counting siblings as additional steps',async()=>{
 const cookie=await signup(),w=createWorkflow(new URL('https://example.com'));for(let i=0;i<6;i++)w.states.push({id:'state-'+i,parent:w.entry,title:'Branch',view:'panel',operations:[]});expect((await request('/api/prototypes','POST',{name:'Branches',targetDomain:'https://example.com',definition:w},cookie)).status).toBe(201);
 for(let i=0;i<6;i++)w.states[i+1].parent=i===0?w.entry:w.states[i].id;
 expect((await request('/api/prototypes','POST',{name:'Too deep',targetDomain:'https://example.com',definition:w},cookie)).body.error.code).toBe('DEPTH_LIMIT_REACHED');
});
it('cannot enable mock billing in production',()=>{expect(()=>configuration({NODE_ENV:'production',WANDEL_MOCK_BILLING:'true',SESSION_PEPPER:'long-enough-secret-with-at-least-32-characters',WANDEL_APP_ORIGIN:'https://example.com'},'long-enough-secret-with-at-least-32-characters')).toThrow('Mock billing');});

it('persists sessions and workflow definitions across a database reopen',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wandel-persistence-'));let disk=database(join(dir,'test.sqlite'));
 try{
 app=createPlatform({db:disk,config:cfg,clock:()=>now,ai:provider,mail:{reset:async()=>{}}});
 const cookie=await signup('durable@example.com');const p=(await create(cookie,'Durable flow')).body;
 disk.close();disk=database(join(dir,'test.sqlite'));
 app=createPlatform({db:disk,config:cfg,clock:()=>now,ai:provider,mail:{reset:async()=>{}}});
 expect((await request('/api/me','GET',undefined,cookie)).status).toBe(200);
 const restored=await request('/api/prototypes/'+p.id,'GET',undefined,cookie);expect(restored.body.name).toBe('Durable flow');expect(restored.body.definition.states).toHaveLength(1);
 expect((disk.prepare('SELECT count(*) n FROM schema_migrations').get() as any).n).toBe(3);
 }finally{disk.close();rmSync(dir,{recursive:true,force:true});}
});
it('rejects malformed workflow graphs with useful validation errors',async()=>{
 const cookie=await signup(),w=createWorkflow(new URL('https://example.com'));w.states[0].parent='missing';
 const r=await request('/api/prototypes','POST',{name:'Broken',targetDomain:'https://example.com',definition:w},cookie);expect(r.status).toBe(400);expect(r.body.error.code).toBe('INVALID_DEFINITION');
});
it('supports extension sign-up, billing and logout without web cookies',async()=>{
 const origin='chrome-extension://'+'a'.repeat(32);
 const account=await request('/api/auth/signup','POST',{email:'extension@example.com',password:'correct horse battery',client:'extension'},undefined,{Origin:origin});
 expect(account.status).toBe(201);expect(account.cookie).toBeUndefined();expect(account.body.token).toBeTruthy();
 const headers={Origin:origin,Authorization:`Bearer ${account.body.token}`};
 const checkout=await request('/api/billing/checkout','POST',{},undefined,headers);expect(checkout.status).toBe(201);
 expect((await request(`/api/billing/checkout/${checkout.body.id}/complete`,'POST',{confirmTestPurchase:true},undefined,headers)).body.entitlements.plan).toBe('PRO');
 expect((await request('/api/billing','GET',undefined,undefined,headers)).body.entitlements.plan).toBe('PRO');
 await request('/api/auth/logout','POST',{},undefined,headers);
 expect((await request('/api/me','GET',undefined,undefined,headers)).status).toBe(401);
 const login=await request('/api/auth/login','POST',{email:'extension@example.com',password:'correct horse battery',client:'extension'},undefined,{Origin:origin});expect(login.status).toBe(200);expect(login.body.token).toBeTruthy();
 cfg.production=true;
 expect((await request('/api/auth/login','POST',{email:'extension@example.com',password:'correct horse battery',client:'extension'},undefined,{Origin:origin})).status).toBe(403);
});
it('saves complete workflows atomically, deduplicates retries, and rejects stale cross-browser saves',async()=>{
 const cookie=await signup(),workflow=createWorkflow(new URL('https://example.com/customers'),'Risk Analysis');
 const payload={workflow,revision:null,requestId:randomUUID()};
 const saved=await request('/api/workflows','POST',payload,cookie);expect(saved.status).toBe(200);expect(saved.body.record.currentVersion).toBe(1);
 expect((await request('/api/workflows','POST',payload,cookie)).body.record.currentVersion).toBe(1);
 const secondBrowser=await request('/api/auth/login','POST',{email:'free@example.com',password:'correct horse battery'});
 expect((await request('/api/workflows/'+workflow.id,'GET',undefined,secondBrowser.cookie)).body.record.draft).toEqual(workflow);
 const changed=structuredClone(workflow);changed.name='Risk Analysis v2';
 const next=await request('/api/workflows','POST',{workflow:changed,revision:1,requestId:randomUUID()},secondBrowser.cookie);expect(next.body.record.currentVersion).toBe(2);
 expect((await request('/api/workflows','POST',{workflow,revision:1,requestId:randomUUID()},cookie)).body.error.code).toBe('REVISION_CONFLICT');
 const other=await signup('other@example.com');expect((await request('/api/workflows/'+workflow.id,'GET',undefined,other)).status).toBe(404);
 expect((await request('/api/workflows','GET',undefined,other)).body.workflows).toEqual([]);
 expect((db.prepare('SELECT count(*) n FROM prototype_versions').get() as any).n).toBe(2);
});
it('checks depth and version limits only on save and leaves the previous save unchanged',async()=>{
 const cookie=await signup(),workflow=createWorkflow(new URL('https://example.com'));
 let revision:null|number=null;
 for(let i=0;i<3;i++){const result=await request('/api/workflows','POST',{workflow,revision,requestId:randomUUID()},cookie);expect(result.status).toBe(200);revision=result.body.revision;}
 const blocked=await request('/api/workflows','POST',{workflow,revision,requestId:randomUUID()},cookie);expect(blocked.body.error.code).toBe('VERSION_LIMIT_REACHED');expect((await request('/api/workflows/'+workflow.id,'GET',undefined,cookie)).body.revision).toBe(3);
 const deep=createWorkflow(new URL('https://example.com'));for(let i=0;i<6;i++)deep.states.push({id:'step-'+i,title:'Step',view:'panel',parent:deep.states.at(-1)!.id,operations:[]});
 expect((await request('/api/workflows','POST',{workflow:deep,revision:null,requestId:randomUUID()},cookie)).body.error.code).toBe('DEPTH_LIMIT_REACHED');
 expect((db.prepare('SELECT count(*) n FROM prototypes').get() as any).n).toBe(1);
 await pro(cookie);
 expect((await request('/api/workflows','POST',{workflow:deep,revision:null,requestId:randomUUID()},cookie)).status).toBe(200);
 expect((await request('/api/workflows','POST',{workflow,revision:3,requestId:randomUUID()},cookie)).body.record.versions).toHaveLength(4);
});
it('uses a verified Clerk subject, isolates accounts, and disables legacy auth in Clerk mode',async()=>{
 cfg.authMode='clerk';
 const {APIError}=await import('../platform/server/security');
 app=createPlatform({db,config:cfg,ai:provider,mail:{reset:async()=>{}},identity:{verify:async token=>{if(token==='clerk-a')return {subject:'user_a',email:'a@clerk.test',name:'A'};if(token==='clerk-b')return {subject:'user_b',email:'b@clerk.test',name:'B'};throw new APIError(401,'AUTH_REQUIRED','Invalid token');}}});
 const a={Authorization:'Bearer clerk-a'},b={Authorization:'Bearer clerk-b'};
 const me=await request('/api/me','GET',undefined,undefined,a);expect(me.status).toBe(200);expect(me.body.entitlements.plan).toBe('FREE');
 expect((await request('/api/me','GET',undefined,undefined,{Authorization:'Bearer forged'})).status).toBe(401);
 expect((await request('/api/auth/login','POST',{email:'a@clerk.test',password:'whatever'})).status).toBe(410);
 const workflow=createWorkflow(new URL('https://example.com'));
 expect((await request('/api/workflows','POST',{workflow,revision:null,requestId:randomUUID()},undefined,a)).status).toBe(200);
 expect((await request('/api/workflows/'+workflow.id,'GET',undefined,undefined,b)).status).toBe(404);
 expect((await request('/api/me','GET',undefined,undefined,a)).body.user.id).toBe(me.body.user.id);
 expect((db.prepare('SELECT count(*) n FROM users').get() as any).n).toBe(2);
});

it('returns and caches a complete connected flow through the authenticated AI endpoint',async()=>{
 const flow={name:'Risk review',entryLabel:'Review risk',screens:[{title:'Details',body:'Review the example.',fields:['Reason'],actionLabel:'Approve'},{title:'Approved',body:'Prototype complete.',fields:[],actionLabel:null}]};
 const plan=vi.spyOn(provider,'plan').mockResolvedValue({steps:[],flow});const cookie=await signup();
 const input={prompt:'Build a review flow',selection:{tag:'button',label:'Customers'},requestId:randomUUID()};
 const first=await request('/api/ai/plan','POST',input,cookie);expect(first.status).toBe(200);expect(first.body.plan.flow).toEqual(flow);
 const second=await request('/api/ai/plan','POST',input,cookie);expect(second.body.plan).toEqual(first.body.plan);expect(plan).toHaveBeenCalledTimes(1);expect(second.body.usage.used).toBe(1);
});

it('allows two bounded guest requests through HTTP without account auth and rejects untrusted origins',async()=>{
 const guestId=randomUUID(),input={guestId,requestId:randomUUID(),prompt:'Add a button beside this',selection:{tag:'button',label:'Customers'}};
 expect((await request('/api/ai/guest-plan','POST',input,undefined,{Origin:'https://untrusted.example'})).status).toBe(403);
 expect((await request('/api/ai/guest-plan','POST',input)).body.remaining).toBe(1);
 expect((await request('/api/ai/guest-plan','POST',{...input,requestId:randomUUID()})).body.remaining).toBe(0);
 expect((await request('/api/ai/guest-plan','POST',{...input,requestId:randomUUID()})).body.error.code).toBe('GUEST_LIMIT');
});
it('persists conditional connections and fallback views through the workflow API',async()=>{
 const cookie=await signup(),workflow=createWorkflow(new URL('https://example.com/signup'),'Conditional signup'),to=randomUUID(),source=randomUUID();
 const locator=(tag:string,name:string,id:string)=>({tag,role:'',name,text:'',attrs:{id},parent:{tag:'main',id:'',role:'',label:''},previous:'',next:''});
 workflow.states[0].operations.push({id:randomUUID(),kind:'trigger',target:locator('button','Continue','continue'),source});workflow.states.push({id:to,title:'Account details',parent:workflow.entry,view:'panel',operations:[]});
 workflow.edges.push({id:randomUUID(),from:workflow.entry,source,to,event:'click',conditions:[{target:locator('input','Terms','terms'),test:'checked'},{target:locator('input','Email','email'),test:'valid'}],otherwise:workflow.entry});
 const saved=await request('/api/workflows','POST',{workflow,revision:null,requestId:randomUUID()},cookie);expect(saved.status).toBe(200);const restored=await request('/api/workflows/'+workflow.id,'GET',undefined,cookie);expect(restored.body.record.draft.edges).toEqual(workflow.edges);
});

it('retains captured route metadata, thumbnails and editable content through cloud save and load',async()=>{
 const cookie=await signup(),base=createWorkflow(new URL('https://example.com/start'));
 const screen={id:randomUUID(),url:'https://example.com/settings',route:'/settings',title:'Settings',thumbnail:'data:image/png;base64,aGVsbG8=',nodes:Array.from({length:180},(_,i)=>({id:randomUUID(),parent:i-1,tag:'div',text:'',style:{}})),capturedAt:new Date().toISOString(),truncated:false};
 const {workflow,stateId}=addCapturedScreen(base,base.entry,screen);const saved=await request('/api/workflows','POST',{workflow,revision:null,requestId:randomUUID()},cookie);expect(saved.status).toBe(200);const loaded=await request('/api/workflows/'+workflow.id,'GET',undefined,cookie);expect(loaded.body.record.draft.states.find((s:any)=>s.id===stateId)).toEqual(workflow.states.find(s=>s.id===stateId));
});
