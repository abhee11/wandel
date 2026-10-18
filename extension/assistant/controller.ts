import {uid,type Workflow,type Selection} from '../shared/model';
import {ContextCollector} from './context';
import {compileAssistant} from './execute';
import {AssistantPlanSchema,type AssistantSnapshot,type PageContext} from './schema';
export class AssistantController {
 readonly collector:ContextCollector;private context:PageContext|null=null;private message='Select a target and describe the change.';private overlays:HTMLElement[]=[];private overlayTimer?:ReturnType<typeof setTimeout>;private transactions:AssistantSnapshot['transactions']=[];
 constructor(root:HTMLElement,private owned:Map<string,HTMLElement>){this.collector=new ContextCollector(root,owned);}
 snapshot():AssistantSnapshot{return {context:this.context,message:this.message,transactions:this.transactions};}
 collect(workflow:Workflow,stateId:string,selection:Selection|null,hover:HTMLElement|null){this.clearHighlights();this.context=this.collector.collect(workflow,stateId,selection,hover);return this.snapshot();}
 style(ref:string){this.collector.get(ref,true);this.collector.styleReference=ref;if(this.context)this.context.styleReference=ref;this.highlight([ref]);this.message='Style reference pinned. Appearance will be copied without host behavior.';}
 clearHighlights(){clearTimeout(this.overlayTimer);this.overlays.forEach(el=>el.remove());this.overlays=[];}
 highlight(refs:string[]){this.clearHighlights();for(const [index,ref] of refs.slice(0,8).entries()){try{const node=this.collector.get(ref),rect=node.getBoundingClientRect(),overlay=document.createElement('div');overlay.dataset.dxIgnore='true';overlay.textContent=String(index+1);overlay.style.cssText=`position:fixed;pointer-events:none;z-index:2147483646;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;border:2px solid #8b5cf6;background:#8b5cf615;color:#5b21b6;font:12px system-ui;`;document.documentElement.append(overlay);this.overlays.push(overlay);}catch{}}this.overlayTimer=setTimeout(()=>this.clearHighlights(),30000);}
 reset(){this.clearHighlights();this.collector.reset();this.context=null;this.transactions=[];this.message='Conversation reset. Your workflow edits remain.';}
 apply(input:unknown,token:string,workflow:Workflow,stateId:string,commit:(next:Workflow,stateId:string)=>void){
  const plan=AssistantPlanSchema.parse(input);this.collector.guard(token,workflow);if(this.context?.stateId!==stateId||this.context.workflowId!==workflow.id)throw new Error('The current view changed while planning. Capture context and retry.');
  const allowed=new Set(this.context?.elements.map(e=>e.ref));for(const a of plan.actions)for(const ref of [...a.targets,...a.styleRef?[a.styleRef]:[]])if(!allowed.has(ref))throw new Error('The plan references an element outside the current scoped context.');
  const next=compileAssistant(workflow,stateId,plan,this.collector);commit(next.workflow,next.stateId);
  const nodes=next.created.map(id=>this.owned.get(id)).filter((n):n is HTMLElement=>!!n);this.collector.remember(nodes,next.group?this.owned.get(next.group):undefined,next.view);
  this.transactions=[...this.transactions,{id:uid(),message:plan.message,createdAt:new Date().toISOString()}].slice(-12);this.message=plan.message;this.context=null;return next;
 }
}
