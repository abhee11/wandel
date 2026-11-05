import {deepElements} from '../assistant/dom';
import type { Locator, Selection } from '../shared/model';
const normalize = (text:string|null|undefined,max=300) => (text||'').replace(/\s+/g,' ').trim().slice(0,max);
const forbidden = 'script,style,noscript,input,textarea,select,option,[contenteditable="true"],[data-dx-ignore]';
export function safeText(el:Element|null,max=300):string {
  if(!el || el.matches(forbidden)) return '';
  const walker=el.ownerDocument.createTreeWalker(el,NodeFilter.SHOW_TEXT);
  let out='',node:Node|null;
  while((node=walker.nextNode()) && out.length < max*2) {
    const p=node.parentElement;
    if(p && !p.closest(forbidden) && !p.closest('[data-dx-owned]')) out+=' '+node.textContent;
  }
  return normalize(out,max);
}
export const roleOf=(el:Element)=>el.getAttribute('role') || ({BUTTON:'button',A:'link',NAV:'navigation',MAIN:'main',ASIDE:'complementary',H1:'heading',H2:'heading',H3:'heading'}[el.tagName]||'');
export function nameOf(el:Element) {
  if(el instanceof HTMLImageElement&&el.alt)return normalize(el.alt);
  const aria=el.getAttribute('aria-label'); if(aria) return normalize(aria);
  const labelled=el.getAttribute('aria-labelledby');
  if(labelled) return normalize(labelled.split(/\s+/).map(id=>safeText(el.ownerDocument.getElementById(id))).join(' '));
  if(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement||el instanceof HTMLSelectElement){const label=Array.from(el.labels||[]).map(label=>safeText(label)).join(' ');return normalize(label||el.getAttribute('placeholder')||el.getAttribute('name'));}
  return safeText(el);
}
function ancestorTags(el:Element){const tags:string[]=[];for(let node=el.parentElement;node&&tags.length<32;node=node.parentElement)tags.push(node.tagName.toLowerCase());return tags;}
export function structuralIdentity(el:Element):Locator['structure'] {
  const path:number[]=[];
  for(let node=el;node.parentElement&&path.length<32;node=node.parentElement){
    const parent=node.parentElement;path.unshift([...parent.children].indexOf(node));
    if(parent.id&&[...parent.ownerDocument.querySelectorAll('[id]')].filter(n=>n.id===parent.id).length===1)return {anchorId:parent.id,path};
  }
  return undefined;
}
export function describe(el:Element,ownedId?:string):Selection {
  const parent=el.parentElement;
  const attrs:Locator['attrs']={};
  for(const key of ['id','data-testid','data-test','data-qa','data-block-id','alt','src','name','type','placeholder','aria-label'] as const) { const v=el.getAttribute(key); if(v && v.length<=2048) attrs[key]=v; }
  const fieldLabel=el.matches('input,textarea,select')?el.closest('label')?.textContent:undefined;
  const text=ownedId?normalize(el.getAttribute('data-dx-label')||fieldLabel||el.getAttribute('aria-label')||el.getAttribute('placeholder')||el.textContent):safeText(el);
  const locator:Locator={ancestorTags:ancestorTags(el),owned:ownedId,tag:el.tagName.toLowerCase(),role:roleOf(el),name:ownedId?text:nameOf(el),text,attrs,parent:{tag:parent?.tagName.toLowerCase()||'',id:parent?.id||'',role:parent?roleOf(parent):'',label:parent?.getAttribute('aria-label')||''},previous:safeText(el.previousElementSibling,100),next:safeText(el.nextElementSibling,100)};
  const popup=el.closest('[role=listbox],[role=menu]');
  if(popup)locator.popup={role:popup.getAttribute('role') as 'listbox'|'menu',id:popup.id,label:popup.getAttribute('aria-label')||''};
  return {locator,label:locator.name||text||locator.tag,tag:locator.tag,owned:!!ownedId};
}
function parentScore(el:Element,l:Locator) {
  const p=el.parentElement; if(!p) return 0;
  return (l.parent.id && p.id===l.parent.id?25:0)+(l.parent.role && roleOf(p)===l.parent.role?10:0)+(l.parent.label && p.getAttribute('aria-label')===l.parent.label?15:0)+(l.parent.tag===p.tagName.toLowerCase()?3:0);
}
export function resolve(l:Locator,root:ParentNode,owned:Map<string,HTMLElement>):HTMLElement|null {
  if(l.owned) { const node=owned.get(l.owned); return node?.isConnected?node:null; }
  if(!/^[a-z][a-z0-9-]*$/.test(l.tag)) return null;
  const candidates=[...(root instanceof HTMLElement&&root.matches(l.tag)?[root]:[]),...deepElements(root,l.tag)].filter(el=>!el.closest('[data-dx-ignore],[data-dx-owned]') && !el.matches('script,style,noscript,option,[contenteditable="true"],[data-dx-ignore]') && !el.hidden && el.getAttribute('aria-hidden')!=='true');
  // Stable element identity outranks matching descendant text. A selected card's
  // contents can change without turning the selection into its inner wrapper.
  const identity=Object.entries(l.attrs).filter(([key])=>['id','data-testid','data-test','data-qa','data-block-id'].includes(key));
  if(identity.length){const exact=candidates.filter(el=>identity.every(([key,value])=>el.getAttribute(key)===value));if(exact.length===1)return exact[0];}
  // Layout containers retain their identity while responsive charts redraw
  // descendant text. Require both the captured class and ancestry, and refuse
  // ambiguous copies; aggregate text is not a stable container identifier.
  if(l.attrs.class){const exact=candidates.filter(el=>el.children.length&&!el.matches('button,a,input,textarea,select,[role=button],[role=link]')&&el.getAttribute('class')===l.attrs.class&&roleOf(el)===l.role&&JSON.stringify(ancestorTags(el))===JSON.stringify(l.ancestorTags));if(exact.length===1)return exact[0];}
  // Icon-only layout wrappers often have no text or accessible name. Anchor
  // their structural address to a unique application ID, with a fingerprint
  // check; never accept a bare positional path into changed content.
  if(l.structure){
    const anchors=deepElements(root,'[id]').filter(el=>el.id===l.structure!.anchorId);
    if(root instanceof HTMLElement&&root.id===l.structure.anchorId)anchors.unshift(root);
    if(anchors.length===1){let node:Element|undefined=anchors[0];for(const index of l.structure.path)node=node?.children[index];
      if(node&&candidates.includes(node as HTMLElement)&&nameOf(node)===l.name&&safeText(node)===l.text&&roleOf(node)===l.role&&JSON.stringify(ancestorTags(node))===JSON.stringify(l.ancestorTags))return node as HTMLElement;
    }
  }
  const ranked=candidates.map(el=>{
    const name=nameOf(el),text=safeText(el),role=roleOf(el);
    const semantic=(!l.name||l.name===name)&&(!l.role||l.role===role);
    const attr=Object.entries(l.attrs).filter(([k,v])=>el.getAttribute(k)===v).length;
    const score=(attr && semantic?110:0)+(l.name && l.name===name?45:0)+(l.text && l.text===text?30:0)+(l.role && l.role===role?12:0)+parentScore(el,l)+(l.previous && safeText(el.previousElementSibling,100)===l.previous?8:0)+(l.next && safeText(el.nextElementSibling,100)===l.next?8:0);
    return {el,score};
  }).sort((a,b)=>b.score-a.score);
  if(!ranked[0] || ranked[0].score<70)return null;
  if(ranked[1] && ranked[0].score-ranked[1].score<18){
    // Nested wrappers often share all visible text. Use recorded ancestry only
    // among strong semantic matches; never guess between identical siblings.
    const contextual=ranked.filter(({el,score})=>score>=70&&ranked[0].score-score<18&&l.ancestorTags&&JSON.stringify(ancestorTags(el))===JSON.stringify(l.ancestorTags)&&nameOf(el)===l.name&&safeText(el)===l.text);
    return contextual.length===1?contextual[0].el:null;
  }
  return ranked[0].el;
}
