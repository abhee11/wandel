import type {NativeDesign} from '../content/nativeDesign';
import {SectionPlanSchema} from './planSchema';
import {uid,type Locator,type Operation,type StylePatch} from '../shared/model';
export function sectionOperations(target:Locator,input:unknown,theme:StylePatch={},design?:NativeDesign){
 const plan=SectionPlanSchema.parse(input),id=uid(),operations:Operation[]=[];
 const owned=(owned:string):Locator=>({...target,owned});
 const insert=(parent:Locator,kind:'panel'|'button'|'text'|'field',text:string,position:'before'|'inside'='inside',nodeId=uid())=>{operations.push({id:uid(),kind:'insert',target:parent,position,node:{id:nodeId,kind,text,...(design?{appearance:kind==='panel'?design.card:kind==='button'?design.button:design.text,...(kind==='field'?{inputAppearance:design.field}:{})}:{})}});return owned(nodeId);};
 const style=(target:Locator,style:StylePatch)=>operations.push({id:uid(),kind:'style',target,style});
 const panel=insert(target,'panel',plan.title,'before',id);
 style(panel,{display:'flex',flexDirection:'column',gap:16,...(design?{}:{padding:28})});
 if(design){const first=operations[0];if(first.kind==='insert')first.node.appearance={...design.surface,...design.heading};}
 insert(panel,'text',plan.description);
 for(const card of plan.cards){const container=insert(panel,'panel',card.title);if(!design)style(container,{fontSize:20});insert(container,'text',card.body);}
 for(const field of plan.fields)insert(panel,'field',field);
 if(plan.actionLabel)style(insert(panel,'button',plan.actionLabel),theme);
 operations.push({id:uid(),kind:'remove',target});
 return {id,operations};
}
