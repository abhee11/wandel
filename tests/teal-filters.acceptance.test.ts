// @vitest-environment jsdom
// Opt-in, live AI: a beta tester's five-filter request on a saved-jobs table (2026-11-19), shaped like theirs, with placeholder rows.
// The conversation goes through the same rules as the panel: answers continue the original request, follow-ups carry the chat.
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
const live=process.env.WANDEL_RUN_DESIGNER_ACCEPTANCE==='1';
const star=(on:boolean)=>`<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16"><path d="M8 1l2 5h5l-4 3 2 5-5-3-5 3 2-5-4-3h5z" fill="${on?'rgb(250,190,40)':'none'}" stroke="rgb(180,180,180)"/></svg>`;
const rating=(n:number)=>`<div class="rating" role="radiogroup" aria-label="Rating" data-rating="${n}" style="display:flex;gap:2px">${[1,2,3,4,5].map(i=>`<span role="radio" aria-checked="${i===n}" aria-label="${i} stars">${star(i<=n)}</span>`).join('')}</div>`;
const rows=[['Sample Job A','$90,000','Acme Corp','Anywhere, USA','Bookmarked','01/06/2026',3],['Sample Job B','$120,000','Beta Inc','Remote','Applied','01/02/2026',5],['Sample Job C','$70,000','Gamma LLC','Austin, TX','Interviewing','12/20/2025',2]] as const;
const th=(t:string)=>`<th style="text-align:left;padding:8px 12px;font-weight:500;color:rgb(80,80,80);border-bottom:1px solid rgb(220,220,220)">${t}</th>`;
const td=(t:string)=>`<td style="padding:12px;border-bottom:1px solid rgb(230,230,230)">${t}</td>`;
const steps=['Bookmarked','Applying','Applied','Interviewing','Negotiating','Accepted'].map((s,i)=>`<div class="stage" style="display:flex;flex-direction:column;align-items:center;padding:12px 40px;border:1px solid rgb(230,230,230)"><strong style="font-size:22px">${i?'– –':'3'}</strong><span style="font-size:12px;text-transform:uppercase">${s}</span></div>`).join('');
const page=`<main style="display:block;font-family:sans-serif">
<nav style="display:flex;gap:16px;padding:12px"><a href="/jobs" style="color:rgb(20,110,90)">Jobs</a><a href="/people">People</a><a href="/companies">Companies</a></nav>
<div class="stages" style="display:flex;gap:8px;padding:16px">${steps}<div style="padding:12px"><h2 style="font-size:24px">Saved Jobs</h2></div></div>
<div class="toolbar" style="display:flex;align-items:center;gap:8px;padding:8px 16px">
 <button aria-label="Search" style="border:1px solid rgb(220,220,220);border-radius:4px;padding:6px;background:#fff">🔍</button>
 <label style="display:flex;gap:6px;border:1px solid rgb(220,220,220);border-radius:4px;padding:6px 10px"><input type="checkbox"> 0 selected</label>
 <div style="flex:1"></div>
 <button aria-label="List view" style="border:1px solid rgb(220,220,220);border-radius:4px;padding:6px;background:rgb(230,245,240)">☰</button>
 <button aria-label="Board view" style="border:1px solid rgb(220,220,220);border-radius:4px;padding:6px;background:#fff">▦</button>
 <button aria-label="Columns" style="border:1px solid rgb(220,220,220);border-radius:4px;padding:6px;background:#fff">⚙</button>
 <button style="background:rgb(20,110,90);color:#fff;border:0;border-radius:4px;padding:8px 14px">+ Add Job</button>
</div>
<table class="jobs" style="width:100%;border-collapse:collapse"><thead><tr>${th('')}${['Job Position','Max. Salary','Company','Location','Status','Date Saved','Deadline','Date Applied','Follow up','Excitement'].map(th).join('')}</tr></thead>
<tbody>${rows.map(r=>`<tr class="job">${td('<input type="checkbox" aria-label="Select row">')}${td(r[0])}${td(r[1])}${td(r[2])}${td(r[3])}${td(r[4])}${td(r[5])}${td('N/A')}${td(r[5])}${td('01/09/2026')}${td(rating(r[6]))}</tr>`).join('')}</tbody></table>
</main>`;
const request='Add a filter to this jobs table with 5 criteria: Salary, Location, Status, Date Saved and Excitement.';
const reply=(question:string,asked:Set<string>)=>{const q=question.toLowerCase();
 const pick=(key:string,answer:string)=>{asked.add(key);return answer;};
 if(/excitement|rating|star/.test(q))return asked.has('rec')?pick('excitement','Exact ratings, so I can pick several like 3 and 5 stars'):pick('rec','What do you recommend?');
 if(/panel|visible|button|layout|where/.test(q)&&!asked.has('layout'))return pick('layout','Panel behind a Filters button');
 if(/apply|immediate|update/.test(q))return pick('apply','Immediately');
 if(/salary|minimum|range|threshold/.test(q)&&!asked.has('salary'))return pick('salary','Minimum');
 if(/location/.test(q))return pick('location','Multiple');
 if(/status/.test(q))return pick('status','Multiple');
 if(/date|preset/.test(q))return pick('date','Both');
 return 'Go with your recommendation';};
