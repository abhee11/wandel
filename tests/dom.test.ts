// @vitest-environment jsdom
import { beforeEach,afterEach,describe,it,expect,vi } from 'vitest';
import { describe as describeElement,resolve } from '../extension/content/locator';
import { Renderer } from '../extension/content/renderer';
import { Session } from '../extension/content/session';
import { createWorkflow,addOperation } from '../extension/prototype/engine';
import { operationFromPlan,localPlan } from '../extension/ai/planner';
import { Repository,BrowserStorage } from '../extension/storage/store';
let session:Session|undefined;
beforeEach(()=>{document.body.innerHTML='<main id="host"><nav id="nav"><button id="customers">Customers</button></nav></main>';localStorage.clear();});
afterEach(()=>{session?.destroy();session=undefined;});
const host=()=>document.getElementById('host')!;
describe('conservative locators',()=>{
 it('relocates after a rerender and refuses ambiguous duplicates',()=>{
  const l=describeElement(document.getElementById('customers')!).locator;
  document.querySelector('nav')!.innerHTML='<span>New label</span><button id="customers">Customers</button>';
  expect(resolve(l,host(),new Map())?.id).toBe('customers');
  document.querySelector('nav')!.innerHTML='<button>Customers</button><button>Customers</button>';
  expect(resolve(l,host(),new Map())).toBeNull();
 });
 it('does not read input values or password field values',()=>{document.querySelector('nav')!.innerHTML='<input type="password" value="SECRET"><button>Go</button>';expect(JSON.stringify(describeElement(document.querySelector('nav')!))).not.toContain('SECRET');});
});
describe('DOM projection',()=>{
 it('repairs missing UI, stays idempotent, escapes markup, and rolls back',()=>{
   const r=new Renderer(host(),()=>{});let w=createWorkflow(new URL('https://example.com'));
   const op=operationFromPlan({...localPlan('Add Analyze'),text:'<img src=x onerror=alert(1)>'},describeElement(document.getElementById('customers')!).locator);
   w=addOperation(w,w.entry,op);r.reconcile(w,w.entry);r.reconcile(w,w.entry);expect(host().querySelectorAll('[data-dx-owned]')).toHaveLength(1);expect(host().querySelector('img')).toBeNull();
   document.querySelector('nav')!.innerHTML='<button id="customers">Customers</button>';expect(r.reconcile(w,w.entry)).toEqual([]);expect(host().querySelectorAll('[data-dx-owned]')).toHaveLength(1);
   r.reset();expect(host().textContent).toBe('Customers');
 });
 it('preserves a host edit made after a prototype text edit when disabled',()=>{
   const r=new Renderer(host(),()=>{});let w=createWorkflow(new URL('https://example.com'));
   w=addOperation(w,w.entry,operationFromPlan(localPlan('Rename this to Accounts'),describeElement(document.getElementById('customers')!).locator));r.reconcile(w,w.entry);
   document.getElementById('customers')!.textContent='Host update';r.reset();expect(document.getElementById('customers')!.textContent).toBe('Host update');
 });
});
describe('full authoring and replay',()=>{
 it('builds Risk Analysis → Details → Approval, saves, reloads and replays every edge',async()=>{
   const repository=new Repository(new BrowserStorage()), url=new URL('https://example.com/customers');
   session=new Session(host(),repository,url);await session.init();
   await session.dispatch({type:'pick'});document.getElementById('customers')!.click();
   await session.dispatch({type:'rename',text:'Risk Analysis Flow'});
   await session.dispatch({type:'prompt',prompt:'Add Risk Analysis beside this'});
   const first=session.selected!.locator.owned!;
   await session.dispatch({type:'child',text:'Analysis Panel'});
   await session.dispatch({type:'prompt',prompt:'Add View Details inside this'});
   const second=session.selected!.locator.owned!;
   await session.dispatch({type:'child',text:'Detail State'});
   await session.dispatch({type:'prompt',prompt:'Add Approve inside this'});
   const third=session.selected!.locator.owned!;
   await session.dispatch({type:'child',text:'Confirmation State'});
   await session.dispatch({type:'prompt',prompt:'Add text called Approved inside this',plan:{kind:'insert',position:'inside',element:'text',text:'Approved'}});
   await session.dispatch({type:'save'});expect(session.snapshot().versions).toHaveLength(1);
   const savedId=session.workflow.id;session.destroy();session=new Session(host(),repository,url);await session.init();expect(host().querySelector('[data-dx-owned]')).toBeNull();await session.dispatch({type:'load',id:savedId});expect(session.workflow.states).toHaveLength(4);expect(session.stateId).toBe(session.workflow.entry);
   await session.dispatch({type:'replay'});
   session.renderer.owned.get(first)!.click();expect(session.workflow.states.find(s=>s.id===session!.stateId)!.title).toBe('Analysis Panel');
   session.renderer.owned.get(second)!.click();expect(session.workflow.states.find(s=>s.id===session!.stateId)!.title).toBe('Detail State');
   session.renderer.owned.get(third)!.click();expect(host().textContent).toContain('Approved');
   await session.dispatch({type:'back'});expect(host().textContent).not.toContain('Approved');
   await session.dispatch({type:'enabled',value:false});expect(host().querySelectorAll('[data-dx-owned]')).toHaveLength(0);
 });
 it('undo/redo removes and restores a complete child state and edge',async()=>{
   session=new Session(host(),new Repository(new BrowserStorage()),new URL('https://example.com'));await session.init();await session.dispatch({type:'pick'});document.getElementById('customers')!.click();await session.dispatch({type:'prompt',prompt:'Add Analyze'});await session.dispatch({type:'child',text:'Analysis'});
   await session.dispatch({type:'undo'});expect(session.workflow.states).toHaveLength(1);expect(session.workflow.edges).toHaveLength(0);
   await session.dispatch({type:'redo'});expect(session.workflow.states).toHaveLength(2);expect(session.workflow.edges).toHaveLength(1);
 });
});

