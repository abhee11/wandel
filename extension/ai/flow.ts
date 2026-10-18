import type {NativeDesign} from '../content/nativeDesign';
import {FlowPlanSchema} from './planSchema';
import {clone,uid,type Locator,type Workflow,type StylePatch,type CopyNode} from '../shared/model';
import {validateWorkflow,hasDefaultWorkflowName} from '../prototype/engine';

const owned=(id:string):Locator=>({owned:id,tag:'',role:'',name:'',text:'',attrs:{},parent:{tag:'',id:'',role:'',label:''},previous:'',next:''});
/** Compile validated screens and explicit links, never executable model output. */
export function compileFlow(workflow:Workflow,stateId:string,target:Locator,input:unknown,theme:StylePatch={},inside=false,design?:NativeDesign){
 const plan=FlowPlanSchema.parse(input),next=clone(workflow);
 if(next.states.length+plan.screens.length>next.maxStates)throw new Error(`This flow would exceed ${next.maxStates} states. Shorten it or start a new workflow.`);
 const parent=next.states.find(s=>s.id===stateId);if(!parent)throw new Error('State not found.');
 if(hasDefaultWorkflowName(next))next.name=plan.name;
 const keys=new Map((plan.variables||[]).map(v=>[v.key,'d'+uid().replaceAll('-','')]));
 const key=(name:string)=>keys.get(name)!;
 const text=(value:string)=>value.replace(/\{\{([^{}]+)\}\}/g,(_,name)=>'{{'+key(name)+'}}');
 if(plan.variables?.length)next.variables=[...(next.variables||[]),...plan.variables.map(v=>({key:key(v.key),value:v.value}))];
 const entry=uid(),ids=plan.screens.map(()=>uid()),graph=!!plan.screens[0].id;
 parent.operations.push({id:uid(),kind:'insert',target,position:inside?'inside':'after',node:{id:entry,kind:'button',text:plan.entryLabel,...(design?{appearance:design.button}:{})}},{id:uid(),kind:'style',target:owned(entry),style:theme});
 next.edges.push({id:uid(),from:stateId,source:entry,to:ids[0]});
 for(const [index,screen] of plan.screens.entries()){
  const id=ids[index],view=owned(`view:${id}`);
  // Graph edges may loop. Visual ancestry remains acyclic and separate from navigation.
  const state:Workflow['states'][number]={id,title:text(screen.title),parent:stateId,view:'panel',presentation:'screen',...(design?{design}:{}),operations:[]};
  if(parent.view==='panel')state.operations.push({id:uid(),kind:'remove',target:owned(`view:${parent.id}`)});
  const insert=(kind:'text'|'field'|'button'|'panel',value:string,binding?:string,copy?:CopyNode[],required?:boolean,inputType?:'text'|'email'|'number'|'url'|'tel')=>{const nodeId=uid();state.operations.push({id:uid(),kind:'insert',target:view,position:'inside',node:{id:nodeId,kind,text:text(value),...(design?{appearance:kind==='button'?design.button:kind==='panel'?design.card:design.text,...(kind==='field'?{inputAppearance:design.field}:{})}:{}),...(required?{required:true}:{}),...(inputType?{inputType}:{}),...(binding?{binding:key(binding)}:{}),...(copy?{copy}:{})}});return nodeId;};
  insert('text',screen.body);
  if(screen.metrics?.length||screen.cards?.length||screen.table){
   const copy:CopyNode[]=[];
   const add=(parent:number,tag:CopyNode['tag'],value='',style:CopyNode['style']={},native:CopyNode['style']={})=>{const i=copy.length;copy.push({id:uid(),parent,tag,text:tag==='#text'?text(value):'',style:{...style,...(design?(tag==='h3'?design.heading:tag==='article'?design.card:tag==='div'?{'font-family':design.surface['font-family']||'inherit',color:design.surface.color||'inherit','background-color':design.surface['background-color']||'transparent'}:design.text):{}),...native}});if(tag!=='#text'&&value)copy.push({id:uid(),parent:i,tag:'#text',text:text(value),style:{}});return i;};
   const root=add(-1,'div','',{display:'grid',gap:'16px','font-family':'system-ui, sans-serif',color:'#202638'});
   if(screen.metrics?.length){const row=add(root,'div','',{display:'grid','grid-template-columns':'repeat(auto-fit,minmax(140px,1fr))',gap:'12px'});for(const m of screen.metrics){const card=add(row,'div','',{padding:'18px','background-color':'#f0effb','border-radius':'12px'});add(card,'small',m.label,{'font-size':'12px',color:'#626078'});add(card,'p',m.value,{'font-size':'28px','font-weight':'700',margin:'8px 0 0'});}}
   for(const c of screen.cards||[]){const card=add(root,'article','',{padding:'20px',border:'1px solid #e3e4ec','border-radius':'12px','background-color':'#ffffff'});add(card,'h3',c.title,{margin:'0 0 8px','font-size':'17px'});add(card,'p',c.body,{margin:'0','line-height':'1.6'});}
   if(screen.table){const table=add(root,'div','',{display:'grid',gap:'0',border:'1px solid #e3e4ec','border-radius':'12px'},design?.table);for(const [i,cells] of [screen.table.columns,...screen.table.rows].entries()){const row=add(table,'div','',{display:'grid','grid-template-columns':`repeat(${screen.table.columns.length},minmax(0,1fr))`,'background-color':i===0?'#f0effb':'#ffffff',padding:'12px',gap:'12px'},i===0?design?.tableHeader:design?.table);for(const cell of cells)add(row,i===0?'strong':'span',cell,{'font-size':'13px','white-space':'normal'},i===0?design?.tableHeader:design?.table);}}
   insert('panel','Feature content',undefined,copy);
  }
  for(const label of screen.fields)insert('field',label);
  for(const f of screen.boundFields||[])insert('field',f.label,f.key,undefined,f.required??undefined,f.inputType??undefined);
  const actions=graph?screen.actions||[]:screen.actionLabel?[{label:screen.actionLabel,to:String(index+1),effects:[]}]:[];
  for(const action of actions){const source=insert('button',action.label);state.operations.push({id:uid(),kind:'style',target:owned(source),style:theme});const to=graph?ids[plan.screens.findIndex(s=>s.id===action.to)]:ids[Number(action.to)];next.edges.push({id:uid(),from:id,source,to,effects:action.effects.map(e=>({key:key(e.key),value:e.value}))});}
  next.states.push(state);
 }
 return {workflow:validateWorkflow(next),entry};
}
/** Read appearance locally. No page content or computed styles are sent to a provider. */
export function buttonTheme(selected:HTMLElement):StylePatch {
 const button=selected.matches('button,a,[role="button"]')?selected:selected.querySelector<HTMLElement>('button,[role="button"]');
 if(!button)return {};
 const css=getComputedStyle(button);
 const hex=(v:string)=>{const match=v.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);return match&&(!match[4]||Number(match[4])===1)?'#'+match.slice(1,4).map(n=>Number(n).toString(16).padStart(2,'0')).join(''):undefined;};
 return {...(hex(css.backgroundColor)?{backgroundColor:hex(css.backgroundColor)}:{}),...(hex(css.color)?{color:hex(css.color)}:{}),...(parseFloat(css.fontSize)>=6?{fontSize:Math.min(200,parseFloat(css.fontSize))}:{})};
}
