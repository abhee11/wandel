import { Session } from './session';
import { TemporaryChromeStorage, Repository } from '../storage/store';
// Chrome may inject on demand while a declarative injection is still starting.
const runtime=globalThis as typeof globalThis & {__wandelContentStarted?:boolean};
if(!runtime.__wandelContentStarted){
runtime.__wandelContentStarted=true;
const session=new Session(document.body,new Repository(new TemporaryChromeStorage()),new URL(location.href),{requestPlan:async(prompt,selection)=>{const result=await chrome.runtime.sendMessage({type:'WANDEL_PLAN_REQUEST',prompt,selection});if(!result)throw new Error('Open the Wandel panel to use the connected planner.');if(result.error)throw new Error(result.error);return result.plan;},requestClose:async()=>{const result=await chrome.runtime.sendMessage({type:'WANDEL_COLLAPSE'});if(result?.error)throw new Error(result.error);},requestSave:()=>{chrome.runtime.sendMessage({type:'WANDEL_SAVE_REQUEST'}).catch(()=>{});}});
const ready=session.init();
session.subscribe(snapshot=>{chrome.runtime.sendMessage({type:'DX_SNAPSHOT',snapshot}).catch(()=>{});});
chrome.runtime.onMessage.addListener((message,_sender,reply)=>{
  if(message.type==='DX_NAVIGATED'){void ready.then(()=>session.navigate(new URL(location.href)));return;}
  if(message.type!=='DX_COMMAND')return;
  if(message.command?.type==='save'){chrome.runtime.sendMessage({type:'WANDEL_SAVE_REQUEST'}).catch(()=>{});ready.then(()=>reply({snapshot:session.snapshot()}));return true;}
  ready.then(()=>session.dispatch(message.command)).then(snapshot=>reply({snapshot})).catch(error=>reply({error:error.message}));return true;
});
window.addEventListener('popstate',()=>{void ready.then(()=>session.navigate(new URL(location.href)));});
window.addEventListener('hashchange',()=>{void ready.then(()=>session.navigate(new URL(location.href)));});

let authoringConnections=0;
chrome.runtime.onConnect.addListener(port=>{
 if(port.name!=='designx-authoring')return;
 authoringConnections++;void ready.then(()=>session.dispatch({type:'edit'}));
 port.onDisconnect.addListener(()=>{authoringConnections--;if(!authoringConnections)void ready.then(()=>session.dispatch({type:'pause'}));});
});

window.addEventListener('pagehide',()=>session.suspend());

}
