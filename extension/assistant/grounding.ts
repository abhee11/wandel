import {response,type PageContext,type AssistantPlan} from './schema';
/** Evidence rules, not the model's confidence, authorize element references. */
export function groundPlan(instruction:string,c:PageContext,plan:AssistantPlan):AssistantPlan{
 if(plan.status!=='edit')return plan;const elements=new Map(c.elements.map(e=>[e.ref,e]));const language=instruction.toLowerCase().replace(/\s+/g,' ');
 const anchored=new Set([c.selected,...(!c.selected?[c.hover]:[]),...c.recent,c.lastGroup]);
 const selected=c.elements.find(e=>e.ref===c.selected);if(selected?.parent)anchored.add(selected.parent);
 for(const a of plan.actions){
  for(const ref of a.targets){const target=elements.get(ref);if(!target)return response('clarify','The referenced element is no longer in this context. Select it again.');if(anchored.has(ref))continue;
   const name=target.name.replace(/\s*[✓✔]$/,'').trim().toLowerCase(),matches=c.elements.filter(e=>e.name.replace(/\s*[✓✔]$/,'').trim().toLowerCase()===name&&(e.interactive||e.role==='heading'));
   if(!name||!language.includes(name))return response('clarify','Select the target you mean.');
   if(matches.length!==1)return response('clarify','Which highlighted element do you mean?',[],matches.slice(0,8).map(e=>e.ref));
  }
  if(a.styleRef&&a.styleRef!==c.styleReference&&a.styleRef!==c.selected){const reference=elements.get(a.styleRef);if(!reference)return response('clarify','Select an existing style reference.');const candidates=c.elements.filter(e=>e.interactive&&e.tag===reference.tag&&!/^(save|cancel|close|delete)$/i.test(e.name));if(new Set(candidates.map(e=>JSON.stringify(e.style))).size>1)return response('clarify','Which existing style should I match?',[],candidates.slice(0,8).map(e=>e.ref));}
 }
 return plan;
}
