import {sensitive} from './privacy';
const controls='button,a,[role="button"],[role="link"]';
export type CardParts={root:HTMLElement;heading:HTMLElement;description:HTMLElement|null;controls:HTMLElement[]};
const text=(node:Element)=>(node.textContent||'').replace(/\s+/g,' ').trim();
function parts(root:HTMLElement):CardParts|null{
 if(root.matches('body,main,form,[role=dialog]')||sensitive(root))return null;
 const actions=[...root.querySelectorAll<HTMLElement>(controls)].filter(node=>!node.parentElement?.closest(controls)&&!sensitive(node)&&getComputedStyle(node).display!=='none'&&getComputedStyle(node).visibility!=='hidden');
 // Feature tiles can be complete cards without a CTA. Require repeated sibling
 // structure and multiple short text blocks; never promote the whole row.
 if(!actions.length){
  const siblings=root.parentElement?[...root.parentElement.children].filter(el=>el instanceof HTMLElement&&el.tagName===root.tagName&&el.className===root.className):[];
  const blocks=[...root.children].filter((el):el is HTMLElement=>el instanceof HTMLElement&&!sensitive(el)&&!el.matches('svg,img')&&!!text(el)&&text(el).length<=500);
  if((siblings.length>=2||root.hasAttribute('data-dx-owned'))&&blocks.length>=2&&blocks.length<=4&&!blocks.some(el=>el.querySelector('h1,h2,h3,h4,p,button,a'))){const heading=copiedHeading(root)||blocks[0];return {root,heading,description:blocks.find(block=>block!==heading&&!block.contains(heading)&&/[a-z]/i.test(text(block)))||null,controls:[]};}
  return null;
 }
 if(actions.length>8)return null;
 const blocks:HTMLElement[]=[];
 const walk=(node:HTMLElement)=>{
  if(node.matches(controls)||sensitive(node))return;
  if(node.querySelector(controls)){for(const child of node.children)if(child instanceof HTMLElement)walk(child);return;}
  if(!text(node))return;
  if(node.matches('h1,h2,h3,h4,h5,h6,[role=heading],p')||!node.querySelector('h1,h2,h3,h4,h5,h6,[role=heading],p')){if(text(node).length<=1000)blocks.push(node);return;}
  for(const child of node.children)if(child instanceof HTMLElement)walk(child);
 };
 for(const child of root.children)if(child instanceof HTMLElement)walk(child);
 const headings=blocks.filter(node=>node.matches('h1,h2,h3,h4,h5,h6,[role=heading]'));
 const surface=getComputedStyle(root),titledSurface=blocks.length===1&&parseFloat(surface.borderRadius)>=8&&text(blocks[0]).length<=120;
 if(headings.length>1||!blocks.length||!headings.length&&blocks.length<2&&!titledSurface)return null;
 const heading=headings[0]||blocks[0];
 return {root,heading,description:blocks.find(node=>node!==heading)||null,controls:actions};
}
/** Expand a title/action row to its enclosing visual surface, without crossing another title. */
function completeSurface(card:CardParts):CardParts{
 let ancestor=card.root.parentElement;
 for(let depth=0;ancestor&&depth<4;depth++,ancestor=ancestor.parentElement){
  if(ancestor.matches('body,main,form,[role=dialog]')||sensitive(ancestor))break;
  const headings=[...ancestor.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6,[role=heading]')];
  if(headings.length!==1||headings[0]!==card.heading)break;
  const css=getComputedStyle(ancestor),surface=parseFloat(css.borderRadius)>=8&&(parseFloat(css.borderWidth)>0||css.boxShadow!=='none'||!['transparent','rgba(0, 0, 0, 0)'].includes(css.backgroundColor));
  if(surface){const expanded=parts(ancestor);if(expanded?.heading===card.heading)return expanded;}
 }
 return card;
}
/** Find the closest complete card, including apps built from styled divs/spans. Never guess across multiple cards. */
export function findCard(node:HTMLElement):CardParts|null{
 const actions=node.matches(controls)?[node]:[...node.querySelectorAll<HTMLElement>(controls)];
 const found=new Map<HTMLElement,CardParts>();
 for(const action of actions){let parent=action.parentElement;while(parent&&!parent.matches('body,main,form,[role=dialog]')){let card=parts(parent);if(card){
   // A padded, elevated shell belongs to the card when it contains exactly
   // the same title and controls as its rounded inner surface.
   const shell=parent.parentElement,outer=shell?parts(shell):null;
   if(shell&&outer&&outer.heading===card.heading&&outer.controls.length===card.controls.length&&outer.controls.every(control=>card!.controls.includes(control))&&getComputedStyle(shell).boxShadow!=='none'&&getComputedStyle(shell).boxShadow!=='')card=outer;
   card=completeSurface(card);found.set(card.root,card);break;}parent=parent.parentElement;}}
 if(!actions.length){const direct=parts(node);if(direct)return completeSurface(direct);let parent=node.parentElement;while(parent&&!parent.matches('body,main,form,[role=dialog]')){const card=parts(parent);if(card&&card.root.contains(node))return completeSurface(card);parent=parent.parentElement;}}
 const cards=[...found.values()].filter(card=>card.root===node||node.contains(card.root)||card.root.contains(node));
 return cards.length===1?cards[0]:null;
}
/** Heading of a known copied unit; no button/link heuristic is needed. */
export function copiedHeading(root:HTMLElement):HTMLElement|null{
 const heading=root.matches('h1,h2,h3,h4,h5,h6,[role=heading]')?root:root.querySelector<HTMLElement>('h1,h2,h3,h4,h5,h6,[role=heading]');if(heading)return heading;
 // Metric tiles put a trend badge and numeric value before their actual label.
 const blocks=[...root.children].filter((node):node is HTMLElement=>node instanceof HTMLElement&&!node.matches('svg,img')&&!sensitive(node)&&visibleText(node));
 const labels=blocks.filter(node=>/[a-z]/i.test(text(node))&&!node.querySelector(controls));
 if(blocks.some(node=>/^[\s\d.,$€£¥%+−–—\-()]+$/.test(text(node)))&&labels.length===1)return labels[0];
 const walk=root.ownerDocument.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node:Node|null;
 while((node=walk.nextNode())){const parent=node.parentElement;if(parent&&node.textContent?.trim()&&!parent.closest('button,a,input,textarea,select,svg,[role=button],[role=link]')&&!sensitive(parent)&&getComputedStyle(parent).display!=='none'&&getComputedStyle(parent).visibility!=='hidden')return parent;}
 return null;
}
function visibleText(node:HTMLElement){return !!text(node)&&getComputedStyle(node).display!=='none'&&getComputedStyle(node).visibility!=='hidden';}
