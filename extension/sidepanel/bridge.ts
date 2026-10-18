import {ChromeScreenBrowser,type ScreenBrowser} from './screenBrowser';
import type { Command, Snapshot } from '../shared/model';
export interface Bridge { screens?:ScreenBrowser; connectionError?:string; retry?():Promise<void>; send(command:Command):Promise<Snapshot>; subscribe(listener:(snapshot:Snapshot|null)=>void):()=>void }
export class ChromeBridge implements Bridge {
  readonly screens?:ScreenBrowser;
  connectionError='';
  retry(){return this.connect();}
  private listeners=new Set<(s:Snapshot|null)=>void>();
  private tabId:number|undefined;
  private windowId:number|undefined;
  private generation=0;
  private port:chrome.runtime.Port|undefined;
  constructor(private readonly ownerTabId?:number){
    if(ownerTabId!==undefined)this.screens=new ChromeScreenBrowser(ownerTabId);
    chrome.runtime.onMessage.addListener((m,sender)=>{if(m.type==='DX_PAGE_RESTORED'&&sender.tab?.id===this.tabId){void this.connect();return;}if(m.type==='DX_SNAPSHOT'&&sender.tab?.id===this.tabId)this.listeners.forEach(fn=>fn(m.snapshot));});
    chrome.tabs.onActivated.addListener(({tabId,windowId})=>{if(this.windowId!==undefined&&windowId!==undefined&&windowId!==this.windowId)return;if(tabId===this.tabId&&this.port)return;if(this.ownerTabId===undefined||tabId===this.ownerTabId)void this.connect();else {++this.generation;this.port?.disconnect();this.port=undefined;this.tabId=undefined;this.listeners.forEach(fn=>fn(null));}});
    chrome.tabs.onUpdated.addListener((id,change)=>{if(id!==this.tabId)return;if(change.status==='loading'){++this.generation;const old=this.port;this.port=undefined;old?.disconnect();this.listeners.forEach(fn=>fn(null));}else if(change.status==='complete'&&!this.port)void this.connect();});
  }
  private async connect(){
    const generation=++this.generation;
    const [active]=await chrome.tabs.query({active:true,currentWindow:true});
    const tab=this.ownerTabId===undefined||active?.id===this.ownerTabId?active:undefined;
    if(generation!==this.generation)return;
    this.port?.disconnect();this.port=undefined;this.tabId=tab?.id;this.windowId=tab?.windowId;this.listeners.forEach(fn=>fn(null));
    this.connectionError='';
    if(this.tabId===undefined)return;
    const tabId=this.tabId;
    try{
      let resume=false;
      // Tabs already open when the extension was installed may lack the script.
      try{const existing=await chrome.tabs.sendMessage(tabId,{type:'DX_COMMAND',command:{type:'snapshot'}},{frameId:0});resume=!!(existing?.snapshot?.panelMinimized||existing?.snapshot?.panelRestoring||existing?.snapshot?.liveSession);}
      catch{
        if(generation!==this.generation)return;
        await chrome.scripting.executeScript({target:{tabId,frameIds:[0]},files:['content.js']});
      }
      if(generation!==this.generation)return;
      const port=chrome.tabs.connect(tabId,{name:'designx-authoring',frameId:0});
      this.port=port;
      port.onDisconnect.addListener(()=>{
        // Chrome exposes port errors only while this callback is running.
        const reason=chrome.runtime.lastError?.message;
        if(this.port!==port||generation!==this.generation)return;
        this.port=undefined;
        this.connectionError=reason?'The page connection closed during navigation. Return to the page and click Retry to reconnect.':'The page connection closed. Click Retry to reconnect.';
        this.listeners.forEach(fn=>fn(null));
      });
      const snapshot=await this.send({type:resume?'snapshot':'edit'});if(generation===this.generation)this.listeners.forEach(fn=>fn(snapshot));
    }catch{
      if(generation!==this.generation)return;
      this.port?.disconnect();this.port=undefined;
      this.connectionError='Wandel could not connect to this page. Check the extension’s site access in Chrome, then retry. Chrome settings and other protected pages cannot be edited.';
      this.listeners.forEach(fn=>fn(null));
    }
  }
  async send(command:Command):Promise<Snapshot>{
    if(this.tabId===undefined)throw new Error('Open a regular webpage first.');
    const tabId=this.tabId,generation=this.generation;
    const connection=['connectionAnchor','connectionAction','connect','replayConnection'].includes(command.type);
    const manual=['minimizePanel','restorePanel','appearance','cancelStyle','alignText','interact','closeEditor','insertElement','fieldSettings','copyStyle','pasteStyle'].includes(command.type);
    if(connection||manual||command.type==='settingsPrompt'||command.type==='settingsPlayback'||command.type==='validateSelection'||command.type==='selectDestination'){
      const probe=await chrome.tabs.sendMessage(tabId,{type:'DX_COMMAND',command:{type:'snapshot'}},{frameId:0});
      if(connection&&!probe?.capabilities?.includes('live-routes-v1'))throw new Error('This page is running an older Wandel script. Refresh the application page, reopen the section you want to edit, then reconnect the real destination page.');
      if(!probe?.capabilities?.includes(['minimizePanel','restorePanel'].includes(command.type)?'panel-lifecycle-v1':['connectionAction','connectionAnchor'].includes(command.type)?'connection-wire-v3':connection?'connections-v1':manual?'manual-editor-v1':command.type==='selectDestination'?'native-design-v1':command.type==='validateSelection'?'selection-preflight-v1':'settings-widgets-v1'))throw new Error('This page is running an older Wandel script. Refresh the application page, reopen the section you want to edit, then retry your prompt.');
      if(tabId!==this.tabId||generation!==this.generation)throw new Error('Active tab changed. Try again on the current page.');
    }
    let result;let timeout:ReturnType<typeof setTimeout>|undefined;
    try{result=await Promise.race([
      chrome.tabs.sendMessage(tabId,{type:'DX_COMMAND',command},{frameId:0}),
      new Promise<never>((_,reject)=>{timeout=setTimeout(()=>reject(new Error('The page did not respond. Close and reopen the Wandel panel to reconnect. Your workflow has not been cleared.')),10000);})
    ]);}catch(error){throw new Error(error instanceof Error?error.message:'Page unavailable. Reopen Wandel to reconnect.');}finally{clearTimeout(timeout);}
    if(tabId!==this.tabId||generation!==this.generation)throw new Error('Active tab changed. Try again on the current page.');
    if(result.error)throw new Error(result.error);return result.snapshot;
  }
  subscribe(listener:(s:Snapshot|null)=>void){this.listeners.add(listener);void this.connect();return()=>{this.listeners.delete(listener);};}
}
