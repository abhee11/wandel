import {registerAccountBridge} from './account';
registerAccountBridge();
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 if(message?.type!=='WANDEL_COLLAPSE'||sender.id!==chrome.runtime.id||sender.tab?.id===undefined||sender.frameId!==0)return;
 chrome.sidePanel.setOptions({tabId:sender.tab.id,enabled:false}).then(()=>reply({ok:true})).catch(error=>reply({error:String(error)}));return true;
});
// Global panels follow the active tab. Keep the default disabled and opt in
// only the tab whose toolbar action the user explicitly clicks.
chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:false}).catch(console.error);
void chrome.sidePanel.setOptions({enabled:false}).catch(console.error);
chrome.action.onClicked.addListener(tab=>{
 if(tab.id===undefined)return;
 const tabId=tab.id;
 // Queue both Chrome calls in the click handler. Awaiting setOptions loses
 // the transient user gesture on Chrome versions that enforce it strictly.
 void chrome.sidePanel.setOptions({tabId,path:`sidepanel.html?tabId=${tabId}`,enabled:true}).catch(console.error);
 void chrome.sidePanel.open({tabId}).catch(console.error);
});
chrome.tabs.onCreated.addListener(tab=>{if(tab.id!==undefined)void chrome.sidePanel.setOptions({tabId:tab.id,enabled:false}).catch(console.error);});
const notify=(details:{tabId:number;frameId:number})=>{if(details.frameId===0)chrome.tabs.sendMessage(details.tabId,{type:'DX_NAVIGATED'},{frameId:0}).catch(()=>{});};
chrome.webNavigation.onHistoryStateUpdated.addListener(notify);
chrome.webNavigation.onReferenceFragmentUpdated.addListener(notify);

export {};
