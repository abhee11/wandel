import {ChromeLiveNavigation} from '../shared/liveNavigation';
import {DestinationBrowserControls} from './browserSession';
import {captureScreen} from './screenCapture';
import {freeBuild} from '../shared/build';
import { Session } from './session';
import { TemporaryChromeStorage, PersistentChromeStorage, Repository } from '../storage/store';
// Chrome may inject on demand while a declarative injection is still starting.
const runtime=globalThis as typeof globalThis & {__wandelContentStarted?:boolean};
if(!runtime.__wandelContentStarted){
runtime.__wandelContentStarted=true;
const session=new Session(document.body,new Repository((freeBuild?new PersistentChromeStorage():new TemporaryChromeStorage())),new URL(location.href),{liveNavigation:new ChromeLiveNavigation(),externalConnections:true,requestConnections:async()=>{const result=await chrome.runtime.sendMessage({type:'WANDEL_OPEN_CONNECTIONS'});if(result?.error)throw new Error(result.error);},...(freeBuild?{}:{requestSignIn:async()=>{const result=await chrome.runtime.sendMessage({type:'WANDEL_SIGN_IN_REQUEST'});if(result?.error)throw new Error(result.error);},requestPlan:async(prompt,selection)=>{const result=await chrome.runtime.sendMessage({type:'WANDEL_PLAN_REQUEST',prompt,selection});if(!result)throw new Error('Open the Wandel panel to use the connected planner.');if(result.error)throw new Error(result.error);return result.plan;}}),requestClose:async()=>{const result=await chrome.runtime.sendMessage({type:'WANDEL_COLLAPSE'});if(result?.error)throw new Error(result.error);},requestSave:()=>{chrome.runtime.sendMessage({type:'WANDEL_SAVE_REQUEST'}).catch(()=>{});}});
const ready=session.init();
const browserControls=new DestinationBrowserControls();
session.subscribe(snapshot=>{chrome.runtime.sendMessage({type:'DX_SNAPSHOT',snapshot}).catch(()=>{});});
chrome.runtime.onMessage.addListener((message,_sender,reply)=>{
  if(message.type==='WANDEL_BROWSER_SESSION'&&_sender.id===chrome.runtime.id){browserControls.show();reply({ok:true});return;}
  if(message.type==='DX_NAVIGATED'){void ready.then(()=>session.navigate(new URL(location.href)));return;}
  if(message.type==='WANDEL_CAPTURE_SCREEN'){ready.then(()=>reply({screen:captureScreen()})).catch(error=>reply({error:error.message}));return true;}
  if(message.type!=='DX_COMMAND')return;
  if(message.command?.type==='save'){chrome.runtime.sendMessage({type:'WANDEL_SAVE_REQUEST'}).catch(()=>{});ready.then(()=>reply({snapshot:session.snapshot()}));return true;}
  ready.then(()=>session.dispatch(message.command)).then(snapshot=>reply({snapshot,capabilities:['workflow-view-v1','live-routes-v1','panel-lifecycle-v1','connection-wire-v3','connection-panel-v2','connections-v1','settings-widgets-v1','selection-preflight-v1','native-design-v1','manual-editor-v1']})).catch(error=>reply({error:error.message}));return true;
});
window.addEventListener('popstate',()=>{void ready.then(()=>session.navigate(new URL(location.href)));});
window.addEventListener('hashchange',()=>{void ready.then(()=>session.navigate(new URL(location.href)));});

let authoringConnections=0;
chrome.runtime.onConnect.addListener(port=>{
 if(port.name!=='designx-authoring')return;
 authoringConnections++;void ready.then(()=>{if(!session.panelAttached())return session.dispatch({type:'edit'});});
 port.onDisconnect.addListener(()=>{void chrome.runtime.lastError;authoringConnections--;if(!authoringConnections)void ready.then(()=>session.dispatch({type:'pause'}));});
});

window.addEventListener('pagehide',()=>session.pageLeaving());
window.addEventListener('pageshow',event=>{if(event.persisted)void ready.then(()=>session.pageRestored()).then(()=>chrome.runtime.sendMessage({type:'DX_PAGE_RESTORED'})).catch(()=>{});});

}
