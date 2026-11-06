/** Lets the panel copy an element from another open tab. Nothing is read from a tab until the user picks it and clicks an element there. */
const fromPanel=(sender:chrome.runtime.MessageSender)=>{
 if(sender.id!==chrome.runtime.id||!sender.url)return false;
 try{const url=new URL(sender.url),base=new URL(chrome.runtime.getURL(''));return url.origin===base.origin&&url.pathname==='/sidepanel.html';}catch{return false;}
};
async function focus(tabId:number){const tab=await chrome.tabs.update(tabId,{active:true});if(tab?.windowId!==undefined)await chrome.windows.update(tab.windowId,{focused:true});}
export function registerTabCopy(){
 chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(!['WANDEL_COPY_TABS','WANDEL_COPY_FROM'].includes(message?.type)||!fromPanel(sender))return;
  (async()=>{
   if(message.type==='WANDEL_COPY_TABS'){
    const tabs=await chrome.tabs.query({url:['http://*/*','https://*/*']});
    return {tabs:tabs.filter(tab=>tab.id!==message.current&&tab.id!==undefined&&tab.url).map(tab=>({id:tab.id,title:(tab.title||'').slice(0,80),host:new URL(tab.url!).hostname})).slice(0,30)};
   }
   const tabId=Number(message.tabId),back=Number(message.current);
   await focus(tabId);
   const ask=()=>chrome.tabs.sendMessage(tabId,{type:'WANDEL_COPY_PICK'},{frameId:0});
   // A tab opened before Wandel was installed or reloaded has no script yet.
   let result;try{result=await ask();}catch{await chrome.scripting.executeScript({target:{tabId,frameIds:[0]},files:['content.js']});await new Promise(resolve=>setTimeout(resolve,300));result=await ask();}
   await focus(back).catch(()=>{});
   return result;
  })().then(reply).catch(error=>reply({error:error instanceof Error?error.message:'That tab can’t be used. Reload it and try again.'}));
  return true;
 });
}
