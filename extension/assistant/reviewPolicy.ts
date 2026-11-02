import type {AssistantPlan} from './schema';
/** Additive controls use executor geometry/content/appearance checks. Structural
 * changes and edits to existing elements still need screenshot review. */
export function requiresVisualReview(plan:AssistantPlan,referenceImage=false){
 if(referenceImage)return true;
 const created=new Set<string>();
 for(const action of plan.actions){
  if(action.kind==='create'&&['button','text','field','link'].includes(action.element||'')){if(action.resultRef)created.add(action.resultRef);continue;}
  if(action.kind==='style'&&action.targets.every(ref=>created.has(ref)))continue;
  return true;
 }
 return false;
}
