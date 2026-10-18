import { z } from 'zod';
import { StyleSchema, NodeSchema, DataEntrySchema, DataKeySchema } from '../shared/model';
const flowText=z.string().trim().min(1).max(300);
const FlowActionSchema=z.object({label:flowText,to:DataKeySchema,effects:z.array(DataEntrySchema).max(12)}).strict();
export const FlowPlanSchema=z.object({
 name:flowText,entryLabel:z.string().trim().min(1).max(100),
 variables:z.array(DataEntrySchema).max(12).optional(),
 screens:z.array(z.object({
  id:DataKeySchema.optional(),title:z.string().trim().min(1).max(100),body:flowText,
  fields:z.array(z.string().trim().min(1).max(100)).max(6),actionLabel:z.string().trim().min(1).max(100).nullable(),
  actions:z.array(FlowActionSchema).max(4).optional(),
  boundFields:z.array(z.object({label:flowText,key:DataKeySchema,required:z.boolean().nullable().optional(),inputType:z.enum(['text','email','number','url','tel']).nullable().optional()}).strict()).max(6).optional(),
  cards:z.array(z.object({title:flowText,body:flowText}).strict()).max(6).optional(),
  metrics:z.array(z.object({label:flowText,value:flowText}).strict()).max(4).optional(),
  table:z.object({columns:z.array(flowText).min(1).max(5),rows:z.array(z.array(flowText).min(1).max(5)).max(6)}).strict().nullable().optional()
 }).strict()).min(2).max(8)
}).strict().superRefine((flow,ctx)=>{
 const fail=(message:string)=>ctx.addIssue({code:'custom',message});
 const variables=new Set((flow.variables||[]).map(v=>v.key));
 if(variables.size!==(flow.variables||[]).length)fail('Duplicate data keys.');
 const graph=flow.screens.some(s=>s.id!==undefined||s.actions!==undefined);
 if(graph){
  const ids=new Set(flow.screens.map(s=>s.id));
  if(ids.size!==flow.screens.length||ids.has(undefined))fail('Every screen needs a unique ID.');
  for(const screen of flow.screens){if(!screen.actions||screen.actionLabel!==null)fail('Graph screens need actions and actionLabel=null.');for(const a of screen.actions||[]){if(!ids.has(a.to))fail('Action destination does not exist.');for(const e of a.effects)if(!variables.has(e.key))fail('Action uses undeclared data.');}}
  const reachable=new Set<string>();const visit=(id:string)=>{if(reachable.has(id))return;reachable.add(id);for(const a of flow.screens.find(s=>s.id===id)?.actions||[])visit(a.to);};
  if(flow.screens[0].id)visit(flow.screens[0].id);if(reachable.size!==flow.screens.length)fail('Every screen must be reachable from the first screen.');
 }else flow.screens.forEach((screen,i)=>{if(i<flow.screens.length-1&&!screen.actionLabel)fail('Every intermediate screen needs a next action.');if(i===flow.screens.length-1&&screen.actionLabel!==null)fail('The final screen must have no next action.');});
 for(const screen of flow.screens){
  for(const field of screen.boundFields||[])if(!variables.has(field.key))fail('Field uses undeclared data.');
  if(screen.table?.rows.some(row=>row.length!==screen.table!.columns.length))fail('Table rows must match columns.');
  const text=JSON.stringify({title:screen.title,body:screen.body,cards:screen.cards,metrics:screen.metrics,table:screen.table});
  for(const match of text.matchAll(/\{\{([^{}]+)\}\}/g))if(!variables.has(match[1]))fail('Template uses undeclared data.');
 }
});
export type FlowPlan=z.infer<typeof FlowPlanSchema>;
export const SectionPlanSchema=z.object({title:z.string().trim().min(1).max(200),description:z.string().trim().min(1).max(300),cards:z.array(z.object({title:z.string().trim().min(1).max(100),body:z.string().trim().min(1).max(300)}).strict()).max(6),fields:z.array(z.string().trim().min(1).max(100)).max(6),actionLabel:z.string().trim().min(1).max(100).nullable()}).strict();
export const BatchSchema=z.object({steps:z.array(z.object({
  kind:z.enum(['insert','text','style','remove']),target:z.enum(['selected','form','submit']),
  position:z.enum(['before','after','inside','below']),element:z.enum(['button','panel','text','field']),
  text:z.string().max(300),style:StyleSchema.nullable(),control:NodeSchema.shape.control.nullable(),required:z.boolean().nullable().optional(),inputType:z.enum(['text','email','number','url','tel']).nullable().optional()
}).strict()).max(20),flow:FlowPlanSchema.nullable().optional(),section:SectionPlanSchema.nullable().optional()}).strict().refine(p=>p.steps.length>0||!!p.flow||!!p.section,'Plan needs edits or a workflow.').refine(p=>Number(p.steps.length>0)+Number(!!p.flow)+Number(!!p.section)===1,'Choose either edits, a flow, or a section redesign.');
export type Batch=z.infer<typeof BatchSchema>;

export function parseBatch(input:unknown):Batch {
  // Providers use null for unused style properties; normalize before strict validation.
  const value=JSON.parse(JSON.stringify(input));
  if(Array.isArray(value?.steps))for(const step of value.steps)if(step.style)step.style=Object.fromEntries(Object.entries(step.style).filter(([,v])=>v!==null));
  return BatchSchema.parse(value);
}
