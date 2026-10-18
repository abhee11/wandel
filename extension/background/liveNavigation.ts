import {freeBuild} from '../shared/build';
import {RecordSchema} from '../shared/model';
import {validateWorkflow} from '../prototype/engine';
import {LiveContextSchema,stateURL,sameApplicationURL,type LiveContext} from '../shared/liveNavigation';
/** Each handoff is bound to the originating tab, never to the active browser tab. */
export function registerLiveNavigation(){
 chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if(m?.type!=='WANDEL_LIVE_NAVIGATION'||sender.id!==chrome.runtime.id||sender.frameId!==0||sender.tab?.id===undefined)return;
  const tabId=sender.tab.id,key='wandel:live:'+tabId;
  (async()=>{
   if(m.action==='clear'){await chrome.storage.session.remove(key);return null;}
   const tab=await chrome.tabs.get(tabId);if(!tab.url)throw new Error('The application page is unavailable.');const origin=new URL(tab.url).origin;
   const saved=m.action==='read'?(await chrome.storage.session.get(key))[key]:m.context;if(!saved)return null;
   let context=LiveContextSchema.parse(saved);const storage=freeBuild?chrome.storage.local:chrome.storage.session;
   const raw=(await storage.get('dx:workflow:'+context.workflowId))['dx:workflow:'+context.workflowId];if(!raw){await chrome.storage.session.remove(key);return null;}
   const record=RecordSchema.parse(raw),w=validateWorkflow(record.draft);if(w.origin!==origin){await chrome.storage.session.remove(key);return null;}
   if(!w.states.some(s=>s.id===context.stateId)||context.visits.some(id=>!w.states.some(s=>s.id===id)))throw new Error('This workflow destination is no longer available.');
   if(m.action==='read'){
    if(stateURL(w,context.stateId)!==tab.url){const index=context.visits.reduce((index,id,i)=>stateURL(w,id)===tab.url?i:index,-1);if(index<0){await chrome.storage.session.remove(key);return null;}context={...context,stateId:context.visits[index],visits:context.visits.slice(0,index)};await chrome.storage.session.set({[key]:context});}return context;
   }
   if(m.action==='remember'){if(stateURL(w,context.stateId)!==tab.url)throw new Error('The application page changed before saving its position.');await chrome.storage.session.set({[key]:context});return context;}
   if(m.action!=='go')throw new Error('Unknown navigation action.');
   const url=sameApplicationURL(m.url,w.origin);if(url!==stateURL(w,context.stateId))throw new Error('The selected screen does not match this route.');
   await chrome.storage.session.set({[key]:context});try{await chrome.tabs.update(tabId,{url});}catch(error){await chrome.storage.session.remove(key);throw error;}return context;
  })().then(context=>reply({context})).catch(e=>reply({error:e.message}));return true;
 });
 chrome.tabs.onRemoved.addListener(id=>{void chrome.storage.session.remove('wandel:live:'+id);});
}
