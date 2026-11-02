import {z} from 'zod';
const attrs=['d','cx','cy','r','rx','ry','x','y','x1','x2','y1','y2','width','height','points','fill','fill-rule','clip-rule','stroke','stroke-width','stroke-linecap','stroke-linejoin','opacity','transform'] as const;
const value=z.string().max(10000).refine(s=>!/[<>"&\\]|url\s*\(|javascript|data:/i.test(s));
/** Static geometry only: no markup, scripts, event handlers, links, use, or foreign objects. */
export const CopyIconSchema=z.object({viewBox:z.string().max(100).regex(/^[\d.eE+\- ,]+$/),shapes:z.array(z.object({tag:z.enum(['path','circle','rect','line','polyline','polygon','ellipse']),attrs:z.record(z.enum(attrs),value)}).strict()).max(64)}).strict();
export function captureIcon(source:SVGSVGElement){
 const shapes:z.infer<typeof CopyIconSchema>['shapes']=[];
 for(const el of source.querySelectorAll('path,circle,rect,line,polyline,polygon,ellipse')){
  if(shapes.length>=64)return null;const attributes:Record<string,string>={};
  for(const name of attrs){const v=el.getAttribute(name);if(v&&value.safeParse(v).success)attributes[name]=v;}
  const css=getComputedStyle(el);for(const name of ['fill','stroke','stroke-width'] as const){const v=css.getPropertyValue(name);if(v&&value.safeParse(v).success)attributes[name]=v;}
  const transforms:string[]=[];let p:Element|null=el.parentElement;while(p&&p!==source){const t=p.getAttribute('transform');if(t&&value.safeParse(t).success)transforms.unshift(t);p=p.parentElement;}
  if(attributes.transform)transforms.push(attributes.transform);if(transforms.length)attributes.transform=transforms.join(' ');
  shapes.push({tag:el.tagName.toLowerCase() as z.infer<typeof CopyIconSchema>['shapes'][number]['tag'],attrs:attributes});
 }
 const width=source.getAttribute('width')||'24',height=source.getAttribute('height')||'24';
 const result=CopyIconSchema.safeParse({viewBox:source.getAttribute('viewBox')||`0 0 ${width} ${height}`,shapes});return result.success&&shapes.length?result.data:null;
}
export function renderIcon(icon:z.infer<typeof CopyIconSchema>){
 const data=CopyIconSchema.parse(icon),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',data.viewBox);svg.setAttribute('width','100%');svg.setAttribute('height','100%');svg.setAttribute('aria-hidden','true');
 for(const shape of data.shapes){const node=document.createElementNS(svg.namespaceURI,shape.tag);for(const [key,value]of Object.entries(shape.attrs))node.setAttribute(key,value);svg.append(node);}return svg;
}

/** Small, static line-icon vocabulary; geometry never comes from model markup. */
export function namedIcon(name:string):z.infer<typeof CopyIconSchema>{
 const paths:Record<string,string>={flask:'M9 3h6 M10 3v7l-6 9a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-9V3 M8 15h8',gauge:'M4 18a9 9 0 1 1 16 0 M12 13l4-5 M7 18h10',check:'M5 12l4 4L19 6',chart:'M5 20V10 M12 20V4 M19 20v-7',shield:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',mail:'M3 5h18v14H3z M3 5l9 7 9-7',user:'M8 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M4 21v-2a8 8 0 0 1 16 0v2'};
 paths.tokens='M20 7c0 2-4 4-8 4S4 9 4 7s4-4 8-4 8 2 8 4z M4 7v5c0 2 4 4 8 4s8-2 8-4V7 M4 12v5c0 2 4 4 8 4s8-2 8-4v-5';
 paths.drift='M3 17l6-6 4 3 8-10 M15 4h6v6';
 paths['trend-up']=paths.drift;paths['trend-down']='M3 7l6 6 4-3 8 10 M15 20h6v-6';
 paths.gear='M9 3h6l.5 3 2 1.2 2.8-1 3 5.2-2.3 2 .0 2.3 2.3 2-3 5.2-2.8-1-2 1.2-.5 3H9l-.5-3-2-1.2-2.8 1-3-5.2 2.3-2v-2.3l-2.3-2 3-5.2 2.8 1 2-1.2z M16 13a4 4 0 1 1-8 0a4 4 0 1 1 8 0';
 paths.settings=paths.gear;paths.cog=paths.gear;
 Object.assign(paths,{
  clock:'M12 21a9 9 0 1 0 0-18a9 9 0 1 0 0 18 M12 7v5l3 2',
  document:'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z M14 3v5h5 M9 13h6 M9 17h6',
  video:'M3 7a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z M16 10l5-3v10l-5-3',
  chat:'M4 5h16v11H9l-5 4z M8 9h8 M8 12h5',
  info:'M12 21a9 9 0 1 0 0-18a9 9 0 1 0 0 18 M12 11v6 M12 7.5v.5',
  'chevron-down':'M6 9l6 6 6-6','chevron-right':'M9 6l6 6-6 6','chevron-up':'M6 15l6-6 6 6','chevron-left':'M15 6l-6 6 6 6',
  plus:'M12 5v14 M5 12h14','arrow-up-right':'M7 17L17 7 M8 7h9v9','arrow-right':'M5 12h14 M13 6l6 6-6 6',
  copy:'M9 9h11v11H9z M5 15H4V4h11v1',bell:'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z M10 20a2 2 0 0 0 4 0',
  help:'M12 21a9 9 0 1 0 0-18a9 9 0 1 0 0 18 M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7 M12 17v.5',
  grid:'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
  book:'M4 5a2 2 0 0 1 2-2h5v17H6a2 2 0 0 0-2 2z M20 5a2 2 0 0 0-2-2h-5v17h5a2 2 0 0 1 2 2z',
  play:'M8 5v14l11-7z',calendar:'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4',sparkle:'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
  list:'M9 6h11 M9 12h11 M9 18h11 M4 6h.5 M4 12h.5 M4 18h.5',quote:'M5 17c2 0 4-2 4-5V7H4v5h4 M15 17c2 0 4-2 4-5V7h-5v5h4',
  mic:'M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0z M5 11a7 7 0 0 0 14 0 M12 18v3',image:'M4 5h16v14H4z M4 16l5-5 4 4 3-3 4 4 M15 8.5a1.5 1.5 0 1 0 .01 0',
  edit:'M4 20h4L19 9l-4-4L4 16z M14 6l4 4',star:'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z',
  users:'M9 11a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7 M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6 M16 4.5a3.5 3.5 0 0 1 0 6.5 M18 14c2 .7 3 2.8 3 6',
  close:'M6 6l12 12 M18 6L6 18',more:'M12 5h.01 M12 12h.01 M12 19h.01',
  feedback:'M4 4h10v8H8l-4 3z M14 9h6v8l-3-2h-6v-3 M7 8h4'
 });
 Object.assign(paths,{record:paths.mic,transcript:paths.document,message:paths.chat,comment:paths.chat,external:paths['arrow-up-right'],summary:paths.book,clip:paths.video,x:paths.close});
 const d=paths[name.trim().toLowerCase()];if(!d)throw new Error('Choose a supported icon: '+Object.keys(paths).join(', ')+'.');
 return {viewBox:name.trim().toLowerCase().match(/^(gear|settings|cog)$/)?'0 0 26 28':'0 0 24 24',shapes:[{tag:'path',attrs:{d,fill:'none',stroke:'currentColor','stroke-width':'2','stroke-linecap':'round','stroke-linejoin':'round'}}]};
}

export const iconNames=['gear','flask','gauge','check','chart','shield','mail','user','users','tokens','trend-up','trend-down','clock','document','video','chat','feedback','info','chevron-down','chevron-right','chevron-up','chevron-left','plus','arrow-up-right','arrow-right','copy','bell','help','grid','book','play','calendar','sparkle','list','quote','mic','image','edit','star','close','more'];
