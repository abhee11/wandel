/**
 * Codebase context: Markdown the user's own coding AI wrote from their repository (routes, API, data model,
 * components, rules). It is stored per app in the browser, and only the sections related to a request are sent.
 */
import {words} from '../appmap/relevant';
export interface DocFile{name:string;text:string;addedAt:string}
export interface AppDocs{origin:string;files:DocFile[];updatedAt:string}
export interface DocSection{file:string;heading:string;text:string;index:number}
export const MAX_FILES=10,MAX_FILE_CHARS=200_000,MAX_TOTAL_CHARS=600_000,DOCS_LIMIT=10_000;
const SECTION_CHARS=2400;

/** The prompt the user runs in Claude Code, Cursor or another coding agent, inside their repository. */
export const CODEBASE_PROMPT=`Write a file named wandel-context.md that describes this application for a design tool that prototypes changes on the running app. Read the code; don't guess. Use exactly these level-2 headings, and keep each part factual and compact.

## Overview
What the product does, who uses it, and the main user roles, in a few sentences.

## Routes
One line per page: the URL path (use :id for ids), the page or component that renders it, and what the user sees and can do there.

## API
One entry per endpoint the frontend calls: METHOD /path, the request fields, the response fields (name and type), and validation or permission rules with the exact error messages users see.

## Data model
The main entities, their fields and types, and the allowed values of status, type or role fields.

## Components and design tokens
The shared UI components to reuse (name, file, props, variants), and the design tokens: colours, type sizes, spacing, radii, shadows, with their names and values.

## Product rules
Who can do what, plan limits, feature flags, and the wording conventions of the product.

## Architecture
How the frontend, backend and services fit together, as a short list. Add a Mermaid diagram if it helps.

Never include secrets, API keys, tokens, passwords, connection strings, environment variable values, or real customer data such as names, emails or phone numbers. Use made-up examples where an example helps.`;

