// @vitest-environment jsdom
import {afterEach,expect,it} from 'vitest';
import {Session} from '../extension/content/session';
import {BrowserStorage,Repository} from '../extension/storage/store';
import {action,response,type AssistantPlan} from '../extension/assistant/schema';
import {interpret} from '../extension/assistant/interpret';
import {connectionControls} from '../extension/assistant/routeConnection';
import {validateTheme} from '../extension/content/theme';
let session:Session;afterEach(()=>{session?.destroy();localStorage.clear();});
async function setup(){document.body.innerHTML='<main id="app"><nav id="rail" style="position:fixed;width:88px;display:flex;flex-direction:column"><a href="/">Home</a><a href="/profile">Profile</a></nav><section id="cards" style="display:flex;flex-direction:row;gap:20px"><article id="source" style="background:white;border-radius:24px;padding:20px;width:420px"><h2>Summary</h2><p>Your recent updates</p><button>Open summary</button></article><article id="activity" style="background:white;border-radius:24px;padding:20px;width:420px"><h2>Activity</h2><p>Latest activity</p><button>Open activity</button></article></section><form id="profile"><label>Name<input id="name" type="text" style="border:1px solid #aaa;border-radius:10px;padding:12px;font:16px Inter;background:#fff;color:#222"></label><button id="save" type="button">Save</button></form></main>';session=new Session(document.getElementById('app')!,new Repository(new BrowserStorage()),new URL('https://example.test/workspace'),{assistantEnabled:true});await session.init();await session.dispatch({type:'edit'});}
const context=async()=>(await session.dispatch({type:'assistantContext'})).assistant!.context!;
async function apply(plan:AssistantPlan){const c=await context();await session.dispatch({type:'assistantApply',token:c.token,plan});}
it('duplicate/adapt: an explicit named original overrides the remembered copy',async()=>{
 await setup();document.getElementById('source')!.click();await session.dispatch({type:'duplicateElement'});let c=await context();const copied=c.lastCard!;const rename=interpret('Change this heading to Feedback',c)!;await session.dispatch({type:'assistantApply',token:c.token,plan:rename});await session.dispatch({type:'interact'});await session.dispatch({type:'edit'});c=await context();const plan=interpret('Duplicate the Summary card with heading Archive',c)!;expect(plan.status).toBe('edit');expect(plan.actions[0].targets).not.toEqual([copied]);await session.dispatch({type:'assistantApply',token:c.token,plan});const headings=[...document.querySelectorAll('#cards h2')].map(n=>n.textContent);expect(headings).toContain('Archive');expect(document.querySelector('#source h2')!.textContent).toBe('Summary');await session.dispatch({type:'undo'});expect([...document.querySelectorAll('#cards h2')].map(n=>n.textContent)).not.toContain('Archive');
});
it('layout: grid to horizontal clears forced full-width card sizing and preserves content',async()=>{
 await setup();let c=await context(),group=c.groups!.find(g=>g.members.length===2)!;await apply(response('edit','Grid',[action('layout',[group.ref],{layout:'grid',columns:2})]));c=await context();group=c.groups!.find(g=>g.members.length===2)!;await apply(response('edit','Horizontal',[action('layout',[group.ref],{layout:'horizontal'})]));for(const article of document.querySelectorAll('article'))expect(article.style.inlineSize).not.toBe('100%');expect(document.querySelectorAll('#cards article')).toHaveLength(2);await session.dispatch({type:'undo'});expect(document.getElementById('cards')!.style.display).toBe('grid');
});
it('theme: rejects unreadable secondary surfaces as well as the primary palette',()=>{
 const theme={background:'#ffffff',surface:'#ffffff',text:'#111827',accent:'#1d4ed8',accentText:'#ffffff',secondary:'#111827',tertiary:'#111827'};expect(()=>validateTheme(theme)).toThrow('contrast');
});
it('precise fields: creates a required email before Save with native input styling and persistence',async()=>{
 await setup();const c=await context(),save=c.elements.find(e=>e.attributes.id==='save')!,name=c.elements.find(e=>e.attributes.id==='name')!;await apply(response('edit','Email',[action('create',[save.ref],{element:'field',text:'Email',inputType:'email',required:true,position:'before',styleRef:name.ref})]));const input=document.querySelector<HTMLInputElement>('input[type=email]')!;expect(input).not.toBeNull();expect(input.required).toBe(true);expect(input.closest('label')!.nextElementSibling!.id).toBe('save');expect(input.style.borderRadius).toBe('10px');input.value='invalid';expect(input.checkValidity()).toBe(false);await session.dispatch({type:'saveTemporary'});const record=(await session.repository.get(session.workflow.id))!;await session.dispatch({type:'loadRecord',record});expect(document.querySelector<HTMLInputElement>('input[type=email]')!.required).toBe(true);expect(document.querySelector<HTMLInputElement>('input[type=email]')!.value).toBe('');
});
it('reorganize: navigation reflows without changing destinations and undo restores it',async()=>{
 await setup();const c=await context(),nav=c.regions!.find(r=>r.kind==='navigation')!;await apply(response('edit','Header',[action('layout',[nav.ref],{layout:'header'})]));expect(document.getElementById('rail')!.style.flexDirection).toBe('row');expect(document.querySelector('#rail a[href="/profile"]')).not.toBeNull();await session.dispatch({type:'undo'});expect(document.getElementById('rail')!.style.position).toBe('fixed');
});
it('connections: a named control resolves without a selection',async()=>{
 await setup();await session.dispatch({type:'interact'});await session.dispatch({type:'edit'});const c=await context();expect(c.selected).toBeNull();expect(connectionControls(c,'Connect the Save button to /profile').map(e=>e.name)).toEqual(['Save']);
});
it('conversation: a theme operation does not steal the remembered card',async()=>{
 await setup();document.getElementById('source')!.click();await session.dispatch({type:'duplicateElement'});let c=await context(),copy=c.lastCard!;await apply({...response('edit','Theme',[action('theme',[c.page!],{theme:{background:'#fff7ed',surface:'#ffffff',text:'#2b1608',accent:'#b84621',accentText:'#ffffff'}})]),scope:'page'});await session.dispatch({type:'interact'});await session.dispatch({type:'edit'});c=await context();expect(interpret('Duplicate it again',c)!.actions[0].targets).toEqual([copy]);
});
it('duplicate/adapt: preserves disabled controls and icons, without copying host handlers',async()=>{
 await setup();const source=document.getElementById('source')!;source.insertAdjacentHTML('beforeend','<button disabled>Unavailable</button>');let called=0;source.querySelector('button')!.onclick=()=>called++;source.click();await session.dispatch({type:'duplicateElement'});const copy=session.findSelected()!;expect(copy.querySelector<HTMLButtonElement>('button[disabled]')!.disabled).toBe(true);await session.dispatch({type:'interact'});copy.querySelector('button')!.click();expect(called).toBe(0);
});
it('compound: accepts the unambiguous generated-button alias without allowing unknown results',async()=>{
 await setup();const c=await context(),source=c.elements.find(e=>e.attributes.id==='source')!;await session.dispatch({type:'assistantApply',token:c.token,plan:response('edit','Copy',[action('duplicate',[source.ref],{text:'Feedback',resultRef:'new:feedback'}),action('style',['new:feedback/button'],{style:{backgroundColor:'#111827',color:'#ffffff'}})])});expect(session.root.querySelectorAll('article')).toHaveLength(3);expect([...session.root.querySelectorAll('article')].find(n=>n.querySelector('h2')?.textContent==='Feedback')!.querySelector('button')!.style.backgroundColor).toBe('rgb(17, 24, 39)');
});

