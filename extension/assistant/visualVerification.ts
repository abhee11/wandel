import {visible} from '../content/nativeDesign';
type ContentIssue={message:string;need?:number;have?:number};
/** Pre-edit content issues by element, so verification fails regressions rather than an element's existing rendering. */
export type ContentBaseline=(node:HTMLElement)=>ContentIssue|undefined;
const contentNodes=(root:HTMLElement)=>[root,...root.querySelectorAll<HTMLElement>('h1,h2,h3,h4,p,label,button,a,input,select,textarea')].filter(n=>visible(n)).slice(0,100);
function contentIssue(root:HTMLElement,node:HTMLElement):ContentIssue|undefined{
 const rect=node.getBoundingClientRect();if(!rect.width||!rect.height)return;
 const css=getComputedStyle(node);if(['absolute','fixed'].includes(css.position))return;
 const container=root.getBoundingClientRect();if(node!==root&&container.width&&rect.width&&(rect.left<container.left-2||rect.right>container.right+2))return {message:'Edited content extends outside its container.'};
 // Only flag clipping at a real clipping ancestor, not ordinary viewport scrolling.
 for(let parent=node.parentElement;parent&&root.contains(parent);parent=parent.parentElement){
  const clip=getComputedStyle(parent),bounds=parent.getBoundingClientRect();if(!bounds.width||!bounds.height)continue;
  if(['hidden','clip'].includes(clip.overflowX||clip.overflow)&& (rect.left<bounds.left-2||rect.right>bounds.right+2))return {message:'Edited content is clipped horizontally.'};
  if(['hidden','clip'].includes(clip.overflowY||clip.overflow)&& (rect.top<bounds.top-2||rect.bottom>bounds.bottom+2))return {message:'Edited content is clipped vertically.'};
 }
 if(node.matches('h1,h2,h3,h4,p,label,button,a')&&node.dataset.dxIconOnly!=='true'){const available=rect.width-(parseFloat(css.paddingLeft)||0)-(parseFloat(css.paddingRight)||0)-(parseFloat(css.borderLeftWidth)||0)-(parseFloat(css.borderRightWidth)||0),fontSize=parseFloat(css.fontSize)||14;const words=(node.textContent||'').trim().match(/[\p{L}\p{N}]{3,}/gu)||[];if(words.length&&available<fontSize*4){const canvas=document.createElement('canvas'),context=canvas.getContext('2d');if(context){context.font=css.font||fontSize+'px '+css.fontFamily;const longest=Math.max(...words.map(word=>context.measureText(word).width));if(available+2<Math.min(longest,fontSize*4))return {message:'The new content is too narrow to read without breaking words.',need:Math.round(longest),have:Math.round(available)};}}}
 if(!node.matches('h1,h2,h3,h4,p,label'))return;
 const next=node.nextElementSibling;if(!(next instanceof HTMLElement)||!next.matches('h1,h2,h3,h4,p,button,input,select,textarea')||!visible(next))return;
 const nextCSS=getComputedStyle(next),parentCSS=getComputedStyle(node.parentElement!);if(['absolute','fixed'].includes(nextCSS.position)||parentCSS.display.includes('flex')&&parentCSS.flexDirection.startsWith('row')||parentCSS.display==='grid')return;
 const b=next.getBoundingClientRect();if(b.width&&b.height&&Math.min(rect.right,b.right)>Math.max(rect.left,b.left)+2&&rect.top<=b.top&&rect.bottom>b.top+2)return {message:'Edited text overlaps the next content block.'};
}
/** Pre-edit issues by element. Wandel re-creates its own elements on each render, so those also match by their stable id. */
export class ContentIssues extends Map<HTMLElement,ContentIssue>{
 override get(node:HTMLElement){const issue=super.get(node);if(issue||!node.dataset.dxOwned)return issue;for(const [known,value] of this)if(known.dataset.dxOwned===node.dataset.dxOwned)return value;return undefined;}
}
/** Capture issues already present before an edit; call before the preview renders. */
export function contentBaseline(root:HTMLElement){const issues=new ContentIssues();for(const node of contentNodes(root)){const issue=contentIssue(root,node);if(issue)issues.set(node,issue);}return issues;}
/** Bounded post-render checks for newly created/reflowed content. Never infer visual success from CSS alone. */
export function verifyContent(root:HTMLElement,baseline?:ContentBaseline){
 if(!root.isConnected)throw new Error('The edited content disappeared.');
 for(const node of contentNodes(root)){
  const issue=contentIssue(root,node);if(!issue)continue;
  // An element that rendered the same way before the edit (or its faithful
  // copy's source) has not regressed; only a worse result fails.
  const before=baseline?.(node);if(before?.message===issue.message&&(issue.need===undefined||issue.need<=before.need!+1&&issue.have!>=before.have!-1))continue;
  const label=(node.textContent||'').replace(/\s+/g,' ').trim().slice(0,40);
  throw new Error(issue.message.replace(/\.$/,'')+` (${node.tagName.toLowerCase()}${label?` “${label}”`:''}${issue.need!==undefined?`: ${issue.have}px available, ${issue.need}px needed`:''}).`);
 }
}

