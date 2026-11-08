// @vitest-environment jsdom
import {act,useEffect,useState} from 'react';import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {AssistantPanel} from '../extension/assistant/AssistantPanel';import {Session} from '../extension/content/session';import {Repository,BrowserStorage} from '../extension/storage/store';import type {Snapshot} from '../extension/shared/model';import type {Bridge} from '../extension/sidepanel/bridge';import {planConversation,transcribeInstruction} from '../extension/assistant/client';import {action,response,type AssistantPlan} from '../extension/assistant/schema';
vi.mock('../extension/assistant/client',()=>({planConversation:vi.fn(),transcribeInstruction:vi.fn(),availableModels:vi.fn(async()=>({models:[],default:''})),chosenModel:vi.fn(),chooseModel:vi.fn()}));
const microphone=vi.hoisted(()=>({denied:false}));
vi.mock('../extension/assistant/voice',()=>({PushToTalk:class{constructor(private active:(v:boolean)=>void,private completed:(blob:Blob)=>void,private failed:(message:string)=>void){}async start(){if(microphone.denied){this.active(false);this.failed('Microphone permission was denied.');return;}this.active(true);}stop(){this.active(false);this.completed(new Blob(['synthetic audio'],{type:'audio/wav'}));}cancel(){this.active(false);}}}));
let root:Root,session:Session,element:HTMLElement;const save=vi.fn();
beforeEach(async()=>{microphone.denied=false;sessionStorage.clear();vi.clearAllMocks();(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;localStorage.clear();localStorage.setItem('wandel:data-notice:v1','1');document.body.innerHTML='<main><h3 id="heading">Signals</h3><button style="border-radius:20px">Existing</button></main><aside></aside>';session=new Session(document.querySelector('main')!,new Repository(new BrowserStorage()),new URL('https://example.com'),{assistantEnabled:true});await session.init();await session.dispatch({type:'edit'});document.getElementById('heading')!.click();element=document.querySelector('aside')!;root=createRoot(element);const bridge:Bridge={send:command=>session.dispatch(command),subscribe:listener=>session.subscribe(listener)};function Harness(){const [snapshot,setSnapshot]=useState<Snapshot>(session.snapshot());useEffect(()=>session.subscribe(setSnapshot),[]);return <AssistantPanel bridge={bridge} snapshot={snapshot} onSave={save}/>;}await act(async()=>root.render(<Harness/>));});
afterEach(async()=>{await act(async()=>root.unmount());session.destroy();vi.restoreAllMocks();});
const button=(label:string)=>[...element.querySelectorAll('button')].find(b=>b.textContent===label)!;
async function type(value:string){const input=element.querySelector('textarea')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});}
it('uses local interpretation without cloud consent, and handles missing labels conversationally',async()=>{
 await type('Add two buttons below this heading');await act(async()=>button('Send').click());expect(element.textContent).toContain('labels');expect(element.querySelector('textarea')!.value).toBe('');
 await type('Continue and Back');await act(async()=>button('Send').click());expect(document.querySelector('main')!.textContent).toContain('Continue');expect(document.querySelector('main')!.textContent).toContain('Back');expect(planConversation).not.toHaveBeenCalled();expect(session.workflow.states[0].operations.filter(o=>o.kind==='insert')).toHaveLength(2);
});
it('uses AI directly for typed conversation and ignores a late reply after cancellation',async()=>{
 let finish!:(plan:AssistantPlan)=>void;vi.mocked(planConversation).mockImplementation((_instruction,context)=>new Promise(resolve=>{finish=()=>resolve(response('edit','Changed',[action('text',[context.selected!],{text:'Unexpected'})]));}));
 await type('Please improve the interface');await act(async()=>button('Send').click());expect(planConversation).toHaveBeenCalledOnce();expect(element.querySelector('[aria-label="Allow AI interpretation"]')).toBeNull();
 await act(async()=>button('Cancel').click());await act(async()=>finish(response('unsupported','Unused')));expect(document.getElementById('heading')!.textContent).toBe('Signals');expect(element.textContent).toContain('Canceled');expect(element.querySelector('textarea')!.value).toBe('');expect(element.querySelector('[data-delivery=stopped]')).not.toBeNull();
});
it('routes save requests to the existing save chooser without pretending to save',async()=>{await type('Save this as a journey');await act(async()=>button('Send').click());expect(save).toHaveBeenCalledOnce();expect(session.record).toBeNull();});

