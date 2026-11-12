/**
 * Where app maps live in the browser, and which domains are switched on.
 * This is the browser-only map; the shared team map on the server builds on the same format.
 */
import {emptyMap,record,type AppMap,type Observation} from './catalog';
import type {Shape} from './shape';
export interface AppMapSettings{
 /** Origins, such as https://app.acme.com, where Wandel learns from the app's own requests. */
 origins:string[];
 /** Path patterns never recorded, even as shapes: /admin, /api/hr/*. */
 blockList:string[];
}
const SETTINGS='appMapSettings',mapKey=(origin:string)=>'appMap:'+origin,SCRIPT_ID='wandel-app-map';
export const defaultSettings=():AppMapSettings=>({origins:[],blockList:[]});
export async function readSettings():Promise<AppMapSettings>{
 const stored=(await chrome.storage.local.get(SETTINGS))[SETTINGS] as Partial<AppMapSettings>|undefined;
 return {origins:Array.isArray(stored?.origins)?stored.origins.filter(o=>typeof o==='string'):[],blockList:Array.isArray(stored?.blockList)?stored.blockList.filter(o=>typeof o==='string'):[]};
}
export async function writeSettings(settings:AppMapSettings){
 const clean={origins:[...new Set(settings.origins.map(o=>new URL(o).origin))].sort(),blockList:[...new Set(settings.blockList.map(rule=>rule.trim()).filter(Boolean))].slice(0,100)};
 await chrome.storage.local.set({[SETTINGS]:clean});await syncInjection(clean);return clean;
}
export async function readMap(origin:string):Promise<AppMap>{return ((await chrome.storage.local.get(mapKey(origin)))[mapKey(origin)] as AppMap|undefined)||emptyMap(origin);}
export async function deleteMap(origin:string){await chrome.storage.local.remove(mapKey(origin));}
/** Only these origins get the watcher, injected into the page's own world before the app starts. */
export async function syncInjection(settings?:AppMapSettings){
 const {origins}=settings||await readSettings();
 const existing=await chrome.scripting.getRegisteredContentScripts({ids:[SCRIPT_ID]}).catch(()=>[]);
 if(existing.length)await chrome.scripting.unregisterContentScripts({ids:[SCRIPT_ID]}).catch(()=>{});
 if(origins.length)await chrome.scripting.registerContentScripts([{id:SCRIPT_ID,matches:origins.map(origin=>origin+'/*'),js:['appmap.js'],world:'MAIN',runAt:'document_start',allFrames:false,persistAcrossSessions:true}]);
}
/** Starts watching an already-open tab, so the user doesn't have to reload after switching on. */
export async function watchTab(tabId:number){await chrome.scripting.executeScript({target:{tabId,frameIds:[0]},world:'MAIN',files:['appmap.js']});}
const isShape=(value:unknown):value is Shape=>!!value&&typeof value==='object'&&Array.isArray((value as Shape).types);
/** Checks what the page sent: the page's own script could send anything, so only well-formed, bounded observations are kept. */
export function validObservations(value:unknown):Observation[]{
 if(!Array.isArray(value))return [];
 return value.slice(0,50).filter((o:any)=>o&&typeof o.method==='string'&&o.method.length<=10&&typeof o.path==='string'&&o.path.length<=2000&&Array.isArray(o.query)&&o.query.every((q:unknown)=>typeof q==='string')&&Number.isInteger(o.status)&&o.status>=0&&o.status<1000&&(o.request==null||isShape(o.request))&&(o.response==null||isShape(o.response))&&(o.message==null||typeof o.message==='string')&&JSON.stringify(o).length<200_000)
  .map((o:any)=>({method:o.method,path:o.path,query:o.query.slice(0,20),status:o.status,request:o.request??null,response:o.response??null,message:o.message??null}));
}
// Writes for one origin are chained so two batches arriving together can't overwrite each other.
const writing=new Map<string,Promise<unknown>>();
export function recordObservations(origin:string,observations:Observation[]){
 const next=(writing.get(origin)||Promise.resolve()).then(async()=>{
  const settings=await readSettings();if(!settings.origins.includes(origin))return;
  let map=await readMap(origin);const now=new Date().toISOString();
  for(const observation of observations)map=record(map,observation,now,settings.blockList);
  await chrome.storage.local.set({[mapKey(origin)]:map});
 }).catch(()=>{});
 writing.set(origin,next);return next;
}