/** Strips things that look like secrets or personal contact details. Returns the cleaned text and how many were removed. */
export function scrubDoc(text:string){
 let removed=0;const hit=(replacement:string)=>()=>{removed++;return replacement;};
 const clean=text
  .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,hit('[private key removed]'))
  .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@/gi,m=>{removed++;return m.replace(/\/\/[^@]+@/,'//[credentials removed]@');})
  .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,m=>/@(?:example\.(?:com|org|net|test)|test\.com)$/i.test(m)?m:hit('[email]')())
  .replace(/\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{8,}\b|\bsk-[A-Za-z0-9_-]{16,}\b|\b(?:ghp|gho|ghs|github_pat)_[A-Za-z0-9_]{16,}\b|\bxox[abpr]-[A-Za-z0-9-]{10,}\b|\bAKIA[0-9A-Z]{16}\b|\bAIza[0-9A-Za-z_-]{30,}\b|\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}\b/g,hit('[credential]'))
  .replace(/\b((?:[A-Z][A-Z0-9_]*_)?(?:password|passwd|secret|token|api[_-]?key|private[_-]?key|access[_-]?key|client[_-]?secret)\s*[:=]\s*)(["']?)[^\s"'`,;]{6,}\2/gi,(_m,key:string)=>{removed++;return key+'[removed]';})
  .replace(/\b(?:bearer|basic)\s+[A-Za-z0-9._~+/=-]{16,}/gi,hit('[credential]'))
  .replace(/\b(?:\d[ -]?){13,19}\b/g,m=>/^\d{4}-\d{2}-\d{2}/.test(m)?m:hit('[number]')());
 return {text:clean,removed};
}

/** Splits Markdown into sections at headings, each carrying its heading trail; long sections are cut at paragraph breaks. */
export function splitSections(file:string,text:string):DocSection[]{
 const out:DocSection[]=[];const trail:string[]=[];let body:string[]=[];let fence=false;
 const flush=()=>{const content=body.join('\n').trim();body=[];if(!content)return;const heading=trail.filter(Boolean).join(' › ');
  for(let part=0,rest=content;rest;part++){let cut=rest.length<=SECTION_CHARS?rest.length:rest.lastIndexOf('\n\n',SECTION_CHARS);if(cut<SECTION_CHARS/3)cut=rest.lastIndexOf('\n',SECTION_CHARS);if(cut<SECTION_CHARS/3)cut=SECTION_CHARS;
   out.push({file,heading:heading+(part?' (continued)':''),text:rest.slice(0,cut).trim(),index:out.length});rest=rest.slice(cut).trim();}};
 for(const line of text.replace(/\r\n?/g,'\n').split('\n')){
  if(/^\s*(```|~~~)/.test(line))fence=!fence;
  const m=!fence&&line.match(/^(#{1,4})\s+(.+?)\s*#*\s*$/);
  if(m){flush();const level=m[1].length;trail.length=level-1;trail[level-1]=m[2].slice(0,120);continue;}
  body.push(line);
 }
 flush();return out;
}

const OVERVIEW=/\b(overview|summary|introduction|about)\b/i;
/** The sections most related to the request and the current page, within `limit` characters, in document order. */
export function relevantDocs(docs:AppDocs|null|undefined,text:string,route='',limit=DOCS_LIMIT){
 if(!docs?.files.length)return '';
 const all=docs.files.flatMap((file,f)=>splitSections(file.name,file.text).map(section=>({...section,order:f*100000+section.index})));
 if(!all.length)return '';
 const asked=words(text),here=words(route.replace(/[/:_-]/g,' '));
 const scored=all.map(section=>{const head=words(section.heading),body=words(section.text);let score=0;
  for(const word of asked){if(head.has(word))score+=3;else if(body.has(word))score+=1;}
  for(const word of here)if(body.has(word)||head.has(word))score+=2;
  // Routes listed in the doc as paths: the current page's path is a strong match.
  if(route&&route!=='/'&&section.text.includes(route))score+=4;
  return {section,score};});
 const overview=scored.find(item=>OVERVIEW.test(item.section.heading))||scored[0];
 const ranked=scored.filter(item=>item.score>0&&item!==overview).sort((a,b)=>b.score-a.score||a.section.order-b.section.order);
 const picked:typeof scored=[];let size=0;
 for(const item of [overview,...ranked]){const length=item.section.text.length+item.section.heading.length+item.section.file.length+12;if(size+length>limit)continue;picked.push(item);size+=length;}
 return picked.sort((a,b)=>a.section.order-b.section.order).map(({section})=>`### ${section.file}${section.heading?' › '+section.heading:''}\n${section.text}`).join('\n\n');
}

/** Adds or replaces a file by name, after scrubbing, within the size limits. */
export function addFile(docs:AppDocs,name:string,raw:string,now=new Date().toISOString()):{docs:AppDocs;removed:number}{
 const cleanName=name.replace(/[^\w .()-]/g,'').trim().slice(0,80)||'context.md';
 const text=raw.replace(/\0/g,'').trim();
 if(!text)throw new Error('That file is empty.');
 if(text.length>MAX_FILE_CHARS)throw new Error(`That file is too long. Keep each file under ${MAX_FILE_CHARS.toLocaleString()} characters.`);
 const scrubbed=scrubDoc(text),files=[...docs.files.filter(file=>file.name!==cleanName),{name:cleanName,text:scrubbed.text,addedAt:now}];
 if(files.length>MAX_FILES)throw new Error(`Wandel keeps up to ${MAX_FILES} files per app. Remove one first.`);
 if(files.reduce((total,file)=>total+file.text.length,0)>MAX_TOTAL_CHARS)throw new Error('These files are too long together. Remove one first.');
 return {docs:{origin:docs.origin,files,updatedAt:now},removed:scrubbed.removed};
}
export const emptyDocs=(origin:string):AppDocs=>({origin,files:[],updatedAt:new Date(0).toISOString()});
export function validDocs(value:unknown,origin:string):AppDocs{
 const v=value as AppDocs|undefined;
 if(!v||!Array.isArray(v.files))return emptyDocs(origin);
 return {origin,updatedAt:typeof v.updatedAt==='string'?v.updatedAt:new Date(0).toISOString(),files:v.files.filter(file=>file&&typeof file.name==='string'&&typeof file.text==='string').slice(0,MAX_FILES).map(file=>({name:file.name.slice(0,80),text:file.text.slice(0,MAX_FILE_CHARS),addedAt:typeof file.addedAt==='string'?file.addedAt:''}))};
}
