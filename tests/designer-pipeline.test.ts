// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect} from 'vitest';
import {Session} from '../extension/content/session';
import {Repository,BrowserStorage} from '../extension/storage/store';
import {action,response,type AssistantPlan} from '../extension/assistant/schema';
import {groundPlan} from '../extension/assistant/grounding';
import {normalizePlan,validatePlanReferences} from '../extension/assistant/plan';
import {conversationHistory} from '../extension/assistant/conversation';
let session:Session;
beforeEach(async()=>{localStorage.clear();document.body.innerHTML='<main id="workspace" style="display:flex;gap:20px"><article id="card" style="border-radius:28px;padding:24px;background:#f0edfa"><h2>Summary</h2><p>Keep this description</p><button>Open</button></article><article id="other"><h2>Activity</h2><button>Inspect</button></article></main>';session=new Session(document.querySelector('main')!,new Repository(new BrowserStorage()),new URL('https://example.com/settings'),{assistantEnabled:true});await session.init();await session.dispatch({type:'edit'});document.getElementById('card')!.click();});
afterEach(()=>session.destroy());
const context=async()=>(await session.dispatch({type:'assistantContext'})).assistant!.context!;
async function apply(plan:AssistantPlan){const c=await context();await session.dispatch({type:'assistantApply',plan,token:c.token});}
it('shares native duplication memory and captures its parent, siblings and applied outcome',async()=>{
 await session.dispatch({type:'copyPrompt',prompt:'Duplicate selected'});const c=await context();expect(c.recent).toContain(c.selected);expect(c.edits?.at(-1)?.outcome).toBe('applied');expect(c.edits?.at(-1)?.message).toContain('Duplicated');const selected=c.elements.find(e=>e.ref===c.selected)!;expect(selected.owned).toBe(true);expect(c.elements.some(e=>e.ref===selected.parent)).toBe(true);expect(c.elements.some(e=>e.attributes.id==='other')).toBe(true);
});
it('duplicates, themes, reorders and connects the resulting button atomically, then undoes and restores',async()=>{
 const c=await context();const plan=response('edit','Added a dark Feedback card before Summary and connected its button.',[
  action('duplicate',[c.selected!],{text:'Feedback',resultRef:'new:feedback'}),
  action('style',['new:feedback'],{style:{backgroundColor:'#171927',color:'#ffffff',padding:32,borderRadius:18,fontWeight:600},labels:['irrelevant provider field']}),
  action('reorder',['new:feedback'],{relativeTo:c.selected!,position:'before'}),
  action('connect',['new:feedback:button'],{newViewTitle:'Feedback details'})
 ]);
 expect(groundPlan('Duplicate selected, make it a dark Feedback card, put it before the original, and create a blank Feedback details view for its button',c,plan).status).toBe('edit');
 await session.dispatch({type:'assistantApply',plan,token:c.token});
 const copy=document.querySelector('main')!.firstElementChild as HTMLElement;expect(copy.querySelector('h2')!.textContent).toBe('Feedback');expect(copy.style.backgroundColor).toBe('rgb(23, 25, 39)');expect(copy.style.fontWeight).toBe('600');expect(copy.querySelector('p')!.textContent).toBe('Keep this description');expect(session.workflow.edges).toHaveLength(1);
 await session.dispatch({type:'undo'});expect(document.querySelectorAll('main article')).toHaveLength(2);expect(document.querySelector('main')!.firstElementChild!.id).toBe('card');expect(session.workflow.edges).toHaveLength(0);
 await session.dispatch({type:'redo'});await session.dispatch({type:'saveTemporary'});const record=(await session.repository.get(session.workflow.id))!;await session.dispatch({type:'loadRecord',record});expect(document.querySelector('main')!.firstElementChild!.textContent).toContain('Feedback');
});
it('reflows an existing container with alignment, grid and typography without inserting replacement controls',async()=>{
 const c=await context(),parent=c.elements.find(e=>e.attributes.id==='workspace')!;
 await session.dispatch({type:'assistantApply',token:c.token,plan:response('edit','Reflowed the cards.',[action('style',[parent.ref],{style:{display:'grid',gridTemplateColumns:'repeat(2, minmax(0, 1fr))',alignItems:'center',justifyContent:'center',columnGap:28,rowGap:16,fontWeight:500,lineHeight:1.5},labels:['not a new label'],text:'not new content'})])});
 expect(session.root.children).toHaveLength(2);expect(session.root.style.alignItems).toBe('center');expect(session.root.style.columnGap).toBe('28px');expect(session.root.style.lineHeight).toBe('1.5');expect(session.root.style.fontWeight).toBe('500');expect(session.workflow.states[0].operations.every(op=>op.kind==='style')).toBe(true);
 await session.dispatch({type:'undo'});expect(session.root.style.display).toBe('flex');expect(session.root.style.alignItems).toBe('');
});
it('rejects forward/self references and invalid rearrangement without leaving a partial copy',async()=>{
 const c=await context();expect(()=>validatePlanReferences(response('edit','Invalid',[action('style',['new:later'],{style:{color:'#ffffff'}}),action('duplicate',[c.selected!],{resultRef:'new:later'})]),c.elements.map(e=>e.ref))).toThrow('not been created');
 const before=JSON.stringify(session.workflow);await expect(session.dispatch({type:'assistantApply',token:c.token,plan:response('edit','Invalid',[action('duplicate',[c.selected!],{resultRef:'new:copy'}),action('reorder',['new:copy'],{relativeTo:'new:copy',position:'inside'})])})).rejects.toThrow('distinct destination');expect(JSON.stringify(session.workflow)).toBe(before);expect(session.root.children).toHaveLength(2);
});
it('uses action-specific fields and preserves failed outcomes in structured history',()=>{
 const normalized=normalizePlan(response('edit','Aligned',[action('style',['e1'],{style:{alignItems:'center'},labels:['Open'],text:'Open',description:'ignored'})]));expect(normalized.actions[0].labels).toEqual([]);expect(normalized.actions[0].text).toBeNull();expect(normalized.actions[0].description).toBeNull();
 const history=conversationHistory([{role:'user',text:'Add billing',status:'failed',error:'Nothing was applied'},{role:'user',text:'New pending message',status:'sending'}]);expect(history).toEqual([{role:'user',text:'Add billing',status:'failed',error:'Nothing was applied'}]);
});
it('honors duplicate placement and maps copied descendants for a readable theme',async()=>{
 const c=await context(),heading=c.elements.find(e=>e.name==='Summary'&&e.tag==='h2')!;
 await session.dispatch({type:'assistantApply',token:c.token,plan:response('edit','Copied before original',[action('duplicate',[c.selected!],{text:'Feedback',position:'before',resultRef:'new:feedback'}),action('style',['new:feedback'],{style:{backgroundColor:'#171927',color:'#ffffff'}}),action('style',['new:feedback/'+heading.ref],{style:{color:'#ffffff'}})])});
 const copy=session.root.firstElementChild as HTMLElement;expect(copy.querySelector('h2')!.textContent).toBe('Feedback');expect(copy.querySelector('h2')!.style.color).toBe('rgb(255, 255, 255)');expect(copy.nextElementSibling!.id).toBe('card');expect(copy.style.backgroundColor).toBe('rgb(23, 25, 39)');
});
it('retains the heading identity of a copied div-only card for a conversational rename',async()=>{
 session.root.innerHTML='<div id="plain"><div><span style="font-weight:bold">Select Group</span></div><div>Create your first group</div><div>General</div></div>';document.getElementById('plain')!.click();await session.dispatch({type:'copyPrompt',prompt:'Duplicate selected'});
 const c=await context();const {interpret}=await import('../extension/assistant/interpret');const plan=interpret('Rename it to Recently Deleted',c)!;expect(plan.status).toBe('edit');await session.dispatch({type:'assistantApply',token:c.token,plan});expect(session.root.children[1].textContent).toContain('Recently Deleted');expect(session.root.children[0].textContent).toContain('Select Group');
});
it('preserves the original/copy relationship for follow-up rearrangement and after reload',async()=>{
 await session.dispatch({type:'copyPrompt',prompt:'Duplicate selected'});let c=await context();expect(c.elements.find(e=>e.ref===c.copySource)?.attributes.id).toBe('card');
 const plan=response('edit','Placed the copy before its original.',[action('reorder',[c.selected!],{relativeTo:c.copySource!,position:'before'})]);expect(groundPlan('Put it before the original',c,plan).status).toBe('edit');await session.dispatch({type:'assistantApply',token:c.token,plan});
 await session.dispatch({type:'saveTemporary'});const record=(await session.repository.get(session.workflow.id))!;await session.dispatch({type:'loadRecord',record});await session.dispatch({type:'edit'});(session.root.firstElementChild as HTMLElement).click();c=await context();expect(c.elements.find(e=>e.ref===c.copySource)?.attributes.id).toBe('card');
});
