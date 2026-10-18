import {parentOf} from './dom';
/** Deliberately excludes input values, URLs, credentials and private DOM subtrees. */
export function cleanText(value:string,max=180){return value.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/ig,'[email]').replace(/\b(?:sk-|pk_|eyJ)[a-zA-Z0-9_.-]{12,}\b/g,'[credential]').replace(/\b(?:bearer\s+|(?:password|token|secret|api.?key)\s*[:=]\s*)\S+/ig,'[credential]').replace(/\b(?:\d[ -]?){13,19}\b/g,'[number]').replace(/\s+/g,' ').trim().slice(0,max);}
export const sensitive=(el:Element)=>{for(let node:HTMLElement|null=el as HTMLElement;node;node=parentOf(node))if(node.matches('[data-private],[data-sensitive],[autocomplete^="cc-"],input[type=password],input[type=hidden],script,style,[data-dx-ignore]'))return true;return false;};

export function contextName(el:HTMLElement){
 const aria=el.getAttribute('aria-label');if(aria)return cleanText(aria);
 if(el.matches('input,textarea,select'))return cleanText(el.getAttribute('placeholder')||el.getAttribute('name')||'');
 const walker=el.ownerDocument.createTreeWalker(el,NodeFilter.SHOW_TEXT);let text='',node:Node|null;
 while((node=walker.nextNode())&&text.length<500){const parent=node.parentElement;if(parent&&!sensitive(parent)&&!parent.closest('input,textarea,select,[contenteditable=true]'))text+=' '+node.textContent;}
 return cleanText(text);
}
