import {resolve} from './locator';
import {cleanText} from '../assistant/privacy';
import type {Operation,Workflow} from '../shared/model';
/** What a change really looks like on the page: the rendered markup with its styles, and how it sits in its surroundings. It lets a coding agent reproduce the result instead of guessing. */
export interface ChangeEvidence{html?:string;layout?:string;styles?:Record<string,string>}
export interface DesignEvidence{page:Record<string,string>;viewport:string;changes:Record<string,ChangeEvidence>}
const kept=['display','position','flex-direction','flex-wrap','flex-grow','flex-shrink','justify-content','align-items','align-self','gap','grid-template-columns','width','max-width','min-height','padding','margin','box-sizing','background-color','background-image','color','font-family','font-size','font-weight','line-height','letter-spacing','text-align','text-transform','text-decoration-line','border','border-radius','box-shadow','opacity','overflow','cursor','object-fit'];
const plain=new Set(['none','normal','auto','0px','0','static','visible','rgba(0, 0, 0, 0)','start','stretch','nowrap','row','content-box','0px none rgb(0, 0, 0)','1','0px 0px','0px 0px 0px 0px','left','fill']);
const inherited=new Set(['color','font-family','font-size','font-weight','line-height','letter-spacing','text-align','text-transform','cursor']);
const escape=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function declarations(el:Element){
 const css=getComputedStyle(el),parent=el.parentElement?getComputedStyle(el.parentElement):null,out:string[]=[];
 for(const key of kept){
  const value=css.getPropertyValue(key);if(!value||plain.has(value))continue;
  if(key==='display'&&['block','inline'].includes(value))continue;
  // A control's width comes from its label, so a measured width would only freeze it.
  if(key==='width'&&el.matches('button,a,[role=button],span,label'))continue;
  if(inherited.has(key)&&parent?.getPropertyValue(key)===value)continue;
  if(/url\(/.test(value))continue;
  out.push(`${key}:${value}`);
 }
 return out.join(';');
}
/** The rendered element as plain HTML with inline styles, shortened to what differs from defaults. */
export function renderedMarkup(root:Element,limit=8000){
 let room=limit;
 const walk=(node:Node,depth:number):string=>{
  if(room<=0)return '';
  if(node instanceof Text){const text=cleanText(node.data,400).replace(/\s+/g,' ').trim();if(!text)return '';room-=text.length;return '  '.repeat(depth)+escape(text)+'\n';}
  if(!(node instanceof Element)||node.matches('script,style,[data-dx-ignore]'))return '';
  if(node instanceof HTMLElement&&(getComputedStyle(node).display==='none'||node.hidden))return '';
  const tag=node.tagName.toLowerCase();
  if(tag==='svg'){room-=20;return '  '.repeat(depth)+'<!-- icon -->\n';}
  const style=declarations(node),attrs=[style?` style="${escape(style)}"`:'',...['role','aria-label','type','placeholder'].flatMap(name=>{const value=node.getAttribute(name);return value?[` ${name}="${escape(cleanText(value))}"`]:[];})].join('');
  if(tag==='img'){const src=node.getAttribute('src')||'';return '  '.repeat(depth)+`<img src="${src.startsWith('data:')?'[embedded image]':escape(src.slice(0,300))}"${attrs}>\n`;}
  const open=`<${tag}${attrs}>`;room-=open.length;
  const inner=[...node.childNodes].map(child=>walk(child,depth+1)).join('');
  if(!inner.includes('\n')||inner.trim().length<60&&!inner.trim().includes('<'))return '  '.repeat(depth)+open+inner.trim()+`</${tag}>\n`;
  return '  '.repeat(depth)+open+'\n'+inner+'  '.repeat(depth)+`</${tag}>\n`;
 };
 const html=walk(root,0).trimEnd();
 return room<=0?html+'\n<!-- shortened: the element is larger than this excerpt -->':html;
}
const label=(el:Element|null)=>el?(el.getAttribute('aria-label')||el.textContent||el.tagName.toLowerCase()).replace(/\s+/g,' ').trim().slice(0,50):'';
/** Where the element sits: its size, the layout of its parent and its neighbours. */
export function layoutSummary(el:Element){
 const box=el.getBoundingClientRect(),parent=el.parentElement,css=parent?getComputedStyle(parent):null,parts=[`Rendered ${Math.round(box.width)} × ${Math.round(box.height)}px`];
 if(parent&&css){
  const flow=css.display.includes('grid')?`grid, columns ${css.gridTemplateColumns}`:css.display.includes('flex')?`flex ${css.flexDirection}`:css.display;
  parts.push(`inside <${parent.tagName.toLowerCase()}> “${label(parent)}” laid out as ${flow}${css.gap&&css.gap!=='normal'?`, gap ${css.gap}`:''}, ${Math.round(parent.getBoundingClientRect().width)}px wide`);
 }
 if(el.previousElementSibling)parts.push(`after “${label(el.previousElementSibling)}”`);
 if(el.nextElementSibling)parts.push(`before “${label(el.nextElementSibling)}”`);
 return parts.join('; ');
}
function pageDesign(root:HTMLElement){
 const body=getComputedStyle(document.body),heading=root.querySelector('h1,h2,h3'),button=root.querySelector('button,[role=button]'),card=root.querySelector('article,section,[class*=card]');
 const page:Record<string,string>={font:body.fontFamily,'text colour':body.color,'body size':body.fontSize,'page background':body.backgroundColor};
 if(heading){const css=getComputedStyle(heading);page['heading style']=`${css.fontSize} / weight ${css.fontWeight}, ${css.color}`;}
 if(button){const css=getComputedStyle(button);page['button style']=`${css.backgroundColor}, ${css.color}, radius ${css.borderRadius}, padding ${css.padding}`;}
 if(card){const css=getComputedStyle(card);page['surface style']=`${css.backgroundColor}, radius ${css.borderRadius}, shadow ${css.boxShadow}, border ${css.border}`;}
 return page;
}
export function collectEvidence(workflow:Workflow,root:HTMLElement,owned:Map<string,HTMLElement>,applied:(id:string)=>HTMLElement|undefined):DesignEvidence{
 const changes:DesignEvidence['changes']={},find=(op:Extract<Operation,{target:unknown}>)=>{const live=applied(op.id);if(live?.isConnected)return live;try{return op.target.owned?owned.get(op.target.owned)||null:resolve(op.target,root,owned);}catch{return null;}};
 for(const state of workflow.states)for(const op of state.operations){
  if(op.kind==='insert'){const el=owned.get(op.node.id);if(el?.isConnected)changes[op.id]={html:renderedMarkup(el),layout:layoutSummary(el)};continue;}
  if(!('target' in op))continue;
  if(!['style','appearance','css','text','reorder','layout'].includes(op.kind))continue;
  const el=find(op);if(!el)continue;
  const css=getComputedStyle(el),names=op.kind==='style'||op.kind==='appearance'?Object.keys(op.style).map(key=>key.replace(/[A-Z]/g,match=>'-'+match.toLowerCase())):op.kind==='css'?op.css.split(';').map(rule=>rule.split(':')[0].trim()).filter(Boolean):[];
  const styles=Object.fromEntries(names.flatMap(name=>{const value=css.getPropertyValue(name);return value?[[name,value]]:[];}));
  changes[op.id]={layout:layoutSummary(el),...(Object.keys(styles).length?{styles}:{})};
 }
 return {page:pageDesign(root),viewport:`${innerWidth} × ${innerHeight}`,changes};
}
