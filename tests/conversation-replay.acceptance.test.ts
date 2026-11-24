// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://replay.test/"}
// Opt-in, live AI: whole conversations from beta reports, replayed against captured pages. The panel's own request loop
// (runRequest), the real client and the real server run; only the browser around them is simulated: pages are captured
// HTML (words blanked when they came from a user's account), moving between pages loads the next capture, and the
// panel's outer loop (scope changes, next steps, kept requests) is reproduced by the small headless panel below.
// REPLAY_CASE picks a case; every reply is checked for dead ends the user should never see.
import {it,expect} from 'vitest';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {database} from '../platform/server/db';
import {createPlatform} from '../platform/server/app';
import {configuration} from '../platform/server/config';
import {MockAIProvider} from '../platform/server/providers';
import {OpenAIAssistant} from '../platform/server/assistant';
import {Session} from '../extension/content/session';
import {Repository,BrowserStorage} from '../extension/storage/store';
import {runRequest} from '../extension/assistant/requestLoop';
import {planConversation,verifyConversation} from '../extension/assistant/client';
import {type ChatTurn} from '../extension/assistant/conversation';
import {peekCarry,dropCarry} from '../extension/assistant/carry';
import {contextAtURL,stateURL,type LiveContext,type LiveNavigation} from '../extension/shared/liveNavigation';
import {accountConfig} from '../extension/shared/accountConfig';
import type {Command,Snapshot} from '../extension/shared/model';
import type {AssistantPlan} from '../extension/assistant/schema';
const live=process.env.WANDEL_RUN_DESIGNER_ACCEPTANCE==='1';
const scratch=process.env.REPLAY_PAGES||'';
type Step={user:string}|{switchTo:string};
type Case={pages:Record<string,string>;start:string;script:Step[];answer:(question:string)=>string;check:(page:{url:string;root:HTMLElement})=>void;
 /** Clicking an element whose text matches takes the app to that page, as the app's own switcher would. */
 links?:{text:RegExp;url:string}[]};
