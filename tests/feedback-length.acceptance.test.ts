// @vitest-environment jsdom
// Opt-in, live AI: the beta user's "Feedback length" request (2026-11-17) on an Advanced modal shaped like theirs, with placeholder text.
import {it,expect} from 'vitest';
import {readFileSync,writeFileSync} from 'node:fs';
import {database} from '../platform/server/db';
import {createPlatform} from '../platform/server/app';
import {configuration} from '../platform/server/config';
import {MockAIProvider} from '../platform/server/providers';
import {response} from '../extension/assistant/schema';
import {OpenAIAssistant} from '../platform/server/assistant';
import {Session} from '../extension/content/session';
import {Repository,BrowserStorage} from '../extension/storage/store';
import {normalizePlan,validatePlanReferences} from '../extension/assistant/plan';
const live=process.env.WANDEL_RUN_DESIGNER_ACCEPTANCE==='1';
const on='background:rgb(242,232,255);color:rgb(134,68,255);border:1px solid rgb(134,68,255)',off='background:rgb(255,255,255);color:rgb(80,78,96);border:1px solid rgb(222,220,232)';
const pill=(text:string,pressed:boolean)=>`<button aria-pressed="${pressed}" style="${pressed?on:off};border-radius:30px;padding:10px 20px;font-size:14px">${text}</button>`;
const group=(id:string,title:string,items:string[],chosen:number[])=>`<section id="${id}" style="display:flex;flex-direction:column;gap:12px;padding:16px 0"><h3 style="font-size:16px;font-weight:700">${title}</h3><p style="font-size:13px;color:rgb(110,106,128)">Sample description.</p><div style="display:flex;flex-wrap:wrap;gap:8px">${items.map((t,i)=>pill(t,chosen.includes(i))).join('')}</div></section>`;
const page=`<main style="display:block"><div role="dialog" aria-modal="true" style="display:flex;flex-direction:column;gap:8px;padding:32px;border-radius:24px;background:#fff;width:640px"><h1 style="font-size:24px">Advanced</h1>${group('rubrics','Rubrics',['Engagement','Clarity','Pacing'],[0,1])}${group('metrics','Metrics',['Talk Time','Wait Time','Questions'],[0])}<footer style="display:flex;justify-content:flex-end;gap:8px"><button style="${off};border-radius:8px;padding:8px 16px">Cancel</button><button style="background:rgb(134,68,255);color:#fff;border:0;border-radius:8px;padding:8px 16px">Save</button></footer></div></main>`;
const ask='add a new section similar to rubrics and metrics in the advanced modal on screen called "Feedback length" and have 3 options - concise, normal, detailed. Only 1 should be pickable at any time.';
it.skipIf(!live)('adds a Feedback length section with three options, one pickable at a time',async()=>{
 const env=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).flatMap(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);return m?[[m[1],m[2].trim().replace(/^['"]|['"]$/g,'')]]:[];}));
 const provider=new OpenAIAssistant(env.OPENAI_API_KEY,env.OPENAI_MODEL),db=database(':memory:');
 const config=configuration({WANDEL_AUTH_MODE:'legacy'},'verification-only-test-pepper-32-characters');
 const trace:unknown[]=[];const log=(x:any)=>{trace.push(x);writeFileSync(process.env.TRACE_OUT||'/dev/null',JSON.stringify(trace,null,2));};
 const app=createPlatform({db,config,ai:new MockAIProvider(),mail:{reset:async()=>{}},assistant:{transcribe:bytes=>provider.transcribe(bytes),plan:input=>provider.plan(input)}});
 const signup=await app.handle(new Request(config.origin+'/api/auth/signup',{method:'POST',headers:{Origin:config.origin,'Content-Type':'application/json'},body:JSON.stringify({email:'verification@example.test',password:'synthetic-test-password-123'})}));const cookie=signup.headers.get('set-cookie')!.split(';')[0];
 const cloud=async(instruction:string,context:any,history:any[])=>{const r=await app.handle(new Request(config.origin+'/api/assistant/plan',{method:'POST',headers:{Origin:config.origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({instruction,context,history,requestId:crypto.randomUUID(),steps:true})}));const d=await r.json();return r.ok?normalizePlan(d.plan):response('unsupported','API '+r.status+': '+(d.error?.message||JSON.stringify(d)));};
 const rect=Element.prototype.getBoundingClientRect;Element.prototype.getBoundingClientRect=function(){return {x:0,y:0,top:0,left:0,right:120,bottom:40,width:120,height:40,toJSON(){}} as DOMRect;};
 localStorage.clear();document.body.innerHTML=page;
 const session=new Session(document.querySelector('main')!,new Repository(new BrowserStorage()),new URL('https://example.test/groups/1'),{assistantEnabled:true});
 try{
  await session.init();await session.dispatch({type:'edit'});
  let instruction=ask,history:any[]=[],error='';
  for(let step=0;step<3&&instruction;step++){
   let c=(await session.dispatch({type:'assistantContext'})).assistant!.context!;
   let plan=await cloud(instruction,c,history);
   for(let round=0;plan.status==='inspect'&&round<4;round++){log({step,round,message:plan.message});c=(await session.dispatch({type:'assistantContext',inspect:plan.candidates})).assistant!.context!;plan=await cloud(instruction,c,[...history,{role:'assistant',text:'The requested elements have now been inspected. Use their supplied labels, descendants and styles to continue.',status:'sent'}]);}
   log({step,status:plan.status,message:plan.message,next:plan.next,actions:plan.actions});
   if(plan.status!=='edit'){error='step '+step+' '+plan.status+': '+plan.message;break;}
   validatePlanReferences(plan,c.elements.map(e=>e.ref));
   try{await session.dispatch({type:'assistantApply',token:c.token,plan});}catch(e){error=(e as Error).message;log({step,error});break;}
   history=[...history,{role:'user',text:instruction,status:'sent'},{role:'assistant',text:plan.message,status:'sent'}];
   instruction=plan.next?'Next step: '+plan.next:'';
  }
  const dialog=document.querySelector('[role=dialog]')!;
  const options=['Concise','Normal','Detailed'].map(name=>[...dialog.querySelectorAll<HTMLElement>('button,[role=radio],label,input')].find(el=>[el.getAttribute('aria-label'),(el.textContent||(el as HTMLInputElement).value||'').replace(/[✓✔]/g,'')].some(label=>label?.trim().toLowerCase()===name.toLowerCase())));
  const picked=()=>options.map(el=>{if(!el)return null;const input=el.matches('input')?el as HTMLInputElement:el.querySelector('input');return input?input.checked:el.getAttribute('aria-pressed')==='true'||el.getAttribute('aria-checked')==='true'||el.getAttribute('aria-selected')==='true';});
  log({error,heading:[...dialog.querySelectorAll('h1,h2,h3,h4,h5,strong')].map(h=>h.textContent),found:options.map(o=>!!o),picked:picked(),html:dialog.outerHTML.slice(-3000)});
  expect(error).toBe('');
  expect(dialog.textContent).toContain('Feedback length');
  expect(options.every(Boolean)).toBe(true);
  options[2]!.click();
  expect(picked()).toEqual([false,false,true]);
  options[0]!.click();
  expect(picked()).toEqual([true,false,false]);
  // The existing sections are untouched.
  expect([...document.querySelectorAll('#rubrics button')].map(b=>b.getAttribute('aria-pressed'))).toEqual(['true','true','false']);
 }finally{Element.prototype.getBoundingClientRect=rect;session.destroy();db.close();}
},900000);
