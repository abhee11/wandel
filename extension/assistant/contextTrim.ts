import type {PageContext} from './schema';
/** Text styles every child inherits. On a real page the same long font list and colour repeat on nearly every element. */
export const INHERITED_STYLES=['font-family','color','line-height','font-size','font-weight','font-style','letter-spacing','text-align','text-transform','white-space','visibility','word-spacing','text-indent','cursor','direction','list-style-type'];
const FLEX_ONLY=['flex-direction','flex-wrap'],FLEX_OR_GRID=['justify-content','align-items','gap','row-gap','column-gap'],OFFSETS=['top','right','bottom','left'];
/** The styles the planner needs, without the ones that say nothing: empty values, settings that don't apply to the
 * element (browser defaults such as no border, offsets on a static element, flex settings on a block, grid columns outside a grid), longhands its
 * shorthand already gives, and inherited text styles equal to its parent's. The page description was most of what
 * each AI request paid for, and over half of it was styles. The planner is told what is left out, so nothing is lost. */
export function trimContextStyles(context:PageContext):PageContext{
 const byRef=new Map((context.elements||[]).map(element=>[element.ref,element]));
 return {...context,elements:(context.elements||[]).map(element=>{
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
// Wandel's hints that mark something a request acts on: a card, a card title, a custom control. Layout and part
// references (wandel-layout-item-ref, wandel-heading-ref) are on nearly every element and say nothing about that.
const KEY_HINTS=/^wandel-(card|heading|custom-|control-count)/;
/** The look a background element keeps: enough to see surfaces and layout, not its typography or spacing. */
const BACKGROUND_STYLES=['display','background-color','background-image','border-radius','position','box-shadow','border'];
/** The page description as the planner reads it. Every element the request can act on keeps all it had:
 * controls, headings, cards, Wandel's own elements, anything selected, recent, grouped, in a layout or region,
 * and anything the request names. Other elements stay as structure: name, place and surface, without typography,
 * spacing or class names. Child lists are left out (each element's parent gives them), and an element's text is
 * left out when it repeats its name. After an inspection or a failed attempt (whole), every element is kept whole,
 * so what was inspected is never slimmed away. The page description was about three quarters of what each plan cost. */
export function trimContext(context:PageContext,instruction='',whole=false):PageContext{
 const styled=trimContextStyles(context),request=instruction.toLowerCase();
 const key=new Set<string>([context.selected,context.hover,context.styleReference,context.lastCard,context.copySource,context.page,...(context.recent||[]),...(context.styledByWandel||[]),
  ...(context.groups||[]).flatMap(group=>[group.ref,...group.members]),...(context.layout||[]).flatMap(layout=>[layout.ref,...layout.items]),...(context.regions||[]).map(region=>region.ref)].filter((ref):ref is string=>!!ref));
 const named=(name:string)=>{const n=name.toLowerCase().trim();return n.length>=3&&n.length<=100&&request.includes(n);};
 return {...styled,elements:(styled.elements||[]).map(element=>{
  const keep=whole||key.has(element.ref)||element.interactive||element.owned||/^h[1-6]$/i.test(element.tag)||element.role==='heading'||Object.keys(element.attributes).some(name=>KEY_HINTS.test(name))||named(element.name);
  const slim={...element,children:[],text:element.text===element.name?'':element.text};
  return keep?slim:{...slim,classes:[],style:Object.fromEntries(Object.entries(element.style).filter(([name])=>BACKGROUND_STYLES.includes(name)))};
 })};
}
/** The column order of the compact element table; the planner is given the same line. */
export const ELEMENT_COLUMNS='ref|tag|role|name|text|parent|x,y,w,h|flags|attributes|classes|style';
/** The elements as a text table, one line each, instead of JSON objects that repeat every field name on every element
 * ("interactive":false and the like were a large share of each request). Same content: flags list only what is true
 * (v visible, i interactive, d disabled, o added by Wandel), positions are whole pixels, children are left out as in
 * trimContext (an element's children are the lines whose parent is it). */
export function compactElements(context:PageContext):Omit<PageContext,'elements'>&{elementColumns:string;elements:string}{
 const cell=(value:unknown)=>String(value??'').replace(/[|\r\n]+/g,' ').replace(/\s+/g,' ').trim();
 const pairs=(record:Record<string,string>,join:string)=>Object.entries(record).map(([key,value])=>key+join+cell(value).replace(/;/g,',')).join(';');
 const lines=(context.elements||[]).map(e=>[e.ref,e.tag,e.role,cell(e.name),e.text===e.name?'':cell(e.text),e.parent||'',
  [e.bounds.x,e.bounds.y,e.bounds.width,e.bounds.height].map(n=>Math.round(n)).join(','),
  (e.visible?'v':'')+(e.interactive?'i':'')+(e.disabled?'d':'')+(e.owned?'o':''),
  pairs(e.attributes,'='),e.classes.map(cell).join(' '),pairs(e.style||{},':')].join('|'));
 return {...context,elementColumns:ELEMENT_COLUMNS,elements:lines.join('\n')};
}