it('runs a voice transcript through the same local editing pipeline and leaves it visible',async()=>{
 vi.mocked(transcribeInstruction).mockResolvedValue('Change this heading to Voice edited.');await act(async()=>element.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());
 await act(async()=>button('🎙 Start speaking').click());expect(element.textContent).toContain('Microphone on');await act(async()=>button('■ Stop & send').click());
 expect(transcribeInstruction).toHaveBeenCalledOnce();expect(planConversation).not.toHaveBeenCalled();expect(document.getElementById('heading')!.textContent).toBe('Voice edited');expect(element.textContent).toContain('Heard: Change this heading to Voice edited.');expect(session.snapshot().canUndo).toBeTruthy();
});

it('recovers from unavailable voice transcription without blocking typed local editing',async()=>{
 vi.mocked(transcribeInstruction).mockRejectedValue(new Error('Voice service unavailable.'));
 await act(async()=>element.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());
 await act(async()=>button('🎙 Start speaking').click());
 await act(async()=>button('■ Stop & send').click());
 expect(element.textContent).toContain('Voice service unavailable.');expect(button('🎙 Start speaking').disabled).toBe(false);
 await type('Change this heading to Typed fallback.');await act(async()=>button('Send').click());expect(document.getElementById('heading')!.textContent).toBe('Typed fallback');expect(planConversation).not.toHaveBeenCalled();
});

it('keeps the renamed target current and allows Undo even after the host removes it',async()=>{
 await type('Change this heading to Renamed.');await act(async()=>button('Send').click());expect(element.textContent).toContain('Selection: Renamed');
 document.getElementById('heading')!.remove();
 await act(async()=>button('Undo').click());expect(session.workflow.states[0].operations).toHaveLength(0);expect(element.textContent).toContain('Undid the last edit');expect(element.textContent).not.toContain('unavailable, private, or ambiguous');
});

it('replaces opening status with a visible recovery step when capture is denied',async()=>{
 microphone.denied=true;await act(async()=>element.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());await act(async()=>button('🎙 Start speaking').click());
 expect(element.textContent).toContain('Microphone is off. Click Set up microphone');expect(element.textContent).not.toContain('Opening microphone');expect(button('🎙 Start speaking').disabled).toBe(false);
});

it('shows explicit consent on Start speaking before requesting context or recording',async()=>{
 await act(async()=>button('🎙 Start speaking').click());expect(element.querySelector('[role=dialog]')?.getAttribute('aria-label')).toBe('Allow voice sharing');expect(element.textContent).not.toContain('Microphone on');expect(transcribeInstruction).not.toHaveBeenCalled();
 await act(async()=>button('Keep typing instead').click());expect(element.querySelector('[role=dialog]')).toBeNull();expect(element.textContent).toContain('Voice is off');
 await act(async()=>button('🎙 Start speaking').click());await act(async()=>button('Allow voice & continue').click());expect(element.textContent).toContain('Microphone on');expect(element.querySelector<HTMLInputElement>('input[type=checkbox]')!.checked).toBe(true);
});

it('keeps sharing consent after the assistant remounts during microphone setup',async()=>{
 await act(async()=>button('🎙 Start speaking').click());await act(async()=>button('Allow voice & continue').click());await act(async()=>button('Cancel').click());
 await act(async()=>root.unmount());root=createRoot(element);
 const bridge:Bridge={send:command=>session.dispatch(command),subscribe:listener=>session.subscribe(listener)};
 await act(async()=>root.render(<AssistantPanel bridge={bridge} snapshot={session.snapshot()} onSave={save}/>));
 expect(element.querySelector<HTMLInputElement>('input[type=checkbox]')!.checked).toBe(true);
 await act(async()=>button('🎙 Start speaking').click());expect(element.querySelector('[role=dialog]')).toBeNull();expect(element.textContent).toContain('Microphone on');
});

