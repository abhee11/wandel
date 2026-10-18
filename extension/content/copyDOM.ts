import type {CopyNode} from '../shared/model';
/** Render only validated copy data, with no host handlers, credentials, or executable markup. */
export function copyDOM(items:CopyNode[],owned?:Map<string,HTMLElement>):HTMLElement{
 const built:Node[]=[];
 for(const item of items){
  const node=item.tag==='#text'?document.createTextNode(item.text):document.createElement(item.tag);
  if(node instanceof HTMLElement){
   node.dataset.dxOwned=item.id;
   if(item.role)node.setAttribute('role',item.role);
   if(node instanceof HTMLAnchorElement&&item.href){node.href=item.href;node.rel='noopener noreferrer';}
   for(const [key,value] of Object.entries(item.style))node.style.setProperty(key,value,'important');
   if(node instanceof HTMLButtonElement)node.type='button';
   if(node instanceof HTMLImageElement){node.referrerPolicy='no-referrer';node.alt=item.alt||'';if(item.src)node.src=item.src;node.draggable=false;}
   if(node instanceof HTMLInputElement||node instanceof HTMLTextAreaElement){if(node instanceof HTMLInputElement)node.type=item.inputType||'text';node.placeholder=item.placeholder||'';node.autocomplete='off';node.addEventListener('keydown',e=>{if((e as KeyboardEvent).key==='Enter')e.preventDefault();});}
   owned?.set(item.id,node);
  }
  if(item.parent>=0)built[item.parent].appendChild(node);built.push(node);
 }
 return built[0] as HTMLElement;
}
