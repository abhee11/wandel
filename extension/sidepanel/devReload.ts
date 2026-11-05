/** Local development only (API on 127.0.0.1/localhost). When `npm run dev:local` rebuilds the
 * extension it rewrites dist/dev-reload.json; an unpacked extension reads its files from disk.
 * The background notices the new stamp, reloads the extension, then reloads the tabs that had
 * Wandel open (and other tabs of the same sites) so they run the new content script.
 * The page can also ask to open the Wandel panel (`wandel:dev-open`), so a browser automation
 * can test without clicking Chrome's toolbar. Published builds never run any of this. */
const tabsKey='wandel:dev-reload-tabs';
export function isLocalDev(){return /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(process.env.WANDEL_PUBLIC_API_ORIGIN||'');}
export function watchDevReload(){
 if(!isLocalDev())return;
 chrome.runtime.onInstalled.addListener(async details=>{
  if(details.reason!=='update')return;
  const ids=(await chrome.storage.local.get(tabsKey))[tabsKey];if(!Array.isArray(ids))return;
  await chrome.storage.local.remove(tabsKey);for(const id of ids)await chrome.tabs.reload(id).catch(()=>{});
 });
 let first:number|undefined;
 const check=async()=>{
  let at:number|undefined;try{const response=await fetch(chrome.runtime.getURL('dev-reload.json'),{cache:'no-store'});if(!response.ok)return;at=(await response.json()).at;}catch{return;}
  if(first===undefined){first=at;return;}
  if(at===first)return;
  const session=await chrome.storage.session.get(null),open=Object.entries(session).filter(([key,value])=>key.startsWith('wandel:inline:')&&value).map(([key])=>Number(key.slice(14)));
  const tabs=await chrome.tabs.query({}),origins=new Set(tabs.filter(tab=>tab.id!==undefined&&open.includes(tab.id)&&tab.url).map(tab=>new URL(tab.url!).origin));
  const reload=tabs.filter(tab=>tab.id!==undefined&&tab.url&&/^https?:/.test(tab.url)&&(open.includes(tab.id)||origins.has(new URL(tab.url).origin))).map(tab=>tab.id!);
  await chrome.storage.local.set({[tabsKey]:reload});chrome.runtime.reload();
 };
 // Calling an extension API on each tick also keeps the development service worker awake.
 void check();setInterval(()=>{void check();void chrome.runtime.getPlatformInfo();},2000);
}