it('shows interim spoken words and removes setup clutter while recording',async()=>{
 let recognition:any;const abort=vi.fn();vi.stubGlobal('SpeechRecognition',class{constructor(){recognition=this;}start(){}abort=abort;});
 await act(async()=>element.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());await act(async()=>button('🎙 Start speaking').click());
 await act(async()=>recognition.onresult({results:[[{transcript:'Add another feedback card'}]]}));expect(element.querySelector('textarea')!.value).toBe('Add another feedback card');expect([...element.querySelectorAll('button')].some(b=>b.textContent==='Set up microphone')).toBe(false);
 await act(async()=>button('Cancel').click());expect(abort).toHaveBeenCalledOnce();expect(transcribeInstruction).not.toHaveBeenCalled();vi.unstubAllGlobals();
});
it('marks failed voice instructions in the thread and leaves a fresh composer',async()=>{
 vi.mocked(transcribeInstruction).mockResolvedValue('Please improve this interface.');vi.mocked(planConversation).mockRejectedValue(new Error('Wandel took too long to respond. Your instruction is kept.'));
 await act(async()=>element.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());await act(async()=>button('🎙 Start speaking').click());await act(async()=>button('■ Stop & send').click());
 expect(element.querySelector('textarea')!.value).toBe('');expect(element.querySelector('textarea')!.disabled).toBe(false);expect(button('Send').disabled).toBe(true);expect(button('Retry')).toBeTruthy();expect(element.querySelector('[data-delivery=failed]')).not.toBeNull();
 await type('Change this heading to Recovered.');await act(async()=>button('Send').click());expect(document.getElementById('heading')!.textContent).toBe('Recovered');
});

it('converses about a card, highlights it, duplicates it with details, and connects its button to a known route',async()=>{
 session.root.innerHTML='<section id="profile"><h1>Amith V</h1><article style="padding:24px;border-radius:28px"><h2>M2 + Reflectivity</h2><p>Send recordings to Reflectivity.</p><button>Connect</button></article></section>';
 await act(async()=>document.querySelector<HTMLElement>('#profile')!.click());
 await type('Do you see a card?');await act(async()=>button('Send').click());expect(element.querySelector('[role=log]')!.textContent).toContain('Yes—“M2 + Reflectivity”');expect(session.snapshot().selected?.locator.attrs.id).toBe('profile');expect((await session.dispatch({type:'assistantContext'})).assistant?.context?.lastCard).toBeTruthy();expect(document.querySelector('[data-dx-ignore]')).not.toBeNull();
 await type('Can you duplicate it into a Feedback card and for the button use Create?');await act(async()=>button('Send').click());expect(document.querySelectorAll('article')).toHaveLength(2);expect(document.querySelectorAll('article')[1].textContent).toContain('Feedback');expect(document.querySelectorAll('article')[1].textContent).toContain('Create');expect(planConversation).not.toHaveBeenCalled();
 session.workflow.states.push({id:'profile-view',title:'Profile',parent:session.stateId,view:'base',liveURL:'https://example.com/profile',operations:[]});
 await type('Make it connect to /profile page');await act(async()=>button('Send').click());expect(session.workflow.edges.some(e=>e.to==='profile-view'&&e.event==='click')).toBe(true);expect(element.querySelector('[role=log]')!.textContent).toContain('Connected Create to /profile');expect(element.querySelector('[role=log]')!.textContent).toContain('Do you see a card?');expect(button('Send').disabled).toBe(true); // empty after successful send
});

