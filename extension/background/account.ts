import {createClerkClient} from '@clerk/chrome-extension/client';
import {accountConfig} from '../shared/accountConfig';
export function registerAccountBridge(){
 const notify=()=>{void chrome.runtime.sendMessage({type:'WANDEL_ACCOUNT_CHANGED'}).catch(()=>{});};
 chrome.cookies?.onChanged?.addListener(change=>{
  const host=new URL(accountConfig.syncHost).hostname;
  if(['__clerk_db_jwt','__client','__session'].includes(change.cookie.name)&&change.cookie.domain.replace(/^\./,'')===host)notify();
 });
 chrome.runtime.onMessageExternal?.addListener((message,sender,reply)=>{
  if(message?.type!=='WANDEL_AUTH_RETURN'||!sender.url||sender.frameId!==0||sender.tab?.id===undefined)return;
  const url=new URL(sender.url);
  if(url.origin!==new URL(accountConfig.appOrigin).origin||url.pathname!=='/extension/sign-in')return;
  (async()=>{
   const key='wandelAuthReturn:'+sender.tab!.id;
   const pending=(await chrome.storage.session.get(key))[key];
   if(!pending||pending.nonce!==message.nonce||Date.now()-pending.created>30*60*1000)throw new Error('Return link expired. Return to your app tab and click the Wandel icon.');
   const tab=await chrome.tabs.get(pending.tabId);
   if(tab.url!==pending.url)throw new Error('The original page changed. Return to your app tab and click the Wandel icon.');
   await chrome.tabs.update(pending.tabId,{active:true});
   if(tab.windowId!==undefined)await chrome.windows.update(tab.windowId,{focused:true});
   notify();
   await chrome.storage.session.remove(key);
   reply({ok:true});
   await chrome.tabs.remove(sender.tab!.id!);
  })().catch(error=>reply({error:error instanceof Error?error.message:'Return to your app tab and click the Wandel icon.'}));
  return true;
 });
 chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.type==='WANDEL_ACCOUNT_SIGN_IN'){
   if(sender.id!==chrome.runtime.id||sender.tab||!sender.url?.startsWith(chrome.runtime.getURL('sidepanel.html')))return;
   (async()=>{
    const source=Number(new URL(sender.url!).searchParams.get('tabId'));
    if(!Number.isInteger(source)||source<=0)throw new Error('Open Wandel on your app tab before signing in.');
    const tab=await chrome.tabs.get(source),nonce=crypto.randomUUID();
    const url=new URL('/extension/sign-in',accountConfig.appOrigin);
    url.searchParams.set('extension',chrome.runtime.id);url.searchParams.set('state',nonce);
    const auth=await chrome.tabs.create({url:url.href});
    await chrome.storage.session.set({['wandelAuthReturn:'+auth.id]:{tabId:source,url:tab.url,nonce,created:Date.now()}});
    return {ok:true};
   })().then(reply).catch(error=>reply({error:error.message}));return true;
  }
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
   if(!accountConfig.publishableKey)throw new Error('This extension build has no Clerk key. Rebuild Wandel and click Reload in chrome://extensions, then refresh this page.');
   if(accountConfig.publishableKey.startsWith('pk_test_')&&!await chrome.cookies.get({url:accountConfig.syncHost,name:'__clerk_db_jwt'}))return {token:null};
   const clerk=await createClerkClient({publishableKey:accountConfig.publishableKey,syncHost:accountConfig.syncHost,background:true});
   if(message.signOut){await clerk.signOut();return {token:null};}
   return {token:await clerk.session?.getToken()||null};
  })().then(reply).catch(error=>reply({error:error instanceof Error?(/authenticate this browser|dev.*browser/i.test(error.message)?'Sign in to Wandel in this Chrome profile, then return and retry. Your draft is unchanged.':error.message):'Sign-in unavailable.'}));return true;
 });
}
