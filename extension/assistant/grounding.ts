import {groundedCategoryRefs,referencedCardGroups,regionLayoutRefs} from './scene';
import {response,type PageContext,type AssistantPlan} from './schema';
/** Evidence rules, not the model's confidence, authorize element references. */
export function groundPlan(instruction:string,c:PageContext,plan:AssistantPlan):AssistantPlan{
 if(plan.status!=='edit')return plan;const elements=new Map(c.elements.map(e=>[e.ref,e]));const language=instruction.toLowerCase().replace(/\s+/g,' ');
 const anchored=new Set([c.selected,c.lastCard,...(!c.selected?[c.hover]:[]),...c.recent,c.lastGroup]);
 const outputs=new Set<string>();for(const ref of [...groundedCategoryRefs(instruction,c),...regionLayoutRefs(instruction,c)])anchored.add(ref);
 if(/\b(?:original|source)\b/.test(language)&&c.copySource)anchored.add(c.copySource);
 const selected=c.elements.find(e=>e.ref===c.selected);if(selected?.parent)anchored.add(selected.parent);
 for(const a of plan.actions){
  for(const ref of [...a.targets,...a.relativeTo?[a.relativeTo]:[]]){if(outputs.has(ref))continue;const target=elements.get(ref);if(!target)return response('clarify','The referenced element is no longer in this context. Select it again.');if(anchored.has(ref))continue;
   const groups=referencedCardGroups(instruction,c);if(groups.length>1&&groups.some(group=>group.ref===ref||group.members.includes(ref))&&!language.includes((target.attributes['wandel-heading']||target.name).toLowerCase()))return response('clarify','Which group of cards do you mean?',[],groups.map(group=>group.ref));
   // Page design actions operate on captured structure, not a forced selection.
   // Broad scope never authorizes destructive actions or arbitrary text replacement.
   if(plan.scope==='page'&&c.page&&['style','layout','theme','reorder','create'].includes(a.kind))continue;
   if(plan.scope==='region'&&['style','layout','theme','reorder','create'].includes(a.kind)&&regionLayoutRefs(instruction,c).has(ref))continue;
   const remembered=c.elements.find(e=>e.ref===c.lastCard),cardContext=selected?.attributes['wandel-card']==='true'?selected:remembered;
   if(a.kind==='text'&&/\b(?:details?|description|subtext|sub text|body)\b/i.test(language)&&target.ref===cardContext?.attributes['wandel-description-ref'])continue;
   // Renaming a selected card means its identified heading, not the entire container.
   if(a.kind==='text'&&selected?.attributes['wandel-card']==='true'&&(target.ref===selected.attributes['wandel-heading-ref']||target.name===selected.attributes['wandel-heading'])){
    const seen=new Set<string>();let ancestor=target.parent;let inside=false;while(ancestor&&!seen.has(ancestor)){if(ancestor===selected.ref){inside=true;break;}seen.add(ancestor);ancestor=elements.get(ancestor)?.parent||null;}
    const headings=c.elements.filter(e=>e.name===selected.attributes['wandel-heading']);if(inside&&(target.ref===selected.attributes['wandel-heading-ref']||headings.length===1))continue;
   }

   const name=(target.attributes['wandel-card']==='true'?target.attributes['wandel-heading']||target.name:target.name).replace(/\s*[✓✔]$/,'').trim().toLowerCase(),matches=c.elements.filter(e=>(e.attributes['wandel-card']==='true'?e.attributes['wandel-heading']||e.name:e.name).replace(/\s*[✓✔]$/,'').trim().toLowerCase()===name&&(target.attributes['wandel-card']==='true'?e.attributes['wandel-card']==='true':e.interactive||e.role==='heading'));
   if(!name||!(language.includes(name)||language.replace(/\+/g,' plus ').replace(/[^a-z0-9]/g,'').includes(name.replace(/\+/g,' plus ').replace(/[^a-z0-9]/g,''))))return response('clarify','Select the target you mean.');
   if(matches.length!==1)return response('clarify','Which highlighted element do you mean?',[],matches.slice(0,8).map(e=>e.ref));
  }
  if(a.resultRef){outputs.add(a.resultRef);outputs.add(a.resultRef+':button');for(const element of c.elements)outputs.add(a.resultRef+'/'+element.ref);}
  if(a.styleRef&&!outputs.has(a.styleRef)&&a.styleRef!==c.styleReference&&a.styleRef!==c.selected){const reference=elements.get(a.styleRef);if(!reference)return response('clarify','Select an existing style reference.');const named=reference.name.replace(/\s+/g,' ').trim().toLowerCase();if(named&&language.includes(named)&&c.elements.filter(e=>e.name.replace(/\s+/g,' ').trim().toLowerCase()===named&&e.interactive).length===1)continue;const candidates=c.elements.filter(e=>e.interactive&&e.tag===reference.tag&&!/^(save|cancel|close|delete)$/i.test(e.name));if(new Set(candidates.map(e=>JSON.stringify(e.style))).size>1)return response('clarify','Which existing style should I match?',[],candidates.slice(0,8).map(e=>e.ref));}
 }
 return plan;
}
