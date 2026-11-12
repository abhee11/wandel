import {openFloatingPanel,registerFloatingPanel} from './floating';
import {accountConfig} from '../shared/accountConfig';
registerFloatingPanel();
import {watchDevReload} from '../sidepanel/devReload';
// Local development: reload the extension and its pages after each rebuild (npm run dev:local).
watchDevReload();
import {backgroundAccountToken} from './account';
import {accountConfig as devAccount} from '../shared/accountConfig';
import {LOCAL_DEV} from '../sidepanel/devReload';
// Local development: Wandel's own content script asks for a plan from the local server, so
// end-to-end checks can run where the panel can't load (for example a browser automation tab).
async function devImage(url:string){const blob=await (await fetch(url)).blob(),bytes=new Uint8Array(await blob.arrayBuffer());let text='';for(const byte of bytes)text+=String.fromCharCode(byte);return 'data:'+blob.type+';base64,'+btoa(text);}
if(LOCAL_DEV)chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 if(message?.type==='WANDEL_DEV_SHARE'&&sender.id===chrome.runtime.id&&sender.tab?.id!==undefined&&LOCAL_DEV){void (async()=>{try{const token=await backgroundAccountToken();if(!token)throw new Error('Sign in to Wandel first.');const response=await fetch(devAccount.apiOrigin+(message.path||'/api/workflow-links'),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(message.body||{workflow:message.workflow})});reply(await response.json());}catch(error){reply({error:error instanceof Error?error.message:'Share failed.'});}})();return true;}
 if(message?.type!=='WANDEL_DEV_PLAN'||sender.id!==chrome.runtime.id||sender.tab?.id===undefined)return;
 (async()=>{const token=await backgroundAccountToken();if(!token)throw new Error('Sign in to Wandel first.');const response=await fetch(devAccount.apiOrigin+'/api/assistant/plan',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({...message.body,...(message.referenceURL?{referenceImage:await devImage(message.referenceURL)}:{})})});const data=await response.json();if(!response.ok)throw new Error(data.error?.message||'Plan request failed.');return {plan:data.plan};})().then(reply).catch(error=>reply({error:error instanceof Error?error.message:String(error)}));return true;
});
import {registerSharedWorkflow} from './sharedWorkflow';
import {registerTabCopy} from './tabCopy';
registerSharedWorkflow();
registerTabCopy();
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
import {registerAppMap} from './appMap';
registerAppMap();
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
