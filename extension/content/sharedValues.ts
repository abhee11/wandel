/** Prototype values named shared_* are one live value across every tab and site with Wandel. They stay on this computer and only their names reach the AI. */
export const sharedPrefix='shared_';
const storageKey='wandelSharedValues';
type Values=Record<string,string>;
let values:Values={};
const listeners=new Set<()=>void>();
const storage=()=>{try{return typeof chrome==='undefined'?undefined:chrome.storage;}catch{return undefined;}};
const take=(next:unknown)=>{values=next&&typeof next==='object'?next as Values:{};for(const listener of listeners)listener();};
try{
 void storage()?.local.get(storageKey).then(saved=>take(saved[storageKey])).catch(()=>{});
 storage()?.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[storageKey])take(changes[storageKey].newValue);});
}catch{/* no extension storage here */}
export const sharedValues=()=>values;
export const onSharedValues=(listener:()=>void)=>{listeners.add(listener);return ()=>{listeners.delete(listener);};};
/** Sends this tab's shared values to the others. */
export function publishShared(data:Values){
 const changed=Object.entries(data).filter(([key,value])=>key.startsWith(sharedPrefix)&&values[key]!==value);if(!changed.length)return;
 values={...values,...Object.fromEntries(changed.map(([key,value])=>[key,value.slice(0,2000)]))};
 try{void storage()?.local.set({[storageKey]:values}).catch(()=>{});}catch{/* the tab keeps its own value */}
}
