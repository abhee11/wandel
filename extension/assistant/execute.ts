import {clone,uid,OperationSchema,type Workflow,type Locator,type Operation,type CopyNode} from '../shared/model';
import {validateWorkflow,visibleNodeIds} from '../prototype/engine';
import {describe} from '../content/locator';
import {captureDesign,readStyle} from '../content/nativeDesign';
import {editableText} from '../content/text';
import {AssistantPlanSchema,type AssistantPlan} from './schema';
import {ContextCollector} from './context';
const owned=(id:string):Locator=>({owned:id,tag:'',role:'',name:'',text:'',attrs:{},parent:{tag:'',id:'',role:'',label:''},previous:'',next:''});
export function compileAssistant(workflow:Workflow,stateId:string,planInput:unknown,collector:ContextCollector){
 const plan=AssistantPlanSchema.parse(planInput);if(plan.status!=='edit')throw new Error('This response needs a clarification, not execution.');
 const next=clone(workflow),state=next.states.find(s=>s.id===stateId)!;let nextState=stateId;const afterAnchors=new Map<string,string>();const created:string[]=[];let group:string|undefined,view:string|undefined;
 const add=(op:Operation)=>state.operations.push(OperationSchema.parse(op));
 const locate=(ref:string)=>{const node=collector.get(ref),id=collector.ownedId(node);return {node,id,locator:id?owned(id):describe(node).locator};};
 for(const action of plan.actions){
  const targets=action.targets.map(locate),styleReference=action.styleRef?collector.get(action.styleRef,true):null;
  const appearance=styleReference?readStyle(styleReference):undefined;
  if(action.kind==='create'){
   if(!action.element||!action.text?.trim()||targets.length!==1)throw new Error('Specify one insertion target, an element type, and its label.');
   const {node}=targets[0],id=uid(),position=action.position||'after';let locator=targets[0].locator;
   const section=node.parentElement;if(action.element==='panel'&&position==='after'&&node.matches('h1,h2,h3,h4,[role=heading]')&&section&&!section.matches('body,main,[role=dialog]')&&section.querySelectorAll('h1,h2,h3,h4,[role=heading]').length===1&&section.querySelector('button,[role=button],[role=radio]'))locator=describe(section).locator;
   if(position==='inside'&&node.matches('button,a,input,textarea,select,img,br'))throw new Error('Select a container to add UI inside.');
   const design=captureDesign(node),style=appearance||(action.element==='panel'?{display:'block',margin:'16px 0',padding:'0',border:'0','box-shadow':'none','background-color':'transparent',...design.text}:action.element==='button'?design.button:design.text);
   if(position==='after'&&afterAnchors.has(action.targets[0]))locator=owned(afterAnchors.get(action.targets[0])!);
   add({id:uid(),kind:'insert',target:locator,position,node:{id,kind:action.element,text:action.text,appearance:style}});created.push(id);if(position==='after')afterAnchors.set(action.targets[0],id);if(action.element==='panel')group=id;
  }else if(action.kind==='choices'||action.kind==='default'){
   if(targets.length!==1)throw new Error('Select a single prototype option group.');const id=targets[0].id;
   const insert=next.states.flatMap(s=>s.operations).find((op):op is Extract<Operation,{kind:'insert'}>=>op.kind==='insert'&&op.node.id===id);
   if(!insert||insert.node.kind!=='panel')throw new Error('Only a prototype option group can be configured.');
   if(action.kind==='default'){
    if(!insert.node.choices||!action.text)throw new Error('Create and label the options first.');const index=insert.node.choices.options.findIndex(label=>label.toLowerCase()===action.text!.toLowerCase());if(index<0)throw new Error('That option is not in this group.');insert.node.choices.selected=index;
   }else{
    if(action.labels.length<2||new Set(action.labels.map(s=>s.toLowerCase())).size!==action.labels.length)throw new Error('Give two to eight distinct option labels.');
    const design=captureDesign(targets[0].node),heading=(styleReference?.closest('section,article')||targets[0].node.parentElement)?.querySelector<HTMLElement>('h2,h3,h4');
    if(!appearance&&!insert.node.choices)throw new Error('Select an existing pill or button as the style reference.');
    insert.node.choices={options:action.labels,selected:0,headingTag:'h3',headingStyle:heading?readStyle(heading):design.heading,buttonStyle:appearance||insert.node.choices!.buttonStyle,sectionStyle:{display:'block',margin:'20px 0',padding:'0',border:'0','box-shadow':'none','background-color':'transparent'}};
    created.push(...action.labels.map((_,i)=>id+':choice:'+i));group=id;
   }
  }else if(action.kind==='connect'){
   if(targets.length!==1)throw new Error('Choose one trigger.');const target=targets[0];let source=target.id;
   if(!source){source=uid();add({id:uid(),kind:'trigger',target:target.locator,source});}
   let destination=action.destination;
   if(!destination){if(!action.newViewTitle?.trim())throw new Error('Choose a destination or name a new prototype view.');if(next.states.length>=next.maxStates)throw new Error('The workflow reached its screen limit.');destination=uid();next.states.push({id:destination,title:action.newViewTitle,parent:stateId,view:'panel',design:captureDesign(target.node),operations:[]});}
   if(!next.states.some(s=>s.id===destination))throw new Error('That destination no longer exists.');
   next.edges=next.edges.filter(e=>e.from!==stateId||e.source!==source);next.edges.push({id:uid(),from:stateId,source,to:destination,event:'click'});view=destination;nextState=destination;
  }else{
   for(const target of targets){
    if(action.kind==='text'){
     if(!action.text?.trim())throw new Error('What should the new text say?');
     if(target.id?.startsWith('heading:')){next.states.find(s=>s.id===target.id!.slice(8))!.title=action.text;continue;}
     if(!editableText(target.node))throw new Error('Select a specific text label, rather than a whole container.');add({id:uid(),kind:'text',target:target.locator,text:action.text});
    }else if(action.kind==='remove')add({id:uid(),kind:'remove',target:target.locator});
    else if(action.kind==='style'&&appearance)add({id:uid(),kind:'appearance',target:target.locator,style:appearance});
    else if(action.kind==='style'||action.kind==='move'){
     if(!action.style||!Object.keys(action.style).length)throw new Error('Describe the style or movement to apply.');
     let style=action.style;if(action.kind==='move'){const parts=getComputedStyle(target.node).translate?.split(' ').map(parseFloat)||[];style={...style,x:(parts[0]||0)+(style.x||0),y:(parts[1]||0)+(style.y||0)};}
     add({id:uid(),kind:'style',target:target.locator,style});
    }else throw new Error('This action is not supported.');
   }
  }
 }
 return {workflow:validateWorkflow(next),stateId:nextState,created,group,view};
}