describe('navigation and editing regressions',()=>{
 it('keeps chained text edits stable during reconciliation and restores the original',()=>{
  const r=new Renderer(host(),()=>{});let w=createWorkflow(new URL('https://example.com'));
  w=addOperation(w,w.entry,operationFromPlan(localPlan('Rename this to Accounts'),describeElement(document.getElementById('customers')!).locator));r.reconcile(w,w.entry);
  w=addOperation(w,w.entry,operationFromPlan(localPlan('Rename this to Clients'),describeElement(document.getElementById('customers')!).locator));r.reconcile(w,w.entry);
  expect(r.reconcile(w,w.entry)).toEqual([]);expect(document.getElementById('customers')!.textContent).toBe('Clients');r.reset();expect(document.getElementById('customers')!.textContent).toBe('Customers');
 });
 it('restores saved route-specific workflows and keeps unsaved SPA drafts',async()=>{
  session=new Session(host(),new Repository(new BrowserStorage()),new URL('https://example.com/customers'));await session.init();await session.dispatch({type:'pick'});document.getElementById('customers')!.click();await session.dispatch({type:'prompt',prompt:'Add Analyze'});await session.dispatch({type:'save'});
  await session.dispatch({type:'rename',text:'Unsaved route draft'});const draftId=session.workflow.id;
  await session.navigate(new URL('https://example.com/reports'));expect(host().querySelector('[data-dx-owned]')).toBeNull();
  await session.navigate(new URL('https://example.com/customers'));expect(host().querySelector('[data-dx-owned]')).toBeNull();await session.dispatch({type:'load',id:draftId});expect(session.workflow.name).toBe('Unsaved route draft');expect(session.dirty).toBe(true);expect(host().textContent).toContain('Analyze');
 });
 it('rejects a stale plan after selection or state changes',async()=>{
  session=new Session(host(),new Repository(new BrowserStorage()),new URL('https://example.com'));await session.init();await session.dispatch({type:'pick'});document.getElementById('customers')!.click();
  await expect(session.dispatch({type:'prompt',prompt:'Add Analyze',context:{workflowId:'stale',stateId:session.stateId,selection:JSON.stringify(session.selected!.locator)}})).rejects.toThrow('changed while planning');expect(host().querySelector('[data-dx-owned]')).toBeNull();
 });
 it('repairs inserts after host mutations through the actual observer',async()=>{
  session=new Session(host(),new Repository(new BrowserStorage()),new URL('https://example.com'));await session.init();await session.dispatch({type:'pick'});document.getElementById('customers')!.click();await session.dispatch({type:'prompt',prompt:'Add Analyze'});
  document.querySelector('nav')!.innerHTML='<span>New sibling</span><button id="customers">Customers</button>';
  await new Promise(resolve=>setTimeout(resolve,230));expect(host().querySelectorAll('[data-dx-owned]')).toHaveLength(1);expect(host().textContent).toContain('Analyze');expect(session.unresolved).toEqual([]);
 });
});

describe('generated-control edits',()=>{
 it('renames an inserted button while retaining its click transition and replay label',async()=>{
  session=new Session(host(),new Repository(new BrowserStorage()),new URL('https://example.com'));await session.init();await session.dispatch({type:'pick'});document.getElementById('customers')!.click();await session.dispatch({type:'prompt',prompt:'Add Analyze'});
  const source=session.selected!.locator.owned!;await session.dispatch({type:'text',text:'Run analysis'});expect(session.renderer.owned.get(source)?.textContent).toBe('Run analysis');
  await session.dispatch({type:'child',text:'Analysis'});await session.dispatch({type:'replay'});session.renderer.owned.get(source)!.click();expect(session.workflow.states.find(s=>s.id===session!.stateId)?.title).toBe('Analysis');
 });
});

describe('sandbox direct selection',()=>{
 it('selects and edits host elements with a plain click, and selects wired controls without replaying',async()=>{
  session=new Session(host(),new Repository(new BrowserStorage()),new URL('https://example.com'),{directSelection:true});await session.init();
  document.getElementById('customers')!.click();expect(session.selected?.label).toBe('Customers');
  await session.dispatch({type:'text',text:'Accounts'});expect(document.getElementById('customers')!.textContent).toBe('Accounts');
  await session.dispatch({type:'prompt',prompt:'Add Analyze'});const id=session.selected!.locator.owned!;
  await session.dispatch({type:'child',text:'Analysis'});await session.dispatch({type:'state',id:session.workflow.entry});
  session.renderer.owned.get(id)!.click();expect(session.stateId).toBe(session.workflow.entry);expect(session.selected?.label).toBe('Analyze');
  await session.dispatch({type:'replay'});session.renderer.owned.get(id)!.click();expect(session.stateId).not.toBe(session.workflow.entry);
 });
 it('does not intercept ordinary host clicks in the extension until selection is enabled',async()=>{
  session=new Session(host(),new Repository(new BrowserStorage()),new URL('https://example.com'));await session.init();
  const handler=vi.fn();document.getElementById('customers')!.addEventListener('click',handler);document.getElementById('customers')!.click();expect(handler).toHaveBeenCalledOnce();expect(session.selected).toBeNull();
 });
});

