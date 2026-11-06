import {resolve,atStructure} from './locator';
import type {Locator,Workflow} from '../shared/model';
/** A public, no-install view of a prototype: a sanitized copy of the page, for Wandel's player to run on. It carries no scripts, entered values, links or handlers. */
export const MAX_SNAPSHOT_BYTES=6*1024*1024;
const words=['a','to','the','text','short','sample','preview','example','prototype','placeholder'];
/** Plain placeholder words of the same length, so the layout holds while the content is gone. Numbers stay numbers in shape only. */
function maskWord(word:string){
 if(/^[\d.,:%/-]+$/.test(word))return word.replace(/\d/g,'0');
 let out='';while(out.length<word.length){const left=word.length-out.length,next=words.find(item=>item.length>=left)||words.at(-1)!;out+=next.slice(0,left);}
 return /^[A-Z]/.test(word)?out[0].toUpperCase()+out.slice(1):out;
}
const maskText=(text:string)=>text.replace(/\S+/g,maskWord);
const isLocator=(value:unknown):value is Locator=>!!value&&typeof value==='object'&&'ancestorTags' in value&&'tag' in value;
function eachLocator(value:unknown,visit:(locator:Locator)=>void){
 if(!value||typeof value!=='object')return;
 if(isLocator(value))visit(value);
 for(const child of Object.values(value))eachLocator(child,visit);
}
/** With masking on, nothing read from the real page may stay in the published data: references lose their words, and copied content that matches the page is replaced. */
function scrub(value:unknown,real:Set<string>):void{
 if(!value||typeof value!=='object')return;
 const record=value as Record<string,unknown>;
 if(isLocator(value)){const locator=value as Locator;locator.name='';locator.text='';locator.previous='';locator.next='';locator.parent={...locator.parent,label:''};if(locator.popup)locator.popup={...locator.popup,label:''};if(!locator.owned&&!locator.attrs['data-testid'])locator.attrs={};}
 for(const [key,child] of Object.entries(record)){
  // A pick-one group is named by a saved reference written out as text; it only has to stay unique.
  if(key==='group'&&typeof child==='string'){let hash=5381;for(const c of child)hash=(hash*33+c.charCodeAt(0))>>>0;record[key]='group-'+hash.toString(36);}
  else if(typeof child==='string'){if(real.has(child.trim())&&!['id','kind','tag','role'].includes(key))record[key]=maskText(child);}
  else scrub(child,real);
 }
}
function collectStyles(doc:Document){
 const origin=doc.location.origin,parts:string[]=[],links:string[]=[];
 for(const sheet of [...doc.styleSheets,...doc.adoptedStyleSheets]){
  if((sheet.ownerNode as Element|null)?.closest?.('[data-dx-ignore]'))continue;
  try{parts.push([...sheet.cssRules].map(rule=>rule.cssText).join('\n').replace(/url\(\s*(["']?)\/(?!\/)/g,`url($1${origin}/`));}catch{if(sheet.href)links.push(sheet.href);}
 }
 return {css:parts.join('\n'),links};
}
function sanitize(root:Element,origin:string,mask:boolean){
 for(const node of root.querySelectorAll('script,noscript,iframe,object,embed,frame,frameset,meta,base,link,style,template,canvas,video,audio,source,[data-dx-ignore],[data-dx-editor],[data-dx-owned]'))node.remove();
 for(const el of root.querySelectorAll('*')){
  for(const attribute of [...el.attributes]){
   const name=attribute.name.toLowerCase();
   if(name.startsWith('on')||name==='srcset'||name==='srcdoc'||name==='href'||name==='data-extension-id'||name==='action'||name==='formaction'||name==='ping'||name==='style'&&/url\(\s*["']?javascript:/i.test(attribute.value))el.removeAttribute(attribute.name);
   else if(mask&&['aria-label','aria-description','title','alt','placeholder','value'].includes(name))el.setAttribute(attribute.name,'Sample');
  }
  if(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement||el instanceof HTMLSelectElement){el.removeAttribute('value');if(el instanceof HTMLTextAreaElement)el.textContent='';}
  if(el instanceof HTMLImageElement){if(mask)el.removeAttribute('src');else{const src=el.getAttribute('src');if(src&&!/^(https?:|data:image\/)/i.test(src)){try{el.setAttribute('src',new URL(src,origin).href);}catch{el.removeAttribute('src');}}}}
 }
 if(mask){const walk=root.ownerDocument.createTreeWalker(root,NodeFilter.SHOW_TEXT);for(let node=walk.nextNode();node;node=walk.nextNode())if(node.textContent?.trim())node.textContent=maskText(node.textContent);}
}
export type PublicSnapshot={html:string;workflow:Workflow;masked:boolean;skippedScreens:number;bytes:number};
/** Call with the prototype's own changes off, so the copy is the page they apply to. */
export function publicSnapshot(doc:Document,workflow:Workflow,owned:Map<string,HTMLElement>,mask:boolean,pageURL:string):PublicSnapshot{
 // References are rewritten to stamped identities, so edits still land when the page's words are masked.
 const published=structuredClone(workflow),stamped=new Map<HTMLElement,string|null>();let count=0;
 eachLocator(published,locator=>{
  if(locator.owned)return;
  const node=resolve(locator,doc.body,owned)||atStructure(locator,doc.body);if(!node)return;
  let id=node.dataset.dxStamp;if(!id){id='dxs'+(++count);stamped.set(node,node.getAttribute('data-testid'));node.dataset.dxStamp=id;node.setAttribute('data-testid',id);}
  locator.attrs={'data-testid':id};
 });
 // A frozen copy has no app behind it and its words may be masked, so a condition on page text is settled now: it always applies, or it never does. The words themselves stay out of the link.
 const pageText=(doc.body.textContent||'').toLowerCase();
 for(const state of published.states)state.operations=state.operations.filter(op=>{if(op.kind!=='behavior'||!op.when?.text)return true;const holds=pageText.includes(op.when.text.toLowerCase())===op.when.present;delete op.when;return holds;});
 // A viewer needs neither the conversation that built this nor pictures of the real screens.
 delete published.assistantMemory;for(const state of published.states)delete state.screen;
 if(mask){
  const real=new Set<string>(),walk=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT);
  for(let node=walk.nextNode();node;node=walk.nextNode()){const text=node.textContent?.trim();if(text&&!node.parentElement?.closest('[data-dx-ignore],[data-dx-owned],script,style'))real.add(text);}
  // Copied elements keep only the words chosen for them; anything else was read from the page, even if it isn't on screen now.
  for(const state of published.states)for(const op of state.operations)if(op.kind==='insert'&&op.node.copy)for(const part of op.node.copy)if(part.tag==='#text'&&part.text&&part.text.trim()!==op.node.text.trim())part.text=maskText(part.text);
  for(const state of published.states)scrub(state,real);
 }
 let html='';
 try{
  const {css,links}=collectStyles(doc),copy=doc.documentElement.cloneNode(true) as HTMLElement;
  sanitize(copy,doc.location.origin,mask);
  for(const node of copy.querySelectorAll('[data-dx-stamp]'))node.removeAttribute('data-dx-stamp');
  const head=copy.querySelector('head')||copy.insertBefore(doc.createElement('head'),copy.firstChild);
  const charset=doc.createElement('meta');charset.setAttribute('charset','utf-8');head.prepend(charset);
  for(const href of links){const link=doc.createElement('link');link.rel='stylesheet';link.href=href;head.append(link);}
  const style=doc.createElement('style');style.textContent=css;head.append(style);
  const title=head.querySelector('title')||head.appendChild(doc.createElement('title'));title.textContent=workflow.name;
  html='<!doctype html>'+copy.outerHTML;
 }finally{
  for(const [node,previous] of stamped){delete node.dataset.dxStamp;if(previous===null)node.removeAttribute('data-testid');else node.setAttribute('data-testid',previous);}
 }
 const bytes=new TextEncoder().encode(html).length+JSON.stringify(published).length;
 if(bytes>MAX_SNAPSHOT_BYTES)throw new Error('This page is too large to publish. Hide large sections first.');
 const skippedScreens=workflow.states.filter(state=>state.liveURL&&state.liveURL!==pageURL).length;
 return {html,workflow:published,masked:mask,skippedScreens,bytes};
}
