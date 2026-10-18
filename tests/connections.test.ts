// @vitest-environment jsdom
import {it,expect,beforeEach,afterEach,vi} from 'vitest';
import {Session} from '../extension/content/session';
import {Repository,BrowserStorage} from '../extension/storage/store';
import {describe} from '../extension/content/locator';
import {validateWorkflow} from '../extension/prototype/engine';
import {RecordSchema,type ConnectionCondition} from '../extension/shared/model';
let session:Session;
const root=()=>document.querySelector('main')!;
const shadow=()=>document.querySelector('[data-dx-editor]')!.shadowRoot!;
const button=()=>document.getElementById('continue')!;
const condition=(id:string,test:ConnectionCondition['test']):ConnectionCondition=>({target:describe(document.getElementById(id)!).locator,test});
beforeEach(async()=>{localStorage.clear();document.body.innerHTML='<main><button id="continue">Continue</button><label>Email<input id="email" type="email"></label><label><input id="terms" type="checkbox">Terms</label><label><input id="business" type="radio" name="type">Business</label><select id="plan" aria-label="Plan"><option>Free</option><option>Pro</option></select></main>';session=new Session(root(),new Repository(new BrowserStorage()),new URL('https://example.com/signup'));await session.init();await session.dispatch({type:'edit'});});
afterEach(()=>session.destroy());
it('connects a button with AND conditions and replays the saved rule without firing the host handler',async()=>{
 const host=vi.fn();button().onclick=host;button().click();const from=session.stateId;
 await session.dispatch({type:'connect',newTitle:'Account details',event:'click',conditions:[condition('terms','checked'),condition('email','filled'),condition('email','valid')]});expect(session.stateId).toBe(from);const edge=session.workflow.edges[0];expect(edge.conditions).toHaveLength(3);expect(session.workflow.states).toHaveLength(2);
 await session.dispatch({type:'saveTemporary'});const record=RecordSchema.parse(JSON.parse(JSON.stringify(session.record)));await session.dispatch({type:'loadRecord',record});await session.dispatch({type:'replay'});button().click();expect(session.stateId).toBe(from);expect(shadow().textContent).toContain('Complete the connection conditions');expect(host).not.toHaveBeenCalled();
 (document.getElementById('terms') as HTMLInputElement).checked=true;(document.getElementById('email') as HTMLInputElement).value='test@example.com';button().click();expect(session.stateId).toBe(edge.to);expect(host).not.toHaveBeenCalled();expect(JSON.stringify(record)).not.toContain('test@example.com');
 await session.dispatch({type:'back'});expect(session.stateId).toBe(from);
});
it('takes an explicit otherwise branch and reports broken condition targets instead of treating them as false',async()=>{
 button().click();await session.dispatch({type:'child',text:'Needs details'});const otherwise=session.stateId;await session.dispatch({type:'state',id:session.workflow.entry});button().click();
 await session.dispatch({type:'connect',newTitle:'Complete',event:'click',conditions:[condition('terms','checked')],otherwise});await session.dispatch({type:'replay'});button().click();expect(session.stateId).toBe(otherwise);
 await session.dispatch({type:'replay'});document.getElementById('terms')!.remove();button().click();expect(session.stateId).toBe(session.workflow.entry);expect(shadow().textContent).toContain('connection field is missing');
});
it.each(['terms','business'])('maps a %s selection to a view without executing native host click handlers',async id=>{
 const field=document.getElementById(id) as HTMLInputElement;const host=vi.fn();field.onclick=host;field.click();
 await session.dispatch({type:'connect',newTitle:'Selected option',event:'change',conditions:[condition(id,'checked')]});const to=session.workflow.edges[0].to;await session.dispatch({type:'replay'});field.checked=false;field.click();await session.dispatch({type:'snapshot'});expect(session.stateId).toBe(to);expect(host).not.toHaveBeenCalled();
});
it.each(['replay','interact'] as const)('maps dropdown changes and Enter actions in %s',async mode=>{
 const plan=document.getElementById('plan') as HTMLSelectElement;plan.click();await session.dispatch({type:'connect',newTitle:'Pro setup',event:'change',conditions:[{...condition('plan','equals'),value:'Pro'}]});const edge=session.workflow.edges[0];await session.dispatch({type:mode});plan.value='Free';plan.dispatchEvent(new Event('change',{bubbles:true}));expect(session.stateId).toBe(edge.from);plan.value='Pro';plan.dispatchEvent(new Event('change',{bubbles:true}));expect(session.stateId).toBe(edge.to);
 await session.dispatch({type:'edit'});await session.dispatch({type:'state',id:session.workflow.entry});const email=document.getElementById('email') as HTMLInputElement;email.click();await session.dispatch({type:'connect',newTitle:'Email complete',event:'enter',conditions:[condition('email','filled'),condition('email','valid')]});const to=session.workflow.edges.at(-1)!.to;await session.dispatch({type:mode});email.value='valid@example.com';const event=new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});email.dispatchEvent(event);expect(event.defaultPrevented).toBe(true);expect(session.stateId).toBe(to);
});
it('connects to an existing view, supports undo and rejects invalid rule graphs atomically',async()=>{
 button().click();await session.dispatch({type:'child',text:'Existing view'});const to=session.stateId;await session.dispatch({type:'state',id:session.workflow.entry});button().click();const before=JSON.stringify(session.workflow);
 await expect(session.dispatch({type:'connect',to:'missing',event:'click',conditions:[]})).rejects.toThrow('destination');expect(JSON.stringify(session.workflow)).toBe(before);
 await session.dispatch({type:'connect',to,event:'click',conditions:[condition('terms','checked')]});expect(session.workflow.edges[0].to).toBe(to);await session.dispatch({type:'undo'});expect(JSON.stringify(session.workflow.edges)).toBe(JSON.stringify(JSON.parse(before).edges));
 const invalid=JSON.parse(before);invalid.edges[0].otherwise='missing';expect(()=>validateWorkflow(invalid)).toThrow('fallback');
});
it('opens a side-by-side editor, creates a view, picks a condition field and tests the saved connection',async()=>{
 button().click();shadow().querySelector<HTMLButtonElement>('[aria-label="Connect to a view"]')!.click();const panel=shadow().querySelector<HTMLElement>('[aria-label="Connect views"]')!;expect(panel.hidden).toBe(false);expect(panel.textContent).toContain('FROM');expect(panel.textContent).toContain('TO');
 const name=panel.querySelector<HTMLInputElement>('[aria-label="Or create a new view"]')!;name.value='My details';name.dispatchEvent(new Event('input',{bubbles:true}));
 [...panel.querySelectorAll('button')].find(b=>b.textContent==='+ Pick condition field')!.click();document.getElementById('terms')!.click();expect(session.selected?.label).toBe('Continue');expect(panel.querySelector('[aria-label="Condition 1 rule"]')).not.toBeNull();
 panel.querySelector<HTMLButtonElement>('.connection-primary')!.click();await session.dispatch({type:'snapshot'});expect(session.workflow.edges[0].conditions?.[0].test).toBe('checked');expect(panel.hidden).toBe(true);expect(shadow().querySelector('[role=status]')?.textContent).toContain('Connected');button().click();shadow().querySelector<HTMLButtonElement>('[aria-label="Connect to a view"]')!.click();
 [...panel.querySelectorAll('button')].find(b=>b.textContent==='Test connection')!.click();await session.dispatch({type:'snapshot'});expect(session.replay).toBe(true);expect(panel.hidden).toBe(true);
});
it('closes the editor when changing workflows or modes rather than connecting the wrong source',async()=>{
 button().click();shadow().querySelector<HTMLButtonElement>('[aria-label="Connect to a view"]')!.click();await session.dispatch({type:'interact'});expect(shadow().querySelector<HTMLElement>('[aria-label="Connect views"]')!.hidden).toBe(true);expect(session.workflow.edges).toHaveLength(0);
});
it('enables Connect immediately after naming a new view and keeps field-picking handles hidden',async()=>{
 button().click();shadow().querySelector<HTMLButtonElement>('[aria-label="Connect to a view"]')!.click();const panel=shadow().querySelector<HTMLElement>('[aria-label="Connect views"]')!;
 const connect=panel.querySelector<HTMLButtonElement>('.connection-primary')!;expect(connect.disabled).toBe(true);const name=panel.querySelector<HTMLInputElement>('[aria-label="Or create a new view"]')!;name.value='Next';name.dispatchEvent(new Event('input',{bubbles:true}));expect(connect.disabled).toBe(false);
 [...panel.querySelectorAll('button')].find(button=>button.textContent==='+ Pick condition field')!.click();window.dispatchEvent(new Event('scroll'));expect(shadow().querySelector('[aria-label="Add below selection"]')!.parentElement!.hidden).toBe(true);
});
it('retains existing data effects when adding a condition to the same destination',async()=>{
 button().click();await session.dispatch({type:'child',text:'Done'});const to=session.stateId;const record={draft:structuredClone(session.workflow),enabled:true,currentVersion:0,versions:[]};record.draft.variables=[{key:'status',value:'Pending'}];record.draft.edges[0].effects=[{key:'status',value:'Approved'}];await session.dispatch({type:'loadRecord',record});button().click();
 await session.dispatch({type:'connect',to,event:'click',conditions:[condition('terms','checked')]});expect(session.workflow.edges[0].effects).toEqual([{key:'status',value:'Approved'}]);
});
it('lets the user open the destination for recursive editing without activating its connection',async()=>{
 button().click();await session.dispatch({type:'connect',newTitle:'Details',event:'click',conditions:[]});const to=session.workflow.edges[0].to;button().click();shadow().querySelector<HTMLButtonElement>('[aria-label="Connect to a view"]')!.click();const panel=shadow().querySelector<HTMLElement>('[aria-label="Connect views"]')!;
 [...panel.querySelectorAll('button')].find(button=>button.textContent==='Edit destination view')!.click();await session.dispatch({type:'snapshot'});expect(session.stateId).toBe(to);expect(session.mode()).toBe('edit');expect(panel.hidden).toBe(true);
});
it('activates mapped checkbox choices by clicking their label text too',async()=>{
 const field=document.getElementById('terms') as HTMLInputElement;field.click();await session.dispatch({type:'connect',newTitle:'Accepted',event:'change',conditions:[condition('terms','checked')]});const to=session.workflow.edges[0].to;await session.dispatch({type:'replay'});field.checked=false;field.closest('label')!.click();await session.dispatch({type:'snapshot'});expect(session.stateId).toBe(to);
});
it('renders previews without loading remote images or copying entered form values',()=>{
 const img=document.createElement('img');img.src='https://example.com/private-avatar.png';document.querySelector('main')!.append(img);const email=document.getElementById('email') as HTMLInputElement;email.value='transient@example.com';button().click();shadow().querySelector<HTMLButtonElement>('[aria-label="Connect to a view"]')!.click();
 const preview=shadow().querySelector('.connection-preview')!;expect(preview.querySelector('img')).toBeNull();expect(preview.textContent).not.toContain('transient@example.com');expect(preview.querySelector('input')).toBeNull();expect(img.src).toBe('https://example.com/private-avatar.png');
});
it('defaults a checkbox connection to checked instead of navigating on uncheck too',()=>{
 document.getElementById('terms')!.click();shadow().querySelector<HTMLButtonElement>('[aria-label="Connect to a view"]')!.click();expect(shadow().querySelector<HTMLSelectElement>('[aria-label="Condition 1 rule"]')!.value).toBe('checked');
});