describe('real-app authoring controls',()=>{
 it('keeps selection active across clicks and navigation, and releases it when the panel closes',async()=>{
  session=new Session(host(),new Repository(new BrowserStorage()),new URL('https://example.com'));await session.init();await session.dispatch({type:'edit'});
  document.getElementById('customers')!.click();expect(session.selected?.label).toBe('Customers');expect(session.picking).toBe(true);
  const other=document.createElement('button');other.textContent='Other';host().append(other);other.click();expect(session.selected?.label).toBe('Other');
  await session.navigate(new URL('https://example.com/other'));expect(session.picking).toBe(true);
  await session.dispatch({type:'pause'});expect(session.picking).toBe(false);
 });
 it('undoes appearance, removal, and a full reset while keeping versions',async()=>{
  session=new Session(host(),new Repository(new BrowserStorage()),new URL('https://example.com'));await session.init();await session.dispatch({type:'edit'});document.getElementById('customers')!.click();
  await session.dispatch({type:'style',style:{color:'#ff0000',width:150,x:30,y:20}});expect(document.getElementById('customers')!.style.width).toBe('150px');
  await session.dispatch({type:'save'});await session.dispatch({type:'remove'});expect(document.getElementById('customers')!.style.display).toBe('none');
  await session.dispatch({type:'undo'});expect(document.getElementById('customers')!.style.display).toBe('');expect(document.getElementById('customers')!.style.width).toBe('150px');
  await session.dispatch({type:'reset'});expect(document.getElementById('customers')!.style.width).toBe('');expect(session.snapshot().versions).toHaveLength(1);
  await session.dispatch({type:'undo'});expect(document.getElementById('customers')!.style.width).toBe('150px');
  document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'z',metaKey:true,bubbles:true,cancelable:true}));await session.dispatch({type:'snapshot'});expect(document.getElementById('customers')!.style.width).toBe('');
 });
 it('restores style and removal from storage and preserves original inline style on disable',async()=>{
  const url=new URL('https://example.com'),repo=new Repository(new BrowserStorage());document.getElementById('customers')!.style.color='blue';
  session=new Session(host(),repo,url);await session.init();await session.dispatch({type:'edit'});document.getElementById('customers')!.click();await session.dispatch({type:'style',style:{color:'#ff0000',height:80}});await session.dispatch({type:'remove'});await session.dispatch({type:'save'});
  const savedId=session.workflow.id;session.destroy();session=new Session(host(),repo,url);await session.init();expect(document.getElementById('customers')!.style.display).toBe('');await session.dispatch({type:'load',id:savedId});expect(document.getElementById('customers')!.style.display).toBe('none');
  await session.dispatch({type:'enabled',value:false});expect(document.getElementById('customers')!.style.color).toBe('blue');expect(document.getElementById('customers')!.style.height).toBe('');expect(document.getElementById('customers')!.style.display).toBe('');
 });
 it('commits a drag as one undoable operation',async()=>{
  session=new Session(host(),new Repository(new BrowserStorage()),new URL('https://example.com'));await session.init();await session.dispatch({type:'edit'});const el=document.getElementById('customers')!;el.click();await session.dispatch({type:'drag'});
  el.dispatchEvent(new MouseEvent('pointerdown',{clientX:10,clientY:10,button:0,bubbles:true}));window.dispatchEvent(new MouseEvent('pointermove',{clientX:80,clientY:50,bubbles:true}));window.dispatchEvent(new MouseEvent('pointerup',{clientX:80,clientY:50,bubbles:true}));await session.dispatch({type:'snapshot'});
  expect(el.style.translate).toBe('70px 40px');expect(session.history.past).toHaveLength(1);await session.dispatch({type:'undo'});expect(el.style.translate).toBe('');
 });
});

describe('hover gestures',()=>{
 async function start(){session=new Session(host(),new Repository(new BrowserStorage()),new URL('https://example.com'));await session.init();await session.dispatch({type:'edit'});return document.getElementById('customers')!;}
 it('Option-drag moves the hovered element without selecting or enabling drag first',async()=>{
  const el=await start();expect(session!.selected).toBeNull();
  el.dispatchEvent(new MouseEvent('pointerdown',{altKey:true,clientX:10,clientY:10,button:0,bubbles:true}));
  window.dispatchEvent(new MouseEvent('pointermove',{clientX:45,clientY:35,bubbles:true}));
  window.dispatchEvent(new MouseEvent('pointerup',{clientX:45,clientY:35,bubbles:true}));await session!.dispatch({type:'snapshot'});
  expect(el.style.translate).toBe('35px 25px');expect(session!.history.past).toHaveLength(1);await session!.dispatch({type:'undo'});expect(el.style.translate).toBe('');
 });
 it('Option+S-drag resizes with one undo step and persists dimensions on reload',async()=>{
  const el=await start();el.style.display='inline';el.style.width='100px';el.style.height='40px';
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'s',code:'KeyS',bubbles:true}));el.dispatchEvent(new MouseEvent('pointerdown',{altKey:true,clientX:0,clientY:0,button:0,bubbles:true}));
  window.dispatchEvent(new MouseEvent('pointermove',{clientX:60,clientY:30,bubbles:true}));expect(el.style.width).toBe('160px');
  window.dispatchEvent(new MouseEvent('pointerup',{clientX:60,clientY:30,bubbles:true}));await session!.dispatch({type:'save'});expect(session!.history.past).toHaveLength(1);
  const repo=session!.repository,savedId=session!.workflow.id;session!.destroy();session=new Session(host(),repo,new URL('https://example.com'));await session.init();expect(el.style.width).toBe('100px');await session.dispatch({type:'load',id:savedId});expect(el.style.width).toBe('160px');expect(el.style.height).toBe('70px');expect(el.style.display).toBe('inline-block');
  await session.dispatch({type:'enabled',value:false});expect(el.style.width).toBe('100px');expect(el.style.height).toBe('40px');expect(el.style.display).toBe('inline');
 });
 it.each(['Escape','blur'])('cancels a preview on %s without adding undo history',async(reason)=>{
  const el=await start();el.style.width='100px';el.style.height='40px';
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'s',code:'KeyS',bubbles:true}));el.dispatchEvent(new MouseEvent('pointerdown',{altKey:true,clientX:0,clientY:0,button:0,bubbles:true}));window.dispatchEvent(new MouseEvent('pointermove',{clientX:40,clientY:30,bubbles:true}));
  if(reason==='Escape')window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));else window.dispatchEvent(new Event('blur'));
  window.dispatchEvent(new MouseEvent('pointerup',{bubbles:true}));await session!.dispatch({type:'snapshot'});expect(el.style.width).toBe('100px');expect(el.style.height).toBe('40px');expect(session!.history.past).toHaveLength(0);
 });
 it('nudges a hovered element and resizes with keyboard modifiers, but ignores text fields and replay',async()=>{
  const el=await start();el.style.width='100px';el.style.height='40px';el.dispatchEvent(new MouseEvent('pointermove',{bubbles:true}));
  window.dispatchEvent(new KeyboardEvent('keydown',{altKey:true,key:'ArrowRight',bubbles:true}));await session!.dispatch({type:'snapshot'});expect(el.style.translate).toBe('1px 0px');
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'s',code:'KeyS',bubbles:true}));window.dispatchEvent(new KeyboardEvent('keydown',{altKey:true,key:'ArrowDown',bubbles:true}));await session!.dispatch({type:'snapshot'});expect(el.style.height).toBe('41px');
  const input=document.createElement('input');host().append(input);input.dispatchEvent(new KeyboardEvent('keydown',{altKey:true,key:'ArrowRight',bubbles:true}));await session!.dispatch({type:'snapshot'});expect(el.style.translate).toBe('1px 0px');
  await session!.dispatch({type:'replay'});window.dispatchEvent(new KeyboardEvent('keydown',{altKey:true,key:'ArrowRight',bubbles:true}));await session!.dispatch({type:'snapshot'});expect(el.style.translate).toBe('1px 0px');
 });
});

