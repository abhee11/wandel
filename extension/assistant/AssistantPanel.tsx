import type React from 'react';
import {providerNames,type ModelChoice,type ModelProvider} from '../shared/models';
import {resolveInspections} from './inspection';
import {emptyAssistantMemory} from '../shared/assistantMemory';
import {requiresVisualReview} from './reviewPolicy';
import {conversationRecovery} from './recovery';
import {prepareReferenceImage} from './referenceImage';
import {applyVerifiedPlan,keptPreview} from './applyVerified';
import {connectionRoute,connectionControls,matchingScreens,matchingStates,routeTrigger} from './routeConnection';
import {readConversation,rememberConversation,type ChatTurn} from './conversation';
import {liveSpeech} from './liveSpeech';
import {prepareMicrophone,openMicrophoneSetup,voiceSharingAllowed,rememberVoiceSharing} from './microphonePermission';
import {HandsFree,echoOf,fillerSpeech,firstName,onItLine,pickVoice,spokenReply,thanks,thanksLine,stopListening,stopWork,type HandsFreeState} from './handsFree';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {Bridge} from '../sidepanel/bridge';
import {uid,type Snapshot,type VisitedScreen,type ConnectionEvent,type ConnectionCondition} from '../shared/model';
import {accountAPI} from '../sidepanel/accountClient';
import {planConversation,verifyConversation,transcribeInstruction,speakReply,reportFailure,availableModels,chosenModel,chooseModel} from './client';
import {samePage,stateURL} from '../shared/liveNavigation';
import {PushToTalk} from './voice';
import type {PageContext,AssistantPlan} from './schema';
/** Execution and review share the plan's intended visibility: content that only a click or hover shows is meant to be absent from AFTER. */
function revealNote(plan:AssistantPlan){
 const shown=plan.actions.some(action=>action.kind==='behavior'&&(action.event==='click'||action.event==='hover')&&action.effects?.some(effect=>effect.action==='show'||effect.action==='toggle'));
 return shown?'\nThe plan shows some content only after a click or hover. It is correctly hidden in AFTER; do not report it as missing. Its layout is checked by Wandel when it is shown.':'';
}
const firstIdeas=['add a pricing banner under the header','make this card stand out','turn this list into a table','show a success message after Save'];
export function AssistantPanel({bridge,snapshot,onSave,onBusyChange,onVisualEdit,notice}:{bridge:Bridge;snapshot:Snapshot;onSave:()=>void;onBusyChange?:(busy:boolean)=>void;onVisualEdit?:()=>void;notice?:React.ReactNode}){
 const [turns,setTurns]=useState<ChatTurn[]>(()=>readConversation(snapshot.workflow.id));
 const conversation=useRef(turns);
 const [referenceImage,setReferenceImage]=useState<string|undefined>();const referenceRef=useRef<string|undefined>(undefined);referenceRef.current=referenceImage;
 // A request waiting for the user to click something in the app; it resumes once Wandel has captured what opened.
 const watchRequest=useRef<{text:string;id:string}|null>(null);const imageInput=useRef<HTMLInputElement|null>(null);
 const [toolsOpen,setToolsOpen]=useState(false),[addOpen,setAddOpen]=useState(false);
 const addMenu=useRef<HTMLDivElement|null>(null);
 const [hint,setHint]=useState(0);
 /** A starter that needs the user's own words puts the beginning in the box and leaves them typing. */
 function startWith(text:string){setInstruction(text);requestAnimationFrame(()=>{const box=composer.current;if(box){box.focus();box.setSelectionRange(text.length,text.length);}});}
 const [copied,setCopied]=useState<{label:string;from:string}|null>(null),[copyTabs,setCopyTabs]=useState<{id:number;title:string;host:string}[]|null>(null);
 const pageTab=Number(new URL(location.href).searchParams.get('tabId'));
 useEffect(()=>{if(typeof chrome==='undefined'||!chrome.storage?.onChanged)return;void chrome.storage.local.get('wandelCopiedElement').then(saved=>setCopied(saved.wandelCopiedElement||null));const changed=(changes:Record<string,chrome.storage.StorageChange>,area:string)=>{if(area==='local'&&changes.wandelCopiedElement)setCopied(changes.wandelCopiedElement.newValue||null);};chrome.storage.onChanged.addListener(changed);return()=>chrome.storage.onChanged.removeListener(changed);},[]);
 async function listTabs(){const reply=await chrome.runtime.sendMessage({type:'WANDEL_COPY_TABS',current:pageTab});if(reply?.error)setError(reply.error);else setCopyTabs(reply.tabs);}
 async function copyFrom(tabId:number){setCopyTabs(null);setAddOpen(false);const reply=await chrome.runtime.sendMessage({type:'WANDEL_COPY_FROM',tabId,current:pageTab});if(reply?.error)setError(reply.error);}
 const [modelList,setModelList]=useState<ModelChoice[]>([]),[model,setModel]=useState('');
 useEffect(()=>{let active=true;void availableModels().then(list=>{if(!active)return;const saved=chosenModel();setModelList(list.models);setModel(list.models.some(item=>item.id===saved)?saved!:list.default);}).catch(()=>{/* no switcher without an account */});return()=>{active=false;};},[]);
 useEffect(()=>{const toggle=()=>setToolsOpen(open=>!open);window.addEventListener('wandel-chat-options',toggle);return()=>window.removeEventListener('wandel-chat-options',toggle);},[]);
 useEffect(()=>{if(!addOpen)return;const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!addMenu.current?.contains(event.target))setAddOpen(false);};document.addEventListener('pointerdown',outside,true);return()=>document.removeEventListener('pointerdown',outside,true);},[addOpen]);
 const [visualContext,setVisualContext]=useState('Viewport capture pending.');
 async function capture(c:PageContext){if(!bridge.capturePage){setVisualContext('DOM context only: this browser connection has no screenshot capture.');return undefined;}try{const image=await bridge.capturePage(c);setVisualContext('Redacted viewport screenshot and DOM context.');return image;}catch(error){setVisualContext('DOM context only. Capture diagnostic: '+(error instanceof Error?error.message:'Viewport capture was unavailable.'));return undefined;}}
 // The last plan's steps, for failure reports.
 const lastPlan=useRef('');
 function recover(detail:string,applied=false){spokenLine.current='';const asked=[...conversation.current].reverse().find(turn=>turn.role==='user')?.text||'';reportFailure({detail:detail.slice(0,600),instruction:asked.slice(0,400),plan:lastPlan.current.slice(0,400),page:(snapshot.workflow.route||'').slice(0,300),applied});const reply=conversationRecovery(detail,applied);setError('');setMessage(reply.text);say('assistant',reply.text,{status:'failed',error:detail.slice(0,300)});speak(reply.text);}

 const clarificationRequest=useRef<{text:string;id:string;scope:string}|null>(null);
 const pendingCopy=useRef<{selection:string;workflow:string;state:string}|null>(null);
 const chatLog=useRef<HTMLDivElement|null>(null),chatThread=useRef<HTMLDivElement|null>(null),composer=useRef<HTMLTextAreaElement|null>(null);
 const stickToBottom=useRef(true),sending=useRef(false);
 const activeRequest=useRef<{id:string;text:string;scope:string;selection:string;applying:boolean}|null>(null);
 const [routeChoices,setRouteChoices]=useState<VisitedScreen[]>([]);
 const routeSource=useRef<{workflow:string;state:string;selection:string;url:string;event:ConnectionEvent;conditions:ConnectionCondition[]}|null>(null);
 function say(role:ChatTurn['role'],text:string,extra:Partial<ChatTurn>={}){const state=snapshot.workflow.states.find(state=>state.id===snapshot.stateId);const next=[...conversation.current,{role,text,page:(state?.title||'Page')+' · '+(state?.virtualRoute||snapshot.workflow.route),...extra}].slice(-40);conversation.current=next;setTurns(next);rememberConversation(snapshot.workflow.id,next);}
 function updateTurn(id:string,patch:Partial<ChatTurn>){const next=conversation.current.map(turn=>turn.id===id?{...turn,...patch}:turn);conversation.current=next;setTurns(next);rememberConversation(snapshot.workflow.id,next);}
 // Every answer that carries a warning (the Fix it case) is logged with its plan, whichever path produced it.
 function speak(text:string){
  if(!talkOn.current)return;const line=spokenReply(text);if(!line)return;
  // Never over the person: wait for them to finish, and if they said something new, that turn answers instead.
  if(hearingNow.current){heldLine.current=line;return;}
  if(typingNow.current>0||talkPending.current.length)return;
  lastSpoken.current=line;recentLines.current=[...recentLines.current.slice(-3),line];
  // The microphone waits while Wandel talks, so it never answers itself.
  stopSpeaking();talk.current?.pause();
  let done=false;const line_id=++speakId.current,limit=setTimeout(()=>finish(),20000);
  const finish=()=>{if(done)return;done=true;clearTimeout(limit);if(talkOn.current&&line_id===speakId.current)talk.current?.resume();};
  const device=()=>{if(line_id!==speakId.current||!talkOn.current||!('speechSynthesis' in window)){finish();return;}const utterance=new SpeechSynthesisUtterance(line),voice=pickVoice(window.speechSynthesis.getVoices(),navigator.language);if(voice)utterance.voice=voice;utterance.onend=finish;utterance.onerror=finish;window.speechSynthesis.speak(utterance);};
  // A natural server voice first; this device's best voice if that isn't reachable.
  const controller=new AbortController();speakAbort.current=controller;
  void speakReply(line,controller.signal).then(source=>{if(line_id!==speakId.current||!talkOn.current){finish();return;}const audio=new Audio(source);speakAudio.current=audio;audio.onended=finish;audio.onerror=device;return audio.play();}).catch(()=>device());
 }
 function stopSpeaking(){speakId.current++;heldLine.current='';speakAbort.current?.abort();speakAudio.current?.pause();speakAudio.current=null;if('speechSynthesis' in window)window.speechSynthesis.cancel();}
 function stopTalk(note='Conversation mode is off.'){talkOn.current=false;talkPending.current=[];setTalkWaiting(0);talk.current?.stop();talk.current=null;setTalking(false);stopSpeaking();stopPreview.current?.();stopPreview.current=null;setTalkTyping(0);setInstruction('');setMessage(note);}
 async function startTalk(allowed=false){
  if(talkOn.current)return;if(!consent&&!allowed){talkConsent.current=true;setError('');setVoiceConsentOpen(true);setMessage('Allow voice sharing below to start talking.');return;}
  setError('');try{if(!await prepareMicrophone()){setMessage('Microphone setup opened in a separate window. Allow access there, then press Talk again.');return;}}catch(e){setError(e instanceof Error?e.message:'Could not open microphone setup.');return;}
  talkOn.current=true;setTalking(true);setTalkState('listening');
  const listener=new HandsFree(wav=>{void hear(wav);},talkChanged,()=>stopTalk('Conversation mode turned off after 3 quiet minutes.'),failure=>{stopTalk(failure);setError(failure);});talk.current=listener;await listener.start();
  if(talkOn.current){void accountAPI<{user?:{name?:string|null;email?:string|null}}>('/me').then(me=>{speaker.current=firstName(me.user?.name,me.user?.email);}).catch(()=>{}).finally(()=>{speak(speaker.current?`Hey ${speaker.current}, I'm listening.`:"Hey, I'm listening.");});}
 }
 // Words appear in the box as they are spoken, then the exact transcript replaces them.
 function talkChanged(state:HandsFreeState){
  hearingNow.current=state==='hearing';
  if(state==='hearing'){stopSpeaking();if(!sending.current)setInstruction('');stopPreview.current?.();stopPreview.current=liveSpeech(text=>{if(talkOn.current)setInstruction(text);},()=>{});}
  else{stopPreview.current?.();stopPreview.current=null;}
  if(state==='dropped'){if(!sending.current)setInstruction('');const line=heldLine.current;heldLine.current='';if(line)speak(line);return;}
  if(state==='listening')heldLine.current='';
  setTalkState(state);
 }
 async function hear(wav:Blob){typingNow.current++;setTalkTyping(typingNow.current);const finished=()=>{typingNow.current=Math.max(0,typingNow.current-1);setTalkTyping(typingNow.current);};try{const text=await transcribeInstruction(wav,new AbortController().signal,uid());finished();if(talkOn.current&&!echoOf(text,lastSpoken.current)){setInstruction(text);onSpoken.current(text);}else if(talkOn.current)setInstruction('');}catch(e){finished();if(!sending.current)setInstruction('');const detail=e instanceof Error?e.message:'';if(talkOn.current&&!/No instruction was/i.test(detail))setError(detail||'That could not be heard. Try again.');}}
 function drainTalk(){if(!talkOn.current||sending.current)return;const next=talkPending.current.shift();setTalkWaiting(talkPending.current.length);if(next)void submit(next.text,undefined,!next.id,undefined,next.id);}
 function answer(text:string,edited=false,review=''){if(review){const asked=[...conversation.current].reverse().find(turn=>turn.role==='user')?.text||'';reportFailure({detail:('kept with warning: '+review).slice(0,600),instruction:asked.slice(0,400),plan:lastPlan.current.slice(0,400),page:(snapshot.workflow.route||'').slice(0,300),applied:true});}setMessage(text);say('assistant',text,{...(edited?{edited:true}:{}),...(review?{review}:{})});const line=review?text:spokenLine.current||(edited?'Done, take a look.':text);spokenLine.current='';speak(line);}
 async function history(type:'undo'|'redo'){if(sending.current)return;try{await bridge.send({type});setMessage(type==='undo'?'Undid the last change.':'Redid the change.');}catch(e){setError(e instanceof Error?e.message:'That change could not be '+(type==='undo'?'undone.':'redone.'));}}
 useEffect(()=>{setReferenceImage(undefined);const saved=readConversation(snapshot.workflow.id);conversation.current=saved;setTurns(saved);routeSource.current=null;pendingCopy.current=null;setRouteChoices([]);},[snapshot.workflow.id]);
 const [talkTyping,setTalkTyping]=useState(0),spokenLine=useRef(''),speakId=useRef(0),speakAbort=useRef<AbortController|null>(null),speakAudio=useRef<HTMLAudioElement|null>(null);
 const [talking,setTalking]=useState(false),[talkState,setTalkState]=useState<HandsFreeState>('listening'),[talkWaiting,setTalkWaiting]=useState(0);
 const talk=useRef<HandsFree|null>(null),talkOn=useRef(false),talkPending=useRef<{text:string;id?:string}[]>([]),hearingNow=useRef(false),typingNow=useRef(0),heldLine=useRef(''),lastSpoken=useRef(''),recentLines=useRef<string[]>([]),speaker=useRef(''),talkConsent=useRef(false),onSpoken=useRef<(text:string)=>void>(()=>{});
 const [voiceTranscript,setVoiceTranscript]=useState(''),[startingVoice,setStartingVoice]=useState(false),[voiceConsentOpen,setVoiceConsentOpen]=useState(false),[microphoneReady,setMicrophoneReady]=useState(false);
 const [instruction,setInstruction]=useState(''),[consent,setConsent]=useState(voiceSharingAllowed),[busy,setBusy]=useState(false),[listening,setListening]=useState(false),[message,setMessage]=useState('Ask about the layout, or select an element for focused feedback.'),[error,rawSetError]=useState(''),[clarification,setClarification]=useState<AssistantPlan|null>(null);
 useEffect(()=>{if(turns.length||instruction)return;const timer=setInterval(()=>setHint(value=>value+1),3200);return()=>clearInterval(timer);},[turns.length,instruction]);
 // The current execution stage of the request in flight, shown beside Cancel above the composer.
 // It follows real steps (planning, applying, checking), is never written to the conversation, and clears when the request ends.
 const [progress,setProgress]=useState('');
 useEffect(()=>{if(!busy)setProgress('');},[busy]);
 function setError(detail:string){if(detail)recover(detail,!!activeRequest.current?.applying);else rawSetError('');}
 useEffect(()=>rememberVoiceSharing(consent),[consent]);
 useEffect(()=>{onBusyChange?.(busy||listening);return()=>onBusyChange?.(false);},[busy,listening,onBusyChange]);
 const stopPreview=useRef<(()=>void)|null>(null);
 // A request that opens another screen continues there once the chat has moved with it.
 const reopen=useRef<{text:string;id:string}|null>(null);
 const epoch=useRef(0),abort=useRef<AbortController|null>(null),voice=useRef<PushToTalk|null>(null),voiceContext=useRef<Promise<PageContext>|null>(null),pending=useRef(''),voiceHeld=useRef(false);
 const scope=snapshot.workflow.id+':'+snapshot.stateId+':'+snapshot.workflow.route;
 const scopeRef=useRef(scope);scopeRef.current=scope;
 useLayoutEffect(()=>{const log=chatLog.current;if(!log)return;stickToBottom.current=true;log.scrollTop=turns.length||busy?log.scrollHeight:0;},[turns,busy,toolsOpen,routeChoices.length]);
 useEffect(()=>{const log=chatLog.current,thread=chatThread.current;if(!log||!thread||typeof ResizeObserver==='undefined')return;const observer=new ResizeObserver(()=>{if(stickToBottom.current)log.scrollTop=log.scrollHeight;});observer.observe(log);observer.observe(thread);return()=>observer.disconnect();},[]);
 async function retry(turn:ChatTurn){if(sending.current)return;try{const current=await bridge.send({type:'snapshot'});if(turn.scope!==scopeRef.current){answer('We’re on a different page now. Should I apply that request to this page instead?');return;}await submit(turn.text,undefined,false,undefined,turn.id);}catch(e){recover(e instanceof Error?e.message:'Could not retry.');}}
 async function remember(plan:AssistantPlan){if(plan.memory)await bridge.send({type:'assistantRemember',memory:plan.memory}).catch(()=>{});}
 function applying(){if(activeRequest.current)activeRequest.current.applying=true;}

 async function context(inspect?:string[],instruction?:string){const next=await bridge.send({type:'assistantContext',chat:true,...(inspect?{inspect}:{}),...(instruction?{instruction}:{})});if(!next.assistant?.context)throw new Error('Refresh this page to use the assistant.');return next.assistant.context;}
 function cancel(){const waiting=clarificationRequest.current;clarificationRequest.current=null;setClarification(null);pending.current='';if(waiting&&!activeRequest.current)updateTurn(waiting.id,{status:'stopped',error:undefined,retryable:true});const active=activeRequest.current;if(active)updateTurn(active.id,{status:'stopped',error:active.applying?'Stopped waiting. Check the page before sending the edit again.':'Reply stopped.',retryable:!active.applying});activeRequest.current=null;sending.current=false;pendingCopy.current=null;setVoiceConsentOpen(false);epoch.current++;abort.current?.abort();abort.current=null;stopPreview.current?.();stopPreview.current=null;voice.current?.cancel();voiceHeld.current=false;setBusy(false);setListening(false);setStartingVoice(false);setError('');setMessage('Canceled. You can send another message.');}
 useEffect(()=>{if(activeRequest.current?.applying&&activeRequest.current.scope.startsWith(snapshot.workflow.id+':'))return;
  // Moving screens ends the request in flight: one this chat moved on purpose resumes here, any other is marked stopped rather than left sending.
  const moved=reopen.current;reopen.current=null;const interrupted=activeRequest.current;
  if(interrupted&&!moved)updateTurn(interrupted.id,{status:'stopped',error:'The screen changed before this finished.',retryable:true});
  if(moved)setTimeout(()=>void submit(moved.text,undefined,false,undefined,moved.id),0);
  activeRequest.current=null;sending.current=false;epoch.current++;abort.current?.abort();stopPreview.current?.();stopPreview.current=null;voice.current?.cancel();voiceHeld.current=false;setBusy(false);setListening(false);setStartingVoice(false);setClarification(null);clarificationRequest.current=null;pending.current='';setInstruction('');setError('');setMessage('Ask about the layout, or select an element for focused feedback.');},[scope]);
 // A request that opened a link carries on here, on the page it opened, once.
 useEffect(()=>{const store=typeof chrome!=='undefined'?chrome.storage?.session:undefined,key='wandel:crawl:'+(new URL(location.href).searchParams.get('tabId')||'');if(!store)return;
  void store.get(key).then(saved=>{const pending=saved[key] as {text:string;name:string;at:number}|undefined;if(!pending)return;void store.remove(key);if(Date.now()-pending.at>90000)return;setTimeout(()=>void submit(pending.text+`\n(Wandel opened “${pending.name}” to continue this request. Continue it on this page; do not open anything else.)`),1500);});},[]);
 // A watched click: its result is the design reference, taken while it is still open, and a request waiting on it resumes.
 const watchedId=snapshot.watched?.id;
 useEffect(()=>{const paste=(event:ClipboardEvent)=>{const file=[...(event.clipboardData?.files||[])].find(item=>/^image\/(png|jpeg|webp)$/.test(item.type));if(!file)return;event.preventDefault();const origin=scopeRef.current;void prepareReferenceImage(file).then(image=>{if(scopeRef.current===origin)setReferenceImage(image);}).catch(error=>setError(error.message));};document.addEventListener('paste',paste);return ()=>document.removeEventListener('paste',paste);},[]);
 useEffect(()=>{if(!watchedId)return;const waiting=watchRequest.current;watchRequest.current=null;void (async()=>{try{const shot=await capture(await context());if(shot){referenceRef.current=shot;setReferenceImage(shot);}}catch{/* the capture still works without a screenshot */}if(waiting)setTimeout(()=>void submit(waiting.text,undefined,false,undefined,waiting.id),0);})();},[watchedId]);
 useEffect(()=>{if(snapshot.watchError&&watchRequest.current){watchRequest.current=null;answer(snapshot.watchError+' Ask again when you’re ready, and click the control once.');}},[snapshot.watchError]);
 useEffect(()=>()=>{epoch.current++;abort.current?.abort();stopPreview.current?.();stopPreview.current=null;voice.current?.cancel();talkOn.current=false;talk.current?.stop();stopSpeaking();},[]);
 // Each finished utterance is a turn: stop and end act at once, and anything else waits for the current edit.
 onSpoken.current=text=>{
  setVoiceTranscript(text);
  if(stopListening(text)){stopTalk();return;}
  if(stopWork(text)){setInstruction('');talkPending.current=[];setTalkWaiting(0);if(sending.current||clarificationRequest.current){cancel();speak('Stopped.');}return;}
  if(fillerSpeech(text)&&!clarificationRequest.current){setInstruction('');return;}
  if(thanks(text)&&!clarificationRequest.current){setInstruction('');speak(thanksLine());return;}
  // A command said during other work shows at once and waits its turn, so nothing disappears.
  if(sending.current){const id=uid();say('user',text,{id,status:'sending'});setInstruction('');talkPending.current.push({text,id});setTalkWaiting(talkPending.current.length);return;}
  speak(onItLine());talkPending.current.push({text});setTalkWaiting(talkPending.current.length);drainTalk();
 };
 useEffect(()=>{if(!busy)drainTalk();},[busy,talking]);
 async function submit(text:string,prepared?:Promise<PageContext>,recordTurn=true,expectedSelection?:string|null,existingId?:string,capturedSelection?:string){
  const followUp=clarificationRequest.current;const value=text.trim();if(!value||sending.current)return;if(/^\/(?!\/)[a-zA-Z0-9/_-]*$/.test(value)){try{await bridge.send({type:'createPage',route:value});setInstruction('');}catch(error){setError(error instanceof Error?error.message:'Could not create that page.');}return;}sending.current=true;pendingCopy.current=null;const request=++epoch.current,origin=scopeRef.current,userId=existingId||uid(),selection=capturedSelection??JSON.stringify(snapshot.selected?.locator||null);activeRequest.current={id:userId,text:value,scope:origin,selection,applying:false};
  stickToBottom.current=true;if(recordTurn)setInstruction('');if(recordTurn)say('user',value,{id:userId,status:'sending',scope:origin,selection});else updateTurn(userId,{status:'sending',error:undefined,retryable:false});
  abort.current?.abort();const controller=new AbortController();abort.current=controller;const requestDeadline=setTimeout(()=>controller.abort(),180000);let failed=false,waiting=false;
  // An edit can move this workflow to the screen it just built; that is this request finishing, not the user leaving.
  const stillHere=()=>request===epoch.current&&!controller.signal.aborted&&(origin===scopeRef.current||!!activeRequest.current?.applying&&origin.split(':')[0]===scopeRef.current.split(':')[0]);
  setBusy(true);setError('');setClarification(null);clarificationRequest.current=null;setProgress('Understanding your request…');composer.current?.focus();

  try{
   let c=await context(undefined,value);
   // Selection is optional; the collector recovers or drops expired handles.
   let verificationNote='',reviewIssue='';const combined=followUp&&recordTurn&&followUp.scope===origin?'Continue this request: '+followUp.text+'\nUser clarification: '+value:value;const image=referenceRef.current;setProgress('Looking at the page…');let pageScreenshot=await capture(c);
   setProgress(c.workspace?.goal?'Continuing our design…':'Thinking…');
   lastPlan.current='';
   const talkContext=(page:PageContext):PageContext=>talkOn.current?{...page,talk:{...(speaker.current?{speaker:speaker.current}:{}),recent:recentLines.current}}:page;
   let plan=await planConversation(combined,talkContext(c),controller.signal,conversation.current.filter(turn=>turn.id!==userId),image,pageScreenshot,userId);spokenLine.current=plan.spoken||'';
   const inspectPlan=async(input:AssistantPlan,current:PageContext,allowNavigation:boolean)=>resolveInspections(input,current,{
    active:stillHere,
    inspect:async refs=>{
     const screen=refs.map(ref=>ref.startsWith('view:')?current.views.find(view=>view.id===ref.slice(5)):undefined).find(Boolean);
     if(screen&&screen.id!==current.stateId){
      if(!allowNavigation||!samePage(stateURL(snapshot.workflow,screen.id),stateURL(snapshot.workflow,current.stateId))){answer(`That’s on the “${screen.title}” screen. Open it from Your flow, then ask me again.`);return null;}
      setProgress(`Opening “${screen.title}”…`);reopen.current={text:value,id:userId};await bridge.send({type:'state',id:screen.id});return null;
     }
     setProgress('Inspecting the relevant layout…');return context(refs.filter(ref=>!ref.startsWith('view:')),combined);
    },
    replan:(expanded,note)=>planConversation(combined,talkContext(expanded),controller.signal,[...conversation.current.filter(turn=>turn.id!==userId),{role:'assistant',text:note,status:'sent'}],image,pageScreenshot,userId)
   });
   {const inspected=await inspectPlan(plan,c,true);if(inspected.interrupted)return;plan=inspected.plan;c=inspected.context;spokenLine.current=plan.spoken||'';}
   // One level deep: the thing the user means only appears once a control of the app is opened. Wandel opens it once, then plans again on what it shows.
   if(plan.status==='open'&&plan.candidates[0]){
    const opener=c.elements.find(element=>element.ref===plan.candidates[0]),name=(opener?.name||opener?.text||'it').slice(0,60);
    // A link may reload the page: the request is kept for this tab so the panel on the next page carries it on.
    const crawlKey='wandel:crawl:'+(new URL(location.href).searchParams.get('tabId')||''),store=typeof chrome!=='undefined'?chrome.storage?.session:undefined;
    if(opener?.tag==='a')await store?.set({[crawlKey]:{text:value,name,at:Date.now()}});
    setProgress(`Opening “${name}”…`);
    const open=async(confirmed:boolean)=>bridge.send({type:'openControl',ref:plan.candidates[0],...(confirmed?{confirmed:true}:{})});
    try{await open(false);}catch(error){
     const message=error instanceof Error?error.message:'';
     // A control that changes real data needs the user's yes for this one click.
     if(message.startsWith('CONFIRM:')){const label=message.slice(8);if(!confirm(`This will really click “${label}” in the app. It may change real data, and Wandel can’t undo it. Click it?`)){await store?.remove(crawlKey);answer('Okay, I didn’t click it. I can prototype it instead, so nothing real changes.');return;}
      try{await open(true);}catch(again){await store?.remove(crawlKey);answer(again instanceof Error?again.message:'I couldn’t click that.');return;}}
     // A link that reloads the page cuts this panel off mid-step: the kept request continues on the next page.
     else if(opener?.tag==='a'&&!/another site|can’t be opened|no longer on the page/.test(message)){setMessage(`Opening “${name}”… I’ll continue there.`);return;}
     else{await store?.remove(crawlKey);answer(message||'I couldn’t open that.');return;}
    }
    await store?.remove(crawlKey);
    if(request!==epoch.current)return;
    c=await context(undefined,combined);pageScreenshot=await capture(c);setProgress('Looking at what opened…');
    plan=await planConversation(combined+`\n(Wandel opened “${name}” so you can see what it shows. Continue the request on this screen; do not open anything else.)`,c,controller.signal,conversation.current.filter(turn=>turn.id!==userId),image,pageScreenshot,userId);
    {const inspected=await inspectPlan(plan,c,false);if(inspected.interrupted)return;plan=inspected.plan;c=inspected.context;spokenLine.current=plan.spoken||'';}
    if(plan.status==='open'||plan.status==='inspect'){answer(plan.question||'I opened it but still couldn’t find what you mean. Which part is it?');return;}
   }
   if(plan.status==='watch'){if(plan.candidates.length)await bridge.send({type:'assistantCandidates',refs:plan.candidates});watchRequest.current={text:value,id:userId};await bridge.send({type:'watch'});answer(plan.question||'Click it once in the page and I’ll watch what opens, then build it.');return;}
   if(plan.status==='inspect'){answer(plan.question||'I couldn’t find what you mean on this screen. Which card or section is it? If it’s on another screen, open that screen first.');return;}
   if(request!==epoch.current||origin!==scopeRef.current)return;
   if(plan.status==='answer'){await remember(plan);answer(plan.message);if(plan.candidates.length)await bridge.send({type:'assistantCandidates',refs:plan.candidates});pending.current='';return;}
   if(plan.status==='clarify'||plan.status==='unsupported'){await remember(plan);setClarification(plan);if(plan.status==='clarify'){clarificationRequest.current={text:combined,id:userId,scope:origin};waiting=true;}if(plan.candidates.length)await bridge.send({type:'assistantCandidates',refs:plan.candidates});pending.current='';answer(plan.status==='clarify'?(plan.question||plan.message):plan.message);return;}
   pending.current='';
   if(plan.status==='undo'||plan.status==='redo')await bridge.send({type:plan.status});
   else if(plan.status==='save')onSave();
   else{const latest=await bridge.send({type:'snapshot'});if(latest.workflow.id!==c.workflowId||latest.stateId!==c.stateId)throw new Error('The current page changed while planning. No edit was applied.');setProgress('Applying a reversible preview…');applying();plan=await applyVerifiedPlan(combined,plan,c,{apply:async(proposed,current)=>{
     const before=pageScreenshot;let kept='';
     // A change that rendered but failed a layout check is left on the page; the user decides.
     // The exact plan being applied, with each step's target, goes into any failure report.
     lastPlan.current=proposed.actions.map(action=>{const target=current.elements.find(element=>element.ref===action.targets[0]);return action.kind+(action.element?' '+action.element:'')+(action.position?' '+action.position:'')+' → '+(target?target.tag+(target.attributes?.role?'['+target.attributes.role+']':'')+' "'+(target.name||target.text||'').slice(0,30)+'"':action.targets[0]);}).join(' | ');
     try{await bridge.send({type:'assistantApply',plan:proposed,token:current.token});}catch(e){const m=e instanceof Error?e.message:'';if(!m.startsWith(keptPreview))throw e;kept=m.slice(keptPreview.length);}
     verificationNote='';reviewIssue='';
     // Review the applied page, including warnings. A warning is evidence, not a veto.
     // One targeted correction and one recheck bound latency and cost; never replay the original request here.
     for(let repair=0;repair<2;repair++){
      if(!stillHere())throw new Error('Request canceled.');
      if(!kept&&!requiresVisualReview(proposed,!!image)&&repair===0)break;
      setProgress(repair?'Checking the correction…':'Checking the rendered result…');
      let afterContext:PageContext,after:string|undefined,issue=kept;
      try{
       const revealed=(await bridge.send({type:'revealChange'})).revealed;
       afterContext=await context(undefined,combined);after=await capture(afterContext);
       if(before&&after){
        const verdict=await verifyConversation(combined.slice(0,1350)+revealNote(proposed)+(revealed?'\nAFTER is scrolled to the changed area. Judge the edit, not the scroll position.':'')+(kept?'\nLayout diagnostic (a clue, not proof of failure): '+kept.slice(0,700):''),proposed,before,after,controller.signal,userId,image);
        if(verdict.status==='pass'){reviewIssue='';break;}
        if(verdict.status==='uncertain'){verificationNote='The change is visible, but visual review could not confirm it: '+verdict.message;reviewIssue=kept;break;}
        issue=verdict.message;
       }else if(!kept){verificationNote='The change was applied; screenshot review was unavailable.';break;}
      }catch(error){
       if(controller.signal.aborted||request!==epoch.current)throw error;
       reviewIssue=issue;verificationNote='The change was applied, but its review could not finish.';break;
      }
      reviewIssue=issue;
      if(repair===1)break;
      setProgress('Correcting the layout…');
      const correctionRequest='The user requested: '+combined+'\nThe requested edit is ALREADY APPLIED on the current page. Do not repeat it or add another copy. Inspect the current DOM and screenshot. Diagnose this evidence: '+issue+'\nTreat geometry warnings as clues: ignore harmless pixel, font, or spacing differences and intentional clipping already present in the original. Fix only a clear defect such as unreadable overlapping text, unintended overflow, missing requested content, or unusable controls. Preserve the rest of the applied edit. Return answer if the result is acceptable and explain why. Ask clarification only for a genuine design choice, never whether broken rendering is acceptable. Do not open application controls, navigate, undo, or redo.';
      try{
       let correction=await planConversation(correctionRequest,afterContext!,controller.signal,conversation.current.filter(turn=>turn.id!==userId),image,after,userId);
       const inspected=await resolveInspections(correction,afterContext!,{
        limit:2,active:stillHere,
        inspect:async refs=>{const expanded=await context(refs,correctionRequest);after=await capture(expanded);return expanded;},
        replan:(expanded,note)=>planConversation(correctionRequest,expanded,controller.signal,[...conversation.current.filter(turn=>turn.id!==userId),{role:'assistant',text:note,status:'sent'}],image,after,userId)
       });
       correction=inspected.plan;afterContext=inspected.context;
       if(inspected.exhausted){verificationNote='The change is applied, but I could not resolve the remaining layout issue.';break;}
       if(!stillHere())throw new Error('Request canceled.');
       if(correction.status==='answer'){reviewIssue='';verificationNote=correction.message;break;}
       if(correction.status!=='edit'){verificationNote='The change is applied, but I could not complete its layout correction.';break;}
       const latest=await bridge.send({type:'snapshot'});
       if(latest.workflow.id!==afterContext!.workflowId||latest.stateId!==afterContext!.stateId)throw new Error('The page changed during review.');
       kept='';
       try{await bridge.send({type:'assistantApply',plan:correction,token:afterContext!.token});}
       catch(error){const message=error instanceof Error?error.message:'';if(!message.startsWith(keptPreview))throw error;kept=message.slice(keptPreview.length);}
      }catch(error){
       if(controller.signal.aborted||request!==epoch.current)throw error;
       // A failed correction must not replay (and duplicate) the already-applied original edit.
       verificationNote='The change is applied, but I could not finish correcting its layout.';break;
      }
     }
    },refresh:async()=>{const fresh=await context(undefined,combined);pageScreenshot=await capture(fresh);return fresh;},inspect:(refs)=>context(refs,combined),replan:(feedback,current)=>planConversation(combined,current,controller.signal,[...conversation.current.filter(turn=>turn.id!==userId),{role:'assistant',text:'The last proposed edit was not applied or its preview was fully rolled back. Repair only the current request; inspect or ask a concise clarification when the target is genuinely ambiguous. '+feedback,status:'failed'}],image,pageScreenshot,userId),active:stillHere,repairing:()=>setProgress('Checking a safer way to apply your request…')});}
   spokenLine.current=plan.spoken||'';
   lastPlan.current=plan.status+': '+plan.actions.map(action=>action.kind+(action.element?' '+action.element:'')+(action.position?' '+action.position:'')).join(', ');
   if(plan.status==='clarify'||plan.status==='unsupported'){setClarification(plan);if(plan.status!=='unsupported'){waiting=true;clarificationRequest.current={text:combined,id:userId,scope:origin};}if(plan.candidates.length)await bridge.send({type:'assistantCandidates',refs:plan.candidates});answer(plan.status==='clarify'?(plan.question||plan.message):plan.message);return;}
   if(request===epoch.current){await remember(plan);answer(plan.status==='edit'?(plan.reply||'Applied: '+plan.actions.map(action=>action.kind==='create'?'added '+(action.text||action.element):action.kind==='duplicate'?'duplicated '+(action.text||'the referenced element'):action.kind==='theme'?'updated the theme':action.kind==='layout'?'updated the layout':action.kind==='text'?'updated the text':action.kind==='remove'?'removed the element':action.kind==='connect'?'connected the views':'updated the element').join('; ')+'. Undo is available.')+(reviewIssue?' The edit still needs attention: '+reviewIssue.replace(/\s*\([^)]*\)/g,'')+' I couldn’t resolve this automatically. Undo is available.':verificationNote?' '+verificationNote:''):plan.message,plan.status==='edit',plan.status==='edit'?reviewIssue:'');}
  }catch(e){if(request===epoch.current){failed=true;void bridge.send({type:'assistantRemember',memory:{...emptyAssistantMemory(),...snapshot.workflow.assistantMemory,pending:value.slice(0,300)}}).catch(()=>{});const detail=e instanceof Error?e.message:'Could not get a reply.',applyingNow=!!activeRequest.current?.applying;
   // The request stays one tap away whenever repeating it cannot duplicate an applied change.
   updateTurn(userId,{status:'failed',error:undefined,retryable:conversationRecovery(detail,applyingNow).retryable});recover(detail,applyingNow);}}finally{clearTimeout(requestDeadline);if(request===epoch.current){if(!failed)updateTurn(userId,{status:waiting?'waiting':'sent'});activeRequest.current=null;sending.current=false;setBusy(false);}}

 }
 async function resumeClarification(ref:string){
  const request=clarificationRequest.current;if(!request||request.scope!==scopeRef.current||sending.current)return;
  try{const selected=await bridge.send({type:'assistantCandidate',ref});setClarification(null);pending.current='';await submit(request.text,undefined,false,undefined,request.id,JSON.stringify(selected.selected?.locator||null));}
  catch(e){setError(e instanceof Error?e.message:'Could not continue the request.');}
 }
 useEffect(()=>bridge.screens?.subscribe(library=>{const source=routeSource.current;if(!source||source.workflow!==snapshot.workflow.id)return;const candidates=library.candidate?[library.candidate]:matchingScreens(library.screens,new URL(source.url).pathname,snapshot.workflow.origin);if(candidates.length){setRouteChoices(candidates);setMessage('Destination found. Confirm the screen below to connect it.');}}),[bridge,snapshot.workflow.id]);
 async function saveRoute(screen:VisitedScreen){
  const source=routeSource.current;if(!source)return;setBusy(true);setError('');try{const current=await bridge.send({type:'snapshot'});if(current.workflow.id!==source.workflow||current.stateId!==source.state||JSON.stringify(current.selected?.locator)!==source.selection)throw new Error('The source selection changed. Select the original button and ask to connect again.');applying();await bridge.send({type:'connect',screen,event:source.event,conditions:source.conditions});routeSource.current=null;setRouteChoices([]);answer('Connected to '+screen.route+'. Switch to Interact and click the button to try it.');}catch(e){setError(e instanceof Error?e.message:'Connection failed.');}finally{setBusy(false);}}
 async function connectRoute(text:string,c:PageContext,request:number){
  const route=connectionRoute(text);if(!route)return false;
  const controls=connectionControls(c,text);if(controls.length!==1){setClarification({status:'clarify',message:'Which button should open '+route+'?',question:null,candidates:controls.map(e=>e.ref),actions:[]});if(controls.length)await bridge.send({type:'assistantCandidates',refs:controls.map(e=>e.ref)});answer(controls.length?'Which highlighted button should open '+route+'?':'Select the button that should open '+route+'.');return true;}
  const source=await bridge.send({type:'assistantCandidate',ref:controls[0].ref});if(request!==epoch.current)return true;
  const spec=routeTrigger(source.selected!);const known=matchingStates(source,route);if(known.length===1){applying();await bridge.send({type:'connect',to:known[0].id,...spec});answer('Connected '+controls[0].name+' to '+route+'. Switch to Interact to try it.');return true;}
  if(!bridge.screens){answer('I have not seen '+route+' yet. Open Connect views and capture that app page before connecting it.');return true;}
  setProgress('Checking visited app screens for '+route+'…');const library=await bridge.screens.call('start');if(request!==epoch.current)return true;const matches=matchingScreens(library.screens,route,source.workflow.origin);
  if(matches.length===1){applying();await bridge.send({type:'connect',screen:matches[0],...spec});answer('Connected '+controls[0].name+' to '+route+'. Switch to Interact to try it.');return true;}
  routeSource.current={workflow:source.workflow.id,state:source.stateId,selection:JSON.stringify(source.selected?.locator),url:source.workflow.origin+route,...spec};setRouteChoices(matches);
  if(matches.length){answer('I found multiple saved versions of '+route+'. Choose the destination below.');return true;}
  await bridge.screens.call('browse',source.workflow.origin+route);if(request!==epoch.current)return true;answer('I opened '+route+' in the destination browser. Check the page and choose Use this screen & close. I will show it here for confirmation before connecting.');return true;
 }
 async function style(){setError('');try{const c=await context();if(!c.selected)throw new Error('Select a style reference on the page first.');await bridge.send({type:'assistantStyle',ref:c.selected});setMessage('Style pinned. Select your target or continue describing the options.');}catch(e){setError((e as Error).message);}}
 async function startVoice(allowed=false){if(busy||listening||voiceHeld.current)return;if(!consent&&!allowed){setError('');setVoiceConsentOpen(true);setMessage('Allow voice sharing below to continue to microphone setup.');return;}voiceHeld.current=true;setStartingVoice(true);setVoiceTranscript('');setError('');
  const request=++epoch.current,origin=scopeRef.current;
  setMessage('Checking microphone permission…');
  try{const prepared=await prepareMicrophone();if(request!==epoch.current||origin!==scopeRef.current||!voiceHeld.current)return;if(!prepared){voiceHeld.current=false;setStartingVoice(false);setMessage('Microphone setup opened in a separate window. Allow access there, then click Return to Wandel. Your app selection stays connected.');return;}}catch(e){voiceHeld.current=false;setStartingVoice(false);setError(e instanceof Error?e.message:'Could not open microphone setup.');setMessage('Microphone is off. Use Set up microphone to retry.');return;}
  voiceContext.current=context();void voiceContext.current.catch(()=>{});
  voice.current=new PushToTalk(value=>{setListening(value);if(value){setMicrophoneReady(true);setStartingVoice(false);setMessage('Listening… Your words appear below. Click Stop & send when finished.');stopPreview.current=liveSpeech(text=>{if(request===epoch.current)setInstruction(text);},()=>{if(request===epoch.current)setMessage('Recording… Live preview is unavailable here; your transcript will appear after Stop & send.');});}else{stopPreview.current?.();stopPreview.current=null;}},blob=>{voiceHeld.current=false;if(request!==epoch.current||origin!==scopeRef.current)return;setBusy(true);setProgress('Transcribing your instruction…');const controller=new AbortController();abort.current=controller;const voiceTurn=uid();void transcribeInstruction(blob,controller.signal,voiceTurn).then(text=>{if(request!==epoch.current||origin!==scopeRef.current)return;setVoiceTranscript(text);setInstruction(text);return submit(text,voiceContext.current||undefined,true,undefined,voiceTurn);}).catch(e=>{if(request===epoch.current){setError(e.message);setBusy(false);}});},message=>{voiceHeld.current=false;setStartingVoice(false);setError(message);setMessage('Microphone is off. Click Set up microphone above to enable access in the setup window.');setBusy(false);});
  setMessage('Opening microphone… Allow access if Chrome asks.');void voice.current.start();
 }
 const c=snapshot.assistant?.context,ownedSelection=snapshot.workflow.states.flatMap(state=>state.operations).find(op=>op.kind==='insert'&&op.node.id===snapshot.selected?.locator.owned),targetLabel=snapshot.selected?(ownedSelection?.kind==='insert'&&snapshot.selected.label.startsWith(ownedSelection.node.text)?ownedSelection.node.text:snapshot.selected.label):undefined,pinned=c?.elements.find(e=>e.ref===c.styleReference);
 return <section className={`dx-assistant dx-chat-workspace ${!turns.length?'dx-chat-empty':''}`} aria-label="Conversational assistant">
 {(!onVisualEdit||toolsOpen)&&<div className="dx-chat-header"><div><strong>{onVisualEdit?'Chat settings':'Design assistant'}</strong></div><button className="dx-chat-menu" aria-label="Chat options" aria-expanded={toolsOpen} onClick={()=>setToolsOpen(!toolsOpen)}>{onVisualEdit?'×':'···'}</button></div>}
 <div className="dx-chat-options" hidden={!toolsOpen} aria-label="Chat options menu">
 {snapshot.workflow.assistantMemory&&<details className="dx-project-brief"><summary>What I’m keeping in mind</summary><p><strong>Goal:</strong> {snapshot.workflow.assistantMemory.goal||'Still exploring'}</p><p>{snapshot.workflow.assistantMemory.summary}</p>{snapshot.workflow.assistantMemory.decisions.map((decision,i)=><p key={i}>• {decision}</p>)}{snapshot.workflow.assistantMemory.pending&&<p><strong>Next:</strong> {snapshot.workflow.assistantMemory.pending}</p>}<button className="dx-small" disabled={busy} onClick={()=>void bridge.send({type:'assistantRemember',memory:emptyAssistantMemory()})}>Forget project brief</button></details>}

  <div className="dx-row"><button className="dx-small" disabled={busy||listening} onClick={()=>void bridge.send({type:'interact'}).catch(e=>setError(e.message))}>Interact with page</button><button className="dx-small" disabled={busy||listening||!snapshot.selected} onClick={()=>void style()}>Use selection as style</button><button className="dx-small" disabled={busy||listening} onClick={()=>void bridge.send({type:'assistantContext'}).catch(e=>setError(e.message))}>Refresh context</button><button className="dx-small" disabled={busy||listening||!snapshot.canUndo} onClick={()=>void submit('Undo that last change')}>Undo</button></div>
 <details><summary>{consent?'Voice sharing on · Settings':'Voice & privacy settings'}</summary><label className="dx-muted"><input type="checkbox" checked={consent} disabled={busy||listening} onChange={e=>setConsent(e.target.checked)}/> Allow voice and scoped labels/styles to Wandel and OpenAI; live dictation may use Chrome’s speech service. AI credits apply.</label><p className="dx-muted">Typed chat uses AI with scoped page labels, styles and recent conversation. Redacted page screenshots and DOM context are shared for design requests. Form fields and marked private regions are masked. An image you attach is sent to Wandel and OpenAI with your messages until removed.</p>{!microphoneReady&&<button className="dx-small" disabled={busy||listening||startingVoice} onClick={()=>{setError('');if(typeof chrome==='undefined'||!chrome.runtime?.id){setMessage('Allow microphone access in your browser’s site settings, then try Start speaking.');return;}void openMicrophoneSetup().then(()=>setMessage('Allow microphone access in setup, then click Return to Wandel.')).catch(e=>setError(e.message));}}>Set up microphone</button>}</details>
 <details><summary>Context & recent edits</summary>{voiceTranscript&&<p className="dx-muted" aria-label="Last voice instruction">Heard: {voiceTranscript}</p>}<p className="dx-muted">{c?.elements.length||0} page elements. {visualContext} Frame contents are excluded.</p>{snapshot.assistant?.transactions.map(t=><p key={t.id}>{t.message}</p>)}{turns.filter(turn=>turn.role==='assistant'&&turn.error).slice(-3).map((turn,index)=><details key={'diagnostic-'+index}><summary>Last request diagnostic</summary><p className="dx-muted">{turn.error}</p></details>)}<button className="dx-small" disabled={busy||listening} onClick={()=>{pending.current='';conversation.current=[];setTurns([]);rememberConversation(snapshot.workflow.id,[]);setVoiceTranscript('');setClarification(null);void bridge.send({type:'assistantReset'});}}>Reset conversation</button></details>
 </div>
 <div ref={chatLog} className="dx-chat" role="log" aria-label="Conversation" aria-live="polite" onScroll={()=>{const log=chatLog.current;if(log)stickToBottom.current=log.scrollHeight-log.scrollTop-log.clientHeight<40;}}><div ref={chatThread} className="dx-chat-thread">
 {!turns.length&&<div className="dx-chat-welcome dx-hero"><span className="dx-hero-mark" aria-hidden="true"><img src="brand/wandel-mark.svg" alt="" onError={event=>event.currentTarget.remove()}/></span><h2>Change anything <em>on this page</em></h2><p>Say what you want and Wandel builds it right here. Only you see it until you share.</p><div className="dx-starters"><button disabled={busy||listening||startingVoice} onClick={()=>void submit('Review this page’s current layout. Briefly explain what works, identify the three most useful improvements using the actual visible sections, and suggest a specific next action for each. Suggestions only; leave the page unchanged.')}><i aria-hidden="true">✦</i><span><strong>Review this layout</strong><small>Get three ideas to improve it</small></span></button><button disabled={busy||listening||startingVoice} onClick={()=>startWith('Add a ')}><i aria-hidden="true">＋</i><span><strong>Add something new</strong><small>A section, button or banner</small></span></button><button disabled={busy||listening||startingVoice} onClick={()=>startWith('Give this page a ')}><i aria-hidden="true">◐</i><span><strong>Try a new look</strong><small>Colours, spacing, a fresh style</small></span></button><button disabled={busy||listening||startingVoice} onClick={()=>imageInput.current?.click()}><i aria-hidden="true">▣</i><span><strong>Copy a design</strong><small>Rebuild it from a screenshot</small></span></button></div>{snapshot.selected&&<button className="dx-small" disabled={busy||listening||startingVoice} onClick={()=>void submit('Duplicate selected')}>Duplicate selection</button>}</div>}
 {turns.map((turn,index,all)=>{const lastEdit=all.map(t=>!!t.edited).lastIndexOf(true);return <div className={'dx-chat-turn '+turn.role} key={turn.id||index} data-delivery={turn.role==='user'?turn.status:undefined}><small>{turn.role==='user'?'You':'Wandel'}</small><p>{turn.text}</p>{turn.edited&&index===lastEdit&&<div className="dx-chat-edit-actions" aria-label="Change history"><button disabled={busy||listening||!snapshot.canUndo} onClick={()=>void history('undo')}>↶ Undo</button><button disabled={busy||listening||!snapshot.canRedo} onClick={()=>void history('redo')}>↷ Redo</button>{turn.review&&<button className="dx-chat-fix" disabled={busy||listening} onClick={()=>void submit('Fix the last change: '+turn.review)}>Fix it</button>}</div>}{turn.role==='user'&&turn.status&&<div className="dx-chat-delivery">{turn.status==='sending'?'Sending…':turn.status==='sent'?'Sent':turn.status==='waiting'?'Waiting for your choice':turn.status==='stopped'?'Stopped':'Not completed'}{turn.error&&<span>{conversationRecovery(turn.error).text}</span>}{(turn.status==='failed'||turn.status==='stopped')&&turn.retryable&&<button disabled={busy} onClick={()=>void retry(turn)}>Retry</button>}</div>}</div>;})}
 </div></div>
 {voiceConsentOpen&&<div className="dx-alert" role="dialog" aria-modal="false" aria-label="Allow voice sharing"><h3>Allow voice instructions?</h3><p>Voice and selected labels/styles go to Wandel and OpenAI. Live dictation may also use Chrome’s speech service. Redacted page screenshots and DOM context are shared for design requests. Form fields and marked private regions are masked. An image you attach is sent to Wandel and OpenAI with your messages until removed. AI credits apply.</p>{talkConsent.current&&<p>Talk mode keeps your microphone on until you turn it off, or after 3 quiet minutes. Sound stays on this device until you speak; each thing you say is then sent to be understood.</p>}<p>Next, Chrome may ask for microphone access in a setup window.</p><div className="dx-row"><button className="dx-primary" autoFocus onClick={()=>{setConsent(true);setVoiceConsentOpen(false);const hands=talkConsent.current;talkConsent.current=false;void (hands?startTalk(true):startVoice(true));}}>Allow voice &amp; continue</button><button className="dx-secondary" onClick={()=>{talkConsent.current=false;setVoiceConsentOpen(false);setMessage('Voice is off. You can still type an instruction.');}}>Keep typing instead</button></div></div>}

 {routeChoices.length>0&&<div className="dx-route-choices"><p>Confirm destination</p>{routeChoices.map(screen=><button key={screen.id} className="dx-secondary" disabled={busy} onClick={()=>void saveRoute(screen)}><img src={screen.thumbnail} alt="" width="120"/><span>Connect to {screen.title} · {screen.route}</span></button>)}</div>}
 {clarification?.candidates.map(ref=>{const element=c?.elements.find(e=>e.ref===ref);return <button key={ref} className="dx-small" onClick={()=>void resumeClarification(ref)}>{element?.attributes['wandel-heading']||element?.name||ref}</button>;})}
 {(snapshot.watching||snapshot.watchError||snapshot.watched)&&<div className="dx-reference-preview dx-watch" role="status">{snapshot.watching?<span>Watching: click the control in the page once. Wandel captures what it opens.</span>:snapshot.watchError?<span>{snapshot.watchError}</span>:<span><strong>Captured: {snapshot.watched!.title}</strong> · {snapshot.watched!.kind}{snapshot.watched!.outline?' · '+snapshot.watched!.outline:''}. Tell me which element should open it.</span>}{!snapshot.watching&&<button className="dx-small" disabled={busy} onClick={()=>void bridge.send({type:'watchClear'})}>Discard</button>}</div>}
 {copied&&<div className="dx-reference-preview"><span><strong>Copied from {copied.from}:</strong> {copied.label}. Tell me where to put it.</span><button className="dx-small" disabled={busy} onClick={()=>void chrome.storage.local.remove('wandelCopiedElement').then(()=>setCopied(null))}>Remove</button></div>}
 {referenceImage&&<div className="dx-reference-preview"><img src={referenceImage} alt="Attached design reference"/><span>Design reference · sent with your next messages</span><button className="dx-small" disabled={busy} onClick={()=>setReferenceImage(undefined)}>Remove</button></div>}
 {talking&&<div className="dx-talk-status" role="status"><span className={'dx-talk-dot '+talkState} aria-hidden="true"/><span>{talkState==='paused'?'Speaking…':talkState==='hearing'?'Hearing you…':talkTyping?'Typing what you said…':busy?'Working on it. Keep talking if you like.':'Listening. Just talk.'}{talkWaiting?` · ${talkWaiting} waiting`:''}</span><button className="dx-small" onClick={()=>stopTalk()}>End talk</button></div>}
 {notice}
 <div className="dx-chat-composer">
 {(busy||listening||startingVoice||clarificationRequest.current)&&<div className="dx-chat-request-controls"><span className="dx-chat-progress" role="status" aria-live="polite">{(busy||listening||startingVoice)&&<i aria-hidden="true"/>}{listening?'Microphone on · Listening…':startingVoice?'Starting microphone…':busy?(progress||'Working on your request…'):'Waiting for your reply'}</span><button type="button" className="dx-chat-cancel" aria-label="Cancel request" onClick={cancel}>Cancel request</button></div>}
 <div className={'dx-chat-target '+(targetLabel?'has-selection':'')} title={targetLabel||'Describe any part of this page. Selection is optional.'}><span aria-hidden="true">{targetLabel?'↖':'◉'}</span><span>{targetLabel?<>Selection: <strong>{targetLabel.slice(0,80)}{targetLabel.length>80?'…':''}</strong></>:'This page · no selection'}{pinned&&<small>Style: {pinned.name}</small>}</span></div>
 {/^\/(?!\/)[a-zA-Z0-9/_-]*$/.test(instruction.trim())&&<button className="dx-small" disabled={busy} onClick={()=>{const route=instruction.trim();void bridge.send({type:'createPage',route}).then(()=>setInstruction('')).catch(error=>setError(error.message));}}>Create {instruction.trim()} prototype page</button>}
 <textarea ref={composer} aria-label="Tell Wandel what to change" rows={2} maxLength={1600} value={instruction} disabled={listening} onChange={e=>setInstruction(e.target.value)} placeholder={turns.length?`Ask or describe a change. Paste an image with ${/Mac/.test(navigator.platform)?'⌘V':'Ctrl+V'}.`:'Try: '+firstIdeas[hint%firstIdeas.length]} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();if(!busy&&!listening)void submit(instruction);}}}/>
 <div className="dx-chat-compose-actions"><input ref={imageInput} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={event=>{const file=event.target.files?.[0];event.target.value='';const origin=scopeRef.current;if(file)void prepareReferenceImage(file).then(image=>{if(scopeRef.current===origin)setReferenceImage(image);}).catch(error=>setError(error.message));}}/><div className="dx-add" ref={addMenu}><button className="dx-small dx-add-toggle" aria-label="Add" aria-expanded={addOpen} title="Add an image or watch a click" disabled={busy||listening} onClick={()=>setAddOpen(!addOpen)}>＋</button><div className="dx-add-menu" hidden={!addOpen} onClick={event=>{if(!(event.target as HTMLElement).closest('[data-keep-open]'))setAddOpen(false);}}><button className="dx-small" aria-label="Attach design reference image" title="Attach an image to recreate a similar layout, or paste one" disabled={busy||listening} onClick={()=>imageInput.current?.click()}>Image</button><button className="dx-small" aria-label="Watch a click" title="Click something in the app once; Wandel captures the modal or panel it opens so a prototype can recreate it" disabled={busy||listening} onClick={()=>void bridge.send({type:snapshot.watching?'watchClear':'watch'})}>{snapshot.watching?'Stop watching':'◉ Watch a click'}</button>{typeof chrome!=='undefined'&&!!chrome.tabs&&<button className="dx-small" data-keep-open="true" disabled={busy||listening} title="Pick an element in another open tab and bring it here" onClick={()=>void listTabs()}>Copy from another tab</button>}{copyTabs&&(copyTabs.length?copyTabs.map(tab=><button key={tab.id} className="dx-small dx-tab-choice" title={tab.title} onClick={()=>void copyFrom(tab.id)}><strong>{tab.host}</strong><span>{tab.title}</span></button>):<small>No other website tabs are open.</small>)}</div></div>{onVisualEdit&&<button className="dx-small" aria-label="Visual edit" title="Edit directly on the page" disabled={busy||listening} onClick={onVisualEdit}>✎ Edit</button>}<small>{listening?'Recording':'Describe any part of this page'}</small>
 {modelList.length>1&&<select className="dx-model" aria-label="AI model" title="AI model" value={model} disabled={busy||listening} onChange={event=>{setModel(event.target.value);chooseModel(event.target.value);}}>{(Object.keys(providerNames) as ModelProvider[]).filter(provider=>modelList.some(item=>item.provider===provider)).map(provider=><optgroup key={provider} label={providerNames[provider]}>{modelList.filter(item=>item.provider===provider).map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</optgroup>)}</select>}
 <button className="dx-small dx-talk" aria-pressed={talking} title="Talk hands-free: Wandel listens, acts when you pause, and keeps listening" disabled={listening||startingVoice} onClick={()=>{if(talking)stopTalk();else void startTalk();}}>{talking?'End talk':'Talk'}</button>
 <button className="dx-chat-mic" title={listening?'Stop & send':'Speak your instruction'} aria-label={startingVoice?'Cancel microphone request':listening?'■ Stop & send':'🎙 Start speaking'} aria-pressed={listening} disabled={busy||talking} onClick={()=>{if(startingVoice){stopPreview.current?.();stopPreview.current=null;voice.current?.cancel();voiceHeld.current=false;setStartingVoice(false);setMessage('Microphone request canceled.');}else if(listening){voiceHeld.current=false;voice.current?.stop();}else void startVoice();}}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 11v1a6 6 0 0 0 12 0v-1M12 18v3m-3 0h6"/></svg><span className="dx-sr-only">{startingVoice?'Cancel microphone request':listening?'■ Stop & send':'🎙 Start speaking'}</span></button>
 <button className="dx-chat-send" aria-label="Send" title="Send message" disabled={busy||listening||!instruction.trim()} onClick={()=>void submit(instruction)}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"/></svg><span className="dx-sr-only">{busy?'Working…':'Send'}</span></button>
 </div></div>
 {error&&!turns.some(turn=>turn.error===error||turn.text===error)&&<p role="alert" className="dx-chat-status">{error}</p>}
 {(!turns.length||message!==turns.at(-1)?.text)&&!busy&&!listening&&!startingVoice&&message!=='Ask about the layout, or select an element for focused feedback.'&&<p role="status" className="dx-chat-status">{message}</p>}
 </section>;
}