it('checks an unseen route and requires destination confirmation before saving its connection',async()=>{
 await act(async()=>document.querySelector<HTMLElement>('main>button')!.click());let receive!:(state:any)=>void;
 const call=vi.fn(async()=>({screens:[],candidate:null,browsing:false,error:''}));const bridge:Bridge={send:command=>session.dispatch(command),subscribe:listener=>session.subscribe(listener),screens:{call,subscribe:listener=>{receive=listener;return()=>{};}}};
 await act(async()=>root.render(<AssistantPanel bridge={bridge} snapshot={session.snapshot()} onSave={save}/>));
 await type('Make it connect to /profile page');await act(async()=>button('Send').click());expect(call).toHaveBeenCalledWith('browse','https://example.com/profile');expect(session.workflow.edges).toHaveLength(0);expect(element.textContent).toContain('confirmation before connecting');
 const screen={id:'profile-capture',title:'Profile',url:'https://example.com/profile',route:'/profile',thumbnail:'data:image/png;base64,AAAA',nodes:[{id:'screen-root',parent:-1,tag:'main',text:'',style:{}}],capturedAt:new Date().toISOString(),truncated:false};
 await act(async()=>receive({screens:[screen],candidate:screen,browsing:false,error:''}));const connect=[...element.querySelectorAll('button')].find(b=>b.textContent==='Connect to Profile · /profile')!;expect(connect).toBeTruthy();await act(async()=>connect.click());expect(session.workflow.states.some(s=>s.liveURL==='https://example.com/profile')).toBe(true);expect(session.workflow.edges).toHaveLength(1);expect(element.textContent).toContain('Connected to /profile');
});


it('interprets typed requests immediately without microphone setup or permission interruptions',async()=>{
 vi.mocked(planConversation).mockImplementation(async(_text,c)=>response('edit','Updated the heading.',[action('text',[c.selected!],{text:'Improved'})]));
 await type('Please improve this interface.');await act(async()=>button('Send').click());expect(planConversation).toHaveBeenCalledOnce();expect(document.getElementById('heading')!.textContent).toBe('Improved');expect(element.querySelector('[aria-label="Allow AI interpretation"]')).toBeNull();expect(transcribeInstruction).not.toHaveBeenCalled();
});
it('recovers from an AI failure and retains local editing',async()=>{
 vi.mocked(planConversation).mockRejectedValue(new Error('Service temporarily unavailable'));
 await type('Please improve this interface.');await act(async()=>button('Send').click());expect(element.textContent).toContain('Service temporarily unavailable');
 await type('Change this heading to Local edit.');await act(async()=>button('Send').click());expect(document.getElementById('heading')!.textContent).toBe('Local edit');
});
it('does not apply an AI edit if the user changes selection before it returns',async()=>{
 let finish!:()=>void;vi.mocked(planConversation).mockImplementation((_text,c)=>new Promise(resolve=>{finish=()=>resolve(response('edit','Change',[action('text',[c.selected!],{text:'Unexpected'})]));}));
 await type('Please improve this interface.');await act(async()=>button('Send').click());await act(async()=>document.querySelector<HTMLElement>('main>button')!.click());await act(async()=>finish());expect(document.getElementById('heading')!.textContent).toBe('Signals');expect(element.textContent).toContain('selection changed');
});

it('retains a confirmed native div card and applies the exact heading, subtext and button request',async()=>{
 session.root.innerHTML='<section><div id="native-card" style="background:white;border-radius:32px;padding:28px"><div class="card-title" style="font-size:24px;font-weight:700"><span>M2 +</span></div><div class="card-description" style="font-size:16px">Send M2 recordings to Reflectivity.</div><div class="card-action"><button style="border-radius:30px">Connect</button></div></div></section>';
 await act(async()=>document.querySelector<HTMLElement>('#native-card')!.click());await type('Do you see a card?');await act(async()=>button('Send').click());expect(element.textContent).toContain('Yes—“M2 +”');expect(session.snapshot().selected?.locator.attrs.id).toBe('native-card');
 const request='Yes - duplicate it with heading "Feedback & Support" and the sub text is for feedback please click on create and call the button inside as "Create"';
 await type(request);await act(async()=>button('Send').click());expect(planConversation).not.toHaveBeenCalled();expect(element.textContent).not.toContain('Which highlighted card should I copy?');
 const cards=session.root.querySelector('section')!.children;expect(cards).toHaveLength(2);const copy=cards[1];expect(copy.children[0].textContent).toBe('Feedback & Support');expect(copy.children[1].textContent).toBe('for feedback please click on create');expect(copy.querySelector('button')!.textContent).toBe('Create');expect(getComputedStyle(copy).borderRadius).toBe('32px');expect(cards[0].querySelector('button')!.textContent).toBe('Connect');expect(cards[0].children[0].textContent).toBe('M2 +');
 await act(async()=>button('Undo').click());expect(session.root.querySelector('section')!.children).toHaveLength(1);
});

