import {normalizePlan,validatePlanReferences,planContractIssues} from './plan';
import {findCard} from './card';
import {uid,type Workflow,type Selection} from '../shared/model';
import {ContextCollector} from './context';
import {compileAssistant} from './execute';
import {AssistantPlanSchema,type AssistantSnapshot,type PageContext} from './schema';
export class AssistantController {
 readonly collector:ContextCollector;private context:PageContext|null=null;private message='Describe what you want to change on the page.';private overlays:HTMLElement[]=[];private overlayTimer?:ReturnType<typeof setTimeout>;private transactions:AssistantSnapshot['transactions']=[];
 constructor(root:HTMLElement,private owned:Map<string,HTMLElement>){this.collector=new ContextCollector(root,owned);}
 snapshot():AssistantSnapshot{return {context:this.context,message:this.message,transactions:this.transactions};}
 collect(workflow:Workflow,stateId:string,selection:Selection|null,hover:HTMLElement|null,inspect:string[]=[],instruction=''){this.clearHighlights();this.context=this.collector.collect(workflow,stateId,selection,hover,inspect,instruction);this.context.edits=this.transactions.slice(-8).map(t=>({message:t.message.slice(0,300),outcome:'applied' as const}));return this.snapshot();}
 style(ref:string){this.collector.get(ref,true);this.collector.styleReference=ref;if(this.context)this.context.styleReference=ref;this.highlight([ref]);this.message='Style reference pinned. Appearance will be copied without host behavior.';}
 clearHighlights(){clearTimeout(this.overlayTimer);this.overlays.forEach(el=>el.remove());this.overlays=[];}
 highlight(refs:string[]){this.clearHighlights();if(refs.length===1&&this.context?.elements.find(e=>e.ref===refs[0])?.attributes['wandel-card']==='true')this.collector.focusCard(this.collector.get(refs[0]));for(const [index,ref] of refs.slice(0,8).entries()){try{const node=this.collector.get(ref);const focus=findCard(node)?.root||node;const rect=focus.getBoundingClientRect(),overlay=document.createElement('div');overlay.dataset.dxIgnore='true';overlay.textContent=String(index+1);overlay.style.cssText=`position:fixed;pointer-events:none;z-index:2147483646;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;border:2px solid #8b5cf6;background:#8b5cf615;color:#5b21b6;font:12px system-ui;`;document.documentElement.append(overlay);this.overlays.push(overlay);}catch{}}this.overlayTimer=setTimeout(()=>this.clearHighlights(),30000);}
 recordExternal(message:string,nodes:HTMLElement[],card?:HTMLElement){this.collector.remember(nodes);if(card)this.collector.focusCard(card);this.context=null;this.transactions=[...this.transactions,{id:uid(),message,createdAt:new Date().toISOString()}].slice(-12);}
 rollback(){this.clearHighlights();this.collector.reset();this.context=null;this.transactions=this.transactions.slice(0,-1);this.message='The previous layout was restored.';}
 reset(){this.clearHighlights();this.collector.reset();this.context=null;this.transactions=[];this.message='Conversation reset. Your workflow edits remain.';}
 async apply(input:unknown,token:string,workflow:Workflow,stateId:string,commit:(next:Workflow,stateId:string,verify:()=>void)=>void|Promise<void>){
  const plan=normalizePlan(input);this.collector.guard(token,workflow);if(this.context?.stateId!==stateId||this.context.workflowId!==workflow.id)throw new Error('The current view changed while planning. Capture context and retry.');
  validatePlanReferences(plan,this.context?.elements.map(e=>e.ref)||[]);
  const issues=planContractIssues(plan);if(issues.length)throw new Error('Preview not applied: Plan not supported: '+issues.join(' '));
  let next:ReturnType<typeof compileAssistant>;
  try{next=compileAssistant(workflow,stateId,plan,this.collector);}catch(error){throw new Error('Preview not applied: '+(error instanceof Error?error.message:'The proposed edit could not be prepared.'));}
  await commit(next.workflow,next.stateId,next.verify);
  const nodes=next.created.map(id=>this.owned.get(id)).filter((n):n is HTMLElement=>!!n);if(next.cardId){const card=this.owned.get(next.cardId);if(card)this.collector.focusCard(card);}this.collector.remember(nodes,next.group?this.owned.get(next.group):undefined,next.view);
  this.transactions=[...this.transactions,{id:uid(),message:plan.message,createdAt:new Date().toISOString()}].slice(-12);this.message=plan.message;this.context=null;return next;
 }
}
