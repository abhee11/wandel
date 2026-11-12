/**
 * Runs in the page's own world, injected only on domains where the team switched capture on.
 * It notes the app's own data requests, reduces each to its shape here in the page, and hands
 * the shapes to Wandel's content script. It only reads: requests are never delayed, changed or blocked,
 * and any failure is swallowed so the app cannot be affected.
 */
import {shapeOf} from './shape';
import type {Observation} from './catalog';
export const APP_MAP_MESSAGE='wandel-app-map';
const MAX_BODY=1_000_000;
/** The app's own requests: same site, so app.example.com calling api.example.com counts and third-party services don't. */
export function ownRequest(url:URL,page:Location|URL){
 if(url.origin===page.origin)return true;
 if(url.protocol!==page.protocol)return false;
 const site=(host:string)=>host.split('.').slice(-2).join('.');
 return site(url.hostname)===site(page.hostname)&&url.hostname.includes('.');
}
const parse=(text:string)=>{try{return JSON.parse(text) as unknown;}catch{return undefined;}};
/** The app's own words for an error, from the usual places in an error body. */
export function errorMessage(body:unknown):string|null{
 if(!body||typeof body!=='object')return null;
 const value=body as Record<string,any>;
 for(const candidate of [value.message,value.error?.message,value.error,value.detail,value.title,value.errors?.[0]?.message,value.errors?.[0]])if(typeof candidate==='string'&&candidate.trim())return candidate.slice(0,300);
 return null;
}
export function observe(method:string,url:URL,status:number,requestBody:unknown,responseText:string|null):Observation{
 const response=responseText!==null&&responseText.length<=MAX_BODY?parse(responseText):undefined;
 return {method:method.toUpperCase(),path:url.pathname,query:[...new Set(url.searchParams.keys())].sort(),status,
  request:requestBody===undefined?null:shapeOf(requestBody),
  response:status<400&&response!==undefined?shapeOf(response):null,
  message:status>=400?errorMessage(response):null};
}
function requestBodyOf(body:unknown){
 if(typeof body==='string')return body.length<=MAX_BODY?parse(body):undefined;
 if(body instanceof URLSearchParams)return Object.fromEntries(body.entries());
 return undefined;
}
export function startWatching(win:Window&typeof globalThis=window){
 const flag='__wandelAppMapWatching';
 if((win as any)[flag])return;(win as any)[flag]=true;
 const queue:Observation[]=[];let timer=0;
 const flush=()=>{timer=0;if(!queue.length)return;try{win.postMessage({type:APP_MAP_MESSAGE,observations:queue.splice(0,50)},win.location.origin);}catch{}if(queue.length)schedule();};
 const schedule=()=>{if(!timer)timer=win.setTimeout(flush,2000);};
 const note=(method:string,url:URL,status:number,body:unknown,text:string|null)=>{try{if(queue.length<500)queue.push(observe(method,url,status,body,text));schedule();}catch{}};
 const json=(type:string|null)=>/json/i.test(type||'');
 const original=win.fetch;
 if(typeof original==='function')win.fetch=function(this:unknown,input:RequestInfo|URL,init?:RequestInit){
  const promise=Reflect.apply(original,win,arguments) as Promise<Response>;
  try{
   const request=input instanceof Request?input:null,url=new URL(request?request.url:String(input),win.location.href);
   if(ownRequest(url,win.location)){
    const method=init?.method||request?.method||'GET',body=requestBodyOf(init?.body);
    promise.then(response=>{try{
     const size=Number(response.headers.get('content-length')||0);
     if(!json(response.headers.get('content-type'))||size>MAX_BODY){note(method,url,response.status,body,null);return;}
     response.clone().text().then(text=>note(method,url,response.status,body,text),()=>{});
    }catch{}},()=>{});
   }
  }catch{}
  return promise;
 } as typeof fetch;
 const XHR=win.XMLHttpRequest?.prototype;
 if(XHR){
  const open=XHR.open,send=XHR.send;
  XHR.open=function(this:XMLHttpRequest&{__wandel?:{method:string;url:string}},method:string,url:string|URL){try{this.__wandel={method,url:String(url)};}catch{}return Reflect.apply(open,this,arguments);} as typeof XHR.open;
  XHR.send=function(this:XMLHttpRequest&{__wandel?:{method:string;url:string}},body?:Document|XMLHttpRequestBodyInit|null){
   try{const info=this.__wandel;if(info){const url=new URL(info.url,win.location.href);if(ownRequest(url,win.location)){const sent=requestBodyOf(body);this.addEventListener('loadend',()=>{try{
    if(!json(this.getResponseHeader('content-type'))){note(info.method,url,this.status,sent,null);return;}
    const text=this.responseType===''||this.responseType==='text'?this.responseText:this.responseType==='json'?JSON.stringify(this.response):null;
    note(info.method,url,this.status,sent,text);
   }catch{}});}}}catch{}
   return Reflect.apply(send,this,arguments);
  } as typeof XHR.send;
 }
}