it('duplicates a whole card in chat, retains the exchange, and targets the copy for a follow-up',async()=>{
 const main=document.querySelector('main')!;const card=document.createElement('section');card.innerHTML='<h2>Select Group</h2><p>Create your first group</p><button>General</button>';main.append(card);await act(async()=>card.click());
 await type('Duplicate the selected and name is Deleted card');await act(async()=>button('Send').click());
 const copied=session.findSelected()!;expect(copied).not.toBe(card);expect(copied.textContent).toContain('Deleted card');expect(copied.textContent).toContain('General');expect(card.querySelector('h2')!.textContent).toBe('Select Group');expect(session.workflow.states).toHaveLength(1);expect(planConversation).not.toHaveBeenCalled();
 expect(element.querySelector('[role=log]')!.textContent).toContain('Duplicate the selected and name is Deleted card');expect(element.querySelector('[role=log]')!.textContent).toContain('The copy is selected');
 await type('Rename it to Archive');await act(async()=>button('Send').click());expect(main.textContent,element.textContent||'').toContain('Archive');expect(main.querySelectorAll('button')).toHaveLength(3);expect(card.querySelector('h2')!.textContent).toBe('Select Group');expect(session.findSelected()!.textContent).toContain('Archive');expect(element.textContent).toContain('Selection: Archive');
 await type('Duplicate selected');await act(async()=>button('Send').click());expect(main.querySelectorAll('h2')).toHaveLength(3);expect(element.querySelectorAll('.dx-chat-turn.user')).toHaveLength(3);expect(element.querySelectorAll('.dx-chat-turn.assistant')).toHaveLength(3);
 await act(async()=>button('Undo').click());expect(main.querySelectorAll('h2')).toHaveLength(2);expect(element.querySelectorAll('.dx-chat-turn.user')).toHaveLength(4);
});

it('discusses layout without a selection, remembers advice, and never applies a discussion response',async()=>{
 await act(async()=>{await session.dispatch({type:'escape'});await session.dispatch({type:'edit'});});
 vi.mocked(planConversation).mockResolvedValue(response('answer','The hierarchy puts the heading first. I would increase the space before the primary action, so the next step is clearer.'));
 await type('What do you think of this layout?');await act(async()=>button('Send').click());
 expect(element.querySelector('[role=log]')!.textContent).toContain('increase the space');expect(session.workflow.states[0].operations).toHaveLength(0);
 expect(vi.mocked(planConversation).mock.calls[0][1].elements.length).toBeGreaterThan(0);expect(vi.mocked(planConversation).mock.calls[0][1].viewport?.width).toBeGreaterThan(0);
 await type('Which option is better?');await act(async()=>button('Send').click());expect(JSON.stringify(vi.mocked(planConversation).mock.calls.at(-1)![3])).toContain('increase the space');expect(session.workflow.states[0].operations).toHaveLength(0);
 vi.mocked(planConversation).mockImplementation(async(_instruction,c)=>response('edit','Change the heading.',[action('text',[c.elements[0].ref],{text:'Unexpected'})]));
 await type('What would you change about the layout?');await act(async()=>button('Send').click());expect(session.workflow.states[0].operations).toHaveLength(0);expect(element.textContent).toContain('Suggestion only—nothing changed');
});
it('answers a greeting as chat without cloud access or a page mutation',async()=>{
 await type('Hello');await act(async()=>button('Send').click());expect(element.querySelector('[role=log]')!.textContent).toContain('We can talk through the layout');expect(planConversation).not.toHaveBeenCalled();expect(session.workflow.states[0].operations).toHaveLength(0);
});

