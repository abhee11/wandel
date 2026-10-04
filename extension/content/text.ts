/** A single direct text run can be edited without replacing icons, badges or listeners. */
export function editableText(el:HTMLElement):Text|null {
  if(el.matches('input,textarea,select,script,style,[contenteditable="true"]'))return null;
  const runs=Array.from(el.childNodes).filter((node):node is Text=>node.nodeType===Node.TEXT_NODE&&!!node.textContent?.trim());
  if(runs.length===1)return runs[0];
  if(runs.length>1)return null;
  // A button may wrap its only label in spans beside an SVG icon.
  // Never flatten the element: keep icons, listeners and form fields intact.
  const walker=el.ownerDocument.createTreeWalker(el,NodeFilter.SHOW_TEXT);
  const nested:Text[]=[];let node:Node|null;
  while((node=walker.nextNode())){
    if(node.textContent?.trim()&&!node.parentElement?.closest('svg,script,style,input,textarea,select,[contenteditable="true"],[aria-hidden="true"],[data-dx-ignore]'))nested.push(node as Text);
    if(nested.length>1)return null;
  }
  return nested[0]||null;
}
