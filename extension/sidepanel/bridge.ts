import type { Command, Snapshot } from '../shared/model';
export interface Bridge { connectionError?:string; retry?():Promise<void>; send(command:Command):Promise<Snapshot>; subscribe(listener:(snapshot:Snapshot|null)=>void):()=>void }
export class ChromeBridge implements Bridge {
  connectionError='';
  retry(){return this.connect();}
  private listeners=new Set<(s:Snapshot|null)=>void>();
  private tabId:number|undefined;
  private generation=0;
  private port:chrome.runtime.Port|undefined;
  constructor(private readonly ownerTabId?:number){
    chrome.runtime.onMessage.addListener((m,sender)=>{if(m.type==='DX_SNAPSHOT'&&sender.tab?.id===this.tabId)this.listeners.forEach(fn=>fn(m.snapshot));});
    chrome.tabs.onActivated.addListener(({tabId})=>{if(this.ownerTabId===undefined||tabId===this.ownerTabId)void this.connect();else {++this.generation;this.port?.disconnect();this.port=undefined;this.tabId=undefined;this.listeners.forEach(fn=>fn(null));}});
    chrome.tabs.onUpdated.addListener((id,change)=>{if(id===this.tabId&&(change.status==='complete'||change.status==='loading'))void this.connect();});
  }
  private async connect(){
    const generation=++this.generation;
    const [active]=await chrome.tabs.query({active:true,currentWindow:true});
    const tab=this.ownerTabId===undefined||active?.id===this.ownerTabId?active:undefined;
    if(generation!==this.generation)return;
    this.port?.disconnect();this.port=undefined;this.tabId=tab?.id;this.listeners.forEach(fn=>fn(null));
    this.connectionError='';
    if(this.tabId===undefined)return;
    const tabId=this.tabId;
    try{
      // Tabs already open when the extension was installed may lack the script.
      try{await chrome.tabs.sendMessage(tabId,{type:'DX_COMMAND',command:{type:'snapshot'}},{frameId:0});}
      catch{
        if(generation!==this.generation)return;
        await chrome.scripting.executeScript({target:{tabId,frameIds:[0]},files:['content.js']});
      }
      if(generation!==this.generation)return;
      this.port=chrome.tabs.connect(tabId,{name:'designx-authoring',frameId:0});
      const snapshot=await this.send({type:'edit'});if(generation===this.generation)this.listeners.forEach(fn=>fn(snapshot));
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
    let result;try{result=await chrome.tabs.sendMessage(tabId,{type:'DX_COMMAND',command},{frameId:0});}catch{throw new Error('Page unavailable. Reload a regular http(s) page after installing the extension.');}
    if(tabId!==this.tabId||generation!==this.generation)throw new Error('Active tab changed. Try again on the current page.');
    if(result.error)throw new Error(result.error);return result.snapshot;
  }
  subscribe(listener:(s:Snapshot|null)=>void){this.listeners.add(listener);void this.connect();return()=>{this.listeners.delete(listener);};}
}
