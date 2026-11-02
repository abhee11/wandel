export {};
/** A full extension tab provides an explicit, visible place for Chrome's permission prompt. */
const allow=document.querySelector<HTMLButtonElement>('#allow')!;
const status=document.querySelector<HTMLElement>('#status')!;
allow.addEventListener('click',async()=>{
 allow.disabled=true;status.textContent='Choose Allow in Chrome’s microphone prompt.';
 try{
  const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
  stream.getTracks().forEach(track=>track.stop());
  status.textContent='Microphone enabled. Click Return to Wandel below, then click Start speaking in the assistant. No audio was saved or sent during setup.';
  allow.textContent='Microphone enabled';
  const back=document.querySelector<HTMLButtonElement>('#return');if(back)back.hidden=false;
 }catch(error){
  status.textContent=error instanceof DOMException&&error.name==='NotAllowedError'?'Access was blocked or dismissed. Allow the microphone for this extension in Chrome’s site settings, and allow Chrome in macOS System Settings → Privacy & Security → Microphone. Then retry.':'Microphone unavailable. Check that a microphone is connected, then retry.';
  allow.disabled=false;
 }
});

const settings=document.querySelector<HTMLButtonElement>('#settings');
settings?.addEventListener('click',()=>{
 void chrome.tabs.create({url:'chrome://settings/content/siteDetails?site='+encodeURIComponent(chrome.runtime.getURL(''))}).catch(()=>{status.textContent='Open Chrome Settings → Privacy and security → Site settings → Microphone to allow Wandel.';});
});

const back=document.querySelector<HTMLButtonElement>('#return');
back?.addEventListener('click',async()=>{
 const params=new URL(location.href).searchParams,tab=params.get('returnTab'),owner=params.get('returnWindow');
 try{
  if(owner&&/^\d+$/.test(owner))await chrome.windows.update(Number(owner),{focused:true});
  if(tab&&/^\d+$/.test(tab))await chrome.tabs.update(Number(tab),{active:true});
  window.close();
 }catch{status.textContent='Your original tab was closed. Close this setup window and reopen Wandel on your app.';}
});
