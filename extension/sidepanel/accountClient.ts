import {accountConfig} from '../shared/accountConfig';
export class AccountError extends Error {constructor(public code:string,message:string){super(message);}}
export async function accountToken(){const result=await chrome.runtime.sendMessage({type:'WANDEL_ACCOUNT_TOKEN'});if(result?.error)throw new AccountError('AUTH_NOT_CONFIGURED',result.error);if(!result?.token)throw new AccountError('AUTH_REQUIRED','Sign in under Account to use Wandel AI and account saves.');return result.token as string;}
export async function accountAPI<T=any>(path:string,method='GET',body?:unknown,timeoutMs=20000):Promise<T>{
 const token=await accountToken();let response:Response;
 try{response=await fetch(accountConfig.apiOrigin+'/api'+path,{method,credentials:'omit',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(timeoutMs)});}catch{throw new AccountError('CONNECTION_FAILED',path==='/ai/plan'?'Wandel AI is unavailable. Your draft is unchanged; retry or connect a local planner.':'Account server is unavailable. Your draft is unchanged; save temporarily or retry.');}
 const value=await response.json();if(!response.ok)throw new AccountError(value.error?.code||'REQUEST_FAILED',value.error?.message||'Please retry.');return value;
}
export async function signIn(){if(!accountConfig.publishableKey)throw new AccountError('AUTH_NOT_CONFIGURED','Add the Clerk keys to .env and rebuild Wandel. Temporary saves still work.');const result=await chrome.runtime.sendMessage({type:'WANDEL_ACCOUNT_SIGN_IN',tabId:Number(new URLSearchParams(location.search).get('tabId'))});if(result?.error)throw new Error(result.error);}
export async function startUpgrade(){const checkout=await accountAPI<{url:string}>('/billing/checkout','POST',{});const url=new URL(checkout.url);if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw new Error('Stripe test checkout is not available.');await chrome.tabs.create({url:url.href});}

export async function previewPlan(prompt:string,selection:{tag:string;label:string}){
 let token:string|undefined;
 try{token=await accountToken();}catch(e){if(!(e instanceof AccountError)||!['AUTH_REQUIRED','AUTH_NOT_CONFIGURED'].includes(e.code))throw e;}
 if(!token&&/\b(flow|workflow|journey|screens|multi.step|feature)\b/i.test(prompt))throw new AccountError('AUTH_REQUIRED','Sign in to Wandel to create a multi-step feature. Guest previews cover a single UI change. Your prompt is kept.');
 const requestId=crypto.randomUUID();
 let payload:Record<string,unknown>={prompt,selection,requestId};
 if(!token){
  const stored=await chrome.storage.local.get('wandelGuestId');let guestId=stored.wandelGuestId;
  if(typeof guestId!=='string'){guestId=crypto.randomUUID();await chrome.storage.local.set({wandelGuestId:guestId});}
  payload={...payload,guestId,selection:{tag:selection.tag,label:selection.label.slice(0,160)}};
 }
 let response:Response;
 try{response=await fetch(accountConfig.apiOrigin+'/api/ai/'+(token?'plan':'guest-plan'),{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(payload),signal:AbortSignal.timeout(60000)});}catch{throw new AccountError('CONNECTION_FAILED','AI is unavailable. Your draft is unchanged.');}
 const value=await response.json();if(!response.ok){if(typeof value.error?.remaining==='number'){await chrome.storage.local.set({wandelGuestRemaining:value.error.remaining});window.dispatchEvent(new Event('wandel-account-refresh'));}throw new AccountError(value.error?.code||'REQUEST_FAILED',value.error?.message||'Preview failed.');}
 if(value.guest){await chrome.storage.local.set({wandelGuestRemaining:value.remaining});window.dispatchEvent(new Event('wandel-account-refresh'));}
 return value;
}
