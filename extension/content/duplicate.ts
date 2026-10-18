import { uid, LinkURLSchema, ImageSourceSchema, type CopyNode } from '../shared/model';
import { copyTags, copyStyles } from '../shared/model';

/** Serializable visual copy; host handlers, form values and identity are never copied. */
export function captureCopy(source:HTMLElement):CopyNode[]{
  const nodes:CopyNode[]=[];
  const visit=(node:Node,parent:number)=>{
    if(nodes.length>=150)throw new Error('This item is too large to duplicate. Select a smaller section.');
    if(node instanceof Text){nodes.push({id:uid(),parent,tag:'#text',text:node.data.slice(0,2000),style:{}});return;}
    if(!(node instanceof HTMLElement)||node.matches('script,style,noscript,iframe,object,embed,[data-dx-ignore]'))return;
    const tag=node.tagName.toLowerCase();
    const safeTag=copyTags.includes(tag as typeof copyTags[number])?tag:'div';
    const computed=getComputedStyle(node),style:Record<string,string>={};
    for(const key of copyStyles){const value=computed.getPropertyValue(key);if(value&&!/url\s*\(|expression|[<>\\]/i.test(value))style[key]=value.slice(0,300);}
    const index=nodes.length;
    nodes.push({id:uid(),parent,tag:safeTag as CopyNode['tag'],text:'',style,...(node instanceof HTMLAnchorElement&&LinkURLSchema.safeParse(node.href).success?{href:node.href}:{}),...(['button','link'].includes(node.getAttribute('role')||'')?{role:node.getAttribute('role') as 'button'|'link'}:{}),...(node instanceof HTMLImageElement&&ImageSourceSchema.safeParse(node.currentSrc||node.src).success?{src:node.currentSrc||node.src,alt:node.alt.slice(0,300)}:{}),inputType:node instanceof HTMLInputElement?(['text','email','number','tel','url','search','date','checkbox','radio','password'].includes(node.type)?node.type as CopyNode['inputType']:'text'):undefined,placeholder:node instanceof HTMLInputElement?node.placeholder.slice(0,300):undefined});
    if(!node.matches('input,textarea,select'))for(const child of node.childNodes)visit(child,index);
  };
  visit(source,-1);
  if(!nodes.length)throw new Error('Select a visible item to duplicate.');
  return nodes;
}