it.skipIf(!live)('builds all five filters in a Filters panel and keeps every answer the user gave',async()=>{
 const env=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).flatMap(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);return m?[[m[1],m[2].trim().replace(/^['"]|['"]$/g,'')]]:[];}));
 const provider=new OpenAIAssistant(env.OPENAI_API_KEY,env.OPENAI_MODEL),db=database(':memory:');
 const config=configuration({WANDEL_AUTH_MODE:'legacy'},'verification-only-test-pepper-32-characters');
 const trace:unknown[]=[];const log=(x:any)=>{trace.push(x);writeFileSync(process.env.TRACE_OUT||'/dev/null',JSON.stringify(trace,null,2));};
 const app=createPlatform({db,config,ai:new MockAIProvider(),mail:{reset:async()=>{}},assistant:{transcribe:bytes=>provider.transcribe(bytes),plan:input=>provider.plan(input)}});
 const signup=await app.handle(new Request(config.origin+'/api/auth/signup',{method:'POST',headers:{Origin:config.origin,'Content-Type':'application/json'},body:JSON.stringify({email:'verification@example.test',password:'synthetic-test-password-123'})}));const cookie=signup.headers.get('set-cookie')!.split(';')[0];
 const turns:ChatTurn[]=[];
 // As planConversation sends it: chat and session memory only when the request continues the conversation.
 const cloud=async(instruction:string,context:any,extra:ChatTurn[]=[])=>{const chat=[...turns,...extra],fresh=!continuesChat(instruction,chat);const sent=fresh?PageContextSchema.parse({...context,workspace:undefined,recent:[],edits:[],lastCard:null,lastGroup:null}):context;
  const r=await app.handle(new Request(config.origin+'/api/assistant/plan',{method:'POST',headers:{Origin:config.origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({instruction,context:sent,history:fresh?[]:conversationHistory(chat),requestId:crypto.randomUUID(),steps:true})}));const d=await r.json();return r.ok?normalizePlan(d.plan):response('unsupported',JSON.stringify(d).slice(0,400));};
 const rect=Element.prototype.getBoundingClientRect;Element.prototype.getBoundingClientRect=function(){return {x:0,y:0,top:0,left:0,right:120,bottom:32,width:120,height:32,toJSON(){}} as DOMRect;};
 localStorage.clear();document.body.innerHTML=page;
 const session=new Session(document.querySelector('main')!,new Repository(new BrowserStorage()),new URL('https://example.test/jobs'),{assistantEnabled:true});
 try{
  await session.init();await session.dispatch({type:'edit'});
  const asked=new Set<string>(['layout','apply','salary','location','status','date','rec']);
  const said:[string,string][]=[[request,'Would you prefer the filters always visible above the table, or tucked into a panel opened by a Filters button? I recommend the panel to keep the table uncluttered.'],['Panel behind a Filters button','Should results update immediately as you change a filter, or only when you click Apply filters?'],['Immediately','Should Salary use a minimum–maximum range, or just a minimum threshold such as “$80,000 or more”?'],['Minimum','For Location, should people be able to select multiple locations at once, including Remote, or just one location?'],['Multiple','Should Status also allow multiple selections, or only one status at a time?'],['Multiple','For Date Saved, would you prefer quick presets like “Last 7 days” and “Last 30 days,” a custom date range, or both?'],['Both','For Excitement, should the filter use a minimum rating, such as “3 stars or more,” or let you select multiple exact ratings, such as 3 and 5 stars?'],['What do you recommend?','I’d recommend a minimum Excitement rating rather than selecting exact ratings: one dropdown with Any rating, 1+ to 5 stars.\n\nShall we use that minimum-rating approach for Excitement?']];
  let pending:string|null=null;for(const [user,assistant] of said){pending=pending?continueRequest(pending,user):user;turns.push({role:'user',text:user,status:'sent'},{role:'assistant',text:assistant,status:'sent'});}
  let value='Exact ratings, so I can pick several like 3 and 5 stars',error='',edits=0,autoSteps=0;asked.add('excitement');
  for(let turn=0;turn<22&&value;turn++){
   const combined:string=pending?continueRequest(pending,value):value;pending=null;
   let c=(await session.dispatch({type:'assistantContext',instruction:combined})).assistant!.context!;
   let plan=await cloud(combined,c);
   if(plan.status==='inspect'){const r=await resolveInspections(plan,c,{active:()=>true,inspect:async refs=>{log({turn,inspect:refs.map(ref=>c.elements.find(e=>e.ref===ref)?.name?.slice(0,60)||ref),why:plan.message});return (await session.dispatch({type:'assistantContext',inspect:refs,instruction:combined})).assistant!.context!;},replan:async(expanded,note)=>{const p=await cloud(combined,expanded,[{role:'assistant',text:note,status:'sent'}]);plan=p;return p;}});plan=r.plan;c=r.context;}
   // As the panel does: open what the AI asked to see, then plan again on what opened.
   if(plan.status==='open'&&plan.candidates[0]){const name=(c.elements.find(e=>e.ref===plan.candidates[0])?.name||'it').slice(0,60);log({turn,open:name});await session.dispatch({type:'openControl',ref:plan.candidates[0]});await new Promise(r=>setTimeout(r,50));
    const reopened=combined+`\n(Wandel opened “${name}” so you can see what it shows. Continue the request on this screen; do not open anything else.)`;
    c=(await session.dispatch({type:'assistantContext',instruction:reopened})).assistant!.context!;plan=await cloud(reopened,c);
    if(plan.status==='inspect'){const r=await resolveInspections(plan,c,{active:()=>true,inspect:async refs=>(await session.dispatch({type:'assistantContext',inspect:refs,instruction:reopened})).assistant!.context!,replan:(expanded,note)=>cloud(reopened,expanded,[{role:'assistant',text:note,status:'sent'}])});plan=r.plan;c=r.context;}}
   turns.push({role:'user',text:value,status:'sent'});
   const question=plan.status==='clarify'?(plan.question||plan.message):plan.status==='answer'&&plan.question?.trim()?plan.message+'\n\n'+plan.question:'';
   log({turn,sent:combined,status:plan.status,message:plan.message,question:plan.question,next:plan.next,actions:plan.actions.map(a=>JSON.stringify({...a,html:undefined,behavior:undefined}).slice(0,600))});
   if(question){turns.push({role:'assistant',text:question,status:'sent'});pending=combined;value=reply(question,asked);continue;}
   // Once the panel is built, saying plainly that combined row filtering can't be prototyped yet is a correct ending.
   if(plan.status==='answer'&&edits>0){log({turn,ended:plan.message.slice(0,300)});break;}
   if(plan.status!=='edit'){error='turn '+turn+' '+plan.status+': '+plan.message;break;}
   validatePlanReferences(plan,c.elements.map(e=>e.ref));
   try{await session.dispatch({type:'assistantApply',token:c.token,plan});edits++;}catch(e){const m=(e as Error).message;log({turn,applied:m});
    // Every jsdom element sits at 0,0, so layout flags (kept, overlaps) are not failures here.
    if(/^Preview kept/.test(m))edits++;else{error=m;break;}}
   turns.push({role:'assistant',text:plan.reply||plan.message,status:'sent'});
   value=plan.next&&autoSteps<4?(autoSteps++,'Next step: '+plan.next):'';
  }
  const text=()=>document.body.textContent||'';
  const filtersButton=[...document.querySelectorAll<HTMLElement>('button,[role=button]')].find(b=>/filter/i.test((b.textContent||'')+(b.getAttribute('aria-label')||''))&&!b.closest('table'));
  log({error,edits,asked:[...asked],hasButton:!!filtersButton,html:document.querySelector('main')!.innerHTML.slice(0,8000)});
  expect(error).toBe('');
  expect(asked.has('excitement')).toBe(true);
  expect(filtersButton).toBeTruthy();
  filtersButton!.click();await new Promise(r=>setTimeout(r,50));
  const panel=text();
  for(const name of ['Salary','Location','Status','Date Saved','Excitement'])expect(panel.toLowerCase()).toContain(name.toLowerCase());
  // "Exact ratings, pick several": the excitement filter takes more than one rating.
  const multi=[...document.querySelectorAll<HTMLElement>('input[type=checkbox],select[multiple],[role=checkbox],[aria-pressed],[role=option]')].filter(el=>!el.closest('table')&&/star|[1-5]/i.test((el.closest('label')?.textContent||el.textContent||el.getAttribute('aria-label')||'')));
  log({multiExcitementControls:multi.length});
  expect(multi.length).toBeGreaterThanOrEqual(2);
 }finally{Element.prototype.getBoundingClientRect=rect;session.destroy();db.close();}
},1800000);
