import type {PageContext} from './schema';
/** Text styles every child inherits. On a real page the same long font list and colour repeat on nearly every element. */
export const INHERITED_STYLES=['font-family','color','line-height','font-size','font-weight','font-style','letter-spacing','text-align','text-transform','white-space','visibility','word-spacing','text-indent','cursor','direction','list-style-type'];
const FLEX_ONLY=['flex-direction','flex-wrap'],FLEX_OR_GRID=['justify-content','align-items','gap','row-gap','column-gap'],OFFSETS=['top','right','bottom','left'];
/** The styles the planner needs, without the ones that say nothing: empty values, settings that don't apply to the
 * element (browser defaults such as no border, offsets on a static element, flex settings on a block, grid columns outside a grid), longhands its
 * shorthand already gives, and inherited text styles equal to its parent's. The page description was most of what
 * each AI request paid for, and over half of it was styles. The planner is told what is left out, so nothing is lost. */
export function trimContextStyles(context:PageContext):PageContext{
 const byRef=new Map(context.elements.map(element=>[element.ref,element]));
 return {...context,elements:context.elements.map(element=>{
  const css=element.style as Record<string,string>|undefined;if(!css)return element;
  const parent=element.parent?byRef.get(element.parent)?.style as Record<string,string>|undefined:undefined;
  const display=String(css.display||''),flex=display.includes('flex'),grid=display.includes('grid'),positioned=!!css.position&&css.position!=='static';
  const style=Object.fromEntries(Object.entries(css).filter(([key,value])=>{
   if(!value)return false;
   if(OFFSETS.includes(key)&&!positioned)return false;
   if(FLEX_ONLY.includes(key)&&!flex)return false;
   if(FLEX_OR_GRID.includes(key)&&!flex&&!grid)return false;
   if(key==='grid-template-columns'&&!grid)return false;
   if(/^padding-/.test(key)&&css.padding)return false;
   if(/^margin-/.test(key)&&css.margin)return false;
   // Browser defaults: no growth, normal shrink, no border.
   if(key==='flex-grow'&&value==='0'||key==='flex-shrink'&&value==='1'||key==='border'&&/^0px none\b/.test(value))return false;
   if(INHERITED_STYLES.includes(key)&&parent?.[key]===value)return false;
   return true;
  }));
  return {...element,style};
 })};
}
