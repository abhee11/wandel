import {captureIcon} from './copyIcon';
import { uid, LinkURLSchema, ImageSourceSchema, type CopyNode } from '../shared/model';
import { copyTags, copyStyles, svgBackground } from '../shared/model';

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
    // Screen-reader-only helpers are not visual content. Their clipping must
    // not be lost when the visual copy normalizes dimensions and positioning.
    if(node instanceof HTMLElement){const css=getComputedStyle(node);if(['absolute','fixed'].includes(css.position)&&(css.clip==='rect(0px, 0px, 0px, 0px)'||css.clipPath==='inset(50%)'||parseFloat(css.width)<=1&&parseFloat(css.height)<=1&&css.overflow==='hidden'))return;}
    if(node instanceof SVGSVGElement){const icon=captureIcon(node);if(icon){const css=getComputedStyle(node);identities?.set(node,nodes.length);nodes.push({id:uid(),parent,tag:'span',text:'',icon,style:{display:'inline-flex','flex-grow':css.flexGrow,'flex-shrink':css.flexShrink,'flex-basis':css.flexBasis,'align-self':css.alignSelf,width:css.width&&css.width!=='auto'?css.width:(parseFloat(node.getAttribute('width')||'')||24)+'px',height:css.height&&css.height!=='auto'?css.height:(parseFloat(node.getAttribute('height')||'')||24)+'px',color:css.color}});}return;}
    if(!(node instanceof HTMLElement)||node.matches('script,style,noscript,iframe,object,embed,[data-dx-ignore]'))return;
    const tag=node.tagName.toLowerCase();
    // A checkbox drawn entirely by a background image (e.g. a circle) is copied as that image in a box of its size.
    const drawnToggle=node.matches('input[type=checkbox],input[type=radio]')&&/^url\(/.test(getComputedStyle(node).backgroundImage)&&getComputedStyle(node).appearance==='none';
    const safeTag=drawnToggle?'span':copyTags.includes(tag as typeof copyTags[number])?tag:'div';
    const computed=getComputedStyle(node),style:Record<string,string>={};
    for(const key of copyStyles){const value=computed.getPropertyValue(key);if(value&&value.length<=300&&!/url\s*\(|expression|[<>\\]/i.test(value))style[key]=value;}
    if(svgBackground(computed.backgroundImage))style['background-image']=computed.backgroundImage;
    // Computed text heights are snapshots, not intrinsic layout constraints.
    // Let renamed/wrapped copy content grow at its new available width.
    if(!node.matches('img,input,br')&&!(node.querySelector('svg,img')&&!node.textContent?.trim()))style.height='auto';
    // Controls and empty visual boxes (e.g. CSS-drawn logos) size by CSS, not
    // content; keep their rendered height as a floor so the copy matches.
    if(style.height==='auto'&&(node.matches('button,a,[role=button],[role=link]')||!node.textContent?.trim()&&!node.children.length)&&!(parseFloat(style['min-height']||'')>0))style['min-height']=computed.height;
    if(node.matches('h1,h2,h3,h4,p,span,strong,em,small'))style.width='auto';
    style['max-width']='100%';style['min-width']='0';style['box-sizing']='border-box';
    // Overlays inside a card (e.g. a full-card click target) keep their absolute placement; the copy itself stays in flow,
    // and fixed or sticky positioning is never copied.
    if(!nodes.length){delete style.float;delete style.clear;}
    if(!nodes.length||!['absolute','relative'].includes(style.position||'')){for(const key of ['top','right','bottom','left','z-index'] as const)delete style[key];style.position=nodes.length?'static':'relative';}
    else if(style.position==='relative')for(const key of ['top','right','bottom','left'] as const)delete style[key];
    const index=nodes.length;identities?.set(node,index);
    const background=!node.textContent?.trim()&&!node.children.length?/^url\("(data:image\/svg\+xml[^"]+)"\)$/.exec(computed.backgroundImage)||/^url\(["']?([^"')]+)["']?\)$/.exec(computed.backgroundImage):null;
    nodes.push({id:uid(),parent,...(node.matches('[disabled],[aria-disabled=true]')?{disabled:true}:{}),tag:safeTag as CopyNode['tag'],text:'',style,...(node instanceof HTMLAnchorElement&&LinkURLSchema.safeParse(node.href).success?{href:node.href}:{}),...(['button','link'].includes(node.getAttribute('role')||'')?{role:node.getAttribute('role') as 'button'|'link'}:{}),...(node instanceof HTMLImageElement&&ImageSourceSchema.safeParse(node.currentSrc||node.src).success?{src:node.currentSrc||node.src,alt:node.alt.slice(0,300)}:{}),inputType:node instanceof HTMLInputElement&&!drawnToggle?(['text','email','number','tel','url','search','date','checkbox','radio','password'].includes(node.type)?node.type as CopyNode['inputType']:'text'):undefined,placeholder:node instanceof HTMLInputElement?node.placeholder.slice(0,300):undefined});
    // An empty box drawn by a CSS background image (e.g. a partner logo) is copied
    // as an image under the same source rules as a copied <img>.
    if(background){const src=new URL(background[1],location.href).href,size=computed.backgroundSize;if(ImageSourceSchema.safeParse(src).success)nodes.push({id:uid(),parent:index,tag:'img',text:'',src,alt:'',style:{display:'block',width:computed.width,height:computed.height,'max-width':'100%','object-fit':size==='cover'?'cover':size==='100% 100%'?'fill':'contain'}});}
    // Glyphs a page draws with ::before/::after (icon fonts, decorative marks) become real text in the copy.
    const pseudo=(which:'::before'|'::after')=>{const p=getComputedStyle(node,which),quoted=/^"((?:[^"\\]|\\.)*)"$/.exec(p.content||'');if(!quoted?.[1]||p.display==='none'||nodes.length>=148)return;
      const box=nodes.length;nodes.push({id:uid(),parent:index,tag:'span',text:'',style:{display:p.display==='block'?'block':'inline-block','font-family':p.fontFamily,'font-size':p.fontSize,'font-weight':p.fontWeight,'font-style':p.fontStyle,color:p.color,'line-height':p.lineHeight,margin:p.margin,padding:p.padding,'vertical-align':p.verticalAlign}});
      nodes.push({id:uid(),parent:box,tag:'#text',text:quoted[1].replace(/\\(.)/g,'$1').slice(0,40),style:{}});};
    pseudo('::before');
    if(!node.matches('input,textarea,select'))for(const child of node.childNodes)visit(child,index);
    pseudo('::after');
  };
  visit(source,-1);
  if(nodes[0]?.tag!=='#text')nodes[0].style['flex-shrink']='0';
  if(!nodes.length)throw new Error('Select a visible item to duplicate.');
  return nodes;
}
