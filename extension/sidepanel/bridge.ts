import {redactPageScreenshot} from '../assistant/pageScreenshot';
import type {PageContext} from '../assistant/schema';
import {freeBuild} from '../shared/build';
import {ChromeScreenBrowser,type ScreenBrowser} from './screenBrowser';
import type { Command, Snapshot } from '../shared/model';
export interface Bridge { capturePage?(context:PageContext):Promise<string>; screens?:ScreenBrowser; connectionError?:string; retry?():Promise<void>; send(command:Command):Promise<Snapshot>; subscribe(listener:(snapshot:Snapshot|null)=>void):()=>void }
/** Whether opening the panel only reconnects. A prototype the panel's closing switched off has to be turned back on; a shared one replays, which the page starts itself. */
export const reconnectsOnly=(seen?:Partial<Snapshot>)=>!!(seen?.panelMinimized||seen?.panelRestoring||seen?.sharedWaiting||seen?.sharedExperience||seen?.liveSession&&seen?.mode!=='closed');
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
    chrome.tabs.onActivated.addListener(({tabId,windowId})=>{if(typeof location!=='undefined'&&new URL(location.href).searchParams.get('embedded')==='1')return;if(this.windowId!==undefined&&windowId!==undefined&&windowId!==this.windowId)return;if(tabId===this.tabId&&this.port)return;if(this.ownerTabId===undefined||tabId===this.ownerTabId)void this.connect();else {++this.generation;this.port?.disconnect();this.port=undefined;this.tabId=undefined;this.listeners.forEach(fn=>fn(null));}});
    chrome.tabs.onUpdated.addListener((id,change)=>{if(id!==this.tabId)return;if(change.status==='loading'){++this.generation;const old=this.port;this.port=undefined;old?.disconnect();this.listeners.forEach(fn=>fn(null));}else if(change.status==='complete'&&!this.port)void this.connect();});
  }
  private async connect(){
    const generation=++this.generation;
    const [active]=await chrome.tabs.query({active:true,currentWindow:true});
    const floating=typeof location!=='undefined'&&new URL(location.href).searchParams.get('floating')==='1'||typeof location!=='undefined'&&new URL(location.href).searchParams.get('embedded')==='1';
    const embedded=typeof location!=='undefined'&&new URL(location.href).searchParams.get('embedded')==='1';
    if(embedded&&(await chrome.tabs.getCurrent())?.id!==this.ownerTabId){this.connectionError='This workspace belongs to a different tab.';this.listeners.forEach(fn=>fn(null));return;}
    const tab=floating&&this.ownerTabId!==undefined?await chrome.tabs.get(this.ownerTabId).catch(()=>undefined):this.ownerTabId===undefined||active?.id===this.ownerTabId?active:undefined;
    if(generation!==this.generation)return;
    this.port?.disconnect();this.port=undefined;this.tabId=tab?.id;this.windowId=tab?.windowId;this.listeners.forEach(fn=>fn(null));
    this.connectionError='';
    if(this.tabId===undefined)return;
    const tabId=this.tabId;
    try{
      let resume=false;
      // Tabs already open when the extension was installed may lack the script.
      try{const existing=await chrome.tabs.sendMessage(tabId,{type:'DX_COMMAND',command:{type:'snapshot'}},{frameId:0});resume=reconnectsOnly(existing?.snapshot);}
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
      const current=await this.send({type:'snapshot'});
      const snapshot=current.navigationError?current:await this.send({type:resume?'snapshot':freeBuild?'edit':'interact'});if(generation===this.generation)this.listeners.forEach(fn=>fn(snapshot));
    }catch{
      if(generation!==this.generation)return;
      this.port?.disconnect();this.port=undefined;
      this.connectionError='Wandel could not connect to this page. Check the extension’s site access in Chrome, then retry. Chrome settings and other protected pages cannot be edited.';
      this.listeners.forEach(fn=>fn(null));
    }
  }
  async capturePage(context:PageContext):Promise<string>{
    const tabId=this.tabId,generation=this.generation;if(tabId===undefined)throw new Error('The application page is disconnected.');
    const tab=await chrome.tabs.get(tabId);if(!tab.active||!/^https?:/.test(tab.url||''))throw new Error('The application tab must be visible for capture.');
    const checkViewport=async()=>{
      const [result]=await chrome.scripting.executeScript({target:{tabId,frameIds:[0]},func:()=>({x:scrollX,y:scrollY,width:innerWidth,height:innerHeight})});
      const v=context.viewport,current=result?.result;if(!v||!current||Math.abs(current.x-v.scrollX)>1||Math.abs(current.y-v.scrollY)>1||Math.abs(current.width-v.width)>1||Math.abs(current.height-v.height)>1)throw new Error('The viewport moved during capture.');
    };
    await checkViewport();
    let raw:string;
    await chrome.tabs.sendMessage(tabId,{type:'WANDEL_INLINE_CAPTURE',hidden:true},{frameId:0});
    try{raw=await chrome.tabs.captureVisibleTab(tab.windowId,{format:'jpeg',quality:85});}finally{await chrome.tabs.sendMessage(tabId,{type:'WANDEL_INLINE_CAPTURE',hidden:false},{frameId:0}).catch(()=>{});}
    const current=await chrome.tabs.get(tabId);if(tabId!==this.tabId||generation!==this.generation||!current.active||current.url!==tab.url)throw new Error('The application tab changed during capture.');
    await checkViewport();return redactPageScreenshot(raw,context);
  }
  async send(command:Command):Promise<Snapshot>{
    if(this.tabId===undefined)throw new Error('Open a regular webpage first.');
    const tabId=this.tabId,generation=this.generation;
    const designer=['assistantContext','assistantApply','assistantRollback'].includes(command.type);
    const connection=['connectionAnchor','connectionAction','connect','replayConnection'].includes(command.type);
    const manual=['copyPrompt','minimizePanel','restorePanel','appearance','cancelStyle','alignText','interact','closeEditor','insertElement','fieldSettings','copyStyle','pasteStyle'].includes(command.type);
    if(designer||connection||manual||command.type==='settingsPrompt'||command.type==='settingsPlayback'||command.type==='validateSelection'||command.type==='selectDestination'){
      const probe=await chrome.tabs.sendMessage(tabId,{type:'DX_COMMAND',command:{type:'snapshot'}},{frameId:0});
      if(connection&&!probe?.capabilities?.includes('live-routes-v1'))throw new Error('This page is running an older Wandel script. Refresh the application page, reopen the section you want to edit, then reconnect the real destination page.');
      if(!probe?.capabilities?.includes(designer?'designer-experience-v5':command.type==='copyPrompt'?'native-copy-v1':['minimizePanel','restorePanel'].includes(command.type)?'panel-lifecycle-v1':['connectionAction','connectionAnchor'].includes(command.type)?'connection-wire-v3':connection?'connections-v1':manual?'manual-editor-v1':command.type==='selectDestination'?'native-design-v1':command.type==='validateSelection'?'selection-preflight-v1':'settings-widgets-v1'))throw new Error('This page is running an older Wandel script. Refresh the application page, reopen the section you want to edit, then retry your prompt.');
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
