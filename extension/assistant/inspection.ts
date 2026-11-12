import {normalizePlan} from './plan';
import {response,type AssistantPlan,type PageContext} from './schema';

const stalled='Inspection is not revealing new information. Use the DOM details already supplied to complete the request. Do not request the same inspection again. If a genuine user decision is missing, return clarify with a concrete question. If the available evidence cannot support the edit, return answer explaining the specific missing evidence without promising further work or asking the user to select an already identified element. No edit has been performed by this inspection step.';
/** Inspection is internal work, not a user choice. Bound it by new evidence as well as calls. */
export async function resolveInspections(initial:AssistantPlan,context:PageContext,options:{
 inspect:(refs:string[])=>Promise<PageContext|null>;
 replan:(context:PageContext,feedback:string)=>Promise<AssistantPlan>;
 active:()=>boolean;
 limit?:number;
}){
 let plan=initial,current=context;const seen=new Set<string>();
 const assertActive=()=>{if(!options.active())throw new Error('Request canceled.');};
 for(let round=0;plan.status==='inspect'&&round<(options.limit??4);round++){
  assertActive();const refs=[...new Set(plan.candidates)];
  if(!refs.length)break;
  const inspected=await options.inspect(refs);assertActive();
  if(!inspected)return {plan,context:current,interrupted:true,exhausted:false};
  if(inspected.workflowId!==context.workflowId||inspected.stateId!==context.stateId)throw new Error('The page changed during inspection.');
  current=inspected;
  // Ignore volatile context tokens, element reference IDs and bounds. Re-reading
  // an animated or repositioned element must not look like new structural evidence.
  const identities=new Map(current.elements.map(e=>[e.ref,e.tag+':'+e.name+':'+e.text]));
  const evidence=JSON.stringify({targets:refs.map(ref=>current.elements.find(e=>e.ref===ref)?.name||ref),elements:current.elements},(key,value)=>['ref','bounds','token'].includes(key)?undefined:typeof value==='string'&&identities.has(value)?identities.get(value):value);
  if(seen.has(evidence))break;
  seen.add(evidence);
  plan=normalizePlan(await options.replan(current,'The requested elements have now been inspected. Use their supplied labels, descendants and styles to continue. Ask the user only for a real unresolved decision, not for permission to inspect.'));assertActive();
 }
 if(plan.status==='inspect'||plan.status==='clarify'&&!plan.question?.trim()){
  // One decision pass, with the evidence and the reason for stopping. Never
  // forward an unfinished inspect response to the clarification UI.
  plan=normalizePlan(await options.replan(current,stalled+' A clarify response must include the actual question in question, not an inspection announcement.'));assertActive();
  if(plan.status==='inspect'||plan.status==='clarify'&&!plan.question?.trim())return {plan:response('answer','I couldn’t tell which parts of the page you mean, so I haven’t changed anything. Click ✎ Edit, pick one of them on the page, then send the request again.'),context:current,interrupted:false,exhausted:true};
 }
 return {plan,context:current,interrupted:false,exhausted:false};
}
