import {findCard} from './card';
import {deepElements} from './dom';
import {contextName,sensitive} from './privacy';
import {visible} from '../content/nativeDesign';
import type {PageContext} from './schema';
/** Ground repeated visual units independently of the pointer and current selection. */
export function cardGroups(root:HTMLElement){
 const cache=new WeakMap<HTMLElement,CSSStyleDeclaration>();
 const css=(el:HTMLElement)=>{let style=cache.get(el);if(!style){style=getComputedStyle(el);cache.set(el,style);}return style;};
 const available=(el:HTMLElement)=>!sensitive(el)&&visible(el);
 const identifiedCards=new Set(deepElements(root,'button,a,[role=button],[role=link],h1,h2,h3,h4,p,span').slice(0,160).map(control=>findCard(control)?.root).filter((node):node is HTMLElement=>!!node));
 const card=(el:HTMLElement)=>{
  if(!available(el)||!el.matches('article,section,div,li')||!contextName(el))return false;
  if(el.matches('article,section[data-dx-owned],[data-card],.card')||identifiedCards.has(el))return true;
  if(el.matches('[role=dialog],nav,form')||el.querySelectorAll('h1,h2,h3,h4,[role=heading]').length>1)return false;
  const style=css(el),surface=parseFloat(style.borderRadius)>0||parseFloat(style.borderWidth)>0||!!style.backgroundColor&&!['transparent','rgba(0, 0, 0, 0)'].includes(style.backgroundColor);
  const blocks=[...el.children].filter((child):child is HTMLElement=>child instanceof HTMLElement&&available(child)&&!!contextName(child));
  return surface&&blocks.length>=2||surface&&blocks.length===1&&blocks[0].children.length>=2||el.matches('section')&&!!el.querySelector('h2,h3,h4,[role=heading]')&&blocks.length>=2;
 };
 const groups:{container:HTMLElement;members:HTMLElement[];layout:string}[]=[];
 for(const parent of [root,...deepElements(root,'div,section,main,article,ul,ol,[role=region],[role=dialog]')].slice(0,500)){
  if(!available(parent))continue;
  const children=[...parent.children].filter((n):n is HTMLElement=>n instanceof HTMLElement&&available(n));
  const members=children.filter(card);if(members.length<2||members.length>8)continue;
  const style=css(parent);groups.push({container:parent,members,layout:style.display==='flex'?style.flexDirection||'row':style.display||'block'});
  if(groups.length===8)break;
 }
 return groups;
}
/** Resolve category/count references from scene evidence, rather than demanding a click. */
export function referencedCardGroups(instruction:string,c:PageContext){
 if(!/\bcards?\b/i.test(instruction))return [];
 const count=instruction.match(/\b(two|three|four|five|six|seven|eight|[2-8]|both)\s+(?:of\s+the\s+)?cards?\b/i)?.[1]?.toLowerCase();
 const n=count?({two:2,both:2,three:3,four:4,five:5,six:6,seven:7,eight:8} as Record<string,number>)[count]||Number(count):null;
 return (c.groups||[]).filter(group=>!n||group.members.length===n);
}
export function groundedCategoryRefs(instruction:string,c:PageContext){
 const refs=new Set<string>(),groups=referencedCardGroups(instruction,c);
 if(groups.length===1){refs.add(groups[0].ref);groups[0].members.forEach(ref=>refs.add(ref));}
 const categories=[{pattern:/\bbuttons?\b/i,match:(e:PageContext['elements'][number])=>e.tag==='button'||e.role==='button'},{pattern:/\blinks?\b/i,match:(e:PageContext['elements'][number])=>e.tag==='a'||e.role==='link'},{pattern:/\bheadings?\b/i,match:(e:PageContext['elements'][number])=>/^h[1-6]$/.test(e.tag)||e.role==='heading'},{pattern:/\b(?:inputs?|fields?)\b/i,match:(e:PageContext['elements'][number])=>['input','textarea','select'].includes(e.tag)}];
 for(const category of categories){if(!category.pattern.test(instruction))continue;const matches=c.elements.filter(category.match);const plural=/\b(?:all|every|each|both)\b|\b(?:buttons|links|headings|inputs|fields)\b/i.test(instruction);if(matches.length===1||plural)matches.forEach(e=>refs.add(e.ref));}
 return refs;
}

