import {RecordSchema} from '../shared/model';
import {validateWorkflow} from '../prototype/engine';
import {sameApplicationURL,stateURL,type LiveContext} from '../shared/liveNavigation';
/** Only the installed side panel may start saved-flow playback in its own tab. */
export function registerWorkflowOpener(){
 chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.type!=='WANDEL_VIEW_WORKFLOW'||sender.id!==chrome.runtime.id||sender.tab||!sender.url||sender.frameId&&sender.frameId!==0)return;
  let tabId:number;try{const url=new URL(sender.url),base=new URL(chrome.runtime.getURL(''));if(url.origin!==base.origin||url.protocol!==base.protocol||url.host!==base.host||url.pathname!=='/sidepanel.html')return;tabId=Number(url.searchParams.get('tabId'));if(!Number.isSafeInteger(tabId)||tabId<=0)return;}catch{return;}
  (async()=>{
   const record=RecordSchema.parse(message.record),w=validateWorkflow(record.draft);record.versions.forEach(v=>validateWorkflow(v.workflow));const target=sameApplicationURL(stateURL(w,w.entry),w.origin);
   const send=async(command:unknown)=>{const result=await chrome.tabs.sendMessage(tabId,{type:'DX_COMMAND',command},{frameId:0});if(result?.error)throw new Error(result.error);if(!result?.snapshot)throw new Error('Reconnect Wandel to the source page and retry.');return result;};
   const initial=await send({type:'snapshot'});if(!initial.capabilities?.includes('workflow-view-v1'))throw new Error('Reload the updated Wandel extension and refresh this app page before viewing a saved flow.');
   if(initial.snapshot.workflow.id!==message.expectedWorkflowId)throw new Error('The active draft changed. Select View flow again.');
   const source=await chrome.tabs.get(tabId);if(!source.url||message.expectedURL!==source.url||stateURL(initial.snapshot.workflow,initial.snapshot.stateId)!==source.url)throw new Error('The app page changed. Retry View flow on the current page.');
   if(initial.snapshot.dirty&&!message.discardConfirmed)throw new Error('Confirm replacing the unsaved draft before opening a saved flow.');
   await send({type:'checkpointDraft',navigating:target!==source.url});
   try{
   const current=await chrome.tabs.get(tabId);if(current.url!==source.url)throw new Error('The app navigated while opening this flow. Retry on the current page.');
   // Preview activates this local copy; the account version is not modified.
   const active={...record,enabled:true};
   if(target===source.url){await send({type:'loadRecord',record:active});await send({type:'replay'});return {ok:true,navigated:false};}
   const recordKey='dx:workflow:'+w.id,liveKey='wandel:live:'+tabId,previous=await chrome.storage.session.get([recordKey,liveKey]);
   const context:LiveContext={workflowId:w.id,stateId:w.entry,visits:[],mode:'replay',minimized:false,dialogs:{}};
   await chrome.storage.session.set({[recordKey]:active,[liveKey]:context});
   try{await chrome.tabs.update(tabId,{url:target});}catch(error){for(const key of [recordKey,liveKey])if(previous[key]===undefined)await chrome.storage.session.remove(key);else await chrome.storage.session.set({[key]:previous[key]});throw error;}
   return {ok:true,navigated:true};
   }catch(error){await send({type:'cancelWorkflowNavigation',workflowId:initial.snapshot.workflow.id}).catch(()=>{});throw error;}
  })().then(reply).catch(error=>reply({error:error instanceof Error?error.message:'Could not open this saved flow. Your account save is unchanged.'}));return true;
 });
}
