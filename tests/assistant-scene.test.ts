// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect} from 'vitest';
import {Session} from '../extension/content/session';
import {Repository,BrowserStorage} from '../extension/storage/store';
import {action,response} from '../extension/assistant/schema';
import {interpret} from '../extension/assistant/interpret';
import {groundPlan} from '../extension/assistant/grounding';
let session:Session;
beforeEach(()=>localStorage.clear());afterEach(()=>session?.destroy());
async function setup(html:string){document.body.innerHTML='<div id="app">'+html+'</div>';session=new Session(document.getElementById('app')!,new Repository(new BrowserStorage()),new URL('https://example.test/layout'),{assistantEnabled:true});await session.init();await session.dispatch({type:'edit'});}
const context=async()=>(await session.dispatch({type:'assistantContext'})).assistant!.context!;
it('captures a pair of styled div cards and shared layout without selection, and stacks them reversibly',async()=>{
 await setup('<div id="cards" style="display:flex"><div style="border-radius:20px"><h2>Summary</h2><p>Details</p></div><div style="border-radius:20px"><h2>Activity</h2><p>Updates</p></div></div>');
 const c=await context(),instruction='the two cards - arrange them veritically instead of horizonatally';expect(c.selected).toBeNull();expect(c.groups).toHaveLength(1);expect(c.groups![0].members).toHaveLength(2);expect(interpret(instruction,c)).toBeNull();
 const plan=response('edit','Stacked the cards.',[action('style',[c.groups![0].ref],{style:{display:'flex',flexDirection:'column',gap:24}})]);expect(groundPlan(instruction,c,plan).status).toBe('edit');await session.dispatch({type:'assistantApply',plan,token:c.token});expect(document.getElementById('cards')!.style.flexDirection).toBe('column');expect(document.querySelectorAll('h2')).toHaveLength(2);await session.dispatch({type:'undo'});expect(document.getElementById('cards')!.style.flexDirection).toBe('');
});
it('asks about multiple matching groups instead of silently choosing one',async()=>{
 await setup('<section id="reports"><article><h2>Sales</h2></article><article><h2>Costs</h2></article></section><section id="people"><article><h2>Team</h2></article><article><h2>Guests</h2></article></section>');const c=await context(),groups=c.groups!.filter(g=>g.members.length===2);expect(groups).toHaveLength(2);
 const plan=groundPlan('Arrange the two cards vertically',c,response('edit','Stacked',[action('style',[groups[0].ref],{style:{flexDirection:'column'}})]));expect(plan.status).toBe('clarify');expect(plan.candidates).toEqual(groups.map(g=>g.ref));expect(session.workflow.states[0].operations).toHaveLength(0);
});
it('turns a left navigation into a header with its contents and main area preserved, independently of selected text',async()=>{
 await setup('<aside id="side" style="position:fixed;left:0;top:0;bottom:0;width:180px;height:600px;display:flex;flex-direction:column"><a href="/home">Home</a><a href="/profile">Profile</a></aside><main id="content" style="margin-left:180px"><h1>Workspace</h1><button id="other">Open card</button></main>');
 document.getElementById('other')!.click();const c=await context(),instruction='can you make the left panel and make it into header instead';const side=c.regions!.find(r=>r.kind==='sidebar')!,main=c.regions!.find(r=>r.kind==='main')!;
 expect(c.elements.find(e=>e.ref===c.selected)?.name).toBe('Open card');expect(side.position).toBe('left');expect(interpret(instruction,c)).toBeNull();expect(interpret('Make the left panel green',c)).toBeNull();
 const plan=response('edit','Moved navigation to the top.',[action('reorder',[side.ref],{relativeTo:main.ref,position:'before'}),action('style',[side.ref],{style:{position:'static',top:'auto',bottom:'auto',left:'auto',inlineSize:'100%',blockSize:'auto',display:'flex',flexDirection:'row',gap:20}}),action('style',[main.ref],{style:{marginLeft:0}})]);
 expect(groundPlan(instruction,c,plan).status).toBe('edit');await session.dispatch({type:'assistantApply',plan,token:c.token});const nav=document.getElementById('side')!;expect(nav.style.position).toBe('static');expect(nav.style.inlineSize).toBe('100%');expect(nav.style.blockSize).toBe('auto');expect(nav.querySelectorAll('a')).toHaveLength(2);expect(nav.querySelector('a')!.getAttribute('href')).toBe('/home');expect(document.getElementById('content')!.style.marginLeft).toBe('0px');expect(document.getElementById('other')!.style.cssText).toBe('');
 await session.dispatch({type:'saveTemporary'});const record=(await session.repository.get(session.workflow.id))!;await session.dispatch({type:'loadRecord',record});expect(nav.style.flexDirection).toBe('row');await session.dispatch({type:'reset'});expect(nav.style.position).toBe('fixed');expect(nav.style.flexDirection).toBe('column');
});
it('excludes private, hidden and editor regions and does not hijack named typography commands',async()=>{
 await setup('<aside hidden><a>Hidden</a></aside><aside data-private><a>Private</a></aside><nav data-dx-ignore><button>Wandel</button></nav><main><h1>Workspace</h1><button>Selected</button></main>');document.querySelector('main button')!.dispatchEvent(new MouseEvent('click',{bubbles:true}));const c=await context();expect(c.regions!.map(r=>r.kind)).toEqual(['main']);expect(interpret('Change Workspace heading to Overview',c)).toBeNull();expect(interpret('Change this label to Launch',c)?.actions[0].targets).toEqual([c.selected]);
});
