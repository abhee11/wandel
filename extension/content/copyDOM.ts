import {renderIcon} from './copyIcon';
import type {CopyNode} from '../shared/model';
/** Render only validated copy data, with no host handlers, credentials, or executable markup. */
export function copyDOM(items:CopyNode[],owned?:Map<string,HTMLElement>):HTMLElement{
 const built:Node[]=[];
 for(const item of items){
  const node=item.tag==='#text'?document.createTextNode(item.text):document.createElement(item.tag);
  if(node instanceof HTMLElement){
   node.dataset.dxOwned=item.id;
   if(item.icon)node.append(renderIcon(item.icon));
   if(item.role)node.setAttribute('role',item.role);
   if(item.disabled){node.setAttribute('aria-disabled','true');if(node instanceof HTMLButtonElement||node instanceof HTMLInputElement||node instanceof HTMLTextAreaElement)node.disabled=true;}
   if(node instanceof HTMLAnchorElement&&item.href){node.href=item.href;node.rel='noopener noreferrer';}
   for(const [key,value] of Object.entries(item.style))node.style.setProperty(key,value,'important');
   if(!item.icon){const iconOnly=items.some(part=>part.parent===items.indexOf(item)&&!!part.icon)&&!items.some(part=>part.parent===items.indexOf(item)&&part.tag==='#text'&&part.text.trim());if(!node.matches('img,input,br')&&!iconOnly)node.style.height='auto';if(node.matches('h1,h2,h3,h4,p,span,strong,em,small'))node.style.width='auto';node.style.maxWidth='100%';node.style.minWidth='0';node.style.boxSizing='border-box';if(item.parent<0)node.style.flexShrink='0';}
   if(node instanceof HTMLButtonElement)node.type='button';
   if(node instanceof HTMLImageElement){node.referrerPolicy='no-referrer';node.alt=item.alt||'';if(item.src)node.src=item.src;node.draggable=false;}
   if(node instanceof HTMLInputElement||node instanceof HTMLTextAreaElement){if(node instanceof HTMLInputElement)node.type=item.inputType||'text';node.placeholder=item.placeholder||'';node.autocomplete='off';node.addEventListener('keydown',e=>{if((e as KeyboardEvent).key==='Enter')e.preventDefault();});}
   owned?.set(item.id,node);
  }
  if(item.parent>=0)built[item.parent].appendChild(node);built.push(node);
 }
 return built[0] as HTMLElement;
}
