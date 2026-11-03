import {AssistantPlanSchema,type AssistantPlan} from './schema';
/** Fields required by provider JSON are not meaningful for every action. */
export function normalizePlan(input:unknown):AssistantPlan{
 const plan=AssistantPlanSchema.parse(input);
 const aliases=new Map(plan.actions.filter(a=>a.kind==='duplicate'&&a.resultRef).map(a=>[a.resultRef+'/button',a.resultRef+':button']));
 const canonical=(ref:string)=>aliases.get(ref)||ref;
 return {...plan,actions:plan.actions.map(a=>({...a,targets:a.targets.map(canonical),styleRef:a.styleRef?canonical(a.styleRef):a.styleRef,
  inputType:a.kind==='create'&&a.element==='field'?a.inputType:undefined,
  required:a.kind==='create'&&a.element==='field'?a.required:undefined,
  options:a.kind==='create'&&a.element==='field'?a.options:undefined,
  radioGroup:a.kind==='create'&&a.element==='field'?a.radioGroup:undefined,
  text:['create','duplicate','text','default','icon','tooltip','iconOnly','connect'].includes(a.kind)?a.text:null,
  description:a.kind==='duplicate'?a.description:null,
  labels:['duplicate','choices'].includes(a.kind)?a.labels:[],
  relativeTo:['reorder','layout'].includes(a.kind)&&a.relativeTo?canonical(a.relativeTo):null,
  resultRef:['create','duplicate'].includes(a.kind)||a.kind==='connect'&&a.newViewTitle?a.resultRef:null,
  newViewTitle:a.kind==='connect'?a.newViewTitle:null,
  pageContent:a.kind==='connect'?a.pageContent:undefined,
  chart:a.kind==='create'&&a.element==='chart'?a.chart:undefined,
  block:a.kind==='create'&&a.element==='block'||a.kind==='connect'&&(a.presentation==='modal'||a.presentation==='drawer')?a.block:undefined,
  destination:a.kind==='connect'?a.destination:null,
  href:a.kind==='create'&&a.element==='link'?a.href:undefined,
  layout:a.kind==='layout'?a.layout:undefined,
  columns:a.kind==='layout'&&a.layout==='grid'?a.columns:undefined,
  theme:a.kind==='theme'?a.theme:undefined
 }))};
}
/** A step can reference captured elements or results of earlier steps only. */
export function validatePlanReferences(plan:AssistantPlan,refs:Iterable<string>){
 const captured=[...refs],available=new Set(captured);
 for(const ref of plan.candidates)if(!available.has(ref))throw new Error('The response referenced an unknown element.');
 for(const a of plan.actions){
  for(const ref of [...a.targets,...a.styleRef?[a.styleRef]:[],...a.relativeTo?[a.relativeTo]:[]])if(!available.has(ref))throw new Error('The plan referenced an unknown element or a result that has not been created.');
  if(a.resultRef){if(!(['create','duplicate'].includes(a.kind)||a.kind==='connect'&&a.newViewTitle)||!/^new:[a-zA-Z0-9_-]{1,60}$/.test(a.resultRef)||available.has(a.resultRef))throw new Error('A created result needs a unique new: reference.');available.add(a.resultRef);if(a.kind==='duplicate'){available.add(a.resultRef+':button');for(const ref of captured)available.add(a.resultRef+'/'+ref);}}
 }
}
/** Shapes the executor accepts, checked before a plan reaches the page so a rejection names the action and its fix. */
export function planContractIssues(plan:AssistantPlan):string[]{
 const issues:string[]=[];
 plan.actions.forEach((a,i)=>{
  const at=`Action ${i+1} (${a.kind}${a.element?' '+a.element:''})`,one=(fix:string)=>{if(a.targets.length!==1)issues.push(`${at} takes exactly one target, not ${a.targets.length}. ${fix}`);};
  if(a.kind==='create'){
   if(!a.element)issues.push(`${at} needs an element type.`);
   else if(a.element==='chart'){if(!a.chart)issues.push(`${at} needs chart data.`);if(a.targets.length>6)issues.push(`${at} can span at most six cards.`);}
   else if(a.element==='panel'&&a.targets.length>1){if(a.targets.length>6)issues.push(`${at} can span at most six cards.`);}
   else if(a.element==='block'){if(!a.block)issues.push(`${at} needs block parts.`);if(a.targets.length>6)issues.push(`${at} can span at most six cards.`);if(a.targets.length>1&&a.position!=='below')issues.push(`${at} spans several cards only with position below.`);}
   else{one(a.element==='panel'?'To add a section spanning several cards, use element panel (or chart) with those cards as targets and position below.':'Target the one container or element it belongs in or beside.');if(!a.text?.trim()&&a.element!=='header')issues.push(`${at} needs its visible label in text.`);if(a.element==='link'&&!a.href)issues.push(`${at} needs href.`);}
  }else if(a.kind==='duplicate')one('Duplicate each card in its own action.');
  else if(a.kind==='reorder'){one('Move each element in its own action.');if(!a.relativeTo||!['before','after','inside'].includes(a.position||''))issues.push(`${at} needs relativeTo and position before, after or inside.`);}
  else if(a.kind==='layout'){one('Target the shared container of the items to arrange.');if(!a.layout)issues.push(`${at} needs layout.`);}
  else if(a.kind==='theme'){one('Target the page or one region.');if(!a.theme)issues.push(`${at} needs a complete theme palette.`);}
  else if(a.kind==='choices'||a.kind==='default'||a.kind==='connect'){one('Target the single option group or trigger.');if(a.kind==='connect'&&!a.destination&&!a.newViewTitle?.trim())issues.push(`${at} needs a destination or newViewTitle.`);if(a.kind==='default'&&!a.text)issues.push(`${at} needs the option label in text.`);}
  else if(['text','icon','tooltip'].includes(a.kind)&&!a.text?.trim())issues.push(`${at} needs text.`);
  else if((a.kind==='move'||a.kind==='style'&&!a.styleRef)&&!(a.style&&Object.keys(a.style).length))issues.push(`${at} needs style values.`);
 });
 return issues;
}