describe('on-page editing',()=>{
 const shadow=()=>document.querySelector<HTMLElement>('[data-dx-editor]')!.shadowRoot!;
 async function start(){session=new Session(host(),new Repository(new BrowserStorage()),new URL('https://example.com'));await session.init();await session.dispatch({type:'edit'});return document.getElementById('customers')!;}
 it('double-click edits in place, commits on blur, preserves nested nodes and event listeners, and undoes',async()=>{
  const el=await start();el.innerHTML='Customers <span>24</span>';const badge=el.querySelector('span')!,listener=vi.fn();badge.addEventListener('custom',listener);
  el.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}));const input=shadow().querySelector<HTMLTextAreaElement>('[aria-label="Edit text"]')!;expect(input.value).toBe('Customers');input.value='Accounts';input.blur();await session!.dispatch({type:'snapshot'});
  expect(el.textContent).toBe('Accounts24');expect(el.querySelector('span')).toBe(badge);badge.dispatchEvent(new Event('custom'));expect(listener).toHaveBeenCalledOnce();expect(session!.history.past).toHaveLength(1);
  await session!.dispatch({type:'undo'});expect(el.textContent).toBe('Customers 24');expect(el.querySelector('span')).toBe(badge);
 });
 it('Enter commits; Escape cancels; typing Cmd+Z in the editor does not undo the workflow',async()=>{
  const el=await start();el.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));let input=shadow().querySelector<HTMLTextAreaElement>('textarea')!;input.value='Accounts';input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,composed:true}));await session!.dispatch({type:'snapshot'});expect(el.textContent).toBe('Accounts');
  el.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));input=shadow().querySelector<HTMLTextAreaElement>('textarea')!;input.value='Cancelled';input.dispatchEvent(new KeyboardEvent('keydown',{key:'z',metaKey:true,bubbles:true,composed:true}));await session!.dispatch({type:'snapshot'});expect(el.textContent).toBe('Accounts');
  input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,composed:true}));expect(shadow().querySelector('textarea')).toBeNull();expect(el.textContent).toBe('Accounts');expect(session!.history.past).toHaveLength(1);
 });
 it('applies size changes on input, keeps a focused field, and groups them into one undo step',async()=>{
  const el=await start();el.click();const input=shadow().querySelector<HTMLInputElement>('[aria-label="Width"]')!;input.focus();
  input.value='180';input.dispatchEvent(new Event('input',{bubbles:true,composed:true}));await session!.dispatch({type:'snapshot'});expect(el.style.width).toBe('180px');
  input.value='190';input.dispatchEvent(new Event('input',{bubbles:true,composed:true}));await session!.dispatch({type:'snapshot'});expect(el.style.width).toBe('190px');expect(shadow().activeElement).toBe(input);expect(session!.history.past).toHaveLength(1);expect(session!.workflow.states[0].operations).toHaveLength(1);
  input.blur();await session!.dispatch({type:'undo'});expect(el.style.width).toBe('');
 });
 it('adds an element and defines a child state from on-page menus',async()=>{
  const el=await start();el.click();shadow().querySelector<HTMLButtonElement>('[aria-label="Add button (B)"]')!.click();await session!.dispatch({type:'snapshot'});const label=shadow().querySelector<HTMLTextAreaElement>('[aria-label="Edit text"]')!;expect(label.value).toBe('New button');label.value='Analyze';label.blur();await session!.dispatch({type:'snapshot'});expect(session!.selected?.label).toBe('Analyze');
  const title=shadow().querySelector<HTMLInputElement>('[aria-label="New state"]')!;title.focus();title.value='Analysis';title.blur();await session!.dispatch({type:'snapshot'});expect(session!.workflow.states).toHaveLength(2);expect(session!.workflow.edges).toHaveLength(1);
 });
});

describe('clean application lifecycle and prompts',()=>{
 it('closing removes text/style/inserts and the observer cannot put them back',async()=>{
  session=new Session(host(),new Repository(new BrowserStorage()),new URL('https://example.com'));await session.init();await session.dispatch({type:'edit'});document.getElementById('customers')!.click();
  await session.dispatch({type:'prompt',prompt:'Change this to Accounts'});await session.dispatch({type:'prompt',prompt:'Make this red'});await session.dispatch({type:'prompt',prompt:'Add Analyze beside this'});await session.dispatch({type:'save'});
  await session.dispatch({type:'pause'});expect(host().textContent).toBe('Customers');expect(document.getElementById('customers')!.style.color).toBe('');expect(session.snapshot().versions).toHaveLength(1);
  host().append(document.createElement('div'));await new Promise(r=>setTimeout(r,220));expect(host().textContent).toBe('Customers');expect(host().querySelector('[data-dx-owned]')).toBeNull();
 });
 it('on-page Ask executes rename, style, insertion, and removal on Enter',async()=>{
  session=new Session(host(),new Repository(new BrowserStorage()),new URL('https://example.com'));await session.init();await session.dispatch({type:'edit'});document.getElementById('customers')!.click();
  const ask=async(value:string)=>{const root=document.querySelector('[data-dx-editor]')!.shadowRoot!;const input=root.querySelector<HTMLInputElement>('[aria-label="Change this element"]')!;input.focus();input.value=value;input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,composed:true}));await session!.dispatch({type:'snapshot'});};
  await ask('Change this to Accounts');expect(document.getElementById('customers')!.textContent).toBe('Accounts');
  await ask('Make this red');expect(document.getElementById('customers')!.style.color).toBe('rgb(255, 0, 0)');
  await ask('Set width to 200');expect(document.getElementById('customers')!.style.width).toBe('200px');
  await ask('Add Analyze beside this');expect(session.selected?.label).toBe('Analyze');
  await ask('Remove this');expect(session.selected).toBeNull();expect([...session.renderer.owned.values()].find(el=>el.textContent==='Analyze')?.style.display).toBe('none');
 });
 it('releasing S switches back to movement; Shift is no longer the resize modifier',async()=>{
  session=new Session(host(),new Repository(new BrowserStorage()),new URL('https://example.com'));await session.init();await session.dispatch({type:'edit'});const el=document.getElementById('customers')!;el.style.width='100px';
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyS',key:'ß',altKey:true,bubbles:true}));window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyS',key:'ß',bubbles:true}));
  el.dispatchEvent(new MouseEvent('pointerdown',{altKey:true,shiftKey:true,clientX:0,clientY:0,button:0,bubbles:true}));window.dispatchEvent(new MouseEvent('pointermove',{clientX:20,clientY:10,bubbles:true}));window.dispatchEvent(new MouseEvent('pointerup',{bubbles:true}));await session.dispatch({type:'snapshot'});expect(el.style.width).toBe('100px');expect(el.style.translate).toBe('20px 10px');
 });
});

