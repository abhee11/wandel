import {resolveInspections} from './inspection';
import {normalizePlan,validatePlanReferences} from './plan';
import type {AssistantPlan,PageContext} from './schema';
export const rolledBackPreview='Preview rolled back: ';
/** A rendered change with diagnostic evidence for AI review and targeted correction. */
export const keptPreview='Preview kept: ';
/** Diagnostic evidence that a new item differs from its neighbours; AI judges whether it matters. */
export const neighbourMismatch='Does not match its neighbours: ';
/** Retry only a confirmed preflight rejection or fully restored preview, and only with a changed plan. */
export async function applyVerifiedPlan(instruction:string,initial:AssistantPlan,context:PageContext,options:{apply:(plan:AssistantPlan,c:PageContext)=>Promise<void>;refresh:()=>Promise<PageContext>;inspect?:(refs:string[])=>Promise<PageContext>;replan:(feedback:string,c:PageContext)=>Promise<AssistantPlan>;active:()=>boolean;repairing:()=>void}){
 let plan=initial,current=context;
 // Result refs are names, and element refs are reissued with each fresh context;
 // compare the elements themselves, since anything else equal repeats the same failure.
 const identity=(ref:string|null,c:PageContext)=>{const e=ref&&c.elements.find(element=>element.ref===ref);return e?[e.tag,e.role,e.name,e.text,Math.round(e.bounds.x),Math.round(e.bounds.y)].join('|'):ref;};
 const signature=(p:AssistantPlan,c:PageContext)=>JSON.stringify(p.actions.map(({resultRef,targets,relativeTo,styleRef,...action})=>({...action,targets:targets.map(ref=>identity(ref,c)),relativeTo:identity(relativeTo??null,c),styleRef:identity(styleRef??null,c)}))),failed=new Set<string>();
 for(let attempt=0;attempt<3;attempt++){
  if(!options.active())throw new Error('Request canceled.');
  try{await options.apply(plan,current);return plan;}catch(error){
   const message=error instanceof Error?error.message:'';
   if(!(message.startsWith(rolledBackPreview)||message.startsWith('Preview not applied: '))||!options.active())throw error;
   failed.add(signature(plan,current));if(attempt===2)throw error;
   options.repairing();current=await options.refresh();
   if(!options.active()||current.workflowId!==context.workflowId||current.stateId!==context.stateId)throw new Error('The page changed. The failed preview was restored.');
   const feedback=message.slice(0,700);plan=normalizePlan(await options.replan(feedback,current));
   if(plan.status==='inspect'||plan.status==='clarify'&&!plan.question?.trim()){
    const resolved=await resolveInspections(plan,current,{active:options.active,inspect:refs=>options.inspect?options.inspect(refs):Promise.resolve(current),replan:(expanded,note)=>options.replan(feedback+'\n'+note,expanded)});
    plan=resolved.plan;current=resolved.context;
   }
   if(!options.active())throw new Error('Request canceled.');validatePlanReferences(plan,current.elements.map(e=>e.ref));
   if(plan.status!=='edit')return plan;
   if(failed.has(signature(plan,current)))throw error;
  }
 }
 return plan;
}
