/**
 * Turns a JSON value into its shape: field names and types, never the values.
 * Runs inside the page, so no value from the app's data ever leaves it. The only values kept are
 * short status-style words (paid, due, overdue) under keys that name a status, type or kind,
 * and only while there are few of them.
 */
export type ShapeType='string'|'number'|'boolean'|'null'|'array'|'object';
export interface Shape{
 /** Every type seen at this place; usually one. */
 types:ShapeType[];
 /** Object fields by name. */
 fields?:Record<string,Shape>;
 /** The shape of array items, merged. */
 items?:Shape;
 /** Status-style values seen here; dropped once there are more than MAX_VALUES. */
 values?:string[];
 /** Looks like personal data: its type is kept, its values never are. */
 personal?:true;
 /** Too many distinct values to be a fixed set. */
 open?:true;
 /** Missing from some objects that otherwise have this field's siblings. */
 optional?:true;
}
export const MAX_VALUES=8,MAX_FIELDS=60,MAX_DEPTH=6,MAX_ITEMS=20;
/** Keys whose values are secrets: the field is left out entirely, not even its type is kept. */
export const SECRET_KEY=/pass(word|wd|code)?$|secret|token|api[-_]?key|auth|session|cookie|credential|signature|^otp$|^pin$|^cvv|^cvc/i;
/** Keys whose values are about a person. */
const WHO='(first|last|full|given|family|middle|user|display|nick|customer|client|contact|owner|author|person|recipient|sender|holder|patient|employee|member|assignee|requester|reporter)';
export const PERSONAL_KEY=new RegExp('^('+WHO+'[_-]?)?name$|[_-]'+WHO+'[_-]?name$|'+/e-?mail|phone|mobile|fax|address|street|city|zip|postal|postcode|birth|dob|^age$|ssn|social_?security|passport|national_?id|tax_?id|licen[cs]e|iban|swift|routing|account_?(number|no)|card|^ip(_?address)?$|lat(itude)?$|lng$|lon(gitude)?$|avatar|photo|signature/.source,'i');
/** Keys that name a small fixed set of values worth keeping. */
const SET_KEY=/(^|_|-)(status|state|type|kind|role|plan|tier|category|priority|stage|level|mode|severity|visibility|frequency|interval|unit|currency|method|channel|source|direction|format|variant|size|color|colour|theme|locale|lang(uage)?)$/i;
const EMAIL=/[^\s@]+@[^\s@]+\.[^\s@]+/,PHONE=/^\+?[\d\s().-]{7,}$/,LONG_DIGITS=/\d{6,}/;
/** A value that looks personal whatever its key. */
export function personalValue(value:string){return EMAIL.test(value)||PHONE.test(value.trim())||LONG_DIGITS.test(value.replace(/[\s-]/g,''));}
const setWord=(value:string)=>/^[a-z][a-z_ -]{0,23}$/i.test(value)&&!/\d/.test(value);
const typeOf=(value:unknown):ShapeType=>value===null?'null':Array.isArray(value)?'array':typeof value==='number'?'number':typeof value==='boolean'?'boolean':typeof value==='object'?'object':'string';
export function shapeOf(value:unknown,key='',depth=0):Shape|null{
 if(value===undefined||typeof value==='function'||typeof value==='symbol'||typeof value==='bigint')return null;
 if(key&&SECRET_KEY.test(key))return null;
 const type=typeOf(value),shape:Shape={types:[type]};
 if(key&&PERSONAL_KEY.test(key))shape.personal=true;
 if(type==='string'){
  const text=value as string;
  if(personalValue(text))shape.personal=true;
  else if(!shape.personal&&SET_KEY.test(key)&&setWord(text))shape.values=[text];
 }
 if(depth>=MAX_DEPTH)return shape;
 if(type==='array'){
  let items:Shape|null=null;
  for(const item of (value as unknown[]).slice(0,MAX_ITEMS)){const next=shapeOf(item,key,depth+1);if(next)items=items?mergeShape(items,next):next;}
  if(items)shape.items=items;
 }
 if(type==='object'){
  const fields:Record<string,Shape>={};let count=0;
  for(const [name,child] of Object.entries(value as Record<string,unknown>)){
   if(count>=MAX_FIELDS)break;
   const next=shapeOf(child,name,depth+1);if(next){fields[name]=next;count++;}
  }
  shape.fields=fields;
 }
 return shape;
}
/** Combines two shapes of the same place, as seen in different responses. */
export function mergeShape(a:Shape,b:Shape):Shape{
 const shape:Shape={types:[...new Set([...a.types,...b.types])].sort() as ShapeType[]};
 if(a.personal||b.personal)shape.personal=true;
 if(a.open||b.open)shape.open=true;
 else if(!shape.personal&&(a.values||b.values)){
  const values=[...new Set([...(a.values||[]),...(b.values||[])])].sort();
  if(values.length>MAX_VALUES)shape.open=true;else shape.values=values;
 }
 if(a.items&&b.items)shape.items=mergeShape(a.items,b.items);else if(a.items||b.items)shape.items=a.items||b.items;
 if(a.fields||b.fields){
  const fields:Record<string,Shape>={},left=a.fields||{},right=b.fields||{};
  for(const name of [...new Set([...Object.keys(left),...Object.keys(right)])].slice(0,MAX_FIELDS)){
   const one=left[name],two=right[name];
   fields[name]=one&&two?mergeShape(one,two):{...(one||two)!,optional:true};
  }
  shape.fields=fields;
 }
 if(a.optional||b.optional)shape.optional=true;
 return shape;
}
/** One line per field, for the AI and for people: `amount: number`, `status: paid | due`. */
export function describeShape(shape:Shape,indent=''):string{
 const kind=shape.types.filter(t=>t!=='null').join(' or ')||'null',nullable=shape.types.includes('null')&&shape.types.length>1?' (can be empty)':'';
 const extra=shape.values?': '+shape.values.join(' | '):'',personal=shape.personal?' (personal)':'';
 if(shape.fields)return Object.entries(shape.fields).map(([name,child])=>{
  const head=indent+name+(child.optional?'?':'');
  if(child.fields)return head+':\n'+describeShape(child,indent+'  ');
  if(child.items?.fields)return head+': list of\n'+describeShape(child.items,indent+'  ');
  if(child.items)return head+': list of '+describeShape(child.items,'').trim();
  return head+': '+describeShape(child,'').trim();
 }).join('\n');
 if(shape.items)return indent+'list of '+describeShape(shape.items,'').trim();
 return indent+kind+nullable+extra+personal;
}
