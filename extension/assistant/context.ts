import {uid,type Locator,type Workflow,type Selection} from '../shared/model';
import {describe,resolve,nameOf} from '../content/locator';
import {visible,readStyle} from '../content/nativeDesign';
import {cleanText,sensitive,contextName} from './privacy';
import {deepElements,inScope,parentOf} from './dom';
import {PageContextSchema,type PageContext} from './schema';
type Handle={node:HTMLElement;locator:Locator;name:string;tag:string;style:string};
export class ContextCollector{
 private handles=new Map<string,Handle>();private identities=new WeakMap<HTMLElement,string>();private scope='';private viewState='';private revision='';private token='';
 recent:string[]=[];lastGroup:string|null=null;styleReference:string|null=null;lastView:string|null=null;
 constructor(private root:HTMLElement,private owned:Map<string,HTMLElement>){}
 reset(){this.handles.clear();this.identities=new WeakMap();this.recent=[];this.lastGroup=null;this.styleReference=null;this.lastView=null;this.token='';}
 private available(el:HTMLElement){if(!inScope(this.root,el)||!el.isConnected||sensitive(el))return false;for(let node:HTMLElement|null=el;node;node=parentOf(node)){if(!visible(node)||node.matches('[disabled],[aria-disabled=true]'))return false;}return true;}
 ref(el:HTMLElement){let id=this.identities.get(el);if(!id||!this.handles.has(id)){const owned=[...this.owned].find(([,n])=>n===el)?.[0];id='e_'+uid();this.identities.set(el,id);this.handles.set(id,{node:el,locator:describe(el,owned).locator,name:contextName(el),tag:el.tagName,style:JSON.stringify(readStyle(el))});}return id;}
 get(ref:string,checkStyle=false):HTMLElement{
  const handle=this.handles.get(ref);if(!handle)throw new Error('That reference expired. Select the element again.');
  const node=handle.node.isConnected?handle.node:resolve(handle.locator,this.root,this.owned);
  if(!node||!this.available(node)||node.tagName!==handle.tag||contextName(node)!==handle.name||(checkStyle&&JSON.stringify(readStyle(node))!==handle.style))throw new Error('The referenced element changed or is ambiguous. Select it again.');
  handle.node=node;this.identities.set(node,ref);return node;
 }
 collect(workflow:Workflow,stateId:string,selected:Selection|null,hover:HTMLElement|null):PageContext{
  const scope=workflow.id+':'+location.href;if(scope!==this.scope){this.reset();this.scope=scope;}else if(this.viewState!==stateId){const lastView=this.lastView;this.reset();this.lastView=workflow.states.some(s=>s.id===lastView)?lastView:null;}this.viewState=stateId;
  // Rebuild short-lived handles on each explicit context capture, retaining semantic memory only when revalidated.
  const retain=(id:string|null)=>{if(!id)return null;try{return this.get(id)?id:null;}catch{return null;}};
  this.recent=this.recent.map(retain).filter((id):id is string=>!!id).slice(-8);this.lastGroup=retain(this.lastGroup);this.styleReference=retain(this.styleReference);
  const target=selected?resolve(selected.locator,this.root,this.owned):null;
  if(selected&&(!target||!this.available(target)))throw new Error('The selected target is unavailable, private, or ambiguous. Select it again.');
  const focus=target&&this.available(target)?target:hover&&this.available(hover)?hover:null;
  const scopeNode=focus?(focus.closest<HTMLElement>('[role=dialog],section,article,form,main')||parentOf(focus)||focus):this.root;
  const candidates=[...(focus?[focus]:[]),...(focus&&parentOf(focus)?[parentOf(focus)!]:[]),...this.recent.map(id=>this.get(id)),...(this.lastGroup?[this.get(this.lastGroup)]:[]),...(this.styleReference?[this.get(this.styleReference)]:[]),...deepElements(scopeNode,'h1,h2,h3,h4,button,[role=button],[role=radio],label,input:not([type=password]):not([type=hidden]),section,article,p,a')];
  const nodes=[...new Set(candidates)].filter(n=>this.available(n)).slice(0,32);const allowed=new Set(nodes);
  const elements=nodes.map(node=>{const rect=node.getBoundingClientRect(),css=getComputedStyle(node),rawStyle=readStyle(node);const ref=this.ref(node),handle=this.handles.get(ref)!;handle.name=contextName(node);handle.style=JSON.stringify(rawStyle);return {ref,tag:node.tagName.toLowerCase(),role:node.getAttribute('role')||describe(node).locator.role,name:contextName(node),text:node.matches('input,textarea,select')?'':contextName(node),attributes:Object.fromEntries(['id','data-testid','data-qa','type','aria-label','aria-pressed','aria-checked'].flatMap(key=>{const value=node.getAttribute(key);return value?[[key,cleanText(value)]]:[];})),classes:[...node.classList].slice(0,8).map(v=>cleanText(v,80)),bounds:{x:Math.round(rect.x),y:Math.round(rect.y),width:Math.round(rect.width),height:Math.round(rect.height)},visible:true,disabled:false,parent:parentOf(node)&&allowed.has(parentOf(node)!)?this.ref(parentOf(node)!):null,children:[...node.children].filter((n):n is HTMLElement=>n instanceof HTMLElement&&allowed.has(n)).slice(0,8).map(n=>this.ref(n)),style:{...rawStyle,display:css.display,'flex-direction':css.flexDirection,gap:css.gap},interactive:node.matches('button,a,input,select,textarea,[role=button],[role=radio]'),owned:!!this.ownedId(node)};});
  while(JSON.stringify(elements).length>26000&&elements.length>8)elements.pop();
  const present=new Set(elements.map(e=>e.ref));for(const ref of this.handles.keys())if(!present.has(ref))this.handles.delete(ref);for(const element of elements){element.children=element.children.filter(ref=>present.has(ref));if(element.parent&&!present.has(element.parent))element.parent=null;}
  this.revision=JSON.stringify(workflow);this.token=uid();
  const limitations=['Only the scoped labels and styles below are used. Typed field values, cookies, query strings and screenshots are excluded.'];
  if(this.root.querySelector('iframe'))limitations.push('Frames are not inspected or edited in this slice. Select an accessible element in the main page.');
  return PageContextSchema.parse({token:this.token,workflowId:workflow.id,stateId,route:new URL(workflow.origin+workflow.route).pathname,selected:target&&nodes.includes(target)?this.ref(target):null,hover:hover&&nodes.includes(hover)?this.ref(hover):null,styleReference:this.styleReference&&present.has(this.styleReference)?this.styleReference:null,elements,recent:this.recent.filter(ref=>present.has(ref)),lastGroup:this.lastGroup&&present.has(this.lastGroup)?this.lastGroup:null,lastView:this.lastView,views:workflow.states.map(s=>({id:s.id,title:cleanText(s.title)})),limitations});
 }
 ownedId(node:HTMLElement){return [...this.owned].find(([,n])=>n===node)?.[0];}
 guard(token:string,workflow:Workflow){if(!this.token||token!==this.token||this.scope!==workflow.id+':'+location.href||JSON.stringify(workflow)!==this.revision)throw new Error('The page or workflow changed while planning. Capture context and retry.');}
 remember(nodes:HTMLElement[],group?:HTMLElement,view?:string){for(const [ref,handle] of this.handles)if(handle.locator.owned){const current=this.owned.get(handle.locator.owned);if(current){handle.node=current;handle.name=contextName(current);handle.style=JSON.stringify(readStyle(current));this.identities.set(current,ref);}} if(nodes.length)this.recent=nodes.map(n=>this.ref(n)).slice(-8);if(group)this.lastGroup=this.ref(group);if(view)this.lastView=view;this.token='';}
}
