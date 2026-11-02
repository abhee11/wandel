// @vitest-environment jsdom
// Opt-in verification only: sends synthetic DOM, never a user's browser content.
import {it,expect} from 'vitest';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {database} from '../platform/server/db';
import {createPlatform} from '../platform/server/app';
import {configuration} from '../platform/server/config';
import {MockAIProvider} from '../platform/server/providers';
import {response,type AssistantPlan} from '../extension/assistant/schema';
import {OpenAIAssistant} from '../platform/server/assistant';
import {Session} from '../extension/content/session';
import {Repository,BrowserStorage} from '../extension/storage/store';
import {normalizePlan,validatePlanReferences} from '../extension/assistant/plan';
import {groundPlan} from '../extension/assistant/grounding';
import {interpret} from '../extension/assistant/interpret';
import {designDiscussion} from '../extension/assistant/discussion';
import type {ConversationHistory} from '../extension/assistant/schema';
const live=process.env.WANDEL_RUN_DESIGNER_ACCEPTANCE==='1';
const cases=[
 {id:'theme',prompts:['change the theme to anohter color','Change the whole page theme to blue with readable text. Apply it now.']},
 {id:'navigation',prompts:['Could you make the left panel nav to header']},
 {id:'new-header',prompts:['Could we add a header with contact us and someother links','Add a new header at the top with Contact us linking to /contact and About linking to /about. Keep the existing navigation.']},
 {id:'page-layout',prompts:['Could you arrange the page vertically','Now arrange the page horizontally instead']}
];
for(const test of cases)it.skipIf(!live)('verifies requested '+test.id+' behavior without selecting a target',async()=>{
 const env=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).flatMap(line=>{const match=line.match(/^([A-Z_]+)=(.*)$/);return match?[[match[1],match[2].trim().replace(/^['\"]|['\"]$/g,'')]]:[];}));
 if(!env.OPENAI_API_KEY||!env.OPENAI_MODEL)throw new Error('Local provider not configured');
 const provider=new OpenAIAssistant(env.OPENAI_API_KEY,env.OPENAI_MODEL),db=database(':memory:');
 const attempts:unknown[]=[];let rawPlan:AssistantPlan|undefined;
 const config=configuration({WANDEL_AUTH_MODE:'legacy'},'verification-only-test-pepper-32-characters');
 const app=createPlatform({db,config,ai:new MockAIProvider(),mail:{reset:async()=>{}},assistant:{transcribe:bytes=>provider.transcribe(bytes),plan:async input=>{try{const result=await provider.plan(input);rawPlan=result;attempts.push({instruction:input.instruction,feedback:input.feedback,plan:result});return result;}catch(e){attempts.push({error:(e as Error).message});throw e;}}}});
 const signup=await app.handle(new Request(config.origin+'/api/auth/signup',{method:'POST',headers:{Origin:config.origin,'Content-Type':'application/json'},body:JSON.stringify({email:'verification@example.test',password:'synthetic-test-password-123'})}));const cookie=signup.headers.get('set-cookie')!.split(';')[0];
 async function cloud(instruction:string,context:Parameters<typeof provider.plan>[0]['context'],history:ConversationHistory){const result=await app.handle(new Request(config.origin+'/api/assistant/plan',{method:'POST',headers:{Origin:config.origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({instruction,context,history,requestId:crypto.randomUUID()})}));const data=await result.json();if(!result.ok)return response('unsupported','API '+result.status+': '+(data.error?.message||JSON.stringify(data)));return normalizePlan(data.plan);}

 localStorage.clear();document.body.innerHTML='<div id="app" style="display:flex;flex-direction:row;background:#faf9fc;color:#272435"><aside id="navigation" style="position:fixed;top:0;left:0;bottom:0;width:180px;height:600px;display:flex;flex-direction:column;padding:20px;gap:16px;background:#f0edfa;color:#272435"><strong>Workspace</strong><a href="/home">Home</a><a href="/profile">Profile</a></aside><main id="content" style="margin-left:220px;padding:24px"><h1>Overview</h1><p>Your recent activity</p><div id="cards" style="display:flex;flex-direction:row;gap:16px"><article id="summary" style="background:#ffffff;color:#272435;padding:20px;border-radius:24px"><h2>Summary</h2><p>Workspace details</p><button style="background:rgb(134,68,255);color:white">Open summary</button></article><article id="activity" style="background:#ffffff;color:#272435;padding:20px;border-radius:24px"><h2>Activity</h2><p>Recent updates</p><button style="background:transparent;color:rgb(134,68,255);border:1px solid rgb(134,68,255)">Open activity</button></article></div></main></div>';
 const session=new Session(document.getElementById('app')!,new Repository(new BrowserStorage()),new URL('https://example.test/layout'),{assistantEnabled:true});
 const history:ConversationHistory=[],stages:unknown[]=[];let lastStatus='',executionError='';
 try{
  await session.init();await session.dispatch({type:'edit'});const original=session.root.innerHTML,fixture=session.root.outerHTML;
  for(const instruction of test.prompts){
   let c=(await session.dispatch({type:'assistantContext'})).assistant!.context!;expect(c.selected).toBeNull();
   let plan=interpret(instruction,c);const source=plan?'local':'provider';if(!plan)plan=await cloud(instruction,c,history);
   for(let expanded=0;plan.status==='inspect'&&expanded<2;expanded++){c=(await session.dispatch({type:'assistantContext',inspect:plan.candidates})).assistant!.context!;plan=await cloud(instruction,c,history);}
   const proposed=source==='provider'?(rawPlan||plan):plan;
   validatePlanReferences(plan,c.elements.map(e=>e.ref));if(designDiscussion(instruction)&&plan.status==='edit')plan={...plan,status:'answer',actions:[]};plan=groundPlan(instruction,c,plan);lastStatus=plan.status;
   let applied=false;executionError='';if(plan.status==='edit')try{await session.dispatch({type:'assistantApply',token:c.token,plan});applied=true;}catch(e){executionError=(e as Error).message;}
   history.push({role:'user',text:instruction,status:executionError?'failed':'sent',...(executionError?{error:executionError}:{})},{role:'assistant',text:executionError||plan.message});
   stages.push({instruction,source,selected:c.selected,proposed,grounded:plan,applied,executionError,html:session.root.innerHTML,rootStyle:session.root.style.cssText,workflow:session.workflow,directions:[session.root,document.getElementById('content')!,document.getElementById('cards')!].map(node=>getComputedStyle(node).flexDirection)});
  }
  const nav=document.getElementById('navigation')!,content=document.getElementById('content')!,cards=document.getElementById('cards')!;
  const findings={lastStatus,executionError,operations:session.workflow.states[0].operations.length,navStyle:nav.style.cssText,contentStyle:content.style.cssText,cardsStyle:cards.style.cssText,rootStyle:session.root.style.cssText,links:[...session.root.querySelectorAll('a')].map(a=>({text:a.textContent,href:a.getAttribute('href')})),headings:[...session.root.querySelectorAll('h1,h2,h3')].map(e=>e.textContent),textPreserved:session.root.textContent?.includes('Workspace details')&&session.root.textContent?.includes('Recent updates'),changed:session.root.innerHTML!==original};
  console.info('requested_design_verification',JSON.stringify({case:test.id,findings}));mkdirSync('docs/acceptance',{recursive:true});writeFileSync('docs/acceptance/verified-request-'+test.id+'.json',JSON.stringify({case:test.id,fixture,stages,findings,attempts,record:{draft:session.workflow,enabled:true,currentVersion:0,versions:[]}},null,2));
  expect(executionError).toBe('');expect(lastStatus).toBe('edit');expect(findings.textPreserved).toBe(true);
  if(test.id==='theme'){expect(session.workflow.states[0].operations.some(op=>op.kind==='theme')).toBe(true);expect(getComputedStyle(session.root).backgroundColor).not.toBe('rgb(250, 249, 252)');expect(getComputedStyle(document.querySelector('button')!).backgroundColor).not.toBe('ButtonFace');}
  if(test.id==='navigation'){expect(nav.style.flexDirection).toBe('row');expect(['static','relative','sticky']).toContain(getComputedStyle(nav).position);expect(content.style.marginLeft).toBe('0px');expect(session.root.querySelectorAll('a')).toHaveLength(2);}
  if(test.id==='new-header'){const contact=[...session.root.querySelectorAll('a')].find(a=>/contact us/i.test(a.textContent||'')),about=[...session.root.querySelectorAll('a')].find(a=>/^about$/i.test(a.textContent||''));expect(contact?.getAttribute('href')).toBe('/contact');expect(about?.getAttribute('href')).toBe('/about');expect(contact?.closest('header,[role=banner]')).toBeTruthy();}
  if(test.id==='page-layout'){expect(stages).toHaveLength(2);expect(cards.style.flexDirection==='row'||content.style.flexDirection==='row'||session.root.style.flexDirection==='row').toBe(true);expect((stages[0] as {directions:string[]}).directions).toContain('column');expect((stages[0] as {applied:boolean}).applied).toBe(true);}
 }finally{session.destroy();db.close();}
},180000);
