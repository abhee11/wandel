import {copyStyles,type CopyNode,type Operation,type Locator} from '../shared/model';
import {describe} from './locator';
import {expectation,hidingAncestor,hiddenRoot} from './visibility';

export type NativeDesign={surface:CopyNode['style'];heading:CopyNode['style'];text:CopyNode['style'];button:CopyNode['style'];field:CopyNode['style'];card:CopyNode['style'];table?:CopyNode['style'];tableHeader?:CopyNode['style']};
export function visible(el:HTMLElement){
 for(let p:HTMLElement|null=el;p;p=p.parentElement){const s=getComputedStyle(p);if(p.hidden||p.getAttribute('aria-hidden')==='true'||s.display==='none'||s.visibility==='hidden')return false;}
 return !el.closest('[data-dx-ignore],script,style');
}
/** Shown on screen, whatever assistive technology is told: apps mark decorative rows and icons aria-hidden, and they can still be designed. */
export function shownOnScreen(el:HTMLElement){
 for(let p:HTMLElement|null=el;p;p=p.parentElement){const s=getComputedStyle(p);if(p.hidden||s.display==='none'||s.visibility==='hidden')return false;}
 return !el.closest('[data-dx-ignore],script,style');
}
// Positioning belongs to a copied part's place inside its card, never to the look reused for new elements.
const visual=copyStyles.filter(p=>!['width','height','min-width','max-width','display','grid-template-columns','flex-direction','opacity','position','top','right','bottom','left','z-index','float','clear'].includes(p));
export function readStyle(el:HTMLElement|null):CopyNode['style']{
 if(!el)return {};
 const css=getComputedStyle(el);
 return Object.fromEntries(visual.map(p=>[p,css.getPropertyValue(p)]).filter(([,v])=>v&&v.length<=300&&!/url\s*\(|expression|[<>\\]/i.test(v)));
}
export function designScope(target:HTMLElement){
 return target.closest<HTMLElement>('[data-dx-owned^="view:"],[role="dialog"],[aria-modal="true"],section,article,form,[role="region"],main')||target.parentElement||target;
}
export function captureDesign(target:HTMLElement):NativeDesign{
 const scope=designScope(target);
 // The nearest matching element to the target sets the style, not the first in the scope: a new button beside a card's buttons looks like them, not like the page header's.
 const at=target.getBoundingClientRect(),distance=(el:HTMLElement)=>{const r=el.getBoundingClientRect();return Math.hypot(Math.max(r.left-at.right,at.left-r.right,0),Math.max(r.top-at.bottom,at.top-r.bottom,0));};
 const nearest=(list:HTMLElement[])=>list.reduce<HTMLElement|null>((best,el)=>!best||distance(el)<distance(best)?el:best,null);
 const find=(selector:string)=>nearest([scope,...scope.querySelectorAll<HTMLElement>(selector)].filter(el=>el.matches(selector)&&visible(el)&&!el.closest('[data-dx-ignore]')));
 const surface=readStyle(scope);
 // Transparent local sections inherit the enclosing app surface, not generic white.
 if(!surface['background-color']||surface['background-color']==='rgba(0, 0, 0, 0)'){
  for(let p=scope.parentElement;p;p=p.parentElement){const bg=getComputedStyle(p).backgroundColor;if(bg&&bg!=='rgba(0, 0, 0, 0)'&&bg!=='transparent'){surface['background-color']=bg;break;}}
 }
 const inherited={'font-family':surface['font-family']||'inherit',color:surface.color||'inherit'};
 const fallbackButton:CopyNode['style']={display:'inline-flex','align-items':'center','justify-content':'center',padding:'10px 16px',margin:'8px 0',border:'1px solid #5856c4','border-radius':'8px','background-color':'#625fd4',color:'#fff','font-family':'system-ui, sans-serif','font-size':'14px','font-weight':'600','line-height':'1.4'};
 return {surface,heading:{...inherited,...readStyle(find('h2,h3,h1,[role="heading"]'))},text:{...inherited,...readStyle(find('p'))},button:{...fallbackButton,...readStyle(target.matches('button,[role="button"]')?target:nearest([...scope.querySelectorAll<HTMLElement>('button:not([aria-pressed]),[role="button"]')].filter(el=>visible(el)&&el.getBoundingClientRect().width>24&&el.getBoundingClientRect().width<400&&el.getBoundingClientRect().height<64&&!el.closest('[data-dx-ignore]')&&! /^(close|cancel|delete|remove)$/i.test(el.getAttribute('aria-label')||el.textContent?.trim()||''))))},field:readStyle(find('input:not([type="hidden"]):not([type="password"]),textarea,select')),table:readStyle(find('table,[role="table"]')),tableHeader:readStyle(find('th,[role="columnheader"]')),card:{...inherited,'background-color':surface['background-color']||'transparent',...readStyle(find('article,[data-card],.card'))}};
}
/** Preserve a visible control even when the reference is a text-only/reset button. */
export function buttonAppearance(reference:CopyNode['style']={}):CopyNode['style']{
 const style:CopyNode['style']={display:'inline-flex','align-items':'center','justify-content':'center',gap:'8px',padding:'12px 20px',margin:'0',border:'1px solid #625fd4','border-radius':'12px','background-color':'#625fd4',color:'#ffffff','font-family':'system-ui, sans-serif','font-size':'14px','font-weight':'600','line-height':'1.4',...reference};
 const transparent=(color:string|undefined)=>!color||color==='transparent'||/rgba\([^)]*,\s*0(?:\.0+)?\)$/.test(color);
 const noBorder=style['border-style']==='none'||style['border-width']!==undefined&&parseFloat(style['border-width'])===0||/^0(?:px)?\b|\bnone\b/.test(style.border||'');
 if(transparent(style['background-color'])&&noBorder&&(!style['box-shadow']||style['box-shadow']==='none')){
  for(const key of ['border','border-width','border-style','border-color'] as const)delete style[key];
  style.border='1px solid '+(style.color&&!transparent(style.color)?style.color:'#625fd4');
 }
 if(!(parseFloat(style['border-radius']||'')>0))style['border-radius']='12px';
 if(!(style.padding?.split(' ').some(value=>parseFloat(value)>=8)))style.padding='12px 20px';
 style.display='inline-flex';style['align-items']='center';style['justify-content']='center';
 return style;
}
export function applyAppearance(el:HTMLElement,style:CopyNode['style']){
 for(const [k,v] of Object.entries(style))el.style.setProperty(k,v);
 el.style.boxSizing='border-box';el.style.maxWidth='100%';el.style.minWidth='0';el.style.overflowWrap='anywhere';
}
/** Only infer an unselected destination from an explicit section name or one open dialog. */
export function inferDestination(prompt:string,root:HTMLElement):HTMLElement{
 const named=prompt.match(/\b(?:in|inside|within|to)\s+(?:the\s+)?["“]?([\w -]{2,60}?)["”]?\s+(?:section|settings?|panel|dialog)\b/i)?.[1]?.trim().toLowerCase();
 const candidates=[...root.querySelectorAll<HTMLElement>('h1,h2,h3,h4,[role="heading"],[role="tabpanel"],[role="region"],[role="dialog"]')].filter(visible);
 if(named){
  const matches=candidates.filter(el=>(el.getAttribute('aria-label')||el.textContent||'').trim().toLowerCase()===named);
  const scopes=[...new Set(matches.map(el=>el.matches('h1,h2,h3,h4,[role="heading"]')?el.parentElement!:el))];
  if(scopes.length===1)return scopes[0];
  throw new Error(scopes.length?'More than one section matches. Select the intended section.':'Open that section and select it so Wandel can place the change correctly.');
 }
 const dialogs=[...root.querySelectorAll<HTMLElement>('[role="dialog"],[aria-modal="true"]')].filter(visible);
 const leaves=dialogs.filter(el=>!dialogs.some(other=>other!==el&&el.contains(other)));
 if(leaves.length===1)return leaves[0];
 throw new Error('Select the section you want to extend. Your prompt is kept.');
}
export function nativeOperations(ops:Operation[],target:HTMLElement,profile=captureDesign(target)):Operation[]{
 // Resolve a footer within this exact insertion target; never move edits into another section.
 const footers=[...target.querySelectorAll<HTMLElement>('footer,[role="contentinfo"],[data-dialog-footer]')].filter(visible);
 let footer=footers.length===1?footers[0]:null;
 if(!footer){
  const save=[...target.querySelectorAll<HTMLElement>('button')].filter(el=>visible(el)&&/^(save|cancel|apply|done)$/i.test(el.textContent?.trim()||''));
  const groups=[...new Set(save.map(el=>el.parentElement!))].filter(el=>save.filter(b=>el.contains(b)).length>=2&&el!==target&&!el.querySelector('input,h1,h2,h3'));
  if(groups.length===1)footer=groups[0];
 }
 return ops.map(op=>{
  if(op.kind!=='insert'||op.node.copy||op.node.choices||op.node.widget)return op;
  const styles=op.node.kind==='button'?profile.button:op.node.kind==='field'?profile.text:op.node.kind==='panel'?profile.card:profile.text;
  const anchor=footer&&op.position==='inside'&&!op.target.owned&&JSON.stringify(op.target)===JSON.stringify(describe(target).locator);
  return {...op,...(anchor?{target:describe(footer!).locator,position:'before' as const}:{}),node:{...op.node,appearance:op.node.appearance||styles,...((op.node.kind==='field'||op.node.control)?{inputAppearance:op.node.inputAppearance||(op.node.control?profile.button:profile.field)}:{})}};
 });
}
export function inspectLayout(nodes:Iterable<HTMLElement>):string[]{
 const issues=new Set<string>(),reported=new Set<HTMLElement>();
 for(const el of nodes){
  if(!el.isConnected)continue;
  const name=el.dataset.dxLabel||el.textContent?.replace(/\s+/g,' ').trim().slice(0,50)||'New element';
  // Hidden until a click or hover, deliberately hidden, or inside a closed disclosure: valid now, checked once shown.
  const reason=expectation(el);
  if(reason==='unrevealed'){const root=hiddenRoot(el);if(reported.has(root))continue;reported.add(root);issues.add(`${root.dataset.dxLabel||name}: hidden control; it is hidden when the page loads and no click or hover shows it. Add a click that shows it, or don’t hide it.`);continue;}
  if(reason)continue;
  const box=el.getBoundingClientRect();if(!box.width&&!box.height){if(document.body.getBoundingClientRect().width&&!visible(el))issues.add(`${name}: hidden control; ${hidingAncestor(el)}, and nothing in the prototype shows it. Place it in a visible section, or make a click show it.`);continue;} // no layout engine in unit tests
  const label=name;
  if(!visible(el)||box.width<1||box.height<1)issues.add(`${label}: hidden control; ${hidingAncestor(el)}, so it can’t be seen or used. Place it in a visible section, or make a click show it.`);
  if(el.scrollWidth>el.clientWidth+4&&getComputedStyle(el).overflowX==='hidden')issues.add(label+': content is clipped.');
  for(let p=el.parentElement;p;p=p.parentElement){
   const css=getComputedStyle(p),clipX=/(hidden|clip)/.test(css.overflowX||css.overflow),clipY=/(hidden|clip)/.test(css.overflowY||css.overflow);
   if(clipX||clipY){const r=p.getBoundingClientRect();if((clipY&&(box.bottom>r.bottom+4||box.top<r.top-4))||(clipX&&(box.right>r.right+4||box.left<r.left-4)))issues.add(label+': extends beyond a clipping container. Resize the section.');}
   // A viewport-fixed dialog escapes ordinary overflow on its page ancestors.
   if(css.position==='fixed')break;
  }
 }
 return [...issues].slice(0,10);
}
