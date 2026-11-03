import {captureCopy} from './duplicate';
import {sensitive} from '../assistant/privacy';
import {uid,type CopyNode} from '../shared/model';
/** What one real click opened, captured so a prototype can recreate it. Only what was visible comes along, never the app's code or data connections. */
export type WatchKind='modal'|'drawer'|'popover'|'toast';
export interface Watched {id:string;kind:WatchKind;side?:'left'|'right';title:string;outline:string;copy:CopyNode[];closes:boolean;width:number;trigger:string}
let latest:Watched|null=null;
export const watched=()=>latest;
export const clearWatched=()=>{latest=null;};
const wandel=(node:Element)=>!!node.closest('[data-dx-ignore],[data-dx-owned]');
const dialogLike='[role=dialog],[role=alertdialog],[aria-modal=true],dialog[open]';
const closer=/^(close|cancel|done|dismiss|×|✕|x)$/i;
function shown(el:Element):el is HTMLElement{
 if(!(el instanceof HTMLElement)||!el.isConnected)return false;const r=el.getBoundingClientRect(),css=getComputedStyle(el);
 return r.width>=60&&r.height>=40&&css.display!=='none'&&css.visibility!=='hidden'&&Number(css.opacity)>0.05;
}
const area=(el:Element)=>{const r=el.getBoundingClientRect();return r.width*r.height;};
/** An overlay that covers the viewport is a backdrop or wrapper: the result is the surface inside it. */
function surfaceOf(start:HTMLElement){
 let el=start;
 for(let depth=0;depth<8;depth++){
  const r=el.getBoundingClientRect();if(r.width<innerWidth*.9||r.height<innerHeight*.9)break;
  const inner=[...el.querySelectorAll<HTMLElement>(dialogLike)].filter(node=>node!==el&&shown(node)&&area(node)<area(el)*.9)[0];
  const child=inner||[...el.children].filter(shown).sort((a,b)=>area(b)-area(a))[0];if(!child)break;el=child;
 }
 return el;
}
function kindOf(el:HTMLElement):{kind:WatchKind;side?:'left'|'right'}{
 const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
 if((r.right>=innerWidth-4||r.left<=4)&&r.height>=innerHeight*.7&&r.width<=innerWidth*.7)return {kind:'drawer',side:r.left<=4&&r.right<innerWidth-4?'left':'right'};
 if(el.matches(dialogLike)||el.closest(dialogLike)||Math.abs(cx-innerWidth/2)<innerWidth*.12&&Math.abs(cy-innerHeight/2)<innerHeight*.2&&r.width*r.height>innerWidth*innerHeight*.06)return {kind:'modal'};
 if(r.height<140&&(r.top<120||r.bottom>innerHeight-120))return {kind:'toast'};
 return {kind:'popover'};
}
function describeResult(el:HTMLElement){
 const label=(node:Element)=>(node.getAttribute('aria-label')||node.textContent||'').replace(/\s+/g,' ').trim();
 const labelled=el.getAttribute('aria-labelledby')?.split(/\s+/).map(id=>document.getElementById(id)?.textContent?.trim()).filter(Boolean).join(' ');
 const title=(el.querySelector('h1,h2,h3,h4,h5,[role=heading]')?.textContent||labelled||el.getAttribute('aria-label')||el.textContent||'').replace(/\s+/g,' ').trim().slice(0,80)||'Captured view';
 const fields=[...el.querySelectorAll('input:not([type=hidden]),textarea,select')].filter(shown).length;
 const buttons=[...el.querySelectorAll<HTMLElement>('button,a,[role=button]')].filter(node=>node.getBoundingClientRect().width>0&&getComputedStyle(node).visibility!=='hidden').map(label).filter(Boolean);
 const outline=[fields?`${fields} field${fields>1?'s':''}`:'',buttons.length?'buttons: '+buttons.slice(0,6).join(', '):''].filter(Boolean).join(' · ')||'text only';
 return {title,outline,closes:buttons.some(text=>closer.test(text))};
}
/** Watches for the next real click on the page and reports what it opened. Returns a function that stops watching. */
export function watchNextClick(done:(result:Watched|{error:string})=>void){
 let observer:MutationObserver|undefined,quiet:ReturnType<typeof setTimeout>|undefined,limit:ReturnType<typeof setTimeout>|undefined,trigger:HTMLElement|null=null;
 const added=new Set<Element>(),changed=new Set<Element>();
 const stop=()=>{window.removeEventListener('click',onClick,true);observer?.disconnect();clearTimeout(quiet);clearTimeout(limit);};
 const finish=()=>{stop();try{done(result());}catch(error){done({error:error instanceof Error?error.message:'Nothing could be captured from that click.'});}};
 const result=():Watched|{error:string}=>{
  const near=(el:Element)=>!!trigger&&(el.contains(trigger)||trigger.contains(el));
  const moved=(el:Element)=>{if(!(el instanceof HTMLElement))return false;const position=getComputedStyle(el).position;return el.matches(dialogLike)||position==='fixed'||position==='absolute';};
  const candidates=[...added,...[...changed].filter(moved)].filter(el=>!el.matches('html,body,head')&&!wandel(el)&&!near(el)&&shown(el));
  const outer=candidates.filter(el=>!candidates.some(other=>other!==el&&other.contains(el)));
  const best=outer.sort((a,b)=>(Number(b.matches(dialogLike)||!!b.querySelector(dialogLike))-Number(a.matches(dialogLike)||!!a.querySelector(dialogLike)))||area(b)-area(a))[0];
  if(!best)return {error:'Nothing new appeared after that click. Try a control that opens a modal, panel or menu.'};
  const el=surfaceOf(best as HTMLElement);
  if(sensitive(el)||el.querySelector('[data-private],[data-sensitive],input[type=password]'))return {error:'What opened holds private content, so Wandel did not capture it.'};
  const {kind,side}=kindOf(el),{title,outline,closes}=describeResult(el),width=Math.round(el.getBoundingClientRect().width);
  const copy=captureCopy(el);
  // The copy is a prototype: no real links, and its surface sits wherever the prototype places it.
  for(const item of copy)delete item.href;
  const root=copy[0].style as Record<string,string|undefined>;for(const key of ['position','top','right','bottom','left','transform','z-index','inset','translate'])delete root[key];
  Object.assign(copy[0].style,{margin:'0','max-width':'100%',width:width+'px','box-sizing':'border-box'});
  return latest={id:uid(),kind,...(side?{side}:{}),title,outline,copy,closes,width,trigger:(trigger?.getAttribute('aria-label')||trigger?.textContent||'').replace(/\s+/g,' ').trim().slice(0,80)};
 };
 const onClick=(event:MouseEvent)=>{
  const target=event.target instanceof Element?event.target:null;if(!target||wandel(target))return;
  window.removeEventListener('click',onClick,true);trigger=target.closest<HTMLElement>('button,a,[role=button],[role=link],[role=tab],summary')||(target as HTMLElement);
  observer=new MutationObserver(records=>{for(const record of records){if(record.type==='childList')record.addedNodes.forEach(node=>{if(node instanceof Element)added.add(node);});else if(record.target instanceof Element)changed.add(record.target);}clearTimeout(quiet);quiet=setTimeout(finish,500);});
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class','hidden','open','aria-hidden','aria-modal','data-state']});
  // A click that changes nothing still finishes, with nothing found.
  quiet=setTimeout(finish,700);limit=setTimeout(finish,3000);
 };
 window.addEventListener('click',onClick,true);
 return stop;
}
