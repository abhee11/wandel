/** Public link pages discover the installed build without exposing account tokens or requiring a fixed extension ID. */
export function registerShareRelay(apiOrigin:string){
 if(location.origin!==new URL(apiOrigin).origin||location.pathname!=='/flow'||window.top!==window)return;
 const ready=()=>window.postMessage({type:'WANDEL_SHARE_READY',extension:chrome.runtime.id},location.origin);
 const receive=(event:MessageEvent)=>{
  if(event.source!==window||event.origin!==location.origin)return;const m=event.data;
  if(m?.type==='WANDEL_SHARE_PROBE'){ready();return;}
  if(m?.type!=='WANDEL_SHARE_OPEN'||m.extension!==chrome.runtime.id||!/^[-a-f0-9]{36}$/.test(m.requestId)||!/^[a-f0-9]{64}$/.test(m.token))return;
  chrome.runtime.sendMessage({type:'WANDEL_OPEN_SHARED',token:m.token,requestId:m.requestId}).then(result=>window.postMessage({type:'WANDEL_SHARE_RESULT',requestId:m.requestId,...result},location.origin)).catch(()=>window.postMessage({type:'WANDEL_SHARE_RESULT',requestId:m.requestId,error:'Reload the updated Wandel extension and this link page, then retry.'},location.origin));
 };window.addEventListener('message',receive);ready();
 return ()=>window.removeEventListener('message',receive);
}
