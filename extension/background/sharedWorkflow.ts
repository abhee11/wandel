import {accountConfig} from '../shared/accountConfig';
import {shareRecord} from '../shared/workflowLink';
import {stateURL,type LiveContext} from '../shared/liveNavigation';
import {uid} from '../shared/model';
export function registerSharedWorkflow(){
 const requests=new Map<string,Promise<unknown>>(),rate=new Map<number,{at:number;count:number}>();
 chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if(m?.type!=='WANDEL_OPEN_SHARED'||sender.id!==chrome.runtime.id||sender.frameId!==0||sender.tab?.id===undefined||!sender.url)return;
  let page:URL;try{page=new URL(sender.url);if(page.origin!==new URL(accountConfig.apiOrigin).origin||page.pathname!=='/flow'||new URLSearchParams(page.hash.slice(1)).get('token')!==m.token||!/^[a-f0-9]{64}$/.test(m.token)||!/^[-a-f0-9]{36}$/.test(m.requestId))return;}catch{return;}
  const source=sender.tab.id,key=source+':'+m.requestId+':'+m.token;
  let task=requests.get(key);if(!task){task=(async()=>{
   const tab=await chrome.tabs.get(source);if(tab.url!==page.href)throw new Error('The share page changed. Open the link again.');const now=Date.now(),limit=rate.get(source);if(limit&&now-limit.at<60000){if(limit.count>=5)throw new Error('Wait a minute before opening more shared experiences.');limit.count++;}else rate.set(source,{at:now,count:1});
   const response=await fetch(accountConfig.apiOrigin+'/api/shared-workflows/'+m.token,{credentials:'omit',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('This workflow link has expired, been revoked, or is unavailable.');const text=await response.text();if(text.length>1000000)throw new Error('This shared workflow is too large.');const value=JSON.parse(text),record=shareRecord(value.record?.draft);record.draft.id=uid();const w=record.draft,target=stateURL(w,w.entry);
   const created=await chrome.tabs.create({url:'about:blank',active:false});if(created.id===undefined)throw new Error('Chrome could not create the experience tab.');const liveKey='wandel:live:'+created.id,recordKey='dx:workflow:'+w.id;
   try{const context:LiveContext={workflowId:w.id,stateId:w.entry,visits:[],mode:'replay',minimized:false,dialogs:{}};await chrome.storage.session.set({[recordKey]:record,[liveKey]:context});await chrome.tabs.update(created.id,{url:target,active:true});return {ok:true};}catch(error){await chrome.storage.session.remove([recordKey,liveKey]).catch(()=>{});await chrome.tabs.remove(created.id).catch(()=>{});throw error;}
  })().catch(error=>({error:error instanceof Error?error.message:'The experience could not open.'}));requests.set(key,task);while(requests.size>50)requests.delete(requests.keys().next().value!);}
  void task.then(reply);return true;
 });
 chrome.tabs.onRemoved.addListener(id=>{rate.delete(id);for(const key of requests.keys())if(key.startsWith(id+':'))requests.delete(key);});
}
