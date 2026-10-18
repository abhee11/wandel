/** Launch in the worker: minimizing the panel can destroy its document mid-request. */
export function registerRecordingLauncher(){
 chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.type!=='WANDEL_RECORD_WALKTHROUGH'||sender.id!==chrome.runtime.id||sender.tab||!sender.url)return;
  let tabId:number;
  try{const url=new URL(sender.url),base=new URL(chrome.runtime.getURL(''));if(url.protocol!==base.protocol||url.host!==base.host||url.pathname!=='/sidepanel.html')return;tabId=Number(url.searchParams.get('tabId'));if(!Number.isInteger(tabId)||tabId<=0)return;}catch{return;}
  (async()=>{
   const send=async(command:unknown)=>{const response=await chrome.tabs.sendMessage(tabId,{type:'DX_COMMAND',command},{frameId:0});if(response?.error)throw new Error(response.error);if(!response?.snapshot)throw new Error('Reconnect Wandel to the app before recording.');return response;};
   const initial=await send({type:'snapshot'});
   if(initial.snapshot.workflow.id!==message.workflowId)throw new Error('The active flow changed. Return to your app and try again.');
   if(!initial.capabilities?.includes('panel-lifecycle-v1'))throw new Error('Refresh the app to update Wandel before recording.');
   if(!initial.snapshot.enabled)throw new Error('Enable the workflow before recording.');
   await send({type:'interact'});
   const prepared=await send({type:'minimizePanel'});
   const params=new URLSearchParams({tabId:String(tabId),name:prepared.snapshot.workflow.name});
   await chrome.tabs.create({url:chrome.runtime.getURL('recorder.html')+'?'+params});
   return {ok:true};
  })().then(reply).catch(error=>reply({error:error instanceof Error?error.message:'Recorder could not open. Return to the app and retry.'}));return true;
 });
}