it('uses a two-turn clarification to duplicate a selected card and add a heading without AI',async()=>{
 const card=document.createElement('article');card.innerHTML='<h2>Original</h2><p>Keep this description</p><button>Continue</button>';card.style.borderRadius='24px';session.root.append(card);await act(async()=>card.click());
 await type('Please duplicate selected and add heading');await act(async()=>button('Send').click());expect(element.textContent).toContain('What should the copied heading say?');expect(session.workflow.states[0].operations).toHaveLength(0);
 await type('Feedback');await act(async()=>button('Send').click());const copy=session.findSelected()!;expect(copy.textContent).toContain('Feedback');expect(copy.textContent).toContain('Keep this description');expect(copy.querySelector('button')!.textContent).toBe('Continue');expect(copy.style.borderRadius).toBe('24px');expect(card.querySelector('h2')!.textContent).toBe('Original');expect(planConversation).not.toHaveBeenCalled();expect(session.workflow.states).toHaveLength(1);
});
it('shows the live selection instead of a stale AI context target and does not generate a replacement for an unparsed copy request',async()=>{
 await act(async()=>session.dispatch({type:'assistantContext'}));await act(async()=>document.querySelector<HTMLElement>('main button')!.click());expect(element.textContent).toContain('Selection: Existing');expect(element.textContent).not.toContain('Selection: Signals');
 vi.mocked(planConversation).mockResolvedValue(response('clarify','Which destination screen should the copy open?'));await type('Could you duplicate selected and connect it to /profile');await act(async()=>button('Send').click());expect(planConversation).toHaveBeenCalledOnce();expect(session.workflow.states[0].operations).toHaveLength(0);
});
it('keeps secondary controls tucked away and the composer available',async()=>{
 expect(element.querySelector('[aria-label="Chat options menu"]')!.hasAttribute('hidden')).toBe(true);expect(element.querySelector('[aria-label="Tell Wandel what to change"]')).not.toBeNull();await act(async()=>button('···').click());expect(element.querySelector('[aria-label="Chat options menu"]')!.hasAttribute('hidden')).toBe(false);
});

it('sends hi with whitespace as a delivered message and clears the composer without capturing page context',async()=>{
 const send=vi.fn();await act(async()=>root.render(<AssistantPanel bridge={{send,subscribe:()=>()=>{}}} snapshot={session.snapshot()} onSave={save}/>));
 await type('  hi  ');await act(async()=>button('Send').click());const input=element.querySelector('textarea')!;
 expect(input.value).toBe('');expect(input.disabled).toBe(false);expect(button('Send').disabled).toBe(true);expect(element.querySelector('.dx-chat-turn.user p')!.textContent).toBe('hi');expect(element.querySelector('.dx-chat-turn.assistant')!.textContent).toContain('Hi!');expect(element.querySelector('[data-delivery=sent]')).not.toBeNull();expect(send).not.toHaveBeenCalled();expect(planConversation).not.toHaveBeenCalled();
});
it('clears on send, shows typing while pending, prevents duplicate submissions and preserves the next draft when the reply arrives',async()=>{
 await act(async()=>element.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());let finish!:(p:AssistantPlan)=>void;vi.mocked(planConversation).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 await type('What would you improve about this layout?');const sendButton=button('Send');await act(async()=>{sendButton.click();sendButton.click();});
 expect(element.querySelector('textarea')!.value).toBe('');expect(element.querySelector('[aria-label="Wandel is typing"]')).not.toBeNull();expect(element.querySelectorAll('.dx-chat-turn.user')).toHaveLength(1);expect(planConversation).toHaveBeenCalledOnce();
 await type('My next message');await act(async()=>finish(response('answer','Give the primary action more breathing room.')));expect(element.querySelector('textarea')!.value).toBe('My next message');expect(element.querySelector('[aria-label="Wandel is typing"]')).toBeNull();expect(element.querySelector('[role=log]')!.textContent).toContain('breathing room');
});
it('retries a failed message in place without duplicating it or losing an unsent draft',async()=>{
 await act(async()=>element.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());vi.mocked(planConversation).mockRejectedValueOnce(new Error('Temporary connection failure')).mockResolvedValueOnce(response('answer','I would align the action with the heading.'));
 await type('What would you improve about this layout?');await act(async()=>button('Send').click());expect(element.querySelector('textarea')!.value).toBe('');expect(element.querySelector('[data-delivery=failed]')!.textContent).toContain('Temporary connection failure');
 await type('Unsent follow-up');await act(async()=>button('Retry').click());expect(planConversation).toHaveBeenCalledTimes(2);expect(element.querySelectorAll('.dx-chat-turn.user')).toHaveLength(1);expect(element.querySelector('[data-delivery=failed]')).toBeNull();expect(element.querySelector('[role=log]')!.textContent).toContain('align the action');expect(element.querySelector('textarea')!.value).toBe('Unsent follow-up');
});