/** Words the user must never see: fixed dead ends from before 0.4.8. */
const deadEnds=[/Open it from Your flow/i,/Existing application/i,/Active tab changed/i,/couldn’t confirm you’re signed in/i,/pick one of them/i,/open that screen first/i];
const cases:Record<string,()=>Case>={
 // Same path, different query, like M2's activities: copy something from the first page onto the second.
 'hn-pages':()=>({pages:{'https://replay.test/news?p=1':scratch+'/hn-p1.html','https://replay.test/news?p=2':scratch+'/hn-p2.html'},start:'https://replay.test/news?p=1',
  script:[{user:'Look at the first story row on this page. I will switch to page 2 next and want it copied there.'},{switchTo:'https://replay.test/news?p=2'},{user:'ok, now copy that first story row from page 1 to the top of this list'}],
  answer:()=>'Yes, copy the exact row from page 1 and put it at the top here',
  check:({url,root})=>{expect(url).toContain('p=2');const owned=[...root.querySelectorAll('[data-dx-owned]')].map(n=>n.textContent||'').join(' ');expect(owned.length).toBeGreaterThan(20);}}),
 // Like M2: the user only had Wandel look at page 1, then asks for its row on page 2. Wandel has to go back, copy, return, paste.
 'hn-fetch':()=>({pages:{'https://replay.test/news?p=1':scratch+'/hn-p1.html','https://replay.test/news?p=2':scratch+'/hn-p2.html'},start:'https://replay.test/news?p=1',
  script:[{user:'Have a look at the first story row on this page, I will want it on page 2. Do not change anything yet.'},{switchTo:'https://replay.test/news?p=2'},{user:'add that first story row from page 1 at the top of this list'}],
  answer:()=>'Yes, use the exact row from page 1 and put it at the top here',
  check:({url,root})=>{expect(url).toContain('p=2');const owned=[...root.querySelectorAll('[data-dx-owned]')].map(n=>n.textContent||'').join(' ');expect(owned.length).toBeGreaterThan(20);}}),
 // The M2 report (2026-11-24): understand Activity 4, switch to Activity 5, add Activity 4's My Record card on top.
 'm2-my-record':()=>({pages:{'https://replay.test/groups/1?activityContainerId=4':'tests/fixtures/m2-activity-4.html','https://replay.test/groups/1?activityContainerId=5':'tests/fixtures/m2-activity-5.html'},start:'https://replay.test/groups/1?activityContainerId=4',
  links:[{text:/^\s*Activity 4\s*$/,url:'https://replay.test/groups/1?activityContainerId=4'},{text:/^\s*Activity 5\s*$/,url:'https://replay.test/groups/1?activityContainerId=5'}],
  script:[{user:'I want to create a new page which is a combination of Activity 4 and Activity 5. For now the only addition should be the my record card preview on top of activity 5. First understand what activity 4 looks like before i switch over to activity 5.'},{switchTo:'https://replay.test/groups/1?activityContainerId=5'},{user:'ok done, add the my record card here'}],
  answer:()=>'Yes, use the exact My Record card from Activity 4 and put it above Activity 5’s cards',
  check:({url,root})=>{expect(url).toContain('activityContainerId=5');const card=[...root.querySelectorAll<HTMLElement>('[data-dx-owned]')].find(n=>/My Record/.test(n.textContent||''));expect(card).toBeTruthy();}}),
};
it.skipIf(!live||!process.env.REPLAY_CASE)('replays the conversation without dead ends and reaches the goal',async()=>{
 const spec=cases[process.env.REPLAY_CASE!]();for(const file of Object.values(spec.pages))if(!existsSync(file))throw new Error('Missing page capture: '+file);
 const env=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).flatMap(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);return m?[[m[1],m[2].trim().replace(/^['"]|['"]$/g,'')]]:[];}));
 const provider=new OpenAIAssistant(env.OPENAI_API_KEY,env.OPENAI_MODEL),db=database(':memory:');
 const config=configuration({WANDEL_AUTH_MODE:'legacy'},'verification-only-test-pepper-32-characters');
 const app=createPlatform({db,config,ai:new MockAIProvider(),mail:{reset:async()=>{}},assistant:{transcribe:bytes=>provider.transcribe(bytes),plan:input=>provider.plan(input)}});
 const cookie=(await app.handle(new Request(config.origin+'/api/auth/signup',{method:'POST',headers:{Origin:config.origin,'Content-Type':'application/json'},body:JSON.stringify({email:'replay@example.test',password:'synthetic-test-password-123'})}))).headers.get('set-cookie')!.split(';')[0];
 const trace:unknown[]=[];const log=(x:unknown)=>{trace.push(x);writeFileSync(process.env.TRACE_OUT||'/dev/null',JSON.stringify(trace,null,2));};
 // The browser around the panel: extension storage, the account token, and the API reaching the in-process server.
 const areas={session:new Map<string,unknown>(),local:new Map<string,unknown>()};
 const area=(m:Map<string,unknown>)=>({get:async(k:string|null)=>k===null?Object.fromEntries(m):m.has(k)?{[k]:m.get(k)}:{},set:async(v:Record<string,unknown>)=>{for(const [k,x] of Object.entries(v))m.set(k,x);},remove:async(k:string)=>{m.delete(k);}});
 (globalThis as any).chrome={runtime:{id:'replay',sendMessage:async(m:any)=>m?.type==='WANDEL_ACCOUNT_TOKEN'?{token:'replay'}:{}},storage:{session:area(areas.session),local:{...area(areas.local),onChanged:{addListener(){}}},onChanged:{addListener(){}}}};
 const realFetch=globalThis.fetch;
 globalThis.fetch=(async(input:any,init:any={})=>{const url=String(input);if(!url.startsWith(accountConfig.apiOrigin))return realFetch(input,init);
  const headers={...init.headers,Origin:config.origin,Cookie:cookie};delete (headers as any).Authorization;
  return app.handle(new Request(config.origin+url.slice(accountConfig.apiOrigin.length),{...init,headers}));}) as typeof fetch;
 (globalThis as any).confirm=()=>true;
 const rect=Element.prototype.getBoundingClientRect;Element.prototype.getBoundingClientRect=function(){return {x:0,y:0,top:0,left:0,right:120,bottom:32,width:120,height:32,toJSON(){}} as DOMRect;};
 // Pages and moving between them, as Chrome and Wandel's background do.
 const repository=new Repository(new BrowserStorage());let session!:Session,url=spec.start,generation=0,moving:Promise<void>=Promise.resolve();
 let live:LiveContext|null=null;const nav:LiveNavigation&{paused:any}={paused:null,sharedWait:null,
  read:async()=>{if(!live)return null;const record=await repository.get(live.workflowId);if(!record)return null;const next=contextAtURL(record.draft,live,url);if(!next){nav.paused={...live,name:record.draft.name,url:stateURL(record.draft,live.stateId)};return null;}nav.paused=null;live=next;return live;},
  remember:async c=>{live=c;},clear:async()=>{live=null;},go:async(to,c)=>{live=c;moving=load(to);}};
 const load=async(to:string)=>{generation++;session?.destroy();url=to;history.replaceState(null,'',to);localStorage.setItem('replay:url',to);
  document.body.innerHTML=readFileSync(spec.pages[to],'utf8').replace(/^<!--.*?-->\n/,'');
  session=new Session(document.querySelector<HTMLElement>('[data-site-root]')!,repository,new URL(to),{assistantEnabled:true,liveNavigation:nav});
  await session.init();await session.dispatch({type:'edit'});log({loaded:to,state:session.snapshot().stateId,paused:!!nav.paused});await panelSees();};
 document.addEventListener('click',event=>{const hit=(spec.links||[]).find(link=>link.text.test((event.target as HTMLElement)?.textContent||''));if(hit&&hit.url!==url){moving=load(hit.url);}},true);
 // The headless panel: the same outer loop as AssistantPanel (scope, kept requests, next steps, questions).
 const turns:ChatTurn[]=[],replies:string[]=[];const ref=<T,>(current:T)=>({current});
 const reopen=ref<{text:string;id:string;hops?:number}|null>(null),clarificationRequest=ref<{text:string;id:string;scope:string}|null>(null),continuation=ref<string|null>(null),epoch=ref(0);
 const scopeOf=(s:Snapshot)=>s.workflow.id+':'+s.stateId+':'+s.workflow.route;let scope='';const scopeRef={get current(){return scope;}};
 const queue:Promise<void>[]=[];let autoSteps=0;
 async function panelSees(){const s=session.snapshot();
  // Wandel's own move onto a page outside the flow joins the flow without asking (the panel's resumeChoice effect).
  if((s as any).resumeChoice&&(await peekCarry()||reopen.current)){await session.dispatch({type:'continueWorkflowHere'});}
  const next=scopeOf(session.snapshot());if(next===scope)return;scope=next;epoch.current++;
  const moved=reopen.current;reopen.current=null;if(moved){await dropCarry();queue.push(submit(moved.text,false,moved.id,moved.hops||1));}}
 const bridge={send:async(command:Command)=>{const at=generation;await moving;if(at!==generation)throw new Error('Active tab changed. Try again on the current page.');const result=await session.dispatch(command).catch((error:unknown)=>{log({command:command.type,error:error instanceof Error?error.message.slice(0,400):String(error)});throw error;});await moving;if(at!==generation)throw new Error('Active tab changed. Try again on the current page.');return result;}};
 async function submit(text:string,recordTurn=true,existingId?:string,hops=0):Promise<void>{
  const followUp=clarificationRequest.current;clarificationRequest.current=null;const value=text.trim(),request=++epoch.current,origin=scope,userId=existingId||crypto.randomUUID(),controller=new AbortController();
  if(recordTurn)turns.push({id:userId,role:'user',text:value,status:'sending'} as ChatTurn);log({user:value,hops});
  let waiting=false;
  try{({waiting}=await runRequest({bridge,context:async(inspect,instruction)=>(await bridge.send({type:'assistantContext',chat:true,...(inspect?{inspect}:{}),...(instruction?{instruction}:{})} as Command)).assistant!.context!,
   capture:async()=>undefined,planConversation:(...args)=>planConversation(...args).then(plan=>{const page=args[1];log({plan:plan.status,views:page.views.map(v=>v.title.slice(0,30)+' '+(v.route||'')+(v.id===page.stateId?' (here)':'')),opens:plan.status==='open'?page.elements.find(e=>e.ref===plan.candidates[0])?.name?.slice(0,60):undefined,message:plan.message.slice(0,300),candidates:plan.candidates,actions:plan.actions.map(a=>a.kind+' '+a.targets.join(',')),next:plan.next});return plan;}),verifyConversation:(...args)=>verifyConversation(...args),
   talkContext:page=>page,workflow:()=>session.snapshot().workflow,setProgress:t=>log({progress:t}),setMessage:t=>{replies.push(t);log({message:t});},
   answer:t=>{replies.push(t);turns.push({role:'assistant',text:t,status:'sent'} as ChatTurn);log({reply:t});},remember:async(plan:AssistantPlan)=>{if(plan.memory)await bridge.send({type:'assistantRemember',memory:plan.memory} as Command).catch(()=>{});},
   setClarification:()=>{},applying:()=>{},onSave:()=>{},stillHere:()=>request===epoch.current&&!controller.signal.aborted&&origin===scope,
   conversation:{get current(){return turns;}} as any,reopen,lastPlan:ref(''),spokenLine:ref(''),clarificationRequest,continuation,pending:ref(''),watchRequest:ref(null),epoch,scopeRef:scopeRef as any,referenceRef:ref(undefined),
   request,controller,followUp,recordTurn,value,origin,userId,hops}));}
  // As the panel: a failure is shown only while this request is still the current one; a request that moved screens has ended.
  catch(error){const m=error instanceof Error?error.message:String(error);log({failed:m,shown:request===epoch.current});if(request===epoch.current)replies.push(m);return;}
  await moving;await panelSees();
  if(waiting)return;
  // As the panel's finally block: a suggested next step runs by itself, at most 4 in a row.
  const next=continuation.current;continuation.current=null;if(next&&request===epoch.current&&autoSteps<4){autoSteps++;await submit('Next step: '+next,true,undefined,0);}
 }
 try{
  await load(spec.start);
  for(const step of spec.script){
   if('switchTo' in step){await load(step.switchTo);if((session.snapshot() as any).resumeChoice)await session.dispatch({type:'continueWorkflowHere'});await panelSees();continue;}
   autoSteps=0;await submit(step.user);
   for(let asked=0;asked<3;asked++){while(queue.length)await queue.shift();if(!clarificationRequest.current)break;await submit(spec.answer(clarificationRequest.current.text));}
   while(queue.length)await queue.shift();
  }
  log({replies,url,owned:[...document.querySelectorAll('[data-dx-owned]')].map(n=>(n.textContent||'').slice(0,80)).slice(0,6)});
  for(const reply of replies)for(const bad of deadEnds)expect(reply,'dead end shown to the user').not.toMatch(bad);
  spec.check({url,root:document.querySelector<HTMLElement>('[data-site-root]')!});
 }finally{Element.prototype.getBoundingClientRect=rect;globalThis.fetch=realFetch;session?.destroy();db.close();}
},1800000);
