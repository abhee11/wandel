import {captureCopy} from './duplicate';
import {sensitive} from '../assistant/privacy';
import type {CopyNode} from '../shared/model';
/** An element the user picked in one tab, ready to place in another. Only its look and text come along: never the site's code, form values or data. */
export interface CopiedElement{copy:CopyNode[];label:string;from:string}
const storageKey='wandelCopiedElement';
let held:CopiedElement|null=null;
const storage=()=>{try{return typeof chrome==='undefined'?undefined:chrome.storage;}catch{return undefined;}};
try{
 void storage()?.local.get(storageKey).then(saved=>{held=saved[storageKey]||null;}).catch(()=>{});
 storage()?.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[storageKey])held=changes[storageKey].newValue||null;});
}catch{/* no extension storage here */}
export const copiedElement=()=>held;
const ours=(node:Element)=>!!node.closest('[data-dx-ignore],[data-dx-owned]');
/** What a click most likely means: the smallest thing around it big enough to be a component. */
function component(start:Element){
 let el:Element|null=start;
 while(el&&el.parentElement&&!el.matches('body,html')){const box=el.getBoundingClientRect();if(box.width>=120&&box.height>=48)return el;el=el.parentElement;}
 return start;
}
/** One pick on this page. Clicks do nothing else while it runs, so a picked link or button never fires. */
export function pickElement():Promise<{ok?:true;canceled?:true;error?:string}>{
 return new Promise(done=>{
  const frame=document.createElement('div'),banner=document.createElement('div');frame.dataset.dxIgnore=banner.dataset.dxIgnore='true';
  frame.style.cssText='position:fixed;z-index:2147483646;pointer-events:none;border:2px solid #5b5bd6;background:#5b5bd61a;border-radius:6px;display:none;box-sizing:border-box';
  banner.setAttribute('role','status');banner.textContent='Click what you want to copy. ↑ picks something bigger, ↓ smaller, Esc cancels.';
  banner.style.cssText='position:fixed;z-index:2147483647;top:16px;left:50%;transform:translateX(-50%);padding:10px 16px;border-radius:10px;background:#1e1b2e;color:#fff;font:500 13px/1.4 system-ui;box-shadow:0 8px 28px #0003;pointer-events:none';
  document.documentElement.append(frame,banner);
  let current:Element|null=null;const trail:Element[]=[];
  const show=(el:Element)=>{current=el;const box=el.getBoundingClientRect();frame.style.cssText+=`;display:block;left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px`;};
  const stop=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();};
  const over=(event:Event)=>{const el=event.target;if(el instanceof Element&&!ours(el)){trail.length=0;show(component(el));}};
  const finish=(result:{ok?:true;canceled?:true;error?:string})=>{for(const type of ['pointerdown','mousedown','pointerup','mouseup','auxclick'])window.removeEventListener(type,stop,true);window.removeEventListener('mouseover',over,true);window.removeEventListener('click',click,true);window.removeEventListener('keydown',key,true);frame.remove();banner.remove();done(result);};
  const click=(event:Event)=>{
   stop(event);const el=current;if(!(el instanceof HTMLElement))return;
   if(sensitive(el)||el.querySelector('input[type=password],[autocomplete^="cc-"]')){finish({error:'That part of the page is private, so Wandel won’t copy it.'});return;}
   try{
    const value:CopiedElement={copy:captureCopy(el),label:(el.getAttribute('aria-label')||el.textContent||'Element').replace(/\s+/g,' ').trim().slice(0,60)||'Element',from:location.hostname};
    void storage()?.local.set({[storageKey]:value}).then(()=>finish({ok:true})).catch(()=>finish({error:'Wandel couldn’t keep that element.'}));
   }catch(error){finish({error:error instanceof Error?error.message:'That element can’t be copied.'});}
  };
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){stop(event);finish({canceled:true});return;}
   if(event.key==='ArrowUp'&&current?.parentElement&&!current.parentElement.matches('body,html')){stop(event);trail.push(current);show(current.parentElement);}
   if(event.key==='ArrowDown'&&trail.length){stop(event);show(trail.pop()!);}
  };
  for(const type of ['pointerdown','mousedown','pointerup','mouseup','auxclick'])window.addEventListener(type,stop,true);
  window.addEventListener('mouseover',over,true);window.addEventListener('click',click,true);window.addEventListener('keydown',key,true);
 });
}
