import {createClerkClient} from '@clerk/chrome-extension/client';
import {accountConfig} from '../shared/accountConfig';
export function registerAccountBridge(){
 chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.type==='WANDEL_TEMP_STORAGE'){
   if(sender.id!==chrome.runtime.id)return;
   const key=String(message.key||'');if(key&&!key.startsWith('dx:'))return;
   const storage=chrome.storage.session;
   const work=message.action==='read'?storage.get(key).then(x=>x[key]):message.action==='keys'?storage.get(null).then(x=>Object.keys(x).filter(k=>k.startsWith('dx:'))):message.action==='write'?storage.set({[key]:message.value}):message.action==='remove'?storage.remove(key):Promise.reject(new Error('Invalid storage action'));
   work.then(value=>reply({value})).catch(()=>reply({error:'Temporary storage unavailable.'}));return true;
  }
  // Account tokens are never exposed to page content scripts.
  if(message?.type!=='WANDEL_ACCOUNT_TOKEN'||sender.id!==chrome.runtime.id||sender.tab||!sender.url?.startsWith(chrome.runtime.getURL('sidepanel.html')))return;
  (async()=>{
   if(!accountConfig.publishableKey)throw new Error('Clerk is not configured yet. Temporary saves are available.');
   const clerk=await createClerkClient({publishableKey:accountConfig.publishableKey,syncHost:accountConfig.syncHost,background:true});
   if(message.signOut){await clerk.signOut();return {token:null};}
   return {token:await clerk.session?.getToken()||null};
  })().then(reply).catch(error=>reply({error:error instanceof Error?error.message:'Sign-in unavailable.'}));return true;
 });
}
