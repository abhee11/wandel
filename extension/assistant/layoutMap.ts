import {deepElements} from './dom';
import {contextName,sensitive} from './privacy';
import {shownOnScreen} from '../content/nativeDesign';
/** The page's layout structures, named in plain words, so the assistant can say "the card grid" or "the option list" instead of guessing one element. */
export type LayoutKind='grid'|'row'|'list';
export interface Structure{container:HTMLElement;kind:LayoutKind;items:HTMLElement[];columns:number;name:string}
const listSemantics='ul,ol,[role=list],[role=menu],[role=listbox],[role=tablist],[role=radiogroup],[role=group]';
const itemSemantics='li,[role=listitem],[role=option],[role=menuitem],[role=menuitemradio],[role=menuitemcheckbox],[role=tab],[role=radio]';
const signature=(el:Element)=>el.tagName+'|'+(typeof el.className==='string'?el.className.trim().split(/\s+/)[0]||'':'');
const box=(el:Element)=>el.getBoundingClientRect();
// The browser's own visibility test is fast enough for a whole-page scan; aria-hidden content still counts, since it is on screen.
const shown=(el:HTMLElement)=>typeof el.checkVisibility==='function'?el.checkVisibility({checkVisibilityCSS:true} as CheckVisibilityOptions):shownOnScreen(el);
const usable=(el:Element):el is HTMLElement=>el instanceof HTMLElement&&box(el).width>8&&box(el).height>8&&!el.closest('[data-dx-ignore]')&&shown(el)&&!sensitive(el);
/** What kind of structure an element lays its children out as, if any. */
export function structureOf(container:HTMLElement):Structure|null{
 if(!container.childElementCount||!usable(container)||container.matches('html,body,svg,svg *,button,a,p,span,h1,h2,h3,h4,h5,h6,label'))return null;
 const items=[...container.children].filter(usable);if(!items.length)return null;
 const css=getComputedStyle(container),semantic=container.matches(listSemantics)||items.every(item=>item.matches(itemSemantics));
 const tracks=css.display.includes('grid')?css.gridTemplateColumns.split(/\s+(?![^(]*\))/).filter(Boolean).length:0;
 const sideBySide=items.length>=2&&items.every((item,i)=>i===0||Math.abs(box(item).top-box(items[0]).top)<8);
 const alike=items.length>=2&&items.filter(item=>signature(item)===signature(items[0])).length>=Math.max(2,Math.ceil(items.length*0.6));
 let kind:LayoutKind|null=null,columns=1;
 if(tracks>=2&&items.length>=2){kind='grid';columns=tracks;}
 else if(/flex/.test(css.display)&&/^row/.test(css.flexDirection)&&sideBySide&&(alike||items.length>=2)&&items.some(item=>box(item).width>120)){kind='row';columns=items.length;}
 else if(semantic||alike&&!sideBySide){kind='list';}
 if(!kind)return null;
 const labels=items.slice(0,3).map(item=>contextName(item).slice(0,40)).filter(Boolean);
 const big=items.reduce((sum,item)=>sum+box(item).height,0)/items.length>140;
 const what=kind==='grid'?`${columns}-column grid of ${items.length}`:kind==='row'?`row of ${items.length}`:big?`stack of ${items.length} sections`:`list of ${items.length} item${items.length===1?'':'s'}`;
 return {container,kind,items,columns,name:`${what}: ${labels.join(', ')}${items.length>3?', …':''}`.slice(0,160)};
}
/** The nearest structure an element belongs to as an item (or is), climbing a few levels. */
export function structureAround(node:HTMLElement){
 for(let el:HTMLElement|null=node,depth=0;el&&depth<6;el=el.parentElement,depth++){
  // A wrapper around a single item (an li around its button) is not the structure when its parent is: the parent list wins.
  const own=depth===0?structureOf(el):null,parent:HTMLElement|null=el.parentElement,around:Structure|null=parent?structureOf(parent):null;
  if(own&&own.items.length>=2)return own;
  if(around&&around.items.includes(el))return around;
  if(own)return own;
 }
 return null;
}
/** Structures on the page, most relevant first: those holding what the request or selection names, those in an open dialog, then the largest. */
export function layoutStructures(root:HTMLElement,focus:HTMLElement[],limit=8):Structure[]{
 const found=new Map<HTMLElement,Structure>();
 for(const el of deepElements(root,'*').slice(0,5000)){if(found.size>60)break;const s=structureOf(el);if(s&&s.items.some(item=>box(item).width*box(item).height>1200))found.set(el,s);}
 // A structure inside another with the same items adds nothing.
 const all=[...found.values()].filter(s=>!(s.items.length===1&&found.has(s.items[0])));
 const dialog=(s:Structure)=>!!s.container.closest('[role=dialog],[role=alertdialog],[aria-modal=true],dialog[open]');
 const score=(s:Structure)=>(focus.some(node=>s.container.contains(node))?4:0)+(dialog(s)?3:0)+Math.min(2,box(s.container).width*box(s.container).height/400000);
 return all.sort((a,b)=>score(b)-score(a)).slice(0,limit);
}
