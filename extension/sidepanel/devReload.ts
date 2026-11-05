/** Local development only: when `npm run dev:local` rebuilds the extension it rewrites
 * dist/dev-reload.json. An unpacked extension reads its files from disk, so the open
 * side panel notices the new stamp, reloads the page it belongs to, and reloads the
 * extension. Published builds talk to a remote API and never run this. */
export const devReloadTabKey='wandel:dev-reload-tab';
export function watchDevReload(ownerTabId?:number){
 const api=process.env.WANDEL_PUBLIC_API_ORIGIN||'';
 if(!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(api)||typeof chrome==='undefined'||!chrome.runtime?.id)return;
 let first:number|undefined;
 const check=async()=>{
  let at:number|undefined;try{const response=await fetch(chrome.runtime.getURL('dev-reload.json'),{cache:'no-store'});if(!response.ok)return;at=(await response.json()).at;}catch{return;}
  if(first===undefined){first=at;return;}
  if(at===first)return;
  // The page is reloaded after the extension restarts (see background), so it gets the new content script.
  if(ownerTabId!==undefined)await chrome.storage.local.set({[devReloadTabKey]:ownerTabId}).catch(()=>{});
  chrome.runtime.reload();
 };
 void check();setInterval(()=>void check(),2000);
}
/** Background side: after a development reload, reload the page whose panel asked for it. */
export function reloadDevTab(){
 chrome.runtime.onInstalled.addListener(async details=>{
  if(details.reason!=='update')return;
  const saved=(await chrome.storage.local.get(devReloadTabKey))[devReloadTabKey];if(typeof saved!=='number')return;
  await chrome.storage.local.remove(devReloadTabKey);await chrome.tabs.reload(saved).catch(()=>{});
 });
}