it('sends the reported another-card request as a real duplicate of the selected div-only container without cloud interpretation',async()=>{
 session.root.innerHTML='<div id="whole-card" style="border-radius:32px;padding:28px;background:rgb(250,248,255)"><div><div><span>Select Group</span></div><div>Create your first group or select below</div><div>General</div></div></div>';
 await act(async()=>document.getElementById('whole-card')!.click());
 const prompt='can you add another card like the one selected ?';await type(prompt);await act(async()=>button('Send').click());
 expect(planConversation).not.toHaveBeenCalled();expect(session.root.children).toHaveLength(2);
 const copy=session.root.children[1] as HTMLElement;expect(copy.textContent).toBe(session.root.children[0].textContent);expect(copy.style.borderRadius).toBe('32px');expect(session.findSelected()).toBe(copy);expect(session.workflow.states).toHaveLength(1);
 expect(element.querySelector('textarea')!.value).toBe('');expect(element.querySelector('[role=log]')!.textContent).toContain(prompt);expect(element.querySelector('[role=log]')!.textContent).toContain('Duplicated the highlighted card');expect(element.querySelector('[data-delivery=sent]')).not.toBeNull();
});

it('keeps a design conversation through native copy, alignment, theme and undo without use-AI prompts',async()=>{
 session.root.innerHTML='<div id="layout" style="display:flex;gap:16px"><article id="source" style="background:#f0edfa;padding:20px"><h2>Summary</h2><p>Details</p><button>Open</button></article></div>';
 await act(async()=>document.getElementById('source')!.click());
 await type('Duplicate selected');await act(async()=>button('Send').click());const copied=session.findSelected()!;
 vi.mocked(planConversation).mockImplementationOnce(async(_instruction,c)=>{expect(c.recent).toContain(c.selected);expect(c.edits?.at(-1)?.message).toContain('Duplicated');const selected=c.elements.find(e=>e.ref===c.selected)!;return response('edit','Stacked the cards vertically.',[action('style',[selected.parent!],{style:{display:'flex',flexDirection:'column',alignItems:'stretch',gap:24},labels:['unused']})]);});
 await type('could you align the newly created vertically');await act(async()=>button('Send').click());expect(document.getElementById('layout')!.style.flexDirection).toBe('column');expect(document.getElementById('layout')!.children).toHaveLength(2);expect(session.findSelected()!.dataset.dxOwned).toBe(copied.dataset.dxOwned);
 vi.mocked(planConversation).mockImplementationOnce(async(_instruction,c,_signal,history)=>{expect(JSON.stringify(history)).toContain('Stacked the cards vertically');return response('edit','Applied a dark theme to the copy.',[action('style',[c.selected!],{style:{backgroundColor:'#171927',color:'#ffffff',borderRadius:18}})]);});
 await type('Give that one a dark theme');await act(async()=>button('Send').click());expect(session.findSelected()!.style.backgroundColor).toBe('rgb(23, 25, 39)');expect(document.getElementById('source')!.style.backgroundColor).toBe('rgb(240, 237, 250)');
 await type('Undo that last change');await act(async()=>button('Send').click());expect(document.getElementById('layout')!.style.flexDirection).toBe('column');expect(document.getElementById('layout')!.children).toHaveLength(2);expect(element.textContent).not.toContain('Use AI for this request');expect(element.querySelectorAll('.dx-chat-turn.user')).toHaveLength(4);
});
it('expands relevant DOM on demand without asking the user to refresh context',async()=>{
 vi.mocked(planConversation).mockImplementationOnce(async(_instruction,c)=>response('inspect','Inspect the containing layout.',[],[c.elements.find(e=>e.attributes.id==='heading')!.parent!])).mockResolvedValueOnce(response('answer','The heading and action have enough contrast; the spacing is the main opportunity.'));
 await type('How would you simplify this layout?');await act(async()=>button('Send').click());expect(planConversation).toHaveBeenCalledTimes(2);expect(element.textContent).toContain('spacing is the main opportunity');expect(element.querySelectorAll('.dx-chat-turn.user')).toHaveLength(1);expect(session.workflow.states[0].operations).toHaveLength(0);
});

