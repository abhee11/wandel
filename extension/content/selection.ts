/** Prefer an actual section, including div-based application blocks, over the entire main area. */
export function sectionTarget(selected:HTMLElement,root:HTMLElement):HTMLElement {
 const own=selected.closest<HTMLElement>('[data-dx-owned^="view:"],section,article,form,nav,aside,[role="region"],[data-block-id]');
 if(own&&root.contains(own))return own;
 let candidate=selected,fallback:HTMLElement|undefined;
 while(candidate.parentElement&&candidate.parentElement!==root){
  const parent=candidate.parentElement;
  if(parent.matches('main,[role="main"],body'))break;
  const children=Array.from(parent.children).filter(el=>!el.matches('script,style,[data-dx-ignore]'));
  if(children.length>=2&&parent.querySelector('h1,h2,h3,p,button,a,input,[role="button"]')){fallback??=parent;if(parent.querySelector('button,a,input,[role="button"]'))return parent;}
  candidate=parent;
 }
 return fallback||(selected.parentElement&&selected.parentElement!==root?selected.parentElement:selected);
}
