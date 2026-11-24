import {createClerkClient} from '@clerk/chrome-extension/client';
import {accountConfig} from '../shared/accountConfig';
/** The signed-in user's API token, read in the background (null when signed out). */
export async function backgroundAccountToken(signOut=false){
 tokenMiss='';
 if(!accountConfig.publishableKey)throw new Error('This extension build has no Clerk key. Rebuild Wandel and click Reload in chrome://extensions, then refresh this page.');
 if(accountConfig.publishableKey.startsWith('pk_test_')&&!await chrome.cookies.get({url:accountConfig.syncHost,name:'__clerk_db_jwt'}))return null;
 const clerk=await createClerkClient({publishableKey:accountConfig.publishableKey,syncHost:accountConfig.syncHost,background:true});
 if(signOut){await clerk.signOut();return null;}
 const first=await readToken(clerk);if(first.token)return first.token;
 // After hours idle, Chrome restarts the background worker and Clerk can come back without its session for a moment;
 // a signed-in user then saw "reconnect your session" with nothing sent. Look once more, bypassing the token cache.
 await new Promise(r=>setTimeout(r,800));
 let reloaded='';await (clerk as any).load?.().catch((error:unknown)=>{reloaded=' reload: '+describe(error);});
 const second=await readToken(clerk,true);if(second.token)return second.token;
 // Signed-in users still lose their token now and then; why is kept for the panel to report once it can.
 tokenMiss='first: '+first.reason+'; second: '+second.reason+reloaded;
 return null;
}
/** Why the last token read came back empty: no Clerk session, or getToken failing (and how). */
let tokenMiss='';
export const lastTokenMiss=()=>tokenMiss;
const describe=(error:unknown)=>(error instanceof Error?error.name+': '+error.message:String(error)).slice(0,160);
async function readToken(clerk:any,skipCache=false):Promise<{token:string|null;reason:string}>{
 if(!clerk.session)return {token:null,reason:'no session'+(clerk.user?' (user present)':'')+(clerk.client?.sessions?.length?` (${clerk.client.sessions.length} client sessions)`:'')};
 try{const token=await clerk.session.getToken(skipCache?{skipCache:true}:undefined);return token?{token,reason:''}:{token:null,reason:'getToken returned nothing ('+(clerk.session.status||'unknown status')+')'};}
 catch(error){return {token:null,reason:'getToken threw '+describe(error)};}
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
 const notify=(reload=false)=>{void chrome.runtime.sendMessage({type:'WANDEL_ACCOUNT_CHANGED',reload}).catch(()=>{});};
 chrome.cookies?.onChanged?.addListener(change=>{
  const host=new URL(accountConfig.syncHost).hostname;
  if(['__clerk_db_jwt','__client','__session'].includes(change.cookie.name)&&change.cookie.domain.replace(/^\./,'')===host)notify();
 });
 chrome.runtime.onMessageExternal?.addListener((message,sender,reply)=>{
  if(!['WANDEL_AUTH_RETURN','WANDEL_SIGNED_OUT'].includes(message?.type)||!sender.url||sender.frameId!==0||sender.tab?.id===undefined)return;
  const url=new URL(sender.url);
  if(url.origin!==new URL(accountConfig.appOrigin).origin||url.pathname!==(message.type==='WANDEL_SIGNED_OUT'?'/extension/sign-out':'/extension/sign-in'))return;
  if(message.type==='WANDEL_SIGNED_OUT'){
   (async()=>{
    const key='wandelSignOut:'+sender.tab!.id;
    const pending=(await chrome.storage.session.get(key))[key];
    if(!pending||pending.nonce!==message.nonce||Date.now()-pending.created>10*60*1000)throw new Error('Sign-out link expired.');
    await chrome.storage.session.remove(key);
    reply({ok:true});
    notify(true);
    await chrome.tabs.remove(sender.tab!.id!);
   })().catch(error=>reply({error:error instanceof Error?error.message:'Sign-out could not finish.'}));
   return true;
  }
  (async()=>{
   const key='wandelAuthReturn:'+sender.tab!.id;
   const pending=(await chrome.storage.session.get(key))[key];
   if(!pending||pending.nonce!==message.nonce||Date.now()-pending.created>30*60*1000)throw new Error('Return link expired. Return to your app tab and click the Wandel icon.');
   const tab=await chrome.tabs.get(pending.tabId);
   if(tab.url!==pending.url)throw new Error('The original page changed. Return to your app tab and click the Wandel icon.');
   await chrome.tabs.update(pending.tabId,{active:true});
   if(tab.windowId!==undefined)await chrome.windows.update(tab.windowId,{focused:true});
   notify(true);
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
  if(message?.type==='WANDEL_ACCOUNT_SIGN_OUT'){
   if(!trustedSurface(sender))return;
   (async()=>{
    // Clerk only accepts sign-out from Wandel's website, so it runs there in a background tab that closes itself when done.
    const nonce=crypto.randomUUID(),url=new URL('/extension/sign-out',accountConfig.appOrigin);
    url.searchParams.set('extension',chrome.runtime.id);url.searchParams.set('state',nonce);
    const tab=await chrome.tabs.create({url:url.href,active:false});
    await chrome.storage.session.set({['wandelSignOut:'+tab.id]:{nonce,created:Date.now()}});
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
  (async()=>message.signOut?{token:await backgroundAccountToken(true)}:await backgroundAccountToken().then(token=>token?{token}:lastTokenMiss()?{token:null,reason:lastTokenMiss()}:{token:null}))().then(reply).catch(error=>reply({error:error instanceof Error?(/authenticate this browser|dev.*browser/i.test(error.message)?'Sign in to Wandel in this Chrome profile, then return and retry. Your draft is unchanged.':error.message):'Sign-in unavailable.'}));return true;
 });
}
