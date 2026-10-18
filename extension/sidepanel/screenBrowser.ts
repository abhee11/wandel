import type {ScreenLibrary} from '../shared/model';
export type ScreenBrowserAction='start'|'status'|'browse'|'refresh'|'return'|'end';
export interface ScreenBrowser{call(action:ScreenBrowserAction,url?:string):Promise<ScreenLibrary>;subscribe(listener:(state:ScreenLibrary)=>void):()=>void}
export class ChromeScreenBrowser implements ScreenBrowser{
 constructor(private source:number){}
 async call(action:ScreenBrowserAction,url?:string){const result=await chrome.runtime.sendMessage({type:'WANDEL_SCREENS',source:this.source,action,...(url?{url}:{})});if(!result||result.error)throw new Error(result?.error||'The live screen browser did not respond. Reopen Wandel.');return result.status as ScreenLibrary;}
 subscribe(listener:(state:ScreenLibrary)=>void){const receive=(m:any,sender:chrome.runtime.MessageSender)=>{if(m?.type==='WANDEL_SCREENS_CHANGED'&&m.source===this.source&&sender.id===chrome.runtime.id)listener(m.status);};chrome.runtime.onMessage.addListener(receive);return()=>chrome.runtime.onMessage.removeListener(receive);}
}
