/** Codebase context lives in this browser, one entry per app origin, like the app map. */
import {addFile,validDocs,type AppDocs} from './docs';
export const docsKey=(origin:string)=>'appDocs:'+origin;
export async function readDocs(origin:string):Promise<AppDocs>{return validDocs((await chrome.storage.local.get(docsKey(origin)))[docsKey(origin)],origin);}
// Writes for one origin are chained so two uploads at once can't overwrite each other.
const writing=new Map<string,Promise<unknown>>();
function chain<T>(origin:string,work:()=>Promise<T>){const next=(writing.get(origin)||Promise.resolve()).catch(()=>{}).then(work);writing.set(origin,next);return next;}
export function saveDoc(origin:string,name:string,text:string){
 return chain(origin,async()=>{const result=addFile(await readDocs(origin),name,text);await chrome.storage.local.set({[docsKey(origin)]:result.docs});return result;});
}
export function removeDoc(origin:string,name:string){
 return chain(origin,async()=>{const docs=await readDocs(origin),files=docs.files.filter(file=>file.name!==name);
  if(files.length)await chrome.storage.local.set({[docsKey(origin)]:{...docs,files,updatedAt:new Date().toISOString()}});else await chrome.storage.local.remove(docsKey(origin));});
}
