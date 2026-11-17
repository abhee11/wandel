/** Compact percentage labels may be split into value, sign and percent runs. */
export function percentageTextRuns(el:HTMLElement):Text[]|null{
 if(el.matches('input,textarea,select,svg,script,style,[contenteditable="true"]')||el.querySelector('h1,h2,h3,h4,h5,h6,p,button,a,input,textarea,select,table,ul,ol'))return null;
 const runs:Text[]=[];const walk=el.ownerDocument.createTreeWalker(el,NodeFilter.SHOW_TEXT);let node:Node|null;
 while((node=walk.nextNode()))if(node.textContent?.trim()&&!node.parentElement?.closest('svg,[hidden],[data-dx-ignore]')){runs.push(node as Text);if(runs.length>8)return null;}
 return /^[+\-−]?\s*\d+(?:[.,]\d+)?\s*%$/.test(runs.map(node=>node.data).join('').trim())?runs:null;
}
/** A single direct text run can be edited without replacing icons, badges or listeners. */
export function editableText(el:HTMLElement,textPath?:number[]):Text|null {
  if(textPath){
    let node:Node=el;for(const index of textPath){const child=node.childNodes[index];if(!child)return null;node=child;}
    return node instanceof Text&&node.data.trim()&&!node.parentElement?.closest('svg,script,style,input,textarea,select,[contenteditable]:not([contenteditable="false"]),[hidden],[data-dx-ignore]')?node:null;
  }
  if(el.matches('input,textarea,select,script,style,[contenteditable="true"]'))return null;
  const runs=Array.from(el.childNodes).filter((node):node is Text=>node.nodeType===Node.TEXT_NODE&&!!node.textContent?.trim());
  if(runs.length===1)return runs[0];
  if(runs.length>1)return null;
  // A button may wrap its only label in spans beside an SVG icon.
  // Never flatten the element: keep icons, listeners and form fields intact.
  const walker=el.ownerDocument.createTreeWalker(el,NodeFilter.SHOW_TEXT);
  // aria-hidden only hides text from screen readers; it is still on screen. Text they can read wins, so an icon's
  // aria-hidden glyph never takes a button's label; a label that is aria-hidden itself (a slide that announces it elsewhere) is still editable.
  const nested:Text[]=[],silent:Text[]=[];let node:Node|null;
  while((node=walker.nextNode())){
    const parent=node.parentElement;
    if(!node.textContent?.trim()||parent?.closest('svg,script,style,input,textarea,select,[contenteditable="true"],[hidden],[data-dx-ignore]'))continue;
    (parent?.closest('[aria-hidden="true"]')?silent:nested).push(node as Text);
    if(nested.length>1)return null;
  }
  return nested[0]||(silent.length===1?silent[0]:null);
}

/** Pinpoint one text run rather than flattening a paragraph containing formatting. */
export function textAtPoint(el:HTMLElement,x:number,y:number):Text|null {
  const doc=el.ownerDocument as Document&{caretPositionFromPoint?:(x:number,y:number)=>{offsetNode:Node}|null;caretRangeFromPoint?:(x:number,y:number)=>Range|null};
  const node=doc.caretPositionFromPoint?.(x,y)?.offsetNode||doc.caretRangeFromPoint?.(x,y)?.startContainer;
  if(!(node instanceof Text)||!el.contains(node)||!node.data.trim())return null;
  const path=textPath(el,node);return path&&editableText(el,path)===node?node:null;
}
export function textPath(el:HTMLElement,node:Text):number[]|undefined {
  const path:number[]=[];let current:Node=node;
  while(current!==el){const parent=current.parentNode;if(!parent||path.length>=32)return;path.unshift(Array.from(parent.childNodes).indexOf(current as ChildNode));current=parent;}
  return path;
}