const size=(rect:DOMRect)=>`${Math.round(rect.width)}×${Math.round(rect.height)} at ${Math.round(rect.left)},${Math.round(rect.top)}`;
/** A same-size copy rendered next to its original on the same row, with nothing between them. */
export function verifyBeside(node:HTMLElement,anchor:HTMLElement,before:DOMRect){
 const box=node.getBoundingClientRect(),reference=anchor.getBoundingClientRect();
 if(!node.isConnected||!anchor.isConnected||!box.width||!box.height)throw new Error('The copy or its original is missing.');
 if(Math.abs(reference.width-before.width)>2||Math.abs(reference.height-before.height)>2)throw new Error(`Adding the copy resized the original from ${size(before)} to ${size(reference)}.`);
 const overlap=Math.min(box.bottom,reference.bottom)-Math.max(box.top,reference.top);
 if(overlap<Math.min(box.height,reference.height)/2)throw new Error(`The copy wrapped onto another row instead of sitting beside the original (original ${size(reference)}, copy ${size(box)}). The original is likely the last item in its row.`);
 const rtl=getComputedStyle(anchor.parentElement||anchor).direction==='rtl',start=rtl?box.right:box.left,edge=rtl?reference.left:reference.right;
 if(rtl?start>edge+2:start<edge-2)throw new Error(`The copy did not render beside the original (original ${size(reference)}, copy ${size(box)}).`);
 const between=[...(anchor.parentElement?.children||[])].some(sibling=>{if(sibling===node||sibling===anchor||!(sibling instanceof HTMLElement)||!visible(sibling))return false;const rect=sibling.getBoundingClientRect();return rect.width>0&&Math.min(rect.bottom,reference.bottom)-Math.max(rect.top,reference.top)>0&&(rtl?rect.right<=reference.left+2&&rect.left>=box.right-2:rect.left>=reference.right-2&&rect.right<=box.left+2);});
 if(between)throw new Error('Another item renders between the original and its copy.');
 if(Math.abs(box.width-reference.width)>2||Math.abs(box.height-reference.height)>2)throw new Error(`The copy is ${size(box)} but the original is ${size(reference)}; the sizes should match.`);
}
/** Content added inside or after a card must push neighbours aside, not render over them. */
export function verifyNoOverlap(node:HTMLElement){
 const box=node.getBoundingClientRect();if(!node.isConnected||!box.width||!box.height)return;
 for(let child:HTMLElement=node,parent=node.parentElement;parent&&!parent.matches('html');child=parent,parent=parent.parentElement){
  if(getComputedStyle(child).position==='fixed')return;
  for(const sibling of parent.children){
   if(sibling===child||!(sibling instanceof HTMLElement)||sibling.closest('[data-dx-ignore]')||!visible(sibling)||['fixed','sticky'].includes(getComputedStyle(sibling).position))continue;
   const rect=sibling.getBoundingClientRect(),width=Math.min(rect.right,box.right)-Math.max(rect.left,box.left),height=Math.min(rect.bottom,box.bottom)-Math.max(rect.top,box.top);
   if(width>4&&height>4)throw new Error(`The new content overlaps “${(sibling.textContent||sibling.tagName).replace(/\s+/g,' ').trim().slice(0,40)}” (${size(box)} over ${size(rect)}).`);
  }
 }
}
/** A section directly under the cards it spans: aligned, as wide as them, cards unchanged, and one bar per point for a chart. */
export function verifyChartSection(section:HTMLElement,cards:HTMLElement[],before:DOMRect[],points?:number){
 const box=section.getBoundingClientRect();if(!section.isConnected||!box.width||!box.height)throw new Error('The new section is not visible.');
 cards.forEach((card,i)=>{const rect=card.getBoundingClientRect();if(!card.isConnected||Math.abs(rect.width-before[i].width)>2||Math.abs(rect.height-before[i].height)>2)throw new Error(`Adding the section resized a card from ${size(before[i])} to ${size(rect)}.`);});
 const rects=cards.map(card=>card.getBoundingClientRect()),left=Math.min(...rects.map(r=>r.left)),right=Math.max(...rects.map(r=>r.right)),bottom=Math.max(...rects.map(r=>r.bottom));
 if(box.top<bottom-2)throw new Error(`The section is not below the cards (section ${size(box)}, cards end at ${Math.round(bottom)}).`);
 if(Math.abs(box.left-left)>2||Math.abs(box.right-right)>2)throw new Error(`The section is ${Math.round(box.width)}px wide at ${Math.round(box.left)}, but the cards span ${Math.round(right-left)}px from ${Math.round(left)}.`);
 if(points===undefined)return;
 const bars=section.querySelectorAll('svg rect').length;if(bars!==points)throw new Error(`The chart shows ${bars} bars for ${points} data points.`);
 const graph=section.querySelector('svg')?.getBoundingClientRect();if(!graph||graph.width<200||graph.height<80)throw new Error('The chart is too small to read.');
}
/** Verify the requested spatial relationship, not merely DOM sibling order. */
export function verifyBelow(node:HTMLElement,anchor:HTMLElement,before:DOMRect,anchorBaseline?:ContentBaseline,nodeBaseline?:ContentBaseline){
 const box=node.getBoundingClientRect(),reference=anchor.getBoundingClientRect();
 if(!node.isConnected||!anchor.isConnected||!box.width||!box.height)throw new Error('The new block or its anchor is missing.');
 if(box.top<reference.bottom-2)throw new Error('The new block was not placed below the existing card.');
 if(box.width<Math.min(before.width,280)-2)throw new Error('The new card was squeezed instead of preserving a usable width.');
 if(reference.width<before.width-2)throw new Error('Adding the card squeezed the existing card.');
 if(reference.left<Math.min(0,before.left)-2||reference.right>Math.max(innerWidth,before.right)+2)throw new Error('Adding the card pushed the existing card outside the page.');
 verifyContent(node,nodeBaseline);verifyContent(anchor,anchorBaseline);
}