it('docks connections in the toolbar workspace and preserves unfinished rules while collapsed or picking',()=>{
 button().click();shadow().querySelector<HTMLButtonElement>('[aria-label="Connect to a view"]')!.click();const panel=shadow().querySelector<HTMLElement>('[aria-label="Connect views"]')!;
 expect(panel.querySelector('.connection-body .connection-columns')).not.toBeNull();expect(panel.querySelector('.connection-body .connection-settings')).not.toBeNull();
 const name=panel.querySelector<HTMLInputElement>('[aria-label="Or create a new view"]')!;name.value='My unfinished view';name.dispatchEvent(new Event('input',{bubbles:true}));
 panel.querySelector<HTMLButtonElement>('[aria-label="Collapse connections to toolbar"]')!.click();expect(panel.className).toBe('connection-pick');expect(panel.hidden).toBe(false);
 [...panel.querySelectorAll('button')].find(b=>b.textContent==='Open connections')!.click();expect(panel.querySelector<HTMLInputElement>('[aria-label="Or create a new view"]')!.value).toBe('My unfinished view');
 panel.querySelector<HTMLButtonElement>('[aria-label="Expand connection workspace"]')!.click();expect(panel.classList.contains('connection-expanded')).toBe(true);
 window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));expect(panel.className).toBe('connection-pick');
 [...panel.querySelectorAll('button')].find(b=>b.textContent==='Open connections')!.click();expect(panel.classList.contains('connection-expanded')).toBe(true);
 [...panel.querySelectorAll('button')].find(b=>b.textContent==='+ Pick condition field')!.click();expect(panel.textContent).toContain('Cancel field selection');
 [...panel.querySelectorAll('button')].find(b=>b.textContent==='Cancel field selection')!.click();expect(panel.querySelector<HTMLInputElement>('[aria-label="Or create a new view"]')!.value).toBe('My unfinished view');
 panel.querySelector<HTMLButtonElement>('[aria-label="Close connection editor"]')!.click();expect(panel.hidden).toBe(true);expect(shadow().querySelector<HTMLButtonElement>('[aria-label="Connect to a view"]')!.closest<HTMLElement>('.bar')!.hidden).toBe(false);expect(session.workflow.edges).toHaveLength(0);
});