describe('multi-change form prompts',()=>{
 const prompt='change the sign in button and the page layout and make more fields and add more name and last name and address';
 async function setup(){
   host().innerHTML='<form><label>Email<input name="email" value="private@example.com"></label><label>Password<input type="password" value="SECRET"></label><button type="submit"><span>Sign in</span></button></form>';
   session=new Session(host(),new Repository(new BrowserStorage()),new URL('https://example.com/login'));await session.init();
   await session.dispatch({type:'pick'});host().querySelector('button span')!.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
 }
 it('handles the exact reported prompt, undo/redo, save/load and close as a group',async()=>{
   await setup();
   const result=await session!.dispatch({type:'prompt',prompt});
   expect(result.unresolved).toEqual([]);
   expect([...host().querySelectorAll('[data-dx-owned] input')].map(el=>el.getAttribute('aria-label'))).toEqual(['First name','Last name','Address']);
   expect(host().querySelector('form')!.style.flexDirection).toBe('column');
   expect(host().querySelector('button')!.style.backgroundColor).toBe('rgb(98, 88, 219)');
   expect(host().querySelector('button')!.textContent).toBe('Sign in');
   expect(JSON.stringify(session!.workflow)).not.toContain('SECRET');
   expect(JSON.stringify(session!.workflow)).not.toContain('private@example.com');
   await session!.dispatch({type:'undo'});expect(host().querySelector('[data-dx-owned]')).toBeNull();expect(host().querySelector('form')!.style.flexDirection).toBe('');
   await session!.dispatch({type:'redo'});expect(host().querySelectorAll('[data-dx-owned] input')).toHaveLength(3);
   await session!.dispatch({type:'save'});const id=session!.workflow.id;
   await session!.dispatch({type:'pause'});expect(host().querySelector('[data-dx-owned]')).toBeNull();expect(host().querySelector('button')!.style.backgroundColor).toBe('');
   session!.destroy();session=new Session(host(),new Repository(new BrowserStorage()),new URL('https://example.com/login'));await session.init();
   await session.dispatch({type:'load',id});expect(session.snapshot().unresolved).toEqual([]);expect(host().querySelectorAll('[data-dx-owned] input')).toHaveLength(3);
   await session.dispatch({type:'replay'});const input=host().querySelector<HTMLInputElement>('[data-dx-owned] input')!;
   input.value='Prototype only';const enter=new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});input.dispatchEvent(enter);expect(enter.defaultPrevented).toBe(true);
   expect(JSON.stringify(session.workflow)).not.toContain('Prototype only');
 });
 it('refuses an ambiguous form without changing any element',async()=>{
   host().innerHTML='<form><h2>Choose an account</h2><input><button>A</button><button>B</button></form>';
   session=new Session(host(),new Repository(new BrowserStorage()),new URL('https://example.com/login'));await session.init();await session.dispatch({type:'pick'});host().querySelector('h2')!.click();
   await expect(session.dispatch({type:'prompt',prompt})).rejects.toThrow('Select the sign-in button');expect(host().querySelector('[data-dx-owned]')).toBeNull();expect(session.workflow.states[0].operations).toHaveLength(0);expect(host().querySelector('form')!.style.display).toBe('');
 });
 it('validates every AI step before applying and permits a batch rename plus fields',async()=>{
   await setup();const steps=[{kind:'insert',target:'submit',position:'before',element:'field',text:'Company',style:null},{kind:'text',target:'submit',position:'after',element:'button',text:'Create account',style:null}];
   await expect(session!.dispatch({type:'prompt',prompt:'Add fields',plan:{steps:[...steps,{...steps[0],element:'script'}]}})).rejects.toThrow();expect(host().querySelector('[data-dx-owned]')).toBeNull();
   const result=await session!.dispatch({type:'prompt',prompt:'Add company and rename the button',plan:{steps}});expect(result.unresolved).toEqual([]);expect(host().querySelector('button')!.textContent).toBe('Create account');expect(host().querySelector('[data-dx-owned] input')!.getAttribute('aria-label')).toBe('Company');
   await session!.dispatch({type:'undo'});expect(host().querySelector('button')!.textContent).toBe('Sign in');expect(host().querySelector('[data-dx-owned]')).toBeNull();
 });
});

