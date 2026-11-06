/** Markup and styles the assistant writes for a custom block: only inert structure and appearance survive. No script, handlers, frames, forms that submit or links that navigate. */
const tags=new Set(['div','span','p','h1','h2','h3','h4','h5','h6','ul','ol','li','button','img','table','thead','tbody','tfoot','tr','th','td','caption','label','input','textarea','select','option','strong','em','b','i','u','small','mark','br','hr','section','header','footer','nav','article','aside','main','figure','figcaption','blockquote','code','pre','dl','dt','dd','progress','meter','details','summary','time','abbr','sup','sub','a',
 'svg','g','path','circle','ellipse','rect','line','polyline','polygon','text','tspan','defs','lineargradient','radialgradient','stop','clippath','title']);
const attributes=new Set(['class','style','role','title','alt','type','placeholder','value','checked','selected','disabled','readonly','rows','cols','colspan','rowspan','min','max','step','width','height','for','name','open','datetime','tabindex','lang','dir',
 'viewbox','d','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-dasharray','stroke-dashoffset','fill-rule','clip-rule','cx','cy','r','rx','ry','x','y','x1','y1','x2','y2','dx','dy','points','transform','opacity','fill-opacity','stroke-opacity','offset','stop-color','stop-opacity','gradientunits','gradienttransform','text-anchor','dominant-baseline','font-size','font-weight','xmlns','preserveaspectratio','clip-path','id']);
// Every CSS function that loads from a web address is out, or page text could be sent to another site in a request for an image.
export const remoteCss=/(?:-webkit-)?image-set\s*\(|cross-fade\s*\(|\bsrc\s*\(|image\s*\(\s*['"]/i;
const unsafeCss=/(@import[^;]*;?|expression\s*\(|behavior\s*:|-moz-binding|javascript:|(?:-webkit-)?image-set\s*\([^)]*\)?|cross-fade\s*\([^)]*\)?|\bsrc\s*\([^)]*\)?|url\s*\((?!\s*['"]?data:image\/(png|jpe?g|gif|webp|svg\+xml))[^)]*\)?)/gi;
const unsafeValue=new RegExp(unsafeCss.source,'i');
export function sanitizeCss(css:string){return css.replace(/<\/?style[^>]*>/gi,'').replace(unsafeCss,'/* removed */').slice(0,12000);}
/** Images come from this site or are embedded. An image from anywhere else is a request that could carry page text away. */
export const safeImage=(value:string)=>{try{const url=new URL(value);if(url.protocol==='data:')return /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(value);const here=location.hostname.replace(/^www\./,''),host=url.hostname;return url.protocol==='https:'&&!url.username&&!url.password&&(host===here||host.endsWith('.'+here));}catch{return /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(value);}};
export function sanitizeMarkup(html:string):DocumentFragment{
 const template=document.createElement('template');template.innerHTML=html;
 const clean=(node:Node)=>{
  for(const child of [...node.childNodes]){
   if(child.nodeType===Node.COMMENT_NODE){child.remove();continue;}
   if(!(child instanceof Element))continue;
   const tag=child.tagName.toLowerCase();
   // Unknown or active elements go entirely; their text is not kept either, since it may be code.
   if(!tags.has(tag)){child.remove();continue;}
   for(const attribute of [...child.attributes]){
    const name=attribute.name.toLowerCase(),value=attribute.value;
    const keep=attributes.has(name)||name.startsWith('aria-')||name==='data-option'||name==='src'&&tag==='img'&&safeImage(value);
    if(!keep||/javascript:|vbscript:/i.test(value)||name==='style'&&unsafeValue.test(value))child.removeAttribute(attribute.name);
   }
   // Links and buttons are prototype controls: they never navigate or submit.
   if(tag==='a')child.setAttribute('role',child.getAttribute('role')||'link');
   if(tag==='button'&&!child.getAttribute('type'))child.setAttribute('type','button');
   clean(child);
  }
 };
 clean(template.content);return template.content;
}
