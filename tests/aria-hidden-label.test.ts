// @vitest-environment jsdom
// The beta user's real My Feedback card (2026-11-17): each metric is a carousel slide whose visible label is aria-hidden="true",
// because the slide's own aria-label already announces it. Placeholder feedback text; structure, classes and attributes as on their page.
import {beforeEach,afterEach,it,expect} from 'vitest';
import {Session} from '../extension/content/session';
import {Repository,BrowserStorage} from '../extension/storage/store';
import {response,action} from '../extension/assistant/schema';
import {editableText} from '../extension/content/text';
import {readFileSync,writeFileSync} from 'node:fs';
import {database} from '../platform/server/db';
import {createPlatform} from '../platform/server/app';
import {configuration} from '../platform/server/config';
import {MockAIProvider} from '../platform/server/providers';
import {OpenAIAssistant} from '../platform/server/assistant';
import {normalizePlan,validatePlanReferences} from '../extension/assistant/plan';
import {resolveInspections} from '../extension/assistant/inspection';
const live=process.env.WANDEL_RUN_DESIGNER_ACCEPTANCE==='1';
const slide=(label:string,value:string,i:number)=>`<div aria-label="${label}: ${value}, item ${i} of 2, Sample feedback" aria-current="${i===1}" aria-hidden="false" class="SlideItem-sc-14v1ufw-2 iDFmbb" style="display:flex;flex-direction:column;align-items:center;gap:24px;width:380px"><div class="Meter" style="display:flex;align-items:center;gap:8px"><span class="Level" style="font-size:22px;font-weight:700">${value}</span><div class="Bar" style="width:48px;height:230px;border-radius:12px;background:rgb(236,224,250)"></div></div><div aria-hidden="true" class="Label-sc-14v1ufw-5 AuODi" style="display:block;text-transform:uppercase;font-size:14px;font-weight:600;color:rgb(80,78,96)">${label}</div></div>`;
const page=`<div class="Layer-sc-9sl797-2 hymjEk" tabindex="-1"><article aria-label="My Feedback clip details" class="DetailsWrapper-sc-1hj46yt-0 cuktIC DetailsPanel-sc-x6v2lt-2" style="display:block;padding:32px;border-radius:24px;background:#fff"><header style="display:flex;align-items:center;gap:12px"><h4 style="font-size:20px;font-weight:700">My Feedback</h4><span>11/10/26</span></header><div id=":ro:-panel-feedback" role="tabpanel" aria-labelledby=":ro:-tab-feedback" tabindex="0" class="Panel-sc-1ej8267-0 KrYil" style="display:block"><div class="Content-sc-18fwuo2-0 fCnDYU" style="display:block"><div role="region" aria-label="Understanding metrics, 1 of 2, Engagement: Developing" aria-roledescription="carousel" class="SliderContainer-sc-14v1ufw-0 fmVVVF" style="display:block"><div class="SliderContent-sc-14v1ufw-1 bSPNdP" style="display:flex;gap:40px">${slide('Engagement','Developing',1)}${slide('Talk Time','78.0%',2)}</div></div><p style="font-size:18px;line-height:30px">Sample feedback paragraph for the lesson.</p></div></div></article></div>`;
let session:Session,rect:typeof Element.prototype.getBoundingClientRect;
beforeEach(async()=>{
 rect=Element.prototype.getBoundingClientRect;Element.prototype.getBoundingClientRect=function(){return {x:0,y:0,top:0,left:0,right:120,bottom:40,width:120,height:40,toJSON(){}} as DOMRect;};
 localStorage.clear();document.body.innerHTML=page;
 session=new Session(document.querySelector('.Layer-sc-9sl797-2') as HTMLElement,new Repository(new BrowserStorage()),new URL('https://app.example.test/groups/1'),{assistantEnabled:true});
 await session.init();await session.dispatch({type:'edit'});
});
afterEach(()=>{session.destroy();Element.prototype.getBoundingClientRect=rect;});
const label=()=>document.querySelector<HTMLElement>('.Label-sc-14v1ufw-5')!;
it('finds the text of a label that is hidden from screen readers but on screen',()=>{
 expect(editableText(label())?.data).toBe('Engagement');
 // A button keeps its own label over an aria-hidden icon glyph.
 const b=document.createElement('button');b.innerHTML='<span aria-hidden="true">chevron_right</span><span>Next</span>';expect(editableText(b)?.data).toBe('Next');
});
it('keeps an edit-mode rename of that label, even after the app redraws it',async()=>{
 label().click();
 await session.dispatch({type:'text',text:'Questioning'});
 expect(label().textContent).toBe('Questioning');
 // The app redraws the label with its own text; Wandel puts the rename back.
 label().firstChild!.textContent='Engagement';
 const errors=session.renderer.reconcile(session.workflow,session.stateId);
 expect(errors).toEqual([]);
 expect(label().textContent).toBe('Questioning');
 expect(document.querySelectorAll('.Label-sc-14v1ufw-5')[1].textContent).toBe('Talk Time');
});
it('shows the label to the AI and applies its rename',async()=>{
 // As in the beta user's session: the AI asks to look inside the Engagement slide, then picks the label.
 const first=(await session.dispatch({type:'assistantContext'})).assistant!.context!;
 const slideRef=first.elements.find(e=>/^Engagement: Developing/.test(e.name||''))?.ref;
 const c=(await session.dispatch({type:'assistantContext',inspect:slideRef?[slideRef]:[]})).assistant!.context!;
 const target=c.elements.find(e=>(e.text||'').trim()==='Engagement');
 expect(target).toBeTruthy();
 await session.dispatch({type:'assistantApply',token:c.token,plan:response('edit','Renamed',[action('text',[target!.ref],{text:'Questioning'})])});
 expect(label().textContent).toBe('Questioning');
 expect(document.querySelector('.Level')!.textContent).toBe('Developing');
});
// Opt-in, live AI: the beta user's exact words on this structure, with the panel's look-inside rounds.
it.skipIf(!live)('renames Engagement to Questioning with the live AI, and nothing else',async()=>{
 const ask='change the name of the rubric from engagement to questioning in the my feedback card. Do not make any other changes.';
 const env=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).flatMap(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);return m?[[m[1],m[2].trim().replace(/^['"]|['"]$/g,'')]]:[];}));
 const provider=new OpenAIAssistant(env.OPENAI_API_KEY,env.OPENAI_MODEL),db=database(':memory:');
 const config=configuration({WANDEL_AUTH_MODE:'legacy'},'verification-only-test-pepper-32-characters');
 const app=createPlatform({db,config,ai:new MockAIProvider(),mail:{reset:async()=>{}},assistant:{transcribe:bytes=>provider.transcribe(bytes),plan:input=>provider.plan(input)}});
 const signup=await app.handle(new Request(config.origin+'/api/auth/signup',{method:'POST',headers:{Origin:config.origin,'Content-Type':'application/json'},body:JSON.stringify({email:'verification@example.test',password:'synthetic-test-password-123'})}));const cookie=signup.headers.get('set-cookie')!.split(';')[0];
 const cloud=async(context:any,history:any[])=>{const r=await app.handle(new Request(config.origin+'/api/assistant/plan',{method:'POST',headers:{Origin:config.origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({instruction:ask,context,history,requestId:crypto.randomUUID(),steps:true})}));const d=await r.json();return r.ok?normalizePlan(d.plan):response('unsupported','API '+r.status+': '+(d.error?.message||JSON.stringify(d)));};
 const trace:unknown[]=[];const log=(x:any)=>{trace.push(x);writeFileSync(process.env.TRACE_OUT||'/dev/null',JSON.stringify(trace,null,2));};
 const before=document.querySelector('article')!.textContent;
 try{
  let c=(await session.dispatch({type:'assistantContext'})).assistant!.context!;
  let plan=await cloud(c,[]);
  for(let round=0;plan.status==='inspect'&&round<4;round++){log({round,message:plan.message});c=(await session.dispatch({type:'assistantContext',inspect:plan.candidates})).assistant!.context!;plan=await cloud(c,[{role:'assistant',text:'The requested elements have now been inspected. Use their supplied labels, descendants and styles to continue.',status:'sent'}]);}
  log({status:plan.status,message:plan.message,actions:plan.actions});
  expect(plan.status).toBe('edit');
  validatePlanReferences(plan,c.elements.map(e=>e.ref));
  await session.dispatch({type:'assistantApply',token:c.token,plan});
  expect(label().textContent).toBe('Questioning');
  expect(document.querySelector('article')!.textContent).toBe(before!.replace('Engagement','Questioning').replace(/Engagement(?=: Developing)/,'Engagement'));
 }finally{db.close();}
},600000);
// Opt-in, live AI: the beta user's "Feedback length" request on this same card, where "rubrics and metrics" are the Engagement and Talk Time slides.
it.skipIf(!live)('on the My Feedback card, either adds Feedback length or asks one clear question',async()=>{
 const ask='add a new section similar to rubrics and metrics in the advanced modal on screen called "Feedback length" and have 3 options - concise, normal, detailed. Only 1 should be pickable at any time.';
 const env=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).flatMap(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);return m?[[m[1],m[2].trim().replace(/^['"]|['"]$/g,'')]]:[];}));
 const provider=new OpenAIAssistant(env.OPENAI_API_KEY,env.OPENAI_MODEL),db=database(':memory:');
 const config=configuration({WANDEL_AUTH_MODE:'legacy'},'verification-only-test-pepper-32-characters');
 const app=createPlatform({db,config,ai:new MockAIProvider(),mail:{reset:async()=>{}},assistant:{transcribe:bytes=>provider.transcribe(bytes),plan:input=>provider.plan(input)}});
 const signup=await app.handle(new Request(config.origin+'/api/auth/signup',{method:'POST',headers:{Origin:config.origin,'Content-Type':'application/json'},body:JSON.stringify({email:'verification@example.test',password:'synthetic-test-password-123'})}));const cookie=signup.headers.get('set-cookie')!.split(';')[0];
 const cloud=async(instruction:string,context:any,history:any[])=>{const r=await app.handle(new Request(config.origin+'/api/assistant/plan',{method:'POST',headers:{Origin:config.origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({instruction,context,history,requestId:crypto.randomUUID(),steps:true})}));const d=await r.json();return r.ok?normalizePlan(d.plan):response('unsupported','API '+r.status+': '+(d.error?.message||JSON.stringify(d)));};
 const trace:unknown[]=[];const log=(x:any)=>{trace.push(x);writeFileSync(process.env.TRACE_OUT||'/dev/null',JSON.stringify(trace,null,2));};
 const slides=()=>[...document.querySelectorAll('.SlideItem-sc-14v1ufw-2')].map(s=>s.textContent);const before=slides();
 try{
  let instruction=ask,history:any[]=[],error='';
  for(let step=0;step<3&&instruction;step++){
   // The panel's own look-again rounds, including its final decide-now call.
   const start=(await session.dispatch({type:'assistantContext'})).assistant!.context!;
   const resolved=await resolveInspections(await cloud(instruction,start,history),start,{inspect:async refs=>(await session.dispatch({type:'assistantContext',inspect:refs})).assistant!.context!,replan:(context,feedback)=>cloud(instruction,context,[...history,{role:'assistant',text:feedback,status:'sent'}]),active:()=>true});
   const plan=resolved.plan,c=resolved.context;
   log({step,status:plan.status,message:plan.message,question:plan.question,next:plan.next,actions:plan.actions});
   if(plan.status!=='edit'){error='step '+step+' '+plan.status+': '+(plan.question||plan.message);break;}
   validatePlanReferences(plan,c.elements.map(e=>e.ref));
   try{await session.dispatch({type:'assistantApply',token:c.token,plan});}catch(e){error=(e as Error).message;log({step,error});break;}
   history=[...history,{role:'user',text:instruction,status:'sent'},{role:'assistant',text:plan.message,status:'sent'}];
   instruction=plan.next?'Next step: '+plan.next:'';
  }
  const card=document.querySelector('article')!;
  const options=['concise','normal','detailed'].map(name=>[...card.querySelectorAll<HTMLElement>('button,[role=radio],label,input,[role=tab],[role=option]')].find(el=>[el.getAttribute('aria-label'),(el.textContent||(el as HTMLInputElement).value||'').replace(/[✓✔]/g,'')].some(label=>label?.trim().toLowerCase()===name)));
  const picked=()=>options.map(el=>{if(!el)return null;const input=el.matches('input')?el as HTMLInputElement:el.querySelector('input');return input?input.checked:['aria-pressed','aria-checked','aria-selected'].some(a=>el.getAttribute(a)==='true');});
  log({error,found:options.map(o=>!!o),picked:picked(),html:card.outerHTML.replace(/ style="[^"]*"/g,'').slice(-3500)});
  // With no Advanced popup on this page, adding it to the card or asking one clear question are both right; a dead end is not.
  if(/^step 0 clarify: /.test(error)){expect(error).toMatch(/\?/);return;}
  expect(error).toBe('');
  expect(card.textContent).toMatch(/feedback length/i);
  expect(options.every(Boolean)).toBe(true);
  options[2]!.click();expect(picked()).toEqual([false,false,true]);
  options[0]!.click();expect(picked()).toEqual([true,false,false]);
  expect(slides().slice(0,2)).toEqual(before);
 }finally{db.close();}
},900000);
