import type {LibraryComponent} from './store';
/** The team's component library as the page sees it, so a paste from the library is placed like any copied element.
 * The panel keeps it in extension storage (store.ts); this module only reads it. */
let components:LibraryComponent[]=[];
const key=()=>{try{return 'knowledge:library:'+location.origin;}catch{return '';}};
try{
 const area=typeof chrome!=='undefined'?chrome.storage?.local:undefined;
 void area?.get(key()).then(saved=>{components=(saved[key()] as LibraryComponent[]|undefined)||[];}).catch(()=>{});
 chrome.storage?.onChanged?.addListener((changes,name)=>{if(name==='local'&&changes[key()])components=(changes[key()].newValue as LibraryComponent[]|undefined)||[];});
}catch{/* no extension storage here */}
export const libraryComponent=(id:string)=>components.find(c=>c.id===id)||null;
/** For tests: what the page would see. */
export function setLibrary(list:LibraryComponent[]){components=list;}
