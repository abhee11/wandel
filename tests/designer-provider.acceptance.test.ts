// @vitest-environment jsdom
// Opt-in: sends only the synthetic fixture below, never a user's browser content.
import {it,expect} from 'vitest';
import {readFileSync,writeFileSync} from 'node:fs';
import {OpenAIAssistant} from '../platform/server/assistant';
import {Session} from '../extension/content/session';
import {Repository,BrowserStorage} from '../extension/storage/store';
import {normalizePlan,validatePlanReferences} from '../extension/assistant/plan';
import {groundPlan} from '../extension/assistant/grounding';
const live=process.env.WANDEL_RUN_DESIGNER_ACCEPTANCE==='1';
it.skipIf(!live)('interprets real layout and compound design instructions against synthetic DOM',async()=>{
 const env=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).flatMap(line=>{const match=line.match(/^([A-Z_]+)=(.*)$/);return match?[[match[1],match[2].trim().replace(/^['\"]|['\"]$/g,'')]]:[];}));if(!env.OPENAI_API_KEY||!env.OPENAI_MODEL)throw new Error('Configure the local provider for this opt-in acceptance check.');
 const provider=new OpenAIAssistant(env.OPENAI_API_KEY,env.OPENAI_MODEL);
 document.body.innerHTML='<main id="canvas" style="display:flex;flex-direction:row;gap:16px"><article id="summary" style="background:#f0edfa;color:#272435;padding:20px;border-radius:24px"><h2>Summary</h2><p>Details about your workspace</p><button>Open</button></article><article id="activity"><h2>Activity</h2><p>Recent updates</p></article></main>';
 const session=new Session(document.querySelector('main')!,new Repository(new BrowserStorage()),new URL('https://example.test/settings'),{assistantEnabled:true});
 const turns:{role:'user'|'assistant';text:string;status?:'sent'}[]=[];
 try{
  await session.init();await session.dispatch({type:'edit'});
  for(const instruction of ['Stack these two cards vertically with a 24px gap and center them horizontally. Keep their contents.','Duplicate the Summary card with heading Feedback, give the copy a dark background with readable light text, and put the copy before the original.']){
   const c=(await session.dispatch({type:'assistantContext'})).assistant!.context!;
   const plan=normalizePlan(await provider.plan({instruction,context:c}));console.info('synthetic_layout_plan',JSON.stringify({instruction,plan}));validatePlanReferences(plan,c.elements.map(e=>e.ref));expect(groundPlan(instruction,c,plan).status,plan.message).toBe('edit');
   await session.dispatch({type:'assistantApply',token:c.token,plan});turns.push({role:'user',text:instruction,status:'sent'},{role:'assistant',text:plan.message});
   if(instruction.startsWith('Stack')){expect(session.root.style.flexDirection).toBe('column');expect(session.root.style.alignItems).toBe('center');expect(session.root.style.gap).toBe('24px');}
   else{expect(session.root.querySelectorAll('article')).toHaveLength(3);const feedback=[...session.root.querySelectorAll('article')].find(node=>node.querySelector('h2')?.textContent==='Feedback') as HTMLElement;expect(feedback).toBeDefined();const original=document.getElementById('summary')!;expect(session.root.firstElementChild===feedback||Number(feedback.style.order)<Number(original.style.order||0)).toBe(true);expect(document.getElementById('summary')!.querySelector('h2')!.textContent).toBe('Summary');}
  }
  if(process.env.WANDEL_DESIGNER_CAPTURE==='1')writeFileSync('docs/acceptance/designer-provider-workflow.json',JSON.stringify({record:{draft:session.workflow,enabled:true,currentVersion:0,versions:[]},turns},null,2));
 }finally{session.destroy();}
},120000);
it.skipIf(!live)('converts left navigation into a header through the real planner with no selected target',async()=>{
 const env=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).flatMap(line=>{const match=line.match(/^([A-Z_]+)=(.*)$/);return match?[[match[1],match[2].trim().replace(/^['\"]|['\"]$/g,'')]]:[];}));
 const provider=new OpenAIAssistant(env.OPENAI_API_KEY,env.OPENAI_MODEL);
 document.body.innerHTML='<div id="app" style="display:flex;flex-direction:row"><aside id="navigation" style="position:fixed;top:0;left:0;bottom:0;width:180px;height:600px;display:flex;flex-direction:column;padding:20px;gap:16px;background:#f0edfa"><strong>Workspace</strong><a href="/home">Home</a><a href="/profile">Profile</a><a href="/settings">Settings</a></aside><main id="content" style="margin-left:220px;padding:24px"><h1>Overview</h1><p>Your recent activity</p><button>New project</button></main></div>';
 const session=new Session(document.getElementById('app')!,new Repository(new BrowserStorage()),new URL('https://example.test/layout'),{assistantEnabled:true});
 try{
  await session.init();await session.dispatch({type:'edit'});const c=(await session.dispatch({type:'assistantContext'})).assistant!.context!;expect(c.selected).toBeNull();
  const instruction='can you make the left panel and make it into header instead';const plan=normalizePlan(await provider.plan({instruction,context:c}));console.info('synthetic_header_plan',JSON.stringify(plan));validatePlanReferences(plan,c.elements.map(e=>e.ref));expect(groundPlan(instruction,c,plan).status,plan.message).toBe('edit');await session.dispatch({type:'assistantApply',plan,token:c.token});
  const nav=document.getElementById('navigation')!,content=document.getElementById('content')!,style=getComputedStyle(nav);
  expect(['static','relative','sticky']).toContain(style.position);expect(style.flexDirection).toBe('row');expect(nav.style.inlineSize==='100%'||nav.style.width==='100%').toBe(true);expect(content.style.marginLeft).toBe('0px');expect(nav.querySelectorAll('a')).toHaveLength(3);expect(content.querySelector('h1')!.textContent).toBe('Overview');
  expect(session.root.style.flexDirection==='column'||session.root.style.display==='block').toBe(true);
  if(process.env.WANDEL_DESIGNER_CAPTURE==='1')writeFileSync('docs/acceptance/designer-header-workflow.json',JSON.stringify({record:{draft:session.workflow,enabled:true,currentVersion:0,versions:[]},turns:[{role:'user',text:instruction,status:'sent'},{role:'assistant',text:plan.message}]},null,2));
 }finally{session.destroy();}
},120000);
it.skipIf(!live)('creates a required email field with native styling through the real planner',async()=>{
 const env=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).flatMap(line=>{const match=line.match(/^([A-Z_]+)=(.*)$/);return match?[[match[1],match[2].trim().replace(/^['\"]|['\"]$/g,'')]]:[];}));
 const provider=new OpenAIAssistant(env.OPENAI_API_KEY,env.OPENAI_MODEL);
 document.body.innerHTML='<main id="app"><h1>Profile settings</h1><form><label>Name<input id="name" type="text" style="padding:12px;border:1px solid #aaa;border-radius:10px;background:#fff;color:#222"></label><button id="save" type="button">Save</button></form></main>';
 const session=new Session(document.getElementById('app')!,new Repository(new BrowserStorage()),new URL('https://example.test/settings'),{assistantEnabled:true});
 try{
  await session.init();await session.dispatch({type:'edit'});const c=(await session.dispatch({type:'assistantContext'})).assistant!.context!;
  const instruction='Add a required Email field immediately before Save. Match the existing Name input styling.';
  const plan=normalizePlan(await provider.plan({instruction,context:c}));validatePlanReferences(plan,c.elements.map(e=>e.ref));expect(groundPlan(instruction,c,plan).status,plan.message).toBe('edit');
  await session.dispatch({type:'assistantApply',token:c.token,plan});const input=session.root.querySelector<HTMLInputElement>('input[type=email]')!;
  expect(input).not.toBeNull();expect(input.required).toBe(true);expect(input.style.borderRadius).toBe('10px');expect(input.closest('label')!.nextElementSibling?.id).toBe('save');input.value='bad';expect(input.checkValidity()).toBe(false);
 }finally{session.destroy();}
},120000);
