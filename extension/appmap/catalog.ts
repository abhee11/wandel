import {mergeShape,personalValue,type Shape} from './shape';
/** One request the app made, already reduced to shapes inside the page. */
export interface Observation{method:string;path:string;query:string[];status:number;request?:Shape|null;response?:Shape|null;message?:string|null}
export interface Endpoint{method:string;path:string;query:string[];statuses:number[];request?:Shape;response?:Shape;
 /** Validation and error messages the app returned, scrubbed of values. */
 rules:string[];firstSeen:string;lastSeen:string;seen:number}
export interface AppMap{origin:string;endpoints:Record<string,Endpoint>;updatedAt:string}
export const MAX_ENDPOINTS=500,MAX_RULES=12,STALE_DAYS=90;
const ID_SEGMENT=/^(\d+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{12,}|[A-Za-z0-9]{20,})$/i;
/** `/api/invoices/inv_83a1/lines/7` becomes `/api/invoices/:id/lines/:id`: ids, numbers and long codes are values, not structure. */
export function templatePath(path:string){
 return '/'+path.split('/').filter(Boolean).slice(0,12).map(segment=>{
  let text=segment;try{text=decodeURIComponent(segment);}catch{}
  if(ID_SEGMENT.test(text)||/^[a-z]{2,8}_[A-Za-z0-9]*\d[A-Za-z0-9]*$/.test(text)||/^[a-z]{2,6}_[A-Za-z0-9]{8,}$/.test(text)||(/\d/.test(text)&&text.length>=6)||personalValue(text))return ':id';
  return text.slice(0,60);
 }).join('/');
}
/** Only the names of query parameters are kept, sorted, never their values. */
export function queryNames(search:string){return [...new Set([...new URLSearchParams(search).keys()].map(key=>key.slice(0,40)))].sort().slice(0,20);}
/** Error text keeps its words and loses anything that could be a value: emails, numbers, quoted text. */
export function scrubMessage(text:string){
 const clean=text.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g,'<email>').replace(/(["'“‘]).*?(["'”’])/g,'<value>').replace(/\d[\d,.\s-]*/g,'<n>').replace(/\s+/g,' ').trim();
 return clean.length>=4?clean.slice(0,160):null;
}
/** A team's block list: path prefixes or simple patterns with *, matched against the templated path. */
export function blocked(path:string,list:string[]){
 return list.some(rule=>{const pattern=rule.trim();if(!pattern)return false;if(!pattern.includes('*'))return path===pattern||path.startsWith(pattern.replace(/\/$/,'')+'/');return new RegExp('^'+pattern.split('*').map(part=>part.replace(/[.+?^${}()|[\]\\]/g,'\\$&')).join('.*')+'$').test(path);});
}
export const endpointKey=(method:string,path:string)=>method.toUpperCase()+' '+path;
export function emptyMap(origin:string,now=new Date().toISOString()):AppMap{return {origin,endpoints:{},updatedAt:now};}
/** Adds one observation to the map. A blocked or oversized map ignores it. */
export function record(map:AppMap,observation:Observation,now=new Date().toISOString(),blockList:string[]=[]):AppMap{
 const method=observation.method.toUpperCase().slice(0,10),path=templatePath(observation.path);
 if(blocked(path,blockList))return map;
 const key=endpointKey(method,path),old=map.endpoints[key];
 if(!old&&Object.keys(map.endpoints).length>=MAX_ENDPOINTS)return map;
 const message=observation.message?scrubMessage(observation.message):null;
 const next:Endpoint={method,path,
  query:[...new Set([...(old?.query||[]),...observation.query])].sort().slice(0,20),
  statuses:[...new Set([...(old?.statuses||[]),observation.status])].sort((a,b)=>a-b).slice(0,12),
  rules:message&&observation.status>=400?[...new Set([...(old?.rules||[]),observation.status+': '+message])].slice(0,MAX_RULES):old?.rules||[],
  firstSeen:old?.firstSeen||now,lastSeen:now,seen:(old?.seen||0)+1};
 const request=old?.request&&observation.request?mergeShape(old.request,observation.request):old?.request||observation.request||undefined;
 // Error bodies have a different shape from the normal response; only successful responses describe the data.
 const ok=observation.status<400,response=ok&&observation.response?(old?.response?mergeShape(old.response,observation.response):observation.response):old?.response;
 if(request)next.request=request;if(response)next.response=response;
 return {...map,endpoints:{...map.endpoints,[key]:next},updatedAt:now};
}
/** Merges two maps of the same app, such as a teammate's into the team's. */
export function mergeMaps(a:AppMap,b:AppMap):AppMap{
 const endpoints={...a.endpoints};
 for(const [key,theirs] of Object.entries(b.endpoints)){
  const ours=endpoints[key];
  if(!ours){if(Object.keys(endpoints).length<MAX_ENDPOINTS)endpoints[key]=theirs;continue;}
  endpoints[key]={...ours,query:[...new Set([...ours.query,...theirs.query])].sort().slice(0,20),statuses:[...new Set([...ours.statuses,...theirs.statuses])].sort((x,y)=>x-y).slice(0,12),rules:[...new Set([...ours.rules,...theirs.rules])].slice(0,MAX_RULES),
   firstSeen:ours.firstSeen<theirs.firstSeen?ours.firstSeen:theirs.firstSeen,lastSeen:ours.lastSeen>theirs.lastSeen?ours.lastSeen:theirs.lastSeen,seen:ours.seen+theirs.seen,
   ...(ours.request||theirs.request?{request:ours.request&&theirs.request?mergeShape(ours.request,theirs.request):ours.request||theirs.request}:{}),
   ...(ours.response||theirs.response?{response:ours.response&&theirs.response?mergeShape(ours.response,theirs.response):ours.response||theirs.response}:{})};
 }
 return {origin:a.origin,endpoints,updatedAt:a.updatedAt>b.updatedAt?a.updatedAt:b.updatedAt};
}
export const isStale=(endpoint:Endpoint,now=new Date())=>now.getTime()-Date.parse(endpoint.lastSeen)>STALE_DAYS*864e5;