describe('persistent selection feedback',()=>{
 it('keeps the selected highlight when hovering elsewhere, tracks layout, and clears on pause',async()=>{
   session=new Session(host(),new Repository(new BrowserStorage()),new URL('https://example.com'));await session.init();await session.dispatch({type:'edit'});
   const button=document.getElementById('customers')!;
   let left=20;vi.spyOn(button,'getBoundingClientRect').mockImplementation(()=>({left,top:30,width:120,height:40,right:left+120,bottom:70,x:left,y:30,toJSON(){}}));
   button.click();const highlight=document.querySelector<HTMLElement>('[data-dx-selection]')!;
   expect(highlight.style.display).toBe('block');expect(highlight.style.left).toBe('20px');expect(highlight.style.pointerEvents).toBe('none');
   document.documentElement.dispatchEvent(new MouseEvent('pointermove',{bubbles:true}));expect(highlight.style.display).toBe('block');
   left=65;window.dispatchEvent(new Event('scroll'));expect(highlight.style.left).toBe('65px');
   await session.dispatch({type:'replay'});expect(highlight.style.display).toBe('none');
   await session.dispatch({type:'edit'});button.click();expect(highlight.style.display).toBe('block');
   await session.dispatch({type:'pause'});expect(highlight.style.display).toBe('none');
   session.destroy();session=undefined;expect(document.querySelector('[data-dx-selection]')).toBeNull();
 });
});
describe('MirrorTalk-style controls',()=>{
 it('renames a label from its SVG icon without removing the icon or nested span',async()=>{
  host().innerHTML='<button type="button"><svg aria-hidden="true"><path d="M0 0"/></svg><span>Continue with Google</span></button>';
  session=new Session(host(),new Repository(new BrowserStorage()),new URL('https://mirrortalk.ai/auth'));await session.init();await session.dispatch({type:'edit'});
  const button=host().querySelector('button')!,icon=button.querySelector('svg')!,label=button.querySelector('span')!;
  button.querySelector('path')!.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}));
  const editor=document.querySelector('[data-dx-editor]')?.shadowRoot||Array.from(document.querySelectorAll('[data-dx-ignore]')).map(el=>el.shadowRoot).find(root=>root?.querySelector('textarea'));
  const input=editor!.querySelector<HTMLTextAreaElement>('textarea')!;expect(input.value).toBe('Continue with Google');input.value='Continue with Wandel';input.blur();await session.dispatch({type:'snapshot'});
  expect(label.textContent).toBe('Continue with Wandel');expect(button.querySelector('svg')).toBe(icon);
  await session.dispatch({type:'undo'});expect(label.textContent).toBe('Continue with Google');
 });
 it('makes inline links transformable while dragging and restores display on undo',async()=>{
  host().innerHTML='<a href="/login" style="display:inline">Email log in</a>';
  session=new Session(host(),new Repository(new BrowserStorage()),new URL('https://mirrortalk.ai/auth'));await session.init();await session.dispatch({type:'edit'});
  const link=host().querySelector('a')!;
  link.dispatchEvent(new MouseEvent('pointerdown',{altKey:true,button:0,clientX:10,clientY:10,bubbles:true}));window.dispatchEvent(new MouseEvent('pointermove',{clientX:50,clientY:35,bubbles:true}));
  expect(link.style.display).toBe('inline-block');expect(link.style.translate).toBe('40px 25px');
  window.dispatchEvent(new MouseEvent('pointerup',{clientX:50,clientY:35,bubbles:true}));await session.dispatch({type:'snapshot'});
  expect(link.style.display).toBe('inline-block');expect(session.unresolved).toEqual([]);
  await session.dispatch({type:'undo'});expect(link.style.display).toBe('inline');expect(link.style.translate).toBe('');
 });
});
it('routes on-page save to the save chooser; explicit temporary save stays local',async()=>{
 const requestSave=vi.fn(),repository=new Repository(new BrowserStorage());session=new Session(host(),repository,new URL('https://example.com'),{requestSave});await session.init();await session.dispatch({type:'edit'});
 await session.dispatch({type:'rename',text:'Unsaved idea'});await session.dispatch({type:'save'});expect(requestSave).toHaveBeenCalledOnce();expect(await repository.get(session.workflow.id)).toBeNull();expect(session.dirty).toBe(true);
 await session.dispatch({type:'saveTemporary'});expect((await repository.get(session.workflow.id))!.draft.name).toBe('Unsaved idea');expect(session.dirty).toBe(false);
});
it('loads account records on the matching page and never discards edits made during a save',async()=>{
 session=new Session(host(),new Repository(new BrowserStorage()),new URL('https://example.com'));await session.init();await session.dispatch({type:'edit'});const expected=structuredClone(session.workflow);const record={draft:expected,currentVersion:1,enabled:true,versions:[{number:1,savedAt:new Date().toISOString(),workflow:expected}]};
 await session.dispatch({type:'rename',text:'Newer unsaved name'});await session.dispatch({type:'acknowledgeSave',record,expected});expect(session.workflow.name).toBe('Newer unsaved name');expect(session.dirty).toBe(true);
 await session.dispatch({type:'loadRecord',record});expect(session.workflow).toEqual(expected);expect(session.dirty).toBe(false);
 const wrong=structuredClone(record);wrong.draft.origin='https://other.example';await expect(session.dispatch({type:'loadRecord',record:wrong})).rejects.toThrow('matching application');expect(session.workflow).toEqual(expected);
});

describe('quick insert shortcuts',()=>{
 async function start(){session=new Session(host(),new Repository(new BrowserStorage()),new URL('https://example.com'));await session.init();await session.dispatch({type:'edit'});}
 function shadow(){return document.querySelector('[data-dx-editor]')!.shadowRoot!;}
 it('inserts with one keystroke and selects the default name for immediate typing',async()=>{
  await start();document.getElementById('customers')!.click();window.dispatchEvent(new KeyboardEvent('keydown',{key:'b',bubbles:true,cancelable:true}));await session!.dispatch({type:'snapshot'});
  const input=shadow().querySelector<HTMLTextAreaElement>('[aria-label="Edit text"]')!;expect(input.value).toBe('New button');expect(input.selectionStart).toBe(0);expect(input.selectionEnd).toBe(input.value.length);
  expect(document.getElementById('customers')!.nextElementSibling?.textContent).toBe('New button');
  input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,composed:true}));expect(host().textContent).toContain('New button');await session!.dispatch({type:'undo'});expect(host().textContent).not.toContain('New button');
 });
 it('inserts a field inside a selected container and keeps its placeholder in sync with the name',async()=>{
  await start();document.getElementById('nav')!.click();window.dispatchEvent(new KeyboardEvent('keydown',{key:'f',bubbles:true,cancelable:true}));await session!.dispatch({type:'snapshot'});
  const input=shadow().querySelector<HTMLTextAreaElement>('[aria-label="Edit text"]')!;expect(input.value).toBe('New field');input.value='First name';input.blur();await session!.dispatch({type:'snapshot'});
  const field=host().querySelector<HTMLInputElement>('[data-dx-owned] input')!;expect(field.placeholder).toBe('First name');expect(field.getAttribute('aria-label')).toBe('First name');expect(field.closest('nav')).not.toBeNull();
  await session!.dispatch({type:'undo'});expect(host().querySelector<HTMLInputElement>('[data-dx-owned] input')!.placeholder).toBe('New field');
 });
 it('does not hijack typing, modified shortcuts, repeats or replay mode',async()=>{
  await start();document.getElementById('customers')!.click();const field=document.createElement('input');host().append(field);
  field.dispatchEvent(new KeyboardEvent('keydown',{key:'b',bubbles:true}));window.dispatchEvent(new KeyboardEvent('keydown',{key:'t',metaKey:true,bubbles:true}));window.dispatchEvent(new KeyboardEvent('keydown',{key:'p',repeat:true,bubbles:true}));await session!.dispatch({type:'snapshot'});expect(host().querySelector('[data-dx-owned]')).toBeNull();
  await session!.dispatch({type:'replay'});window.dispatchEvent(new KeyboardEvent('keydown',{key:'f',bubbles:true}));await session!.dispatch({type:'snapshot'});expect(host().querySelector('[data-dx-owned]')).toBeNull();
 });
 it('asks for an insertion target instead of dropping items somewhere unexpected',async()=>{
  await start();window.dispatchEvent(new KeyboardEvent('keydown',{key:'p',bubbles:true}));await session!.dispatch({type:'snapshot'});expect(shadow().querySelector('[role="alert"]')!.textContent).toContain('Select where');expect(host().querySelector('[data-dx-owned]')).toBeNull();
 });
});


