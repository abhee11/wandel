// @vitest-environment jsdom
import {act,useEffect,useState} from 'react';import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {AssistantPanel} from '../extension/assistant/AssistantPanel';import {Session} from '../extension/content/session';import {Repository,BrowserStorage} from '../extension/storage/store';import type {Snapshot} from '../extension/shared/model';import type {Bridge} from '../extension/sidepanel/bridge';import {planConversation,transcribeInstruction} from '../extension/assistant/client';import {action,response,type AssistantPlan} from '../extension/assistant/schema';
vi.mock('../extension/assistant/client',()=>({planConversation:vi.fn(),transcribeInstruction:vi.fn()}));
vi.mock('../extension/assistant/voice',()=>({PushToTalk:class{constructor(private active:(v:boolean)=>void,private completed:(blob:Blob)=>void){}async start(){this.active(true);}stop(){this.active(false);this.completed(new Blob(['synthetic audio'],{type:'audio/wav'}));}cancel(){this.active(false);}}}));
let root:Root,session:Session,element:HTMLElement;const save=vi.fn();
beforeEach(async()=>{vi.clearAllMocks();(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;localStorage.clear();document.body.innerHTML='<main><h3 id="heading">Signals</h3><button style="border-radius:20px">Existing</button></main><aside></aside>';session=new Session(document.querySelector('main')!,new Repository(new BrowserStorage()),new URL('https://example.com'),{assistantEnabled:true});await session.init();await session.dispatch({type:'edit'});document.getElementById('heading')!.click();element=document.querySelector('aside')!;root=createRoot(element);const bridge:Bridge={send:command=>session.dispatch(command),subscribe:listener=>session.subscribe(listener)};function Harness(){const [snapshot,setSnapshot]=useState<Snapshot>(session.snapshot());useEffect(()=>session.subscribe(setSnapshot),[]);return <AssistantPanel bridge={bridge} snapshot={snapshot} onSave={save}/>;}await act(async()=>root.render(<Harness/>));});
afterEach(async()=>{await act(async()=>root.unmount());session.destroy();vi.restoreAllMocks();});
const button=(label:string)=>[...element.querySelectorAll('button')].find(b=>b.textContent===label)!;
async function type(value:string){const input=element.querySelector('textarea')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});}
it('uses local interpretation without cloud consent, and handles missing labels conversationally',async()=>{
 await type('Add two buttons below this heading');await act(async()=>button('Send').click());expect(element.textContent).toContain('labels');expect(element.querySelector('textarea')!.value).toBe('');
 await type('Continue and Back');await act(async()=>button('Send').click());expect(document.querySelector('main')!.textContent).toContain('Continue');expect(document.querySelector('main')!.textContent).toContain('Back');expect(planConversation).not.toHaveBeenCalled();expect(session.workflow.states[0].operations.filter(o=>o.kind==='insert')).toHaveLength(2);
});
it('does not send page context without consent and ignores a late model result after cancellation',async()=>{
 await type('Please improve the interface');await act(async()=>button('Send').click());expect(planConversation).not.toHaveBeenCalled();expect(element.textContent).toContain('Enable scoped context');
 await act(async()=>element.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());let finish!:(plan:AssistantPlan)=>void;vi.mocked(planConversation).mockImplementation((_instruction,context)=>new Promise(resolve=>{finish=()=>resolve(response('edit','Changed',[action('text',[context.selected!],{text:'Unexpected'})]));}));
 await act(async()=>button('Send').click());expect(planConversation).toHaveBeenCalledOnce();await act(async()=>button('Cancel').click());await act(async()=>finish(response('unsupported','Unused')));expect(document.getElementById('heading')!.textContent).toBe('Signals');expect(element.textContent).toContain('Canceled');expect(element.querySelector('textarea')!.value).toBe('Please improve the interface');
});
it('routes save requests to the existing save chooser without pretending to save',async()=>{await type('Save this as a journey');await act(async()=>button('Send').click());expect(save).toHaveBeenCalledOnce();expect(session.record).toBeNull();});

it('runs a voice transcript through the same local editing pipeline and leaves it visible',async()=>{
 vi.mocked(transcribeInstruction).mockResolvedValue('Change this heading to Voice edited.');await act(async()=>element.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());
 await act(async()=>button('Hold to speak').dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true})));expect(element.textContent).toContain('Microphone on');await act(async()=>button('● Release to send').dispatchEvent(new KeyboardEvent('keyup',{key:' ',bubbles:true})));
 expect(transcribeInstruction).toHaveBeenCalledOnce();expect(planConversation).not.toHaveBeenCalled();expect(document.getElementById('heading')!.textContent).toBe('Voice edited');expect(element.textContent).toContain('Heard: Change this heading to Voice edited.');expect(session.snapshot().canUndo).toBeTruthy();
});
