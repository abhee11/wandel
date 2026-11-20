// @vitest-environment jsdom
// Opt-in, live AI: realistic designer requests on rendered copies of public websites (computed styles inlined, scripts removed).
// SITE_FILE names the captured page; SITE_PROMPTS is a JSON list of requests. Each request starts from a fresh copy of the page.
import {it,expect} from 'vitest';
import {readFileSync,writeFileSync} from 'node:fs';
import {database} from '../platform/server/db';
import {createPlatform} from '../platform/server/app';
import {configuration} from '../platform/server/config';
import {MockAIProvider} from '../platform/server/providers';
import {response,PageContextSchema} from '../extension/assistant/schema';
import {OpenAIAssistant} from '../platform/server/assistant';
import {Session} from '../extension/content/session';
import {Repository,BrowserStorage} from '../extension/storage/store';
import {normalizePlan,validatePlanReferences} from '../extension/assistant/plan';
import {resolveInspections} from '../extension/assistant/inspection';
import {continuesChat} from '../extension/assistant/stableRefs';
import {continueRequest,conversationHistory,type ChatTurn} from '../extension/assistant/conversation';
const live=process.env.WANDEL_RUN_DESIGNER_ACCEPTANCE==='1'&&!!process.env.SITE_FILE;
it.skipIf(!live)('handles realistic requests on a real site',async()=>{
 const raw=readFileSync(process.env.SITE_FILE!,'utf8'),url=raw.match(/^<!-- (\S+) -->/)?.[1]||'https://example.test/';
 const prompts:string[]=JSON.parse(process.env.SITE_PROMPTS||'[]');
 const env=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).flatMap(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);return m?[[m[1],m[2].trim().replace(/^['"]|['"]$/g,'')]]:[];}));
 const provider=new OpenAIAssistant(env.OPENAI_API_KEY,env.OPENAI_MODEL),db=database(':memory:');
 const config=configuration({WANDEL_AUTH_MODE:'legacy'},'verification-only-test-pepper-32-characters');
 const trace:any[]=[];const log=(x:any)=>{trace.push(x);writeFileSync(process.env.TRACE_OUT||'/dev/null',JSON.stringify(trace,null,2));};
 const app=createPlatform({db,config,ai:new MockAIProvider(),mail:{reset:async()=>{}},assistant:{transcribe:bytes=>provider.transcribe(bytes),plan:input=>provider.plan(input)}});
 const signup=await app.handle(new Request(config.origin+'/api/auth/signup',{method:'POST',headers:{Origin:config.origin,'Content-Type':'application/json'},body:JSON.stringify({email:'verification@example.test',password:'synthetic-test-password-123'})}));const cookie=signup.headers.get('set-cookie')!.split(';')[0];
 const rect=Element.prototype.getBoundingClientRect;Element.prototype.getBoundingClientRect=function(){return {x:0,y:0,top:0,left:0,right:120,bottom:32,width:120,height:32,toJSON(){}} as DOMRect;};
 const failures:string[]=[];
 try{for(const request of prompts){
  localStorage.clear();document.body.innerHTML=raw.replace(/^<!--.*?-->\n/,'');
  const root=document.querySelector<HTMLElement>('[data-site-root]')!;
  const session=new Session(root,new Repository(new BrowserStorage()),new URL(url),{assistantEnabled:true});
  const turns:ChatTurn[]=[];const started=Date.now();
  const cloud=async(instruction:string,context:any,extra:ChatTurn[]=[])=>{const chat=[...turns,...extra],fresh=!continuesChat(instruction,chat);const sent=fresh?PageContextSchema.parse({...context,workspace:undefined,recent:[],edits:[],lastCard:null,lastGroup:null}):context;
   const r=await app.handle(new Request(config.origin+'/api/assistant/plan',{method:'POST',headers:{Origin:config.origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({instruction,context:sent,history:fresh?[]:conversationHistory(chat),requestId:crypto.randomUUID(),steps:true})}));const d=await r.json();return r.ok?normalizePlan(d.plan):response('unsupported',JSON.stringify(d).slice(0,400));};
  const before=root.innerHTML;let error='',edits=0,autoSteps=0,clarifies=0,pending:string|null=null,value=request;const steps:any[]=[];
  try{
   await session.init();await session.dispatch({type:'edit'});
   for(let turn=0;turn<10&&value;turn++){
    const combined:string=pending?continueRequest(pending,value):value;pending=null;
    const t0=Date.now();let c=(await session.dispatch({type:'assistantContext',instruction:combined})).assistant!.context!;const contextMs=Date.now()-t0;
    let plan=await cloud(combined,c);
    if(plan.status==='inspect'){const r=await resolveInspections(plan,c,{active:()=>true,inspect:async refs=>{steps.push({turn,inspect:refs.map(ref=>c.elements.find(e=>e.ref===ref)?.name?.slice(0,60)||ref),why:plan.message.slice(0,300)});return (await session.dispatch({type:'assistantContext',inspect:refs,instruction:combined})).assistant!.context!;},replan:async(expanded,note)=>{const p=await cloud(combined,expanded,[{role:'assistant',text:note,status:'sent'}]);steps.push({turn,replan:p.status,message:p.message.slice(0,300),candidates:p.candidates.map(ref=>expanded.elements.find(e=>e.ref===ref)?.name?.slice(0,50)||ref)});return p;}});plan=r.plan;c=r.context;}
    if(plan.status==='open'&&plan.candidates[0]){const name=(c.elements.find(e=>e.ref===plan.candidates[0])?.name||'it').slice(0,60);await session.dispatch({type:'openControl',ref:plan.candidates[0]});await new Promise(r=>setTimeout(r,50));
     const reopened=combined+`\n(Wandel opened “${name}” so you can see what it shows. Continue the request on this screen; do not open anything else.)`;
     c=(await session.dispatch({type:'assistantContext',instruction:reopened})).assistant!.context!;plan=await cloud(reopened,c);}
    turns.push({role:'user',text:value,status:'sent'});
    const question=plan.status==='clarify'?(plan.question||plan.message):plan.status==='answer'&&plan.question?.trim()?plan.message+'\n\n'+plan.question:'';
    steps.push({turn,contextMs,elements:c.elements.length,status:plan.status,message:plan.message.slice(0,400),question:plan.question,next:plan.next,actions:plan.actions.map(a=>JSON.stringify({...a,html:(a as any).html?.slice(0,300),behavior:(a as any).behavior?'…':undefined}).slice(0,500))});
    if(question){turns.push({role:'assistant',text:question,status:'sent'});pending=combined;clarifies++;value=clarifies>2?'Just do it with your best judgment, no more questions':'Go with your recommendation';continue;}
    if(plan.status!=='edit'){if(!edits)error=plan.status+': '+plan.message.slice(0,300);break;}
    validatePlanReferences(plan,c.elements.map(e=>e.ref));
    try{await session.dispatch({type:'assistantApply',token:c.token,plan});edits++;}catch(e){const m=(e as Error).message;steps.push({turn,applyError:m});if(/^Preview kept/.test(m))edits++;else{error='apply: '+m;break;}}
    turns.push({role:'assistant',text:plan.reply||plan.message,status:'sent'});
    value=plan.next&&autoSteps<2?(autoSteps++,'Next step: '+plan.next):'';
   }
  }catch(e){error='threw: '+(e as Error).message;}
  const changed=root.innerHTML!==before;
  const owned=[...root.querySelectorAll('[data-dx-owned]')].map(n=>(n as HTMLElement).outerHTML.slice(0,1500));
  const clickable=[...root.querySelectorAll<HTMLElement>('*')].filter(el=>el.style.cursor==='pointer').length,styled=[...root.querySelectorAll<HTMLElement>('*')].filter(el=>/!important/.test(el.getAttribute('style')||'')).length;
  log({request,clickable,styled,seconds:Math.round((Date.now()-started)/1000),error,edits,clarifies,changed,steps,owned:owned.slice(0,4)});
  if(error||!edits)failures.push(request+' → '+(error||'no edit'));
  session.destroy();
 }}finally{Element.prototype.getBoundingClientRect=rect;db.close();}
 expect(failures).toEqual([]);
},3600000);
