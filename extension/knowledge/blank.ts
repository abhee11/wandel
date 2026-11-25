import type {CopyNode} from '../shared/model';
import type {PageContext} from '../assistant/schema';
import {isLabel,type ScreenSummary} from './schema';
import {templatePath,queryNames} from '../appmap/catalog';
/** Placeholder text of the same shape: letters become X/x, digits 0. Punctuation and spaces stay, so layouts measure the same. */
export const blank=(text:string)=>text.replace(/[A-Za-zÀ-ÖØ-öø-ÿ]/g,c=>c===c.toUpperCase()?'X':'x').replace(/\p{L}/gu,'x').replace(/\d/g,'0');
/** Words that belong to the app's controls are kept: buttons, links, tabs, menu items, field labels and short headings.
 * Everything else, including any text inside a card, row or paragraph, is blanked. */
const LABEL_TAGS=new Set(['button','a','label','h1','h2','h3','h4']);
export function blankCopy(nodes:CopyNode[]):CopyNode[]{
 const elementOf=(index:number)=>{let i=index;while(i>=0&&nodes[i]?.tag==='#text')i=nodes[i].parent;return i>=0?nodes[i]:undefined;};
 return nodes.map((node,index)=>{
  const {href:_href,src:_src,...rest}=node;
  const owner=node.tag==='#text'?elementOf(node.parent):node;
  const labelled=!!owner&&(LABEL_TAGS.has(owner.tag)||owner.role==='button'||owner.role==='link');
  const keep=(text:string)=>labelled&&isLabel(text)?text:blank(text);
  return {...rest,text:node.text?keep(node.text):node.text,...(node.alt!==undefined?{alt:blank(node.alt)}:{}),...(node.placeholder!==undefined?{placeholder:isLabel(node.placeholder)?node.placeholder:blank(node.placeholder)}:{})};
 });
}
/** A screen's address pattern: the path with ids replaced, and query names without values. */
export function screenPattern(href:string){const url=new URL(href);const names=queryNames(url.search);return (templatePath(url.pathname)+(names.length?'?'+names.join('&'):'')).slice(0,300);}
const labelsOf=(values:Iterable<string>,limit:number)=>[...new Set([...values].map(v=>v.replace(/\s+/g,' ').trim()).filter(v=>v&&isLabel(v)))].slice(0,limit);
/** What a screen is, from the page description Wandel already built for the request: no extra capture, labels only. */
export function screenSummary(context:PageContext,documentTitle=''):ScreenSummary{
 const byRef=new Map(context.elements.map(e=>[e.ref,e]));
 const inRegion=(ref:string,kinds:string[])=>{const regions=new Set((context.regions||[]).filter(r=>kinds.includes(r.kind)).map(r=>r.ref));for(let e=byRef.get(ref),n=0;e&&n<40;e=e.parent?byRef.get(e.parent):undefined,n++)if(regions.has(e.ref))return true;return false;};
 const headings=context.elements.filter(e=>/^h[1-4]$/i.test(e.tag)||e.role==='heading').map(e=>e.name);
 const controls=context.elements.filter(e=>e.interactive&&e.visible&&!e.owned);
 const components:ScreenSummary['components']=[];
 for(const group of context.groups||[]){const heading=byRef.get(group.ref)?.attributes['wandel-heading'];components.push({kind:'cards',...(heading&&isLabel(heading)?{label:heading}:{}),count:group.members.length});}
 const count=(test:(e:PageContext['elements'][number])=>boolean)=>context.elements.filter(test).length;
 const tables=count(e=>e.tag==='table'),forms=count(e=>e.tag==='form'),tabs=count(e=>e.role==='tablist'),dialogs=count(e=>e.role==='dialog'),charts=count(e=>e.attributes['data-dx-chart']!==undefined);
 if(tables)components.push({kind:'table',count:tables});if(forms)components.push({kind:'form',count:forms});if(tabs)components.push({kind:'tabs',count:tabs});if(dialogs)components.push({kind:'dialog',count:dialogs});if(charts)components.push({kind:'chart',count:charts});
 const title=isLabel(documentTitle)?documentTitle.trim():labelsOf(headings,1)[0]||'Screen';
 return {title,regions:[...new Set((context.regions||[]).map(r=>r.kind))],headings:labelsOf(headings,24),
  navigation:labelsOf(controls.filter(e=>inRegion(e.ref,['navigation','sidebar','header'])).map(e=>e.name),40),
  actions:labelsOf(controls.filter(e=>!inRegion(e.ref,['navigation','sidebar','header'])&&/button/.test(e.role||e.tag)).map(e=>e.name),40),
  components:components.slice(0,24)};
}
/** A short, stable fingerprint of a summary, so an unchanged screen is never sent again. */
export async function summaryHash(summary:ScreenSummary){const bytes=new TextEncoder().encode(JSON.stringify(summary));const digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].slice(0,16).map(b=>b.toString(16).padStart(2,'0')).join('');}
