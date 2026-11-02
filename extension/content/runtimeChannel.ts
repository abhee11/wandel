/** Chrome can throw synchronously after an extension update, before returning a Promise. */
export function createRuntimeChannel(onInvalidated:()=>void){
 let stopped=false;
 const invalidate=()=>{if(stopped)return;stopped=true;onInvalidated();};
 const available=()=>{if(stopped)return false;try{if(chrome.runtime.id)return true;}catch{/* Old isolated world. */}invalidate();return false;};
 const handle=(error:unknown)=>{if(/extension context invalidated/i.test(error instanceof Error?error.message:String(error)))invalidate();};
 async function send(message:unknown){
  if(!available())throw new Error('Wandel was updated. Reload this page to reconnect.');
  try{return await chrome.runtime.sendMessage(message);}catch(error){handle(error);throw error;}
 }
 return {send,available,handle};
}
