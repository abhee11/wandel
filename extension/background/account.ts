import {createClerkClient} from '@clerk/chrome-extension/client';
import {accountConfig} from '../shared/accountConfig';
/** The signed-in user's API token, read in the background (null when signed out). */
export async function backgroundAccountToken(signOut=false){
 if(!accountConfig.publishableKey)throw new Error('This extension build has no Clerk key. Rebuild Wandel and click Reload in chrome://extensions, then refresh this page.');
 if(accountConfig.publishableKey.startsWith('pk_test_')&&!await chrome.cookies.get({url:accountConfig.syncHost,name:'__clerk_db_jwt'}))return null;
 const clerk=await createClerkClient({publishableKey:accountConfig.publishableKey,syncHost:accountConfig.syncHost,background:true});
 if(signOut){await clerk.signOut();return null;}
 return await clerk.session?.getToken()||null;
}
export function registerAccountBridge(){
 const trustedSurface=(sender:chrome.runtime.MessageSender)=>{
  if(sender.id!==chrome.runtime.id||!sender.url)return false;
  try{const url=new URL(sender.url),base=new URL(chrome.runtime.getURL(''));
   if(url.protocol!==base.protocol||url.host!==base.host)return false;
   if(sender.frameId&&!(url.pathname==='/sidepanel.html'&&url.searchParams.get('embedded')==='1'&&String(sender.tab?.id)===url.searchParams.get('tabId')))return false;
   return url.pathname==='/sidepanel.html'&&(!sender.tab||url.searchParams.get('embedded')==='1'&&String(sender.tab.id)===url.searchParams.get('tabId')||url.searchParams.get('floating')==='1'&&/^\d+$/.test(url.searchParams.get('tabId')||''))||url.pathname==='/recorder.html'&&sender.tab?.id!==undefined;
  }catch{return false;}
 };
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
   if(!trustedSurface(sender))return;
   (async()=>{
    const source=new URL(sender.url!).pathname==='/recorder.html'?sender.tab!.id!:Number(new URL(sender.url!).searchParams.get('tabId'));
    if(!Number.isInteger(source)||source<=0)throw new Error('Open Wandel on your app tab before signing in.');
    const tab=await chrome.tabs.get(source),nonce=crypto.randomUUID();
    const url=new URL('/extension/sign-in',accountConfig.appOrigin);
    url.searchParams.set('extension',chrome.runtime.id);url.searchParams.set('state',nonce);
    const auth=await chrome.tabs.create({url:url.href});
    await chrome.storage.session.set({['wandelAuthReturn:'+auth.id]:{tabId:source,url:tab.url,nonce,created:Date.now()}});
    return {ok:true};
   })().then(reply).catch(error=>reply({error:error.message}));return true;
  }
  // Undo history for a workflow; like the draft it survives Chrome restarts (capped at 20 steps per direction by the page).
  if(message?.type==='WANDEL_HISTORY'){
   if(sender.id!==chrome.runtime.id||typeof message.workflowId!=='string'||!/^[\w-]{1,100}$/.test(message.workflowId))return;
   const key='wandel:history:'+message.workflowId;
   const work=message.action==='read'?chrome.storage.local.get(key).then(async x=>x[key]??(await chrome.storage.session.get(key))[key]??null):message.action==='write'?chrome.storage.local.set({[key]:message.value}):Promise.reject(new Error('Invalid history action'));
   work.then(value=>reply({value})).catch(()=>reply({error:'Undo history is unavailable.'}));return true;
  }
  if(message?.type==='WANDEL_TEMP_STORAGE'){
   if(sender.id!==chrome.runtime.id)return;
   const key=String(message.key||'');if(key&&!key.startsWith('dx:'))return;
   // Drafts persist across Chrome restarts and extension reloads; drafts from the earlier session-only store are still read.
   const local=chrome.storage.local,session=chrome.storage.session;
   const work=message.action==='read'?local.get(key).then(async x=>x[key]??(await session.get(key))[key]):message.action==='keys'?Promise.all([local.get(null),session.get(null)]).then(([a,b])=>[...new Set([...Object.keys(a),...Object.keys(b)])].filter(k=>k.startsWith('dx:'))):message.action==='write'?local.set({[key]:message.value}).then(()=>session.remove(key)):message.action==='remove'?Promise.all([local.remove(key),session.remove(key)]):Promise.reject(new Error('Invalid storage action'));
   work.then(value=>reply({value})).catch(()=>reply({error:'Draft storage is unavailable. Save to your account or export the flow.'}));return true;
  }
  // Only exact packaged UI pages can request tokens; host-page content scripts cannot.
  if(message?.type!=='WANDEL_ACCOUNT_TOKEN'||!trustedSurface(sender))return;
  (async()=>message.signOut?{token:await backgroundAccountToken(true)}:{token:await backgroundAccountToken()})().then(reply).catch(error=>reply({error:error instanceof Error?(/authenticate this browser|dev.*browser/i.test(error.message)?'Sign in to Wandel in this Chrome profile, then return and retry. Your draft is unchanged.':error.message):'Sign-in unavailable.'}));return true;
 });
}
