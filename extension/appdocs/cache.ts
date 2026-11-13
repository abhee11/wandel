/** The content script's copy of this site's codebase context, kept current from storage so describing the page stays synchronous. */
import {validDocs,type AppDocs} from './docs';
let docs:AppDocs|null=null,started=false;
export function currentAppDocs(){
 if(!started){started=true;try{
  const key='appDocs:'+location.origin;
  void chrome.storage.local.get(key).then(stored=>{docs=stored[key]?validDocs(stored[key],location.origin):null;}).catch(()=>{});
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&key in changes)docs=changes[key].newValue?validDocs(changes[key].newValue,location.origin):null;});
 }catch{}}
 return docs;
}
