import {FloatingPanel} from './floatingPanel';
import {isLocalDev} from '../sidepanel/devReload';
import {createRuntimeChannel} from './runtimeChannel';
import {registerShareRelay} from './shareRelay';
import {accountConfig} from '../shared/accountConfig';
import {ChromeLiveNavigation} from '../shared/liveNavigation';
import {DestinationBrowserControls} from './browserSession';
import {captureScreen} from './screenCapture';
import {freeBuild} from '../shared/build';
import { Session } from './session';
import { TemporaryChromeStorage, PersistentChromeStorage, Repository } from '../storage/store';
// Chrome may inject on demand while a declarative injection is still starting.
const runtime=globalThis as typeof globalThis & {__wandelContentStarted?:boolean};
if(!runtime.__wandelContentStarted){
const lifecycle=new AbortController();
let cleanup=()=>{};
const channel=createRuntimeChannel(()=>cleanup());
let stopRelay:(()=>void)|undefined;
const ports=new Set<chrome.runtime.Port>();
const send=channel.send;
const ignore=(error:unknown)=>channel.handle(error);
runtime.__wandelContentStarted=true;
// A stale editor must stop intercepting the first interaction after an update.
for(const type of ['pointerdown','keydown','pointermove'])window.addEventListener(type,()=>channel.available(),{capture:true,signal:lifecycle.signal});
const session=new Session(document.body,new Repository((freeBuild?new PersistentChromeStorage(send):new TemporaryChromeStorage(send))),new URL(location.href),{historyStore:{read:async workflowId=>(await send({type:'WANDEL_HISTORY',action:'read',workflowId}))?.value,write:async(workflowId,value)=>{await send({type:'WANDEL_HISTORY',action:'write',workflowId,value});}},liveNavigation:new ChromeLiveNavigation(send),externalConnections:true,requestConnections:async()=>{const result=await send({type:'WANDEL_OPEN_CONNECTIONS'});if(result?.error)throw new Error(result.error);},...(freeBuild?{}:{requestSignIn:async()=>{const result=await send({type:'WANDEL_SIGN_IN_REQUEST'});if(result?.error)throw new Error(result.error);},requestPlan:async(prompt,selection)=>{const result=await send({type:'WANDEL_PLAN_REQUEST',prompt,selection});if(!result)throw new Error('Open the Wandel panel to use the connected planner.');if(result.error)throw new Error(result.error);return result.plan;}}),requestSectionChat:(rect,label)=>{void send({type:'WANDEL_INLINE_STATUS'}).then(status=>{if(status?.tabId){floatingPanel.show(status.tabId);floatingPanel.focusSection(rect,label);}}).catch(ignore);},requestClose:async()=>{if(session.snapshot().panelMinimized)floatingPanel.collapse(true);else{floatingPanel.destroy();void send({type:'WANDEL_INLINE_CLOSE'}).catch(ignore);}const result=await send({type:'WANDEL_COLLAPSE'});if(result?.error)throw new Error(result.error);},requestSave:()=>{send({type:'WANDEL_SAVE_REQUEST'}).catch(()=>{});}});
const floatingPanel=new FloatingPanel(()=>{void send({type:'WANDEL_INLINE_CLOSE'}).catch(ignore);},()=>{void ready.then(()=>session.dispatch({type:'restorePanel'})).catch(ignore);});
const ready=session.init();
// Local development: a page event opens the Wandel panel, so browser automation can test end to end.
if(isLocalDev())window.addEventListener('wandel:dev-open',()=>{void send({type:'WANDEL_OPEN_CONNECTIONS'}).catch(ignore);},{signal:lifecycle.signal});
// Local development: the current workflow and its problems, for automated checks.
if(isLocalDev())window.addEventListener('wandel:dev-state',()=>{void ready.then(()=>{const s=session.snapshot();window.dispatchEvent(new CustomEvent('wandel:dev-state-result',{detail:JSON.stringify({stateId:s.stateId,mode:s.mode,unresolved:s.unresolved,canUndo:s.canUndo,workflow:s.workflow})}));});},{signal:lifecycle.signal});
// Local development: create a real share link for the current workflow.
if(isLocalDev())window.addEventListener('wandel:dev-share',()=>{void ready.then(async()=>{const reply=await send({type:'WANDEL_DEV_SHARE',workflow:session.snapshot().workflow});window.dispatchEvent(new CustomEvent('wandel:dev-share-result',{detail:JSON.stringify(reply)}));}).catch(error=>window.dispatchEvent(new CustomEvent('wandel:dev-share-result',{detail:JSON.stringify({error:String(error)})})));},{signal:lifecycle.signal});
// Local development: run one session command (undo, interact, reset…) from the page, for automated checks.
if(isLocalDev())window.addEventListener('wandel:dev-command',event=>{void (async()=>{
 let result:Record<string,unknown>;
 try{await ready;const s=await session.dispatch(JSON.parse(String((event as CustomEvent).detail)));result={mode:s.mode,unresolved:s.unresolved,canUndo:s.canUndo,stateId:s.stateId,...(s.assistant?.context?{context:{token:s.assistant.context.token,elements:s.assistant.context.elements.map(e=>({ref:e.ref,tag:e.tag,name:(e.name||e.text||'').slice(0,50)}))}}:{})};}catch(error){result={error:error instanceof Error?error.message:String(error)};}
 window.dispatchEvent(new CustomEvent('wandel:dev-command-result',{detail:JSON.stringify(result)}));
})();},{signal:lifecycle.signal});
// Local development: a chat request sent from the page runs the real context → plan → apply path; the result comes back as a page event.
if(isLocalDev())window.addEventListener('wandel:dev-chat',event=>{void (async()=>{
 let result:Record<string,unknown>;
 try{
  const {instruction}=JSON.parse(String((event as CustomEvent).detail));await ready;
  const snap=await session.dispatch({type:'assistantContext',chat:true,instruction}),context=snap.assistant?.context;if(!context)throw new Error('No page context: '+JSON.stringify({keys:Object.keys(snap),assistant:snap.assistant&&Object.keys(snap.assistant),mode:snap.mode,navigationError:snap.navigationError}).slice(0,400));
  const reply=await send({type:'WANDEL_DEV_PLAN',body:{instruction,context,history:[],requestId:crypto.randomUUID()}});if(reply?.error)throw new Error(reply.error);
  const plan=reply.plan;result={plan};
  if(plan?.status==='edit'){try{await session.dispatch({type:'assistantApply',plan,token:context.token});result.applied='OK';}catch(error){result.applied=error instanceof Error?error.message:String(error);}}
  result.unresolved=session.snapshot().unresolved;
 }catch(error){result={error:error instanceof Error?error.message:String(error)};}
 window.dispatchEvent(new CustomEvent('wandel:dev-chat-result',{detail:JSON.stringify(result)}));
})();},{signal:lifecycle.signal});
void ready.then(()=>send({type:'WANDEL_INLINE_STATUS'})).then(status=>{if(status?.open)floatingPanel.show(status.tabId);}).catch(ignore);
void ready.then(()=>{if(!channel.available())session.destroy();}).catch(ignore);
const browserControls=new DestinationBrowserControls(document,async action=>{const result=await send({type:'WANDEL_BROWSER_FINISH',action});if(!result?.ok)throw new Error(result?.error||'This browsing session has ended. Return to Wandel.');});
let unsubscribe=()=>{};
let stopped=false;
cleanup=()=>{if(stopped)return;stopped=true;for(const release of [()=>lifecycle.abort(),()=>unsubscribe(),()=>stopRelay?.(),()=>browserControls.destroy(),()=>floatingPanel.destroy(),()=>session.destroy(),...Array.from(ports,port=>()=>port.disconnect()),()=>chrome.runtime.onMessage.removeListener(onMessage),()=>chrome.runtime.onConnect.removeListener(onConnect)]){try{release();}catch{/* Continue releasing page interception even if Chrome already removed the context. */}}ports.clear();};
const replySafely=(reply:(value:unknown)=>void,value:unknown)=>{try{if(channel.available())reply(value);}catch(error){ignore(error);}};

unsubscribe=session.subscribe(snapshot=>{void send({type:'DX_SNAPSHOT',snapshot}).catch(ignore);});
const onMessage=(message:any,_sender:chrome.runtime.MessageSender,reply:(value:unknown)=>void)=>{
  if(!channel.available())return;
  const respond=(value:unknown)=>replySafely(reply,value);
  if(message.type==='WANDEL_BROWSER_SESSION'&&_sender.id===chrome.runtime.id){browserControls.show();respond({ok:true});return;}
  if(message.type==='WANDEL_INLINE_OPEN'&&_sender.id===chrome.runtime.id){session.clearChatFocus();floatingPanel.wholePage(message.tabId);respond({ok:true});return;}
  if(message.type==='WANDEL_INLINE_CAPTURE'&&_sender.id===chrome.runtime.id){floatingPanel.captureHidden(!!message.hidden);respond({ok:true});return;}
  if(message.type==='DX_NAVIGATED'){void ready.then(()=>{if(channel.available())return session.navigate(new URL(location.href));}).catch(ignore);return;}
  if(message.type==='WANDEL_CAPTURE_SCREEN'){void ready.then(()=>{if(channel.available())respond({screen:captureScreen()});}).catch(error=>respond({error:error.message}));return true;}
  if(message.type!=='DX_COMMAND')return;
  if(message.command?.type==='save'){send({type:'WANDEL_SAVE_REQUEST'}).catch(()=>{});void ready.then(()=>respond({snapshot:session.snapshot()})).catch(ignore);return true;}
  void ready.then(()=>{if(!channel.available())return;return session.dispatch(message.command);}).then(snapshot=>{if(message.command?.type==='minimizePanel')floatingPanel.collapse(true);if(message.command?.type==='restorePanel')floatingPanel.collapse(false);respond({snapshot,capabilities:['designer-experience-v5','native-copy-v1','workflow-view-v1','live-routes-v1','panel-lifecycle-v1','connection-wire-v3','connection-panel-v2','connections-v1','settings-widgets-v1','selection-preflight-v1','native-design-v1','manual-editor-v1']});}).catch(error=>respond({error:error.message}));return true;
};
window.addEventListener('popstate',()=>{void ready.then(()=>{if(channel.available())return session.navigate(new URL(location.href));}).catch(ignore);},{signal:lifecycle.signal});
window.addEventListener('hashchange',()=>{void ready.then(()=>{if(channel.available())return session.navigate(new URL(location.href));}).catch(ignore);},{signal:lifecycle.signal});

let authoringConnections=0;
const onConnect=(port:chrome.runtime.Port)=>{
 if(!channel.available())return;
 if(port.name!=='designx-authoring')return;
 ports.add(port);authoringConnections++;void ready.then(()=>{if(channel.available()&&!session.snapshot().navigationError&&!session.panelAttached())return session.dispatch({type:freeBuild?'edit':'interact'});}).catch(ignore);
 port.onDisconnect.addListener(()=>{ports.delete(port);if(!channel.available())return;void chrome.runtime.lastError;authoringConnections--;if(!authoringConnections)void ready.then(()=>session.dispatch({type:'pause'})).catch(ignore);});
};
try{if(channel.available()){chrome.runtime.onMessage.addListener(onMessage);chrome.runtime.onConnect.addListener(onConnect);stopRelay=freeBuild?undefined:registerShareRelay(accountConfig.apiOrigin);}}catch(error){ignore(error);}

window.addEventListener('pagehide',()=>{if(channel.available())session.pageLeaving();},{signal:lifecycle.signal});
window.addEventListener('pageshow',event=>{if(event.persisted&&channel.available())void ready.then(()=>session.pageRestored()).then(()=>send({type:'DX_PAGE_RESTORED'})).catch(ignore);},{signal:lifecycle.signal});

}
