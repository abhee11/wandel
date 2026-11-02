import {captureIcon} from './copyIcon';
import { uid, LinkURLSchema, ImageSourceSchema, type CopyNode } from '../shared/model';
import { copyTags, copyStyles } from '../shared/model';

/** Serializable visual copy; host handlers, form values and identity are never copied. */
export function captureCopy(source:HTMLElement,identities?:Map<Node,number>):CopyNode[]{
  const nodes:CopyNode[]=[];
  const visit=(node:Node,parent:number)=>{
    if(nodes.length>=150)throw new Error('This item is too large to duplicate. Select a smaller section.');
    if(node instanceof Text){identities?.set(node,nodes.length);nodes.push({id:uid(),parent,tag:'#text',text:node.data.slice(0,2000),style:{}});return;}
    // A visual copy excludes inactive/hidden UI branches and hidden form helpers.
    // They cannot be exercised in this static prototype and must not become
    // visible controls (a hidden input otherwise defaults to a text field).
    if(node instanceof Element){const css=getComputedStyle(node);if(node.hasAttribute('hidden')||css.display==='none'||css.visibility==='hidden'||css.visibility==='collapse'||node.matches('input[type=hidden]'))return;}
    if(node instanceof SVGSVGElement){const icon=captureIcon(node);if(icon){const css=getComputedStyle(node);identities?.set(node,nodes.length);nodes.push({id:uid(),parent,tag:'span',text:'',icon,style:{display:'inline-flex',width:css.width&&css.width!=='auto'?css.width:(parseFloat(node.getAttribute('width')||'')||24)+'px',height:css.height&&css.height!=='auto'?css.height:(parseFloat(node.getAttribute('height')||'')||24)+'px',color:css.color}});}return;}
    if(!(node instanceof HTMLElement)||node.matches('script,style,noscript,iframe,object,embed,[data-dx-ignore]'))return;
    const tag=node.tagName.toLowerCase();
    const safeTag=copyTags.includes(tag as typeof copyTags[number])?tag:'div';
    const computed=getComputedStyle(node),style:Record<string,string>={};
    for(const key of copyStyles){const value=computed.getPropertyValue(key);if(value&&value.length<=300&&!/url\s*\(|expression|[<>\\]/i.test(value))style[key]=value;}
    // Computed text heights are snapshots, not intrinsic layout constraints.
    // Let renamed/wrapped copy content grow at its new available width.
    if(!node.matches('img,input,br')&&!(node.querySelector('svg,img')&&!node.textContent?.trim()))style.height='auto';
    // Controls and empty visual boxes (e.g. CSS-drawn logos) size by CSS, not
    // content; keep their rendered height as a floor so the copy matches.
    if(style.height==='auto'&&(node.matches('button,a,[role=button],[role=link]')||!node.textContent?.trim()&&!node.children.length)&&!(parseFloat(style['min-height']||'')>0))style['min-height']=computed.height;
    if(node.matches('h1,h2,h3,h4,p,span,strong,em,small'))style.width='auto';
    style['max-width']='100%';style['min-width']='0';style['box-sizing']='border-box';
    const index=nodes.length;identities?.set(node,index);
    const background=!node.textContent?.trim()&&!node.children.length?/^url\(["']?([^"')]+)["']?\)$/.exec(computed.backgroundImage):null;
    nodes.push({id:uid(),parent,...(node.matches('[disabled],[aria-disabled=true]')?{disabled:true}:{}),tag:safeTag as CopyNode['tag'],text:'',style,...(node instanceof HTMLAnchorElement&&LinkURLSchema.safeParse(node.href).success?{href:node.href}:{}),...(['button','link'].includes(node.getAttribute('role')||'')?{role:node.getAttribute('role') as 'button'|'link'}:{}),...(node instanceof HTMLImageElement&&ImageSourceSchema.safeParse(node.currentSrc||node.src).success?{src:node.currentSrc||node.src,alt:node.alt.slice(0,300)}:{}),inputType:node instanceof HTMLInputElement?(['text','email','number','tel','url','search','date','checkbox','radio','password'].includes(node.type)?node.type as CopyNode['inputType']:'text'):undefined,placeholder:node instanceof HTMLInputElement?node.placeholder.slice(0,300):undefined});
    // An empty box drawn by a CSS background image (e.g. a partner logo) is copied
    // as an image under the same source rules as a copied <img>.
    if(background){const src=new URL(background[1],location.href).href,size=computed.backgroundSize;if(ImageSourceSchema.safeParse(src).success)nodes.push({id:uid(),parent:index,tag:'img',text:'',src,alt:'',style:{display:'block',width:computed.width,height:computed.height,'max-width':'100%','object-fit':size==='cover'?'cover':size==='100% 100%'?'fill':'contain'}});}
    if(!node.matches('input,textarea,select'))for(const child of node.childNodes)visit(child,index);
  };
  visit(source,-1);
  if(nodes[0]?.tag!=='#text')nodes[0].style['flex-shrink']='0';
  if(!nodes.length)throw new Error('Select a visible item to duplicate.');
  return nodes;
}
