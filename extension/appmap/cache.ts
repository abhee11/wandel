/** The content script's copy of this site's app map, kept current from storage so describing the page stays synchronous. */
import type {AppMap} from './catalog';
let map:AppMap|null=null,started=false;
export function currentAppMap(){
 if(!started){started=true;try{
  const key='appMap:'+location.origin;
  void chrome.storage.local.get(key).then(stored=>{map=(stored[key] as AppMap|undefined)||null;}).catch(()=>{});
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&key in changes)map=(changes[key].newValue as AppMap|undefined)||null;});
 }catch{}}
 return map;
}
