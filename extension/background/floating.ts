/** Open the workspace inside its owning application tab; no companion window. */
export async function openFloatingPanel(tabId:number){
 const tab=await chrome.tabs.get(tabId);if(!/^https?:/.test(tab.url||''))throw new Error('Open a regular application page first.');
 // Retire only a legacy Wandel popup associated with this exact tab.
 const key='wandel:floating:'+tabId,saved=await chrome.storage.session.get(key),old=saved[key];
 if(Number.isInteger(old)){const w=await chrome.windows.get(old,{populate:true}).catch(()=>null);if(w?.tabs?.some(t=>t.url===chrome.runtime.getURL('sidepanel.html')+'?tabId='+tabId+'&floating=1'))await chrome.windows.remove(old).catch(()=>{});await chrome.storage.session.remove(key);}
 try{await chrome.tabs.sendMessage(tabId,{type:'WANDEL_INLINE_OPEN',tabId},{frameId:0});}catch{await chrome.scripting.executeScript({target:{tabId,frameIds:[0]},files:['content.js']});await chrome.tabs.sendMessage(tabId,{type:'WANDEL_INLINE_OPEN',tabId},{frameId:0});}
 await chrome.storage.session.set({['wandel:inline:'+tabId]:true});
 await chrome.sidePanel.setOptions({tabId,enabled:false}).catch(()=>{});
}
export function registerFloatingPanel(){
 chrome.tabs.onRemoved.addListener(tab=>{void chrome.storage.session.remove(['wandel:inline:'+tab,'wandel:floating:'+tab]);});
 chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(sender.id!==chrome.runtime.id)return;
  if(message?.type==='WANDEL_INLINE_STATUS'&&sender.tab?.id!==undefined&&sender.frameId===0){const tabId=sender.tab.id;chrome.storage.session.get('wandel:inline:'+tabId).then(saved=>reply({tabId,open:!!saved['wandel:inline:'+tabId]}));return true;}
  if(message?.type==='WANDEL_INLINE_CLOSE'&&sender.tab?.id!==undefined&&sender.frameId===0){void chrome.storage.session.remove('wandel:inline:'+sender.tab.id);reply({ok:true});return;}
  if(message?.type!=='WANDEL_FLOAT_PANEL'||!Number.isInteger(message.tabId)||!sender.url?.startsWith(chrome.runtime.getURL('sidepanel.html')))return;
  if(new URL(sender.url).searchParams.get('embedded')==='1'&&sender.tab?.id!==message.tabId)return;
  openFloatingPanel(message.tabId).then(()=>reply({ok:true})).catch(error=>reply({error:error.message}));return true;
 });
}