it('routes installed connections into the side panel without rendering or cloning a host dialog',async()=>{
 session.destroy();const openPanel=vi.fn();session=new Session(root(),new Repository(new BrowserStorage()),new URL('https://example.com/signup'),{externalConnections:true,requestConnections:openPanel});await session.init();await session.dispatch({type:'edit'});
 document.getElementById('terms')!.click();shadow().querySelector<HTMLButtonElement>('[aria-label="Connect to a view"]')!.click();expect(openPanel).toHaveBeenCalledOnce();expect(shadow().querySelector<HTMLElement>('[aria-label="Connect views"]')!.hidden).toBe(true);
 expect(session.snapshot().connectionWorkspace?.source.tag).toBe('input');expect(session.snapshot().connectionWorkspace?.conditions[0].test).toBe('checked');
 await session.dispatch({type:'connectionAction',change:{action:'title',value:'Checked screen'}});await session.dispatch({type:'connectionAction',change:{action:'pick'}});document.getElementById('email')!.click();expect(session.snapshot().connectionWorkspace?.picking).toBe(false);expect(session.snapshot().connectionWorkspace?.conditions).toHaveLength(2);
 await session.dispatch({type:'connectionAction',change:{action:'save'}});expect(session.workflow.edges).toHaveLength(1);expect(session.snapshot().connectionWorkspace).toBeNull();document.getElementById('terms')!.click();shadow().querySelector<HTMLButtonElement>('[aria-label="Connect to a view"]')!.click();
 await session.dispatch({type:'connectionAction',change:{action:'test'}});expect(session.replay).toBe(true);expect(session.snapshot().connectionWorkspace).toBeNull();
});

