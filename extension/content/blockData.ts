import type {BlockLogic} from '../shared/block';
import {expectHidden} from './visibility';
/** Prototype data for composed blocks: named text values shared across a prototype's screens, written by fields and clicks, and read by text, conditions and repeated parts. Lists are stored as JSON text. Nothing leaves the preview. */
type Data=Record<string,string>;
type Item=Record<string,string>;
const logicOf=(el:HTMLElement):BlockLogic=>JSON.parse(el.dataset.dxLogic||'{}');
const list=(data:Data,key:string):Item[]=>{try{const value=JSON.parse(data[key]||'[]');return Array.isArray(value)?value:[];}catch{return [];}};
/** A value by name; `name.count` is the length of a list. */
export function readValue(data:Data,key:string){return key.endsWith('.count')?String(list(data,key.slice(0,-6)).length):Object.hasOwn(data,key)?data[key]:'';}
const token=/\{\{([a-zA-Z][a-zA-Z0-9_.]*)\}\}/g;
export const fill=(text:string,data:Data)=>text.replace(token,(whole,key:string)=>key.startsWith('item.')?whole:readValue(data,key));
export const passes=(when:NonNullable<BlockLogic['when']>,data:Data)=>{const value=readValue(data,when.key),match=when.is===null||when.is===undefined?!!value.trim():value===when.is;return when.not?!match:match;};
/** The element a part's logic acts on: its field, for a labelled input or select. */
export const fieldOf=(part:HTMLElement)=>part.matches('input,textarea,select')?part as HTMLInputElement:part.querySelector<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>('input,textarea,select');
function fillItem(clone:HTMLElement,item:Item){
 const walk=document.createTreeWalker(clone,NodeFilter.SHOW_TEXT);
 for(let node=walk.nextNode();node;node=walk.nextNode())node.textContent=(node.textContent||'').replace(/\{\{item\.([a-zA-Z0-9_]+)\}\}/g,(_,key:string)=>item[key]??'');
}
function repeat(template:HTMLElement,key:string,data:Data){
 const raw=data[key]||'[]';if(template.dataset.dxRepeated===raw&&template.dataset.dxRepeatReady)return;
 template.dataset.dxRepeated=raw;template.dataset.dxRepeatReady='true';
 for(const old of template.parentElement?.querySelectorAll<HTMLElement>(`:scope > [data-dx-clone-of="${key}"]`)||[])old.remove();
 let after:HTMLElement=template;
 list(data,key).forEach((item,index)=>{
  const clone=template.cloneNode(true) as HTMLElement;clone.dataset.dxCloneOf=key;clone.dataset.dxItem=String(index);
  delete clone.dataset.dxLogic;delete clone.dataset.dxRepeated;delete clone.dataset.dxRepeatReady;clone.style.removeProperty('display');
  for(const owned of [clone,...clone.querySelectorAll<HTMLElement>('[data-dx-owned]')])delete owned.dataset.dxOwned;
  fillItem(clone,item);after.after(clone);after=clone;
 });
}
/** Brings every block part in line with the data: repeated parts, conditions and required values. */
export function syncBlocks(hosts:Iterable<HTMLElement>,data:Data){
 for(const host of hosts){
  for(const part of host.querySelectorAll<HTMLElement>('[data-dx-logic]')){
   const logic=logicOf(part);
   if(logic.repeat){expectHidden(part,'interaction');part.style.setProperty('display','none','important');repeat(part,logic.repeat,data);continue;}
   if(logic.when){const show=passes(logic.when,data);if(!show)expectHidden(part,'interaction');if(show)part.style.removeProperty('display');else part.style.setProperty('display','none','important');}
   if(logic.requires&&part instanceof HTMLButtonElement){const ready=logic.requires.every(key=>!!readValue(data,key).trim());part.disabled=!ready;part.style.opacity=ready?'':'.5';part.style.cursor=ready?'':'not-allowed';}
  }
 }
}
/** Applies what a click on a block part does to the data. Returns whether anything changed. */
export function dataClick(target:Element,data:Data){
 const part=target.closest<HTMLElement>('[data-dx-logic]'),clone=target.closest<HTMLElement>('[data-dx-item]');
 const inside=clone&&clone.dataset.dxCloneOf?clone:null,removing=target.closest<HTMLElement>('[data-dx-remove-item]');
 if(inside&&removing){const key=inside.dataset.dxCloneOf!,items=list(data,key);items.splice(Number(inside.dataset.dxItem),1);data[key]=JSON.stringify(items);return true;}
 if(!part)return false;
 const logic=logicOf(part);let changed=false;
 if(logic.bind&&!fieldOf(part)){
  const option=target.closest<HTMLElement>('[data-dx-choice]')?.dataset.dxChoice??target.closest<HTMLElement>('[data-dx-tab]')?.textContent?.trim();
  const flip=part.matches('[data-dx-toggle-switch],[data-dx-check]')?String(part.getAttribute('aria-checked')!=='true'):undefined,value=option??flip;
  if(value!==undefined){data[logic.bind]=value;changed=true;}
 }
 if(logic.add){const item:Item={};for(const field of logic.add.fields)item[field.key]=fill(field.value,data);data[logic.add.list]=JSON.stringify([...list(data,logic.add.list),item].slice(-50));changed=true;}
 for(const entry of logic.set||[]){data[entry.key]=fill(entry.value,data);changed=true;}
 return changed;
}
/** The values a screen's blocks own: closing that screen discards them, so opening it again starts fresh. */
export function screenDataKeys(operations:readonly {kind:string;node?:{block?:{data?:{key:string}[]|null;nodes:{logic?:BlockLogic|null}[]}}}[]){
 const keys=new Set<string>();
 for(const op of operations){const block=op.kind==='insert'?op.node?.block:undefined;if(!block)continue;for(const entry of block.data||[])keys.add(entry.key);for(const node of block.nodes){if(node.logic?.bind)keys.add(node.logic.bind);if(node.logic?.add)keys.add(node.logic.add.list);}}
 return keys;
}
