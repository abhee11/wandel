// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect} from 'vitest';
import {Session} from '../extension/content/session';
import {Repository,BrowserStorage} from '../extension/storage/store';
import {action,response,type AssistantPlan} from '../extension/assistant/schema';
import {groundPlan} from '../extension/assistant/grounding';
import {NavigationURLSchema} from '../extension/shared/model';
let session:Session;
const palette={background:'#eff6ff',surface:'#ffffff',text:'#172554',accent:'#1d4ed8',accentText:'#ffffff'};
beforeEach(async()=>{localStorage.clear();document.body.innerHTML='<div id="app" style="display:flex"><aside id="nav" style="position:fixed;width:180px;height:600px;display:flex;flex-direction:column"><a href="/home">Home</a><a href="/profile">Profile</a></aside><main id="content" style="margin-left:220px;padding-left:220px"><h1>Overview</h1><div id="cards" style="display:flex;flex-direction:row"><article style="background:white"><h2>Summary</h2><button id="open" style="background:rgb(134,68,255);color:white">Open</button></article><article style="background:white"><h2>Activity</h2></article></div><div data-private style="color:red">Private</div></main></div>';session=new Session(document.getElementById('app')!,new Repository(new BrowserStorage()),new URL('https://example.test/layout'),{assistantEnabled:true});await session.init();await session.dispatch({type:'edit'});});
afterEach(()=>session.destroy());
const context=async()=>(await session.dispatch({type:'assistantContext'})).assistant!.context!;
async function run(plan:AssistantPlan,instruction:string){const c=await context();const grounded=groundPlan(instruction,c,plan);expect(grounded.status).toBe('edit');await session.dispatch({type:'assistantApply',token:c.token,plan:grounded});}
it('themes an entire page without a selection, preserves private content, and supports undo and save/reload',async()=>{
 const c=await context();expect(c.page).toBeDefined();expect(c.selected).toBeNull();await run({...response('edit','Blue theme',[action('theme',[c.page!],{theme:palette})]),scope:'page'},'Change the whole page theme to blue');
 expect(getComputedStyle(session.root).backgroundColor).toBe('rgb(239, 246, 255)');expect(getComputedStyle(document.getElementById('open')!).backgroundColor).toBe('rgb(29, 78, 216)');expect(document.querySelector('[data-private]')!.getAttribute('style')).toBe('color:red');expect(session.root.querySelectorAll('article')).toHaveLength(2);
 await session.dispatch({type:'undo'});expect(session.root.style.backgroundColor).toBe('');await session.dispatch({type:'redo'});await session.dispatch({type:'saveTemporary'});const record=(await session.repository.get(session.workflow.id))!;await session.dispatch({type:'loadRecord',record});expect(getComputedStyle(document.getElementById('open')!).color).toBe('rgb(255, 255, 255)');
});
it('converts navigation, resets dependent spacing and preserves original links',async()=>{
 const c=await context(),nav=c.regions!.find(r=>r.kind==='sidebar')!;await run({...response('edit','Header',[action('layout',[nav.ref],{layout:'header'})]),scope:'page'},'Could you make the left panel nav to header');
 expect(document.getElementById('nav')!.style.flexDirection).toBe('row');expect(document.getElementById('content')!.style.marginLeft).toBe('0px');expect(document.getElementById('content')!.style.paddingLeft).toBe('0px');expect(document.querySelector('a')!.getAttribute('href')).toBe('/home');await session.dispatch({type:'undo'});expect(document.getElementById('nav')!.style.position).toBe('fixed');expect(document.getElementById('content')!.style.marginLeft).toBe('220px');
});
it('creates a semantic header with safe working anchors, and restores it from a saved workflow',async()=>{
 const c=await context();await run({...response('edit','Header',[action('create',[c.page!],{element:'header',text:'Contact navigation',resultRef:'new:header',position:'inside'}),action('create',['new:header'],{element:'link',text:'Contact us',href:'/contact',position:'inside'}),action('create',['new:header'],{element:'link',text:'About',href:'/about',position:'inside'})]),scope:'page'},'Add a header with Contact us /contact and About /about');
 expect(document.getElementById('content')!.firstElementChild?.tagName).toBe('HEADER');const link=document.querySelector<HTMLAnchorElement>('header a')!;expect(link.getAttribute('href')).toBe('/contact');expect(link.nextElementSibling!.getAttribute('href')).toBe('/about');expect(document.getElementById('nav')!.style.position).toBe('fixed');
 await session.dispatch({type:'interact'});let intercepted=true;link.addEventListener('click',e=>{intercepted=e.defaultPrevented;e.preventDefault();},{once:true});link.click();expect(intercepted).toBe(false);
 await session.dispatch({type:'saveTemporary'});const record=(await session.repository.get(session.workflow.id))!;await session.dispatch({type:'loadRecord',record});expect(document.querySelector('header a')!.getAttribute('href')).toBe('/contact');await session.dispatch({type:'undo'}); // history after load is intentionally empty
});
it('rearranges page groups in both directions without replacing content',async()=>{
 let c=await context();const group=c.groups!.find(g=>g.members.length===2)!;for(const layout of ['vertical','horizontal'] as const){await run({...response('edit','Rearranged',[action('layout',[group.ref],{layout})]),scope:'page'},'Arrange the page '+layout);expect(document.getElementById('cards')!.style.flexDirection).toBe(layout==='vertical'?'column':'row');c=await context();}expect(document.querySelectorAll('article')).toHaveLength(2);expect(document.querySelector('h2')!.textContent).toBe('Summary');
});
it('rejects unsafe destinations, unreadable palettes and misleading layout success atomically',async()=>{
 for(const href of ['javascript:alert(1)','//evil.test','/\\evil.test','data:text/html,hi','/with space'])expect(NavigationURLSchema.safeParse(href).success).toBe(false);
 for(const href of ['/contact','https://example.test/about','mailto:help@example.test'])expect(NavigationURLSchema.safeParse(href).success).toBe(true);
 let c=await context();const before=JSON.stringify(session.workflow);await expect(session.dispatch({type:'assistantApply',token:c.token,plan:{...response('edit','Bad',[action('theme',[c.page!],{theme:{...palette,text:'#ffffff'}})]),scope:'page'}})).rejects.toThrow('contrast');expect(JSON.stringify(session.workflow)).toBe(before);
 c=await context();const cards=c.groups![0].ref;await session.dispatch({type:'assistantApply',token:c.token,plan:{...response('edit','Vertical',[action('layout',[cards],{layout:'vertical',style:{flexDirection:'row'}})]),scope:'page'}});expect(document.getElementById('cards')!.style.flexDirection).toBe('column');await session.dispatch({type:'undo'});expect(JSON.stringify(session.workflow)).toBe(before);expect(document.getElementById('cards')!.style.flexDirection).toBe('row');
});
it('clears full-width column sizing when a page returns to horizontal flow',async()=>{
 for(const layout of ['vertical','horizontal'] as const){const c=await context();await run({...response('edit','Reflow',[action('layout',[c.page!],{layout})]),scope:'page'},'Arrange the page '+layout);}
 expect(document.getElementById('nav')!.style.inlineSize).toBe('auto');expect(document.getElementById('content')!.style.inlineSize).toBe('auto');expect(document.getElementById('nav')!.style.flexDirection).toBe('column');
});
it('does not let broad design scope authorize arbitrary deletion or unrelated text edits',async()=>{
 const c=await context(),heading=c.elements.find(e=>e.tag==='h1')!;for(const kind of ['remove','text'] as const)expect(groundPlan('Change the page theme',c,{...response('edit','Wrong',[action(kind,[heading.ref],{text:'Wrong'})]),scope:'page'}).status).toBe('clarify');
});
