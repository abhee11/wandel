import {copyTags,copyStyles,uid,VisitedScreenSchema,type CopyNode,type VisitedScreen} from '../shared/model';
/** Local visual capture: no executable markup, entered values, handlers or external image loads. */
export function captureScreen(doc:Document=document,url=new URL(doc.location.href)):VisitedScreen{
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error('Choose a regular application page.');
 for(const key of url.searchParams.keys())if(/token|secret|password|auth|code|session|key/i.test(key))throw new Error('Finish signing in before capturing this screen.');
 const win=doc.defaultView!;
 const dialogs=[...doc.querySelectorAll<HTMLElement>('[role=dialog],dialog[open]')].filter(n=>n.getBoundingClientRect().width>0);
 const root=dialogs.at(-1)||doc.querySelector<HTMLElement>('main,[role=main]')||doc.body;
 const nodes:CopyNode[]=[];let truncated=false;
 const canvas=doc.createElement('canvas');canvas.width=360;canvas.height=220;const ctx=canvas.getContext('2d');const bounds=root.getBoundingClientRect();const ratio=360/Math.max(bounds.width,360);
 if(ctx){ctx.fillStyle='#faf9fd';ctx.fillRect(0,0,360,220);}
 function visit(node:Node,parent:number){
  if(nodes.length>=800){truncated=true;return;}
  if(node.nodeType===Node.TEXT_NODE){const text=(node.textContent||'').slice(0,500);if(text.trim())nodes.push({id:uid(),parent,tag:'#text',text,style:{}});return;}
  if(node.nodeType!==Node.ELEMENT_NODE)return;const el=node as HTMLElement;
  if(el.matches('script,style,noscript,iframe,object,embed,canvas,svg,[data-dx-ignore],[data-dx-editor],[hidden]'))return;
  const css=win.getComputedStyle(el);if(css.display==='none'||css.visibility==='hidden')return;
  const tag=el.tagName.toLowerCase(),style:Record<string,string>={};
  for(const key of copyStyles){const value=css.getPropertyValue(key);if(value&&!/url\s*\(|expression|[<>\\]/i.test(value))style[key]=value.slice(0,300);}
  // A captured screen must fit its destination, never recreate the host's fixed modal layer.
  if(parent===-1){style.width='100%';style.height='auto';style['min-width']='0';style['max-width']='100%';style.margin='0';}
  const field=tag==='input'||tag==='textarea'||tag==='select';
  const index=nodes.length;nodes.push({id:uid(),parent,tag:(copyTags as readonly string[]).includes(tag)?tag as CopyNode['tag']:'div',text:'',style,...(tag==='input'?{inputType:['text','email','number','tel','url','search','date','checkbox','radio','password'].includes((el as HTMLInputElement).type)?(el as HTMLInputElement).type as CopyNode['inputType']:'text',placeholder:(el as HTMLInputElement).placeholder.slice(0,300)}:{}),...(['button','link'].includes(el.getAttribute('role')||'')?{role:el.getAttribute('role') as 'button'|'link'}:{})});
  if(ctx){const rect=el.getBoundingClientRect(),x=(rect.left-bounds.left)*ratio,y=(rect.top-bounds.top)*ratio,w=rect.width*ratio,h=rect.height*ratio;
   if(y<220&&y+h>0){if(css.backgroundColor!=='rgba(0, 0, 0, 0)'&&css.backgroundColor!=='transparent'){ctx.fillStyle=css.backgroundColor;ctx.fillRect(x,y,w,h);}const text=el.isContentEditable?'':field?((el as HTMLInputElement).placeholder||''):([...el.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join(' ').trim());if(text){ctx.fillStyle=css.color;ctx.font=`${Math.max(6,Math.min(22,parseFloat(css.fontSize)*ratio))}px system-ui`;ctx.fillText(text.slice(0,100),x,y+Math.min(h,16),Math.max(w,10));}}
  }
  if(!field&&!el.isContentEditable)for(const child of el.childNodes)visit(child,index);
 }
 visit(root,-1);if(!nodes.length)throw new Error('This screen has no capturable application content.');
 if(!ctx)throw new Error('A visual preview could not be created. Try a different screen.');
 const route=url.pathname+url.search+url.hash,title=((dialogs.at(-1)?.querySelector('h1,h2,h3')?.textContent||root.querySelector('h1,h2')?.textContent||doc.title).trim()||route||'/').slice(0,300);
 return VisitedScreenSchema.parse({id:uid(),url:url.href,route,title,thumbnail:canvas.toDataURL('image/png'),nodes,capturedAt:new Date().toISOString(),truncated});
}
