import {findCard} from '../assistant/card';
import {describe,structuralIdentity} from './locator';
import {uid,type Operation} from '../shared/model';
/** A copied item must not be squeezed into the remaining space of a non-wrapping row. */
export function copyPlacement(source:HTMLElement,owned:(node:HTMLElement)=>string|undefined):Operation[]{
 const parent=source.parentElement;if(!parent||parent.matches('html,body,nav,[role=navigation]'))return [];
 const css=getComputedStyle(parent);
 const siblings=[...parent.children].filter((node):node is HTMLElement=>node instanceof HTMLElement&&!node.matches('[data-dx-ignore]'));
 const features=siblings.length>=2&&siblings.length<=7&&siblings.every(node=>{const card=findCard(node);return card?.root===node&&card.controls.length===0;});
 if(features&&css.display==='flex'&&['row','row-reverse',''].includes(css.flexDirection))return [{id:uid(),kind:'style',target:describe(parent,owned(parent)).locator,style:{display:'grid',gridTemplateColumns:`repeat(${siblings.length+1}, minmax(0, 1fr))`,gap:24,alignItems:'flex-start'}}];
if(!css.display.includes('flex')||!['row','row-reverse',''].includes(css.flexDirection)||css.flexWrap==='wrap')return [];
 const target=describe(parent,owned(parent)).locator;if(!target.owned&&!target.name&&!target.text)target.structure=structuralIdentity(parent);
 return [{id:uid(),kind:'style',target,style:{flexWrap:'wrap',...(parseFloat(css.gap)===0||!css.gap||css.gap==='normal'?{gap:24}:{})}}];
}
