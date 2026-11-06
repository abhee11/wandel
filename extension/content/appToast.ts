/** The look of the app's own toast, learned the first time one appears, so a prototype toast matches it. Only styling is kept, never the message. */
export type ToastLook=Record<string,string>;
const toastLike='[role=alert],[role=status],[class*=toast i],[class*=snackbar i],[class*=notistack i],[data-sonner-toast]';
const keys=['background-color','color','border','border-radius','box-shadow','padding','font-family','font-size','font-weight','line-height','letter-spacing','min-height','height'];
const key='wandel:app-toast:'+location.origin;
let look:ToastLook|null=null;
export const appToastLook=()=>look;
const painted=(css:CSSStyleDeclaration)=>css.backgroundColor!=='rgba(0, 0, 0, 0)'&&css.backgroundColor!=='transparent';
/** A toast floats over the page: it sits near the top or bottom edge, and it or a parent is pinned to the screen. */
function floats(el:HTMLElement){
 const r=el.getBoundingClientRect();if(r.width<60||r.height<24||r.height>140||r.width>innerWidth*.8)return false;
 if(r.top>160&&r.bottom<innerHeight-160)return false;
 for(let node:HTMLElement|null=el;node;node=node.parentElement)if(getComputedStyle(node).position==='fixed')return true;
 return false;
}
function read(el:HTMLElement):ToastLook|null{
 const surface=[el,...el.querySelectorAll<HTMLElement>('*')].find(node=>painted(getComputedStyle(node))&&floats(node));
 if(!surface)return null;
 const css=getComputedStyle(surface),found:ToastLook={},r=surface.getBoundingClientRect();
 for(const name of keys){const value=css.getPropertyValue(name);if(value&&value.length<=300&&!/url\s*\(/i.test(value))found[name]=value;}
 const centre=r.left+r.width/2;
 found['--align']=Math.abs(centre-innerWidth/2)<innerWidth*.12?'center':centre<innerWidth/2?'left':'right';
 found['--edge']=r.top<innerHeight/2?'top':'bottom';
 found['--offset']=Math.round(found['--edge']==='top'?r.top:innerHeight-r.bottom)+'px';
 found['--inset']=Math.round(centre<innerWidth/2?r.left:innerWidth-r.right)+'px';
 const icon=[...surface.querySelectorAll<HTMLElement>('*')].map(node=>getComputedStyle(node).backgroundImage).find(image=>/^url\("https:/.test(image));
 if(icon&&icon.length<=300)found['--icon']=icon;
 return found;
}
export function rememberAppToasts(){
 try{chrome.storage?.local.get(key).then(saved=>{if(saved[key]&&!look)look=saved[key] as ToastLook;}).catch(()=>{});}catch{/* no extension storage on a test page */}
 new MutationObserver(records=>{
  for(const record of records)for(const node of record.addedNodes){
   if(!(node instanceof HTMLElement)||node.closest('[data-dx-ignore],[data-dx-owned]'))continue;
   const el=node.matches(toastLike)?node:node.querySelector<HTMLElement>(toastLike);if(!el)continue;
   // Wait out its entrance animation before reading how it looks.
   setTimeout(()=>{if(!el.isConnected)return;const found=read(el);if(!found)return;look=found;try{chrome.storage?.local.set({[key]:found}).catch(()=>{});}catch{/* as above */}},450);
  }
 }).observe(document.documentElement,{childList:true,subtree:true});
}
