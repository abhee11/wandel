import {RecordSchema} from '../shared/model';
import {validateWorkflow} from '../prototype/engine';
import {sameApplicationURL,stateURL,samePage,type LiveContext} from '../shared/liveNavigation';
/** Only the installed extension workspace may start saved-flow playback in its own tab. */
export function registerWorkflowOpener(){
 chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.type!=='WANDEL_VIEW_WORKFLOW'||sender.id!==chrome.runtime.id||!sender.url)return;
  let tabId:number;try{const url=new URL(sender.url),base=new URL(chrome.runtime.getURL(''));if(url.origin!==base.origin||url.protocol!==base.protocol||url.host!==base.host||url.pathname!=='/sidepanel.html')return;tabId=Number(url.searchParams.get('tabId'));if(url.searchParams.get('embedded')==='1'&&sender.tab?.id!==tabId)return;if(sender.frameId&&url.searchParams.get('embedded')!=='1')return;if(!Number.isSafeInteger(tabId)||tabId<=0)return;}catch{return;}
  (async()=>{
   const record=RecordSchema.parse(message.record),w=validateWorkflow(record.draft);record.versions.forEach(v=>validateWorkflow(v.workflow));const target=sameApplicationURL(stateURL(w,w.entry),w.origin);
   // A page opened before Wandel was reloaded has no live script: inject one instead of asking for a refresh.
   const message_=async(command:unknown)=>{try{return await chrome.tabs.sendMessage(tabId,{type:'DX_COMMAND',command},{frameId:0});}catch{await chrome.scripting.executeScript({target:{tabId,frameIds:[0]},files:['content.js']});for(let attempt=0;;attempt++){try{return await chrome.tabs.sendMessage(tabId,{type:'DX_COMMAND',command},{frameId:0});}catch(error){if(attempt>=10)throw error;await new Promise(resolve=>setTimeout(resolve,150));}}}};
   const send=async(command:unknown)=>{const result=await message_(command);if(result?.error)throw new Error(result.error);if(!result?.snapshot)throw new Error('Reconnect Wandel to the source page and retry.');return result;};
   const initial=await send({type:'snapshot'});if(!initial.capabilities?.includes('workflow-view-v1'))throw new Error('Reload the updated Wandel extension and refresh this app page before viewing a saved flow.');
   // The panel may hold an older view of the page. Proceed from what the page reports now; only unsaved work needs confirmation.
   const source=await chrome.tabs.get(tabId);if(!source.url)throw new Error('The application page is unavailable. Return to it and retry View flow.');
   if(initial.snapshot.dirty&&!(message.discardConfirmed&&initial.snapshot.workflow.id===message.expectedWorkflowId))throw new Error('Confirm replacing the unsaved draft before opening a saved flow.');
   await send({type:'checkpointDraft',navigating:!samePage(target,source.url)});
   try{
   const current=await chrome.tabs.get(tabId);if(current.url!==source.url)throw new Error('The app navigated while opening this flow. Retry on the current page.');
   // Preview activates this local copy; the account version is not modified.
   const active={...record,enabled:true};
   if(samePage(target,source.url)){await send({type:'loadRecord',record:active});await send({type:'replay'});return {ok:true,navigated:false};}
   const recordKey='dx:workflow:'+w.id,liveKey='wandel:live:'+tabId,anchor='wandel:workflow-tab:'+tabId,previous={...await chrome.storage.session.get([liveKey,anchor]),...await chrome.storage.local.get(recordKey)};
   const context:LiveContext={workflowId:w.id,stateId:w.entry,visits:[],mode:'replay',minimized:false,dialogs:{}};
   await chrome.storage.local.set({[recordKey]:active});await chrome.storage.session.set({[liveKey]:context,[anchor]:context});
   try{await chrome.tabs.update(tabId,{url:target});}catch(error){for(const key of [recordKey,liveKey,anchor]){const store=key===recordKey?chrome.storage.local:chrome.storage.session;if(previous[key]===undefined)await store.remove(key);else await store.set({[key]:previous[key]});}throw error;}
   return {ok:true,navigated:true};
   }catch(error){await send({type:'cancelWorkflowNavigation',workflowId:initial.snapshot.workflow.id}).catch(()=>{});throw error;}
  })().then(reply).catch(error=>reply({error:error instanceof Error?error.message:'Could not open this saved flow. Your account save is unchanged.'}));return true;
 });
}