describe('duplicate selected items',()=>{
 async function start(){session=new Session(host(),new Repository(new BrowserStorage()),new URL('https://example.com'));await session.init();await session.dispatch({type:'edit'});}
 it('duplicates a styled host button, edits only the copy, and restores through undo and saved reload',async()=>{
  const original=document.getElementById('customers')!;original.style.backgroundColor='rgb(10, 20, 30)';
  await start();original.click();await session!.dispatch({type:'duplicateElement'});
  const id=session!.selected!.locator.owned!;let copied=session!.renderer.owned.get(id)!;
  expect(copied.tagName).toBe('BUTTON');expect(copied.id).toBe('');expect(copied.style.backgroundColor).toBe('rgb(10, 20, 30)');expect(original.nextElementSibling).toBe(copied);
  await session!.dispatch({type:'text',text:'Accounts'});expect(original.textContent).toBe('Customers');expect(session!.renderer.owned.get(id)!.textContent).toBe('Accounts');
  await session!.dispatch({type:'undo'});expect(session!.renderer.owned.get(id)!.textContent).toBe('Customers');
  await session!.dispatch({type:'undo'});expect(host().querySelector('[data-dx-owned]')).toBeNull();
  await session!.dispatch({type:'redo'});await session!.dispatch({type:'save'});
  const savedId=session!.workflow.id;session!.destroy();session=undefined;await start();await session!.dispatch({type:'load',id:savedId});expect(host().querySelector('[data-dx-owned]')!.textContent).toBe('Customers');
  await session!.dispatch({type:'reset'});expect(host().querySelector('[data-dx-owned]')).toBeNull();expect(original.isConnected).toBe(true);
 });
 it('copies editable descendants without form values, identities or executable attributes',async()=>{
  document.getElementById('nav')!.innerHTML='<section id="card"><h2>Profile</h2><label>Name<input name="secret" value="PRIVATE" placeholder="Your name"></label><button onclick="window.bad=true" type="submit">Continue</button><script>BAD_SCRIPT</script></section>';
  await start();document.getElementById('card')!.click();await session!.dispatch({type:'duplicateElement'});
  const copy=session!.findSelected()!;expect(copy.querySelector('input')!.value).toBe('');expect(copy.querySelector('input')!.name).toBe('');expect(copy.querySelector('input')!.placeholder).toBe('Your name');expect(copy.querySelector('script')).toBeNull();expect(copy.querySelector('button')!.getAttribute('onclick')).toBeNull();expect(copy.querySelector('button')!.type).toBe('button');expect(JSON.stringify(session!.workflow)).not.toContain('PRIVATE');
  copy.querySelector('h2')!.click();await session!.dispatch({type:'text',text:'Account'});expect(host().querySelector('#card h2')!.textContent).toBe('Profile');expect(host().querySelector('[data-dx-owned] h2')!.textContent).toBe('Account');
  const button=host().querySelector<HTMLButtonElement>('[data-dx-owned] button')!;button.click();await session!.dispatch({type:'child',text:'Details'});expect(session!.workflow.states).toHaveLength(2);
 });
 it('supports the on-page shortcut and guards typing and replay',async()=>{
  await start();document.getElementById('customers')!.click();
  const field=document.createElement('input');host().append(field);field.dispatchEvent(new KeyboardEvent('keydown',{key:'d',ctrlKey:true,bubbles:true}));await session!.dispatch({type:'snapshot'});expect(host().querySelector('[data-dx-owned]')).toBeNull();
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'d',metaKey:true,bubbles:true,cancelable:true}));await session!.dispatch({type:'snapshot'});
  const shadow=document.querySelector('[data-dx-editor]')!.shadowRoot!;const edit=shadow.querySelector<HTMLTextAreaElement>('[aria-label="Edit text"]')!;expect(edit.value).toBe('Customers');edit.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  await session!.dispatch({type:'replay'});await expect(session!.dispatch({type:'duplicateElement'})).rejects.toThrow('Return to Edit');
 });
});

describe('two-stage Escape',()=>{
 it('releases page interactions, checkpoints before collapsing, and reopens the editable draft',async()=>{
  const repository=new Repository(new BrowserStorage());const close=vi.fn(async()=>{expect(await repository.get(session!.workflow.id)).not.toBeNull();});
  session=new Session(host(),repository,new URL('https://example.com'),{directSelection:true,requestClose:close});await session.init();await session.dispatch({type:'edit'});
  document.getElementById('customers')!.click();await session.dispatch({type:'prompt',prompt:'Add Analyze beside this'});
  const workflowId=session.workflow.id;
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await session.dispatch({type:'snapshot'});
  expect(session.isAuthoring()).toBe(false);expect(session.selected).toBeNull();expect(host().textContent).toContain('Analyze');expect(close).not.toHaveBeenCalled();
  const nativeClick=vi.fn();document.getElementById('customers')!.addEventListener('click',nativeClick);document.getElementById('customers')!.click();expect(nativeClick).toHaveBeenCalledOnce();expect(session.selected).toBeNull();
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',repeat:true,bubbles:true}));await session.dispatch({type:'snapshot'});expect(close).not.toHaveBeenCalled();
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await session.dispatch({type:'snapshot'});
  expect(close).toHaveBeenCalledOnce();expect(host().textContent).not.toContain('Analyze');expect((await repository.get(workflowId))!.versions).toHaveLength(0);
  await session.dispatch({type:'edit'});expect(host().textContent).toContain('Analyze');expect(session.isAuthoring()).toBe(true);expect(session.dirty).toBe(true);
  session.destroy();session=new Session(host(),repository,new URL('https://example.com'));await session.init();await session.dispatch({type:'load',id:workflowId});expect(host().textContent).toContain('Analyze');
 });
 it('keeps the draft open when checkpoint storage fails',async()=>{
  const adapter=new BrowserStorage(),close=vi.fn(async()=>{});
  session=new Session(host(),new Repository(adapter),new URL('https://example.com'),{requestClose:close});await session.init();await session.dispatch({type:'edit'});
  document.getElementById('customers')!.click();await session.dispatch({type:'text',text:'Accounts'});await session.dispatch({type:'escape'});
  vi.spyOn(adapter,'write').mockRejectedValueOnce(new Error('Storage full'));
  await expect(session.dispatch({type:'escape'})).rejects.toThrow('Storage full');expect(close).not.toHaveBeenCalled();expect(host().textContent).toContain('Accounts');
  await session.dispatch({type:'edit'});expect(session.isAuthoring()).toBe(true);
 });
});

