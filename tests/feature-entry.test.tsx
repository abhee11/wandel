// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import {App,generationPrompt} from '../extension/sidepanel/App';
import {accountAPI,AccountError,signIn,previewPlan} from '../extension/sidepanel/accountClient';
import {createWorkflow} from '../extension/prototype/engine';
import type {Snapshot} from '../extension/shared/model';
vi.mock('../extension/sidepanel/accountClient',async original=>({...await original<typeof import('../extension/sidepanel/accountClient')>(),accountAPI:vi.fn(),signIn:vi.fn(),previewPlan:vi.fn()}));
let root:Root,el:HTMLDivElement,s:Snapshot,notify:(s:Snapshot|null)=>void;
const send=vi.fn();
beforeEach(()=>{vi.clearAllMocks();(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;el=document.createElement('div');document.body.append(el);root=createRoot(el);const workflow=createWorkflow(new URL('https://example.com'));s={workflow,stateId:workflow.entry,selected:null,picking:true,dragging:false,replay:false,enabled:true,dirty:false,canUndo:false,canRedo:false,canBack:false,unresolved:[],currentVersion:0,versions:[],library:[]};send.mockImplementation(async()=>s);vi.stubGlobal('chrome',{runtime:{onMessage:{addListener:vi.fn(),removeListener:vi.fn()}},storage:{local:{get:vi.fn().mockResolvedValue({})}}});vi.mocked(accountAPI).mockRejectedValue(new AccountError('AUTH_REQUIRED','Sign in'));});
afterEach(async()=>{await act(async()=>root.unmount());el.remove();vi.unstubAllGlobals();});
const button=(text:string)=>[...el.querySelectorAll('button')].find(b=>b.textContent===text)!;
async function mount(){await act(async()=>root.render(<App bridge={{send,subscribe:listener=>{notify=listener;listener(s);return()=>{};}}}/>));}
it('exposes feature creation immediately and explains guest limits before sending a request',async()=>{
 await mount();expect(el.textContent).toContain('What should this app do next?');const prompt=el.querySelector('textarea')!;expect(prompt.closest('details')).toBeNull();expect(el.textContent).toContain('Multi-step features require a Wandel sign-in');
 await act(async()=>button('Onboarding').click());const draft=prompt.value;expect(draft).toContain('profile');await act(async()=>button('Sign in to create').click());expect(signIn).toHaveBeenCalledOnce();expect(previewPlan).not.toHaveBeenCalled();expect(prompt.value).toBe(draft);
 await act(async()=>button('Try a free edit').click());expect(el.textContent).toContain('What would you like to change?');await act(async()=>button('Find section & create').click());expect(send).toHaveBeenCalledWith({type:'selectDestination',prompt:draft});expect(prompt.value).toBe(draft);
});
it('updates the start label and offers creation after signing in without losing the draft',async()=>{
 await mount();await act(async()=>button('Approval flow').click());const draft=el.querySelector('textarea')!.value;
 vi.mocked(accountAPI).mockResolvedValue({user:{name:'Tester',email:'test@example.com'},entitlements:{plan:'FREE'}});
 await act(async()=>window.dispatchEvent(new Event('focus')));
 s={...s,selected:{tag:'button',label:'Sign in',owned:false,locator:{tag:'button',role:'',name:'Sign in',text:'Sign in',attrs:{},parent:{tag:'',id:'',role:'',label:''},previous:'',next:''}}};await act(async()=>notify(s));
 expect(el.textContent).toContain('Starting at Sign in');expect(button('Create feature').disabled).toBe(false);expect(el.querySelector('textarea')!.value).toBe(draft);
 vi.mocked(previewPlan).mockRejectedValue(new Error('Planner unavailable'));await act(async()=>button('Create feature').click());expect(previewPlan).toHaveBeenCalledWith('Create a connected workflow: '+draft,{tag:'button',label:'Sign in'});expect(el.querySelector('textarea')!.value).toBe(draft);expect(el.textContent).toContain('Planner unavailable');
 await act(async()=>{notify(null);notify(s);});expect(el.textContent).not.toContain('Planner unavailable');expect(el.querySelector('textarea')!.value).toBe(draft);
 let reject!:(e:Error)=>void;vi.mocked(previewPlan).mockImplementationOnce(()=>new Promise((_,fail)=>{reject=fail;}));
 await act(async()=>button('Create feature').click());await act(async()=>{notify(null);notify(s);});
 await act(async()=>reject(new Error('Stale request failed')));expect(el.textContent).not.toContain('Stale request failed');
});

it('routes the reported Advanced settings prompt without selection or sign-in',async()=>{
 await mount();
 const prompt=el.querySelector('textarea')!;
 const value='Add a dark/light theme option and a panel to resize the screen with a slider in Advanced settings.';
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(prompt,value);prompt.dispatchEvent(new Event('input',{bubbles:true}));});
 expect(button('Add to Advanced settings')).toBeTruthy();
 await act(async()=>button('Add to Advanced settings').click());
 expect(send).toHaveBeenCalledWith({type:'settingsPrompt',prompt:value});
 expect(signIn).not.toHaveBeenCalled();expect(previewPlan).not.toHaveBeenCalled();
 expect(el.textContent).toContain('Added working prototype settings inside Advanced');
});