it.each(['input','label'])('runs a newly created checkbox connection in Interact via %s and dismisses the saved wire',async via=>{
 button().click();await session.dispatch({type:'insertElement',kind:'field',inputType:'checkbox',text:'Show profile',position:'after'});
 let field=[...session.renderer.owned.values()].find(n=>n instanceof HTMLInputElement&&n.type==='checkbox') as HTMLInputElement;
 field.click();shadow().querySelector<HTMLButtonElement>('[aria-label="Connect to a view"]')!.click();
 const panel=shadow().querySelector<HTMLElement>('[aria-label="Connect views"]')!;
 const name=panel.querySelector<HTMLInputElement>('[aria-label="Or create a new view"]')!;name.value='Profile';name.dispatchEvent(new Event('input',{bubbles:true}));
 panel.querySelector<HTMLButtonElement>('.connection-primary')!.click();await session.dispatch({type:'snapshot'});
 const edge=session.workflow.edges[0];expect(edge.conditions?.[0].test).toBe('checked');expect(panel.hidden).toBe(true);expect(shadow().querySelector('[role=status]')?.textContent).toContain('Connected');
 await session.dispatch({type:'saveTemporary'});const record=structuredClone(session.record!);await session.dispatch({type:'loadRecord',record});
 await session.dispatch({type:'interact'});expect(session.stateId).toBe(edge.from);
 field=[...session.renderer.owned.values()].find(n=>n instanceof HTMLInputElement&&n.type==='checkbox') as HTMLInputElement;
 field.checked=true;field.click();await session.dispatch({type:'snapshot'});expect(session.stateId).toBe(edge.from);
 (via==='label'?field.closest('label')!:field).click();await session.dispatch({type:'snapshot'});expect(session.stateId).toBe(edge.to);expect(session.mode()).toBe('interact');
});
it('runs mapped buttons in Interact while leaving unrelated application buttons usable',async()=>{
 const native=document.createElement('button');native.textContent='Native action';const host=vi.fn();native.onclick=host;root().append(native);
 button().click();await session.dispatch({type:'connect',newTitle:'Profile',event:'click',conditions:[]});const edge=session.workflow.edges[0];await session.dispatch({type:'interact'});
 native.click();expect(host).toHaveBeenCalledOnce();expect(session.stateId).toBe(edge.from);button().click();expect(session.stateId).toBe(edge.to);
});
