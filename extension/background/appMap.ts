import {recordObservations,syncInjection,validObservations} from '../appmap/store';
/** Keeps the watcher registered on switched-on domains and stores what it learns. */
export function registerAppMap(){
 chrome.runtime.onInstalled.addListener(()=>{void syncInjection().catch(console.error);});
 chrome.runtime.onStartup.addListener(()=>{void syncInjection().catch(console.error);});
 chrome.runtime.onMessage.addListener((message,sender)=>{
  if(message?.type!=='WANDEL_APP_MAP_OBSERVATIONS'||sender.id!==chrome.runtime.id||sender.frameId!==0||!sender.url)return;
  // The origin comes from Chrome, never from the message, so a page can only add to its own map.
  let origin:string;try{origin=new URL(sender.url).origin;}catch{return;}
  const observations=validObservations(message.observations);
  if(observations.length)void recordObservations(origin,observations);
 });
}