it('continues the original edit after a clarification choice instead of resetting the conversation',async()=>{
 const heading=document.getElementById('heading')!,buttonRef=(await session.dispatch({type:'assistantContext'})).assistant!.context!.elements.find(e=>e.name==='Existing')!.ref;
 vi.mocked(planConversation).mockImplementationOnce(async(_text,c)=>response('clarify','Which element should get the line?',[],[c.selected!,buttonRef])).mockImplementationOnce(async(text,c)=>{expect(text).toBe('Add a dark blue line below the chosen element');return response('edit','Added the line.',[action('style',[c.selected!],{style:{borderBottomWidth:2,borderBottomColor:'#102a56',borderBottomStyle:'solid'}})]);});
 await type('Add a dark blue line below the chosen element');await act(async()=>button('Send').click());expect(element.querySelector('[data-delivery=waiting]')).not.toBeNull();await act(async()=>button('Signals').click());expect(heading.style.borderBottomWidth).toBe('2px');expect(planConversation).toHaveBeenCalledTimes(2);expect(element.textContent).not.toContain('What would you like to do with it?');expect(element.querySelectorAll('.dx-chat-turn.user')).toHaveLength(1);expect(element.textContent).toContain('Added the line');
});
it('repairs a rolled-back preview inside the same chat turn and clears the composer',async()=>{
 const dispatch=session.dispatch.bind(session);let attempts=0;vi.spyOn(session,'dispatch').mockImplementation(async command=>{if(command.type==='assistantApply'&&attempts++===0)throw new Error('Preview rolled back: Edited text overlaps the next content block.');return dispatch(command);});
 let size=26;vi.mocked(planConversation).mockImplementation(async(_text,c)=>response('edit','Adjusted the heading safely.',[action('style',[c.selected!],{style:{fontSize:size-=2}})]));await type('Make this heading more prominent');await act(async()=>button('Send').click());expect(attempts).toBe(2);expect(planConversation).toHaveBeenCalledTimes(2);expect(vi.mocked(planConversation).mock.calls[1][3]?.at(-1)?.text).toContain('rolled back');expect(element.querySelector('textarea')!.value).toBe('');expect(element.querySelector('[data-delivery=failed]')).toBeNull();expect(session.workflow.states[0].operations).toHaveLength(1);
});
it('resolves a simple duplicate follow-up without a selection after reloading a saved copy',async()=>{
 document.querySelector('main')!.insertAdjacentHTML('beforeend','<article id="card"><h2>Summary</h2><p>Keep details</p><button>Open</button></article>');await act(async()=>{document.getElementById('card')!.click();await session.dispatch({type:'duplicateElement'});await session.dispatch({type:'saveTemporary'});const record=(await session.repository.get(session.workflow.id))!;await session.dispatch({type:'loadRecord',record});await session.dispatch({type:'interact'});await session.dispatch({type:'edit'});await session.dispatch({type:'assistantReset'});});
 await type('Duplicate it');await act(async()=>button('Send').click());expect(document.querySelectorAll('article')).toHaveLength(3);expect(planConversation).not.toHaveBeenCalled();expect(element.textContent).not.toContain('Select the card');
});
it('connects a named checkbox to a known route only when checked',async()=>{
 session.root.insertAdjacentHTML('beforeend','<label><input id="show-profile" type="checkbox">Show profile</label>');session.workflow.states.push({id:'profile-view',title:'Profile',parent:session.stateId,view:'base',liveURL:'https://example.com/profile',operations:[]});await type('When Show profile is checked, open /profile');await act(async()=>button('Send').click());const edge=session.workflow.edges.find(e=>e.to==='profile-view')!;expect(edge.event).toBe('change');expect(edge.conditions).toHaveLength(1);expect(edge.conditions![0].test).toBe('checked');expect(edge.conditions![0].target.attrs.id).toBe('show-profile');expect(planConversation).not.toHaveBeenCalled();
});
