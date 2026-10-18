import {BatchSchema,type Batch} from './planSchema';
/** Explicit UI choice lists only. No inference of arbitrary features or host behavior. */
export function choicePlan(prompt:string):Batch|null{
 if(prompt.length>2000||! /\badd\b/i.test(prompt)||! /\b(section|category)\b/i.test(prompt)||! /\b(options?|choices?|pills?|toggles?)\b/i.test(prompt)||/\b(independent|multiple selections|multi.select|workflow|journey|screens)\b/i.test(prompt))return null;
 const title=prompt.match(/\b(?:section|category)\s+(?:called|named)\s+["“]?(.+?)["”]?\s+(?:which|that|with|having)\b/i)?.[1]?.trim()
  ||prompt.match(/\badd\s+(?:an?\s+)?["“]([^"”]+)["”]\s+(?:section|category)\b/i)?.[1]?.trim();
 if(!title||title.length>100)return null;
 let labels=[...prompt.matchAll(/(?:^|[\s;])([1-8])[.)]\s*(.+?)(?=(?:[\s;]+[1-8][.)]\s)|$)/g)].map(m=>m[2].trim());
 if(!labels.length){
  const list=prompt.match(/\b(?:include|options?:|choices?:)\s+(.+?)(?:[.!?]|$)/i)?.[1];
  if(list)labels=list.split(/\s*,\s*|\s+and\s+/i);
 }
 labels=labels.map(label=>label.replace(/\s*[-–—:]\s*toggle\s*(?:\([^)]*\))?/ig,'').replace(/[;,.]+$/,'').trim());
 if(labels.length<2||labels.length>8||labels.some(x=>!x||x.length>100)||new Set(labels.map(x=>x.toLowerCase())).size!==labels.length)return null;
 const selected=labels.findIndex(label=>new RegExp('\\b'+label.replace(/[.*+?^$\{\}()|[\]\\]/g,'\\$&')+'\\s+(?:selected|on)\\b','i').test(prompt));
 return BatchSchema.parse({steps:[{kind:'insert',target:'selected',position:'inside',element:'panel',text:title,style:null},...labels.map((text,i)=>({kind:'insert',target:'selected',position:'inside',element:'button',text:text+((selected<0?0:selected)===i?' — On':' — Off'),style:null}))],flow:null,section:null});
}