it('checks the page target before spending an AI request and retains the prompt on failure',async()=>{
 vi.mocked(accountAPI).mockResolvedValue({user:{name:'Tester'},entitlements:{plan:'FREE'}});await mount();
 s={...s,selected:{tag:'div',label:'Advanced',owned:false,locator:{tag:'div',role:'',name:'Advanced',text:'Advanced',attrs:{},parent:{tag:'div',id:'',role:'',label:''},previous:'',next:''}}};
 await act(async()=>notify(s));await act(async()=>button('Approval flow').click());
 const prompt=el.querySelector('textarea')!.value;
 send.mockRejectedValueOnce(new Error('The selected section is no longer available.'));
 await act(async()=>button('Create feature').click());
 expect(send).toHaveBeenCalledWith({type:'selectDestination',prompt});expect(previewPlan).not.toHaveBeenCalled();expect(el.querySelector('textarea')!.value).toBe(prompt);
});

it('does not force a request to add an inline section into a connected workflow',()=>{
 const prompt='Add another section called Feedback length which has three options: Concise - toggle (like others), Normal, Elaborated';
 expect(generationPrompt(prompt,'feature')).toBe(prompt);
 expect(generationPrompt('In the Advanced dialog add a dropdown with Brief and Detailed options','feature')).toBe('In the Advanced dialog add a dropdown with Brief and Detailed options');
 expect(generationPrompt('Add onboarding across three screens','feature')).toBe('Create a connected workflow: Add onboarding across three screens');
});
it.each([
 'Add another section called Feedback length which has three options: 1. Concise - toggle (like others); 2. Normal; 3. Elaborated',
 'Add a “Feedback length” category below Metrics and above Cancel/Save. Match the existing headings, spacing and purple pill controls. Include Concise, Normal and Elaborated. Allow only one choice at a time, with Normal selected initially.'
])('adds the exact category prompt through the panel without sign-in or AI: %s',async(prompt)=>{
 await mount();
 s={...s,selected:{tag:'div',label:'Advanced',owned:false,locator:{tag:'div',role:'',name:'Advanced',text:'Advanced',attrs:{},parent:{tag:'',id:'',role:'',label:''},previous:'',next:''}}};
 await act(async()=>notify(s));
 const area=el.querySelector('textarea')!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(area,prompt);area.dispatchEvent(new Event('input',{bubbles:true}));});
 await act(async()=>button('Add matching category').click());
 expect(signIn).not.toHaveBeenCalled();expect(previewPlan).not.toHaveBeenCalled();
 expect(send).toHaveBeenCalledWith(expect.objectContaining({type:'prompt',prompt,plan:expect.objectContaining({steps:expect.arrayContaining([expect.objectContaining({text:'Feedback length'})])})}));
});
it('switches modes with E/I/V when focus is in the side panel rather than the website',async()=>{
 await mount();send.mockClear();
 await act(async()=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:'i',bubbles:true,cancelable:true}));});expect(send).toHaveBeenLastCalledWith({type:'interact'});
 await act(async()=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:'e',bubbles:true,cancelable:true}));});expect(send).toHaveBeenLastCalledWith({type:'edit'});
 await act(async()=>{s={...s,mode:'interact'};notify(s);});
 await act(async()=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:'v',bubbles:true,cancelable:true}));});expect(send).toHaveBeenLastCalledWith({type:'edit'});
 await act(async()=>{s={...s,mode:'edit'};notify(s);});
 send.mockClear();const prompt=el.querySelector('textarea')!;
 await act(async()=>{prompt.dispatchEvent(new KeyboardEvent('keydown',{key:'i',bubbles:true,cancelable:true}));});expect(send).not.toHaveBeenCalled();
});
it('places the minimize icon directly beside the status dot at the right of the header',async()=>{
 await mount();const actions=el.querySelector('.dx-header .dx-header-actions')!;expect(actions.querySelector('.dx-dot')?.nextElementSibling?.getAttribute('aria-label')).toBe('Minimize Wandel panel');expect(actions.querySelector('svg')).not.toBeNull();await act(async()=>actions.querySelector<HTMLButtonElement>('button')!.click());expect(send).toHaveBeenCalledWith({type:'minimizePanel'});
});
it('keeps playback and sharing visible in the footer without saving or creating a connection first',async()=>{
 await mount();const footer=el.querySelector('footer')!;expect(footer.textContent).toContain('Play flow');expect(footer.textContent).toContain('Share & playback');expect(s.workflow.edges).toHaveLength(0);
 await act(async()=>button('Share & playback').click());const details=el.querySelector('main details') as HTMLDetailsElement;expect(details.open).toBe(true);expect(el.querySelector('main')!.textContent).toContain('Export workflow');expect(el.querySelector('main')!.textContent).toContain('Record walkthrough');expect(send).not.toHaveBeenCalled();
 await act(async()=>button('Try flow on app').click());expect(send).toHaveBeenCalledWith({type:'replay'});expect(el.querySelector('main')!.textContent).not.toContain('Export workflow');
 await act(async()=>button('Saved versions 0').click());expect(footer.textContent).toContain('Share & playback');await act(async()=>button('Share & playback').click());expect(el.querySelector('main details')?.hasAttribute('open')).toBe(true);
});

it('exposes voice in regular Wandel and retains the multi-step prompt when switching back',async()=>{
 await mount();await act(async()=>button('Onboarding').click());const draft=el.querySelector('textarea')!.value;
 await act(async()=>button('Voice assistant').click());expect(el.querySelector('[aria-label="Conversational assistant"]')).not.toBeNull();expect(button('Hold to speak')).toBeTruthy();expect(el.textContent).not.toContain('ASSISTANT BETA');
 await act(async()=>button('Hold to speak').dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true})));expect(el.textContent).toContain('Enable voice/context sharing first');expect(send).not.toHaveBeenCalledWith({type:'assistantContext'});
 await act(async()=>button('Imagine a feature').click());expect(el.querySelector('[aria-label="Conversational assistant"]')).toBeNull();expect(el.querySelector('textarea')!.value).toBe(draft);expect(button('Approval flow')).toBeTruthy();
});