/** Landmarks plus visible navigation columns, captured even when a child is selected. */
export function pageRegions(root:HTMLElement){
 const candidates=[root,...deepElements(root,'nav,aside,header,main,footer,[role=navigation],[role=banner],[role=main],[role=complementary],div,section')].slice(0,600);
 const regions:{node:HTMLElement;kind:'navigation'|'sidebar'|'header'|'main'|'footer';position:'left'|'right'|'top'|'bottom'|'content'}[]=[];
 for(const node of candidates){
  if(sensitive(node)||!visible(node))continue;
  const rect=node.getBoundingClientRect(),css=getComputedStyle(node);
  const semantic=node.matches('nav,[role=navigation]')?'navigation':node.matches('aside,[role=complementary]')?'sidebar':node.matches('header,[role=banner]')?'header':node.matches('main,[role=main]')?'main':node.matches('footer,[role=contentinfo]')?'footer':null;
  const column=rect.width>0&&rect.width<window.innerWidth*.38&&rect.height>window.innerHeight*.5;
  const inferred=!semantic&&column&&node.querySelectorAll('a,button,[role=link],[role=button]').length>=2;
  if(!semantic&&!inferred)continue;
  const kind=semantic||'sidebar';
  const side=column||rect.width<window.innerWidth*.38&&css.flexDirection==='column'&&node.querySelectorAll('a,button,[role=link],[role=button]').length>=2||['sidebar','navigation'].includes(kind)&&css.position==='fixed'&&css.flexDirection!=='row';
  const position=kind==='main'?'content':kind==='footer'?'bottom':side?(rect.x>window.innerWidth/2?'right':'left'):kind==='header'?'top':rect.height>rect.width?'left':'top';
  if(inferred&&regions.some(region=>region.node.contains(node)||node.contains(region.node)))continue;
  regions.push({node,kind,position});if(regions.length===10)break;
 }
 return regions;
}
export function referencedRegions(instruction:string,c:PageContext){
 const regions=c.regions||[];
 // Spatial descriptions identify the source. A destination such as "into a header" does not change it.
 const side=instruction.match(/\b(left|right|top|bottom)[ -]+(?:hand[ -]+)?(?:panel|sidebar|navigation|nav|menu|bar|column|header|footer)\b/i)?.[1]?.toLowerCase();
 const headerFirst=/\bheader\b/i.exec(instruction),sidePhrase=/\b(left|right|top|bottom)[ -]+(?:hand[ -]+)?(?:panel|sidebar|navigation|nav|menu|bar|column|header|footer)\b/i.exec(instruction);
 // In 'move the header as a left panel', left describes the destination.
 // In 'move the left panel into a header', it identifies the source.
 if(side&&!(headerFirst&&sidePhrase&&headerFirst.index<sidePhrase.index))return regions.filter(region=>region.position===side);
 const kind=headerFirst&&sidePhrase&&headerFirst.index<sidePhrase.index?'header':/\b(?:sidebar|side bar)\b/i.test(instruction)?'sidebar':/\b(?:navigation|nav|menu)\b/i.test(instruction)?'navigation':/\bheader\b/i.test(instruction)?'header':/\bfooter\b/i.test(instruction)?'footer':null;
 if(kind==='header'){const headers=regions.filter(region=>region.kind==='header');return headers.length?headers:regions.filter(region=>['navigation','sidebar'].includes(region.kind)&&region.position==='top');}
 return kind?regions.filter(region=>region.kind===kind||kind==='sidebar'&&region.kind==='navigation'&&['left','right'].includes(region.position)):[];
}
export function regionLayoutRefs(instruction:string,c:PageContext){
 const regions=referencedRegions(instruction,c),refs=new Set<string>();if(regions.length!==1)return refs;
 const region=regions[0];refs.add(region.ref);
 // A structural change needs its contents and the surrounding layout/main area, not only one box.
 if(/\b(?:header|layout|rearrange|move|convert|turn|instead|horizontal|vertical)\b/i.test(instruction)){
  const byRef=new Map(c.elements.map(e=>[e.ref,e]));const element=byRef.get(region.ref);if(element?.parent)refs.add(element.parent);
  for(const item of c.regions||[])if(item.kind==='main'||item.kind==='header')refs.add(item.ref);
  for(const item of c.elements){let parent=item.parent;const seen=new Set<string>();while(parent&&!seen.has(parent)){if(parent===region.ref){refs.add(item.ref);break;}seen.add(parent);parent=byRef.get(parent)?.parent||null;}}
 }
 return refs;
}
