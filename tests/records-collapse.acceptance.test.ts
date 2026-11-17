// @vitest-environment jsdom
// Opt-in, live AI: the My Record transcript structure from the beta user's page, with placeholder text.
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
import {groundPlan} from '../extension/assistant/grounding';
const live=process.env.WANDEL_RUN_DESIGNER_ACCEPTANCE==='1';
const titles=['1. Class Recalls Story And Author','2. Students Practice New Words','3. Class Sorts Words By Meaning','4. Students Share Their Boxes'],times=['7:55am','7:56am','7:58am','8:01am'];
let line=0;
const block=()=>`<div class="BlockRow" style="display:flex;align-items:flex-start;gap:16px"><div class="BlockText" style="font-size:16px;line-height:24px;color:rgb(39,36,53)"><strong>Educator:</strong> Sample line ${++line}.<br>Sample line ${++line}.</div><button class="AudioButton" aria-label="Play">▶</button></div>`;
const size=Number(process.env.RECORD_SIZE||3),items=(n:number)=>Array.from({length:n},block).join('');
const section=(i:number)=>`<section class="ChunkSection" style="display:block;padding:24px 0px"><div class="ChunkRow" style="display:flex;align-items:flex-start;gap:16px"><label class="Checkbox" style="display:flex;cursor:pointer"><input type="checkbox"><span class="Box" style="display:block;width:20px;border-radius:4px"></span></label><div class="ChunkMain" style="display:flex;flex-direction:column;gap:16px;width:680px"><div class="ChunkHeader" style="display:flex;justify-content:space-between;align-items:center"><div class="ChunkTitleRow" style="display:flex;align-items:center;gap:8px"><h5 class="ChunkTitle" style="font-size:18px;font-weight:700;color:rgb(39,36,53)">${titles[i]}</h5></div><p class="ChunkTimestamp" style="font-size:14px;color:rgb(110,106,128)">${times[i]}</p></div><div class="ChunkBody" style="display:flex;flex-direction:column;gap:24px">${Array.from({length:Math.max(2,Math.round(size/3))},()=>`<div class="SessionItem" style="display:flex;flex-direction:column;gap:24px">${items(size)}</div>`).join('')}</div></div></div></section>`;
const page=`<div id="app" style="display:block;background:#faf9fc"><section class="Takeaways" style="padding:32px;border-radius:24px;background:#fffbea"><h4>Takeaways</h4><p>Sample summary text for the lesson.</p><button>Reflect</button></section><section class="Feedback" style="padding:32px;border-radius:24px"><h4>My Feedback</h4><span>0</span><p>11/10/26</p><blockquote>Sample quote.</blockquote></section><article class="DetailsWrapper" style="display:flex;flex-direction:column;padding:32px;border-radius:24px;background:#ffffff"><div class="RecordHeader" style="display:flex;gap:24px;align-items:center"><h4 style="font-size:20px;font-weight:700">My Record</h4><span>20m 12s</span><span>2,039 words</span><span>0 videos</span></div><div class="Transcript" style="display:flex;flex-direction:column">${[0,1,2,3].map(section).join('')}</div><div class="Group" style="display:flex;align-items:center;gap:16px"><label class="Checkbox"><input type="checkbox"><span class="Box"></span><span class="CheckboxLabel">Select All</span></label><p role="status">0 of 4 selected</p></div></article></div>`;
const request='in the my records section - for each checkbox item - user should be ble to expand collapse each section - deaful is collapsed';
it.skipIf(!live)('makes each My Record section collapsible, collapsed by default',async()=>{
 const env=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).flatMap(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);return m?[[m[1],m[2].trim().replace(/^['"]|['"]$/g,'')]]:[];}));
 const provider=new OpenAIAssistant(env.OPENAI_API_KEY,env.OPENAI_MODEL),db=database(':memory:');
 const config=configuration({WANDEL_AUTH_MODE:'legacy'},'verification-only-test-pepper-32-characters');
 const trace:unknown[]=[];const started=Date.now();const log=(x:any)=>{trace.push({t:Math.round((Date.now()-started)/1000),...x});writeFileSync(process.env.TRACE_OUT||'/dev/null',JSON.stringify(trace,null,2));};
 const app=createPlatform({db,config,ai:new MockAIProvider(),mail:{reset:async()=>{}},assistant:{transcribe:bytes=>provider.transcribe(bytes),plan:input=>provider.plan(input)}});
 const signup=await app.handle(new Request(config.origin+'/api/auth/signup',{method:'POST',headers:{Origin:config.origin,'Content-Type':'application/json'},body:JSON.stringify({email:'verification@example.test',password:'synthetic-test-password-123'})}));const cookie=signup.headers.get('set-cookie')!.split(';')[0];
 const cloud=async(context:any,history:any[])=>{const r=await app.handle(new Request(config.origin+'/api/assistant/plan',{method:'POST',headers:{Origin:config.origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({instruction:request,context,history,requestId:crypto.randomUUID(),steps:true})}));const d=await r.json();return r.ok?normalizePlan(d.plan):response('unsupported','API '+r.status+': '+(d.error?.message||JSON.stringify(d)));};
 localStorage.clear();document.body.innerHTML=page;
 const session=new Session(document.getElementById('app')!,new Repository(new BrowserStorage()),new URL('https://example.test/groups/1'),{assistantEnabled:true});
 try{
  await session.init();await session.dispatch({type:'edit'});
  let c=(await session.dispatch({type:'assistantContext'})).assistant!.context!;
  const name=(ref:string)=>{const e=c.elements.find(x=>x.ref===ref);return e?e.tag+' '+(e.name||e.text||'').slice(0,40):ref;};
  log({elements:c.elements.length,sample:c.elements.slice(0,60).map(e=>e.ref+' '+e.tag+' '+String(e.name||e.text||'').slice(0,40))});
  let plan=await cloud(c,[]);
  for(let round=0;plan.status==='inspect'&&round<4;round++){
   log({round,status:plan.status,message:plan.message,candidates:plan.candidates.map(name)});
   c=(await session.dispatch({type:'assistantContext',inspect:plan.candidates})).assistant!.context!;
   plan=await cloud(c,[{role:'assistant',text:'The requested elements have now been inspected. Use their supplied labels, descendants and styles to continue.',status:'sent'}]);
  }
  log({final:plan.status,message:plan.message,question:plan.question,actions:plan.actions});
  let error='';
  if(plan.status==='edit'){validatePlanReferences(plan,c.elements.map(e=>e.ref));plan=groundPlan(request,c,plan);log({grounded:plan.status,message:plan.message,question:plan.question});try{await session.dispatch({type:'assistantApply',token:c.token,plan});}catch(e){error=(e as Error).message;}}
  const bodies=[...document.querySelectorAll('.ChunkBody')] as HTMLElement[];
  const hidden=bodies.map(b=>b.hidden||getComputedStyle(b).display==='none'||b.closest('details:not([open])')!==null);
  log({error,hidden,html:document.querySelector('.ChunkSection')?.outerHTML.slice(0,3000)});
  writeFileSync(process.env.TRACE_OUT||'/dev/null',JSON.stringify(trace,null,2));
  expect(error).toBe('');expect(plan.status).toBe('edit');expect(hidden).toEqual([true,true,true,true]);
  // Clicking a header opens only that section.
  (document.querySelectorAll('.ChunkHeader')[2] as HTMLElement).click();
  const after=bodies.map(b=>b.hidden||getComputedStyle(b).display==='none'||b.closest('details:not([open])')!==null);
  expect(after).toEqual([true,true,false,true]);
 }finally{session.destroy();db.close();}
},900000);
// The beta user's own words (2026-11-17): arrows beside each title that fold that item, open by default. Runs the panel's next steps too.
it.skipIf(!live)('adds an arrow beside each My Record title that folds only its own item',async()=>{
 const ask='make the items in my record collapsible/expandable. i.e. each check box item shold collapse all the content within it. Use a small arrow on the right side of the checkbox title to show the expand/collapse state and act as the button.';
 const env=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).flatMap(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);return m?[[m[1],m[2].trim().replace(/^['"]|['"]$/g,'')]]:[];}));
 const provider=new OpenAIAssistant(env.OPENAI_API_KEY,env.OPENAI_MODEL),db=database(':memory:');
 const config=configuration({WANDEL_AUTH_MODE:'legacy'},'verification-only-test-pepper-32-characters');
 const trace:unknown[]=[];const log=(x:any)=>{trace.push(x);writeFileSync(process.env.TRACE_OUT||'/dev/null',JSON.stringify(trace,null,2));};
 const app=createPlatform({db,config,ai:new MockAIProvider(),mail:{reset:async()=>{}},assistant:{transcribe:bytes=>provider.transcribe(bytes),plan:input=>provider.plan(input)}});
 const signup=await app.handle(new Request(config.origin+'/api/auth/signup',{method:'POST',headers:{Origin:config.origin,'Content-Type':'application/json'},body:JSON.stringify({email:'verification@example.test',password:'synthetic-test-password-123'})}));const cookie=signup.headers.get('set-cookie')!.split(';')[0];
 const cloud=async(instruction:string,context:any,history:any[])=>{const r=await app.handle(new Request(config.origin+'/api/assistant/plan',{method:'POST',headers:{Origin:config.origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({instruction,context,history,requestId:crypto.randomUUID(),steps:true})}));const d=await r.json();return r.ok?normalizePlan(d.plan):response('unsupported','API '+r.status+': '+(d.error?.message||JSON.stringify(d)));};
 // jsdom has no layout: every element gets a small box, as a real page would give it.
 const rect=Element.prototype.getBoundingClientRect;Element.prototype.getBoundingClientRect=function(){return {x:0,y:0,top:0,left:0,right:32,bottom:32,width:32,height:32,toJSON(){}} as DOMRect;};
 localStorage.clear();document.body.innerHTML=page;
 const session=new Session(document.getElementById('app')!,new Repository(new BrowserStorage()),new URL('https://example.test/groups/1'),{assistantEnabled:true});
 const bodies=()=>[...document.querySelectorAll('.ChunkBody')] as HTMLElement[];
 const folded=()=>bodies().map(b=>b.hidden||getComputedStyle(b).display==='none'||b.closest('details:not([open])')!==null||[...b.children].every(c=>(c as HTMLElement).hidden||getComputedStyle(c).display==='none'));
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
  const arrows=[...document.querySelectorAll('.ChunkSection')].map(s=>[...s.querySelectorAll('button,[role=button]')].find(b=>/[▾▸▴▼►▶⌄›]/.test(b.textContent||'')&&!(b as HTMLElement).matches('.AudioButton')) as HTMLElement|undefined);
  log({error,folded:folded(),arrows:arrows.map(a=>a?.textContent),html:document.querySelector('.ChunkSection')?.outerHTML.slice(0,2500)});
  expect(error).toBe('');
  expect(arrows.every(Boolean)).toBe(true);
  expect(folded()).toEqual([false,false,false,false]);
  const before=arrows[2]!.textContent;
  arrows[2]!.click();
  expect(folded()).toEqual([false,false,true,false]);
  expect(arrows[2]!.textContent).not.toBe(before);
  // The checkbox still works and stays visible.
  const box=document.querySelectorAll<HTMLInputElement>('.ChunkSection input[type=checkbox]')[2];expect(getComputedStyle(box.closest('label')!).display).not.toBe('none');
  arrows[2]!.click();
  expect(folded()).toEqual([false,false,false,false]);
 }finally{Element.prototype.getBoundingClientRect=rect;session.destroy();db.close();}
},900000);
