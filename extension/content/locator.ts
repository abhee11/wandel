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
export function describe(el:Element,ownedId?:string):Selection {
  const parent=el.parentElement;
  const attrs:Locator['attrs']={};
  for(const key of ['id','data-testid','data-test','data-qa','data-block-id','alt','src','name','type','placeholder'] as const) { const v=el.getAttribute(key); if(v && v.length<=2048) attrs[key]=v; }
  const fieldLabel=el.matches('input,textarea,select')?el.closest('label')?.textContent:undefined;
  const text=ownedId?normalize(el.getAttribute('data-dx-label')||fieldLabel||el.getAttribute('aria-label')||el.getAttribute('placeholder')||el.textContent):safeText(el);
  const locator:Locator={ancestorTags:ancestorTags(el),owned:ownedId,tag:el.tagName.toLowerCase(),role:roleOf(el),name:ownedId?text:nameOf(el),text,attrs,parent:{tag:parent?.tagName.toLowerCase()||'',id:parent?.id||'',role:parent?roleOf(parent):'',label:parent?.getAttribute('aria-label')||''},previous:safeText(el.previousElementSibling,100),next:safeText(el.nextElementSibling,100)};
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