describe('seamless flow authoring',()=>{
 async function start(){session=new Session(host(),new Repository(new BrowserStorage()),new URL('https://example.com'));await session.init();await session.dispatch({type:'edit'});}
 it('mirrors a real button only in Try flow, preserves its label, and survives saving',async()=>{
  await start();const source=document.getElementById('customers')!;source.click();
  await session!.dispatch({type:'duplicateElement'});await session!.dispatch({type:'mirror'});const copyId=session!.selected!.locator.owned!;
  await session!.dispatch({type:'text',text:'Open accounts'});const action=vi.fn();source.addEventListener('click',action);
  session!.renderer.owned.get(copyId)!.click();expect(action).not.toHaveBeenCalled();
  await session!.dispatch({type:'save'});const id=session!.workflow.id;session!.destroy();session=undefined;await start();await session!.dispatch({type:'load',id});await session!.dispatch({type:'replay'});
  session!.renderer.owned.get(copyId)!.click();expect(action).toHaveBeenCalledOnce();expect(source.textContent).toBe('Customers');expect(session!.renderer.owned.get(copyId)!.textContent).toBe('Open accounts');
 });
 it('mirrors field input through native setters and events without storing values',async()=>{
  const field=document.createElement('input');field.id='email';field.type='email';field.placeholder='Email';field.value='PRIVATE';host().append(field);
  await start();field.click();await session!.dispatch({type:'duplicateElement'});await session!.dispatch({type:'mirror'});const id=session!.selected!.locator.owned!;const input=vi.fn();field.addEventListener('input',input);
  expect((session!.findSelected() as HTMLInputElement).value).toBe('');await session!.dispatch({type:'replay'});
  const copied=session!.renderer.owned.get(id) as HTMLInputElement;copied.value='typed@example.com';copied.dispatchEvent(new Event('input',{bubbles:true}));
  expect(field.value).toBe('typed@example.com');expect(input).toHaveBeenCalledOnce();expect(JSON.stringify(session!.workflow)).not.toContain('typed@example.com');expect(JSON.stringify(session!.workflow)).not.toContain('PRIVATE');
 });
 it('wires an existing host button to a prototype view and restores its original action outside replay',async()=>{
  await start();const source=document.getElementById('customers')!;source.click();const action=vi.fn();source.addEventListener('click',action);
  await session!.dispatch({type:'child',text:'Risk analysis'});expect(session!.workflow.states).toHaveLength(2);
  await session!.dispatch({type:'replay'});source.click();expect(session!.workflow.states.find(s=>s.id===session!.stateId)!.title).toBe('Risk analysis');expect(action).not.toHaveBeenCalled();
  await session!.dispatch({type:'pause'});source.click();expect(action).toHaveBeenCalledOnce();
 });
 it('scopes page and section prompts without changing the selected target accidentally',async()=>{
  await start();document.getElementById('customers')!.click();await session!.promptHere('Make this red','section');expect(host().querySelector('nav')!.style.color).toBe('rgb(255, 0, 0)');expect(document.getElementById('customers')!.style.color).toBe('');
  document.getElementById('customers')!.click();await session!.promptHere('Make this green','page');expect(host().style.color).not.toBe('');
 });
 it('exposes placement points, resize handle and breadcrumbs; autosaves a recovery draft without versions',async()=>{
  await start();document.getElementById('customers')!.click();const shadow=document.querySelector('[data-dx-editor]')!.shadowRoot!;
  expect(shadow.querySelector('[aria-label="Drag to resize"]')).not.toBeNull();expect(shadow.querySelectorAll('.insert-handle')).toHaveLength(3);expect(shadow.querySelector('[aria-label="Flow steps"]')).not.toBeNull();
  await session!.dispatch({type:'text',text:'Accounts'});await new Promise(r=>setTimeout(r,600));const draft=await session!.repository.get(session!.workflow.id);expect(draft?.draft.states[0].operations).toHaveLength(1);expect(draft?.versions).toHaveLength(0);expect(session!.dirty).toBe(true);
 });
});


it('prefers a new prototype transition over a mirrored live action',async()=>{
 session=new Session(host(),new Repository(new BrowserStorage()),new URL('https://example.com'));await session.init();await session.dispatch({type:'edit'});
 const source=document.getElementById('customers')!;source.click();const action=vi.fn();source.addEventListener('click',action);
 await session.dispatch({type:'duplicateElement'});const id=session.selected!.locator.owned!;await session.dispatch({type:'mirror'});await session.dispatch({type:'child',text:'Prototype destination'});
 await session.dispatch({type:'replay'});session.renderer.owned.get(id)!.click();expect(action).not.toHaveBeenCalled();expect(session.workflow.states.find(s=>s.id===session!.stateId)!.title).toBe('Prototype destination');
});

it('edits a mirrored field placeholder without touching its value and undoes cleanly',async()=>{
 const field=document.createElement('input');field.id='field';field.placeholder='Email';field.value='private';host().append(field);
 session=new Session(host(),new Repository(new BrowserStorage()),new URL('https://example.com'));await session.init();await session.dispatch({type:'edit'});field.click();
 await session.dispatch({type:'duplicateElement'});const id=session.selected!.locator.owned!;await session.dispatch({type:'mirror'});await session.dispatch({type:'text',text:'Work email'});
 expect((session.renderer.owned.get(id) as HTMLInputElement).placeholder).toBe('Work email');expect(field.placeholder).toBe('Email');expect(field.value).toBe('private');
 await session.dispatch({type:'undo'});expect((session.renderer.owned.get(id) as HTMLInputElement).placeholder).toBe('Email');
});
