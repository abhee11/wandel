import {accountConfig} from '../shared/accountConfig';
export class AccountError extends Error {constructor(public code:string,message:string){super(message);}}
export async function accountToken(){const result=await chrome.runtime.sendMessage({type:'WANDEL_ACCOUNT_TOKEN'});if(result?.error)throw new AccountError('AUTH_NOT_CONFIGURED',result.error);if(!result?.token)throw new AccountError('AUTH_REQUIRED','Sign in to save across browsers and devices.');return result.token as string;}
export async function accountAPI<T=any>(path:string,method='GET',body?:unknown):Promise<T>{
 const token=await accountToken();let response:Response;
 try{response=await fetch(accountConfig.apiOrigin+'/api'+path,{method,credentials:'omit',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});}catch{throw new AccountError('CONNECTION_FAILED','Account server is unavailable. Your draft is unchanged; save temporarily or retry.');}
 const value=await response.json();if(!response.ok)throw new AccountError(value.error?.code||'REQUEST_FAILED',value.error?.message||'Please retry.');return value;
}
export async function signIn(){if(!accountConfig.publishableKey)throw new AccountError('AUTH_NOT_CONFIGURED','Add the Clerk keys to .env and rebuild Wandel. Temporary saves still work.');await chrome.tabs.create({url:accountConfig.appOrigin+'/extension/sign-in'});}
export async function startUpgrade(){const checkout=await accountAPI<{url:string}>('/billing/checkout','POST',{});const url=new URL(checkout.url);if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw new Error('Stripe test checkout is not available.');await chrome.tabs.create({url:url.href});}
