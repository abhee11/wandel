/** Keep permission UI outside the app's tab strip so the editor stays attached to its target. */
export async function openMicrophoneSetup(){
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
 const url=new URL(chrome.runtime.getURL('microphone.html'));
 if(tab?.id!==undefined)url.searchParams.set('returnTab',String(tab.id));
 if(tab?.windowId!==undefined)url.searchParams.set('returnWindow',String(tab.windowId));
 await chrome.windows.create({url:url.href,type:'popup',width:560,height:520,focused:true});
}
export async function prepareMicrophone():Promise<boolean>{
 if(typeof chrome==='undefined'||!chrome.runtime?.id||location.protocol!=='chrome-extension:')return true;
 let permission:PermissionStatus;
 try{permission=await navigator.permissions.query({name:'microphone' as PermissionName});}catch{return true;}
 if(permission.state==='granted')return true;
 await openMicrophoneSetup();
 return false;
}
const consentKey='wandel:voice-sharing:v2';
export function voiceSharingAllowed(){try{return sessionStorage.getItem(consentKey)==='allowed';}catch{return false;}}
export function rememberVoiceSharing(allowed:boolean){try{if(allowed)sessionStorage.setItem(consentKey,'allowed');else sessionStorage.removeItem(consentKey);}catch{/* Current mounted panel still keeps the choice. */}}

const aiConsentKey='wandel:ai-sharing:v1';
export function aiSharingAllowed(){try{return sessionStorage.getItem(aiConsentKey)==='allowed';}catch{return false;}}
export function rememberAISharing(allowed:boolean){try{if(allowed)sessionStorage.setItem(aiConsentKey,'allowed');else sessionStorage.removeItem(aiConsentKey);}catch{/* Mounted panel retains its choice. */}}
