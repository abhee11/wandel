import {openFloatingPanel,registerFloatingPanel} from './floating';
import {accountConfig} from '../shared/accountConfig';
registerFloatingPanel();
import {registerSharedWorkflow} from './sharedWorkflow';
registerSharedWorkflow();
import {registerWorkflowOpener} from './openWorkflow';
registerWorkflowOpener();
import {registerRecordingLauncher} from './recording';
registerRecordingLauncher();
import {registerLiveNavigation} from './liveNavigation';
registerLiveNavigation();
import {registerScreenCatalog} from './screens';
registerScreenCatalog();
import {registerAccountBridge} from './account';
registerAccountBridge();
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 if(!['WANDEL_COLLAPSE','WANDEL_OPEN_CONNECTIONS'].includes(message?.type)||sender.id!==chrome.runtime.id||sender.tab?.id===undefined||sender.frameId!==0)return;
 if(message.type==='WANDEL_OPEN_CONNECTIONS'){
  const tabId=sender.tab.id;
  openFloatingPanel(tabId).then(()=>reply({ok:true})).catch(()=>reply({error:'Click the Wandel extension icon to open Connections.'}));return true;
 }
 chrome.sidePanel.setOptions({tabId:sender.tab.id,enabled:false}).then(()=>reply({ok:true})).catch(error=>reply({error:String(error)}));return true;
});
// Global panels follow the active tab. Keep the default disabled and opt in
// only the tab whose toolbar action the user explicitly clicks.
chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:false}).catch(console.error);
void chrome.sidePanel.setOptions({enabled:false}).catch(console.error);
chrome.action.onClicked.addListener(tab=>{if(tab.id!==undefined)void openFloatingPanel(tab.id).catch(console.error);});
chrome.tabs.onCreated.addListener(tab=>{if(tab.id!==undefined)void chrome.sidePanel.setOptions({tabId:tab.id,enabled:false}).catch(console.error);});
const notify=(details:{tabId:number;frameId:number})=>{if(details.frameId===0)chrome.tabs.sendMessage(details.tabId,{type:'DX_NAVIGATED'},{frameId:0}).catch(()=>{});};
chrome.webNavigation.onHistoryStateUpdated.addListener(notify);
chrome.webNavigation.onReferenceFragmentUpdated.addListener(notify);

export {};
// Share pages opened before Wandel was installed get its relay, so they connect without a reload.
chrome.runtime.onInstalled.addListener(()=>{void chrome.tabs.query({url:new URL('/flow*',accountConfig.apiOrigin).href}).then(tabs=>Promise.all(tabs.map(tab=>tab.id===undefined?null:chrome.scripting.executeScript({target:{tabId:tab.id,frameIds:[0]},files:['content.js']}).catch(()=>null)))).catch(()=>{});});
