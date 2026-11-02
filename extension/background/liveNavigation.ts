import {RecordSchema} from '../shared/model';
import {validateWorkflow} from '../prototype/engine';
import {LiveContextSchema,stateURL,sameApplicationURL,contextAtURL,samePage,type LiveContext} from '../shared/liveNavigation';
/** Each handoff is bound to the originating tab, never to the active browser tab. */
export function registerLiveNavigation(){
 chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if(m?.type!=='WANDEL_LIVE_NAVIGATION'||sender.id!==chrome.runtime.id||sender.frameId!==0||sender.tab?.id===undefined)return;
  const tabId=sender.tab.id,key='wandel:live:'+tabId,anchor='wandel:workflow-tab:'+tabId;
  (async()=>{
   if(m.action==='clear'){await chrome.storage.session.remove(key);await chrome.storage.session.remove(anchor);return null;}
   const tab=await chrome.tabs.get(tabId);if(!tab.url)throw new Error('The application page is unavailable.');const origin=new URL(tab.url).origin;
   const saved=m.action==='read'?((await chrome.storage.session.get(key))[key]||(await chrome.storage.session.get(anchor))[anchor]):m.context;if(!saved)return null;
   let context=LiveContextSchema.parse(saved);const recordKey='dx:workflow:'+context.workflowId;
   // Drafts are kept in local storage; shared-link playback copies stay in the session store.
   const raw=(await chrome.storage.local.get(recordKey))[recordKey]??(await chrome.storage.session.get(recordKey))[recordKey];if(!raw)throw new Error('The active workflow draft is unavailable. Restore it from Saved workflows before continuing.');
   const record=RecordSchema.parse(raw),w=validateWorkflow(record.draft);if(w.origin!==origin)return null;
   if(!w.states.some(s=>s.id===context.stateId)||context.visits.some(id=>!w.states.some(s=>s.id===id)))throw new Error('This workflow destination is no longer available.');
   if(m.action==='read'){
    // Another page of the same app: the page asks whether to continue this workflow here or start anew.
    const next=contextAtURL(w,context,tab.url);if(!next)return {paused:{...context,name:w.name,url:stateURL(w,context.stateId)}};context=next;await chrome.storage.session.set({[key]:context,[anchor]:context});return context;
   }
   if(m.action==='remember'){if(!samePage(stateURL(w,context.stateId),tab.url))throw new Error('The application page changed before saving its position.');await chrome.storage.session.set({[key]:context,[anchor]:context});return context;}
   if(m.action!=='go')throw new Error('Unknown navigation action.');
   const url=sameApplicationURL(m.url,w.origin);if(url!==stateURL(w,context.stateId))throw new Error('The selected screen does not match this route.');
   const before=(await chrome.storage.session.get(key))[key],backup=(await chrome.storage.session.get(anchor))[anchor];await chrome.storage.session.set({[key]:context,[anchor]:context});try{await chrome.tabs.update(tabId,{url});}catch(error){for(const [name,value]of [[key,before],[anchor,backup]] as const){if(value)await chrome.storage.session.set({[name]:value});else await chrome.storage.session.remove(name);}throw error;}return context;
  })().then(result=>reply(result&&'paused' in result?{context:null,paused:result.paused}:{context:result})).catch(e=>reply({error:e.message}));return true;
 });
 chrome.tabs.onRemoved.addListener(id=>{void Promise.all([chrome.storage.session.remove('wandel:live:'+id),chrome.storage.session.remove('wandel:workflow-tab:'+id)]).catch(()=>{});});
}