it('theme: dark purple-tinted body text remains body text instead of becoming the accent',async()=>{
 await setup();session.root.style.color='#272435';document.getElementById('source')!.querySelector('button')!.style.cssText='background:#8644ff;color:#fff';await apply({...response('edit','Orange',[action('theme',[(await context()).page!],{theme:{background:'#fff7ed',surface:'#ffffff',text:'#2b1608',accent:'#b84621',accentText:'#ffffff'}})]),scope:'page'});expect(getComputedStyle(document.querySelector('#source h2')!).color).toBe('rgb(43, 22, 8)');expect(getComputedStyle(document.querySelector('#source button')!).backgroundColor).toBe('rgb(184, 70, 33)');
});

it('duplicate/adapt: text grows when a renamed heading wraps at a narrower width',async()=>{
 await setup();const heading=document.querySelector<HTMLElement>('#source h2')!;heading.style.height='26px';document.getElementById('source')!.click();await session.dispatch({type:'duplicateElement'});const copy=session.findSelected()!;expect(copy.querySelector<HTMLElement>('h2')!.style.height).toBe('auto');expect(copy.querySelector<HTMLElement>('h2')!.style.maxWidth).toBe('100%');
});

it('connections: unrelated required form fields do not block card navigation, but still validate Save',async()=>{
 await setup();const c=await context(),save=c.elements.find(e=>e.attributes.id==='save')!;await apply(response('edit','Email',[action('create',[save.ref],{element:'field',text:'Email',inputType:'email',required:true,position:'before'})]));
 document.querySelector<HTMLButtonElement>('#source button')!.click();await session.dispatch({type:'connect',newTitle:'Card destination',event:'click',conditions:[]});const to=session.workflow.edges.at(-1)!.to;await session.dispatch({type:'interact'});document.querySelector<HTMLButtonElement>('#source button')!.click();expect(session.stateId).toBe(to);
 await session.dispatch({type:'back'});await session.dispatch({type:'edit'});document.getElementById('save')!.click();await session.dispatch({type:'connect',newTitle:'Saved form',event:'click',conditions:[]});const destination=session.workflow.edges.at(-1)!.to;await session.dispatch({type:'interact'});document.getElementById('save')!.click();expect(session.stateId).not.toBe(destination);document.querySelector<HTMLInputElement>('input[type=email]')!.value='person@example.test';document.getElementById('save')!.click();expect(session.stateId).toBe(destination);
});
