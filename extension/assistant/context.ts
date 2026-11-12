import {copiedElement} from '../content/tabClipboard';
import {sharedValues} from '../content/sharedValues';
import {layoutStructures} from './layoutMap';
import {watched} from '../content/watch';
import {appToastLook} from '../content/appToast';
import {emptyAssistantMemory} from '../shared/assistantMemory';
import {currentAppMap} from '../appmap/cache';
import {relevantEndpoints} from '../appmap/relevant';
import {renderLineage} from '../prototype/engine';
import {cardGroups,pageRegions} from './scene';
import {findCard,copiedHeading} from './card';
import {uid,type Locator,type Workflow,type Selection} from '../shared/model';
import {describe,resolve,nameOf} from '../content/locator';
import {visible,shownOnScreen,readStyle} from '../content/nativeDesign';
import {cleanText,sensitive,contextName} from './privacy';
import {deepElements,inScope,parentOf} from './dom';
import {PageContextSchema,type PageContext} from './schema';
type Handle={node:HTMLElement;locator:Locator;name:string;tag:string;style:string};
export class ContextCollector{
 focusLocator:Locator|null=null;
 private cardMemory:{node:HTMLElement;locator:Locator}|null=null;
 private handles=new Map<string,Handle>();private identities=new WeakMap<HTMLElement,string>();private scope='';private viewState='';private revision='';private token='';
 recent:string[]=[];lastGroup:string|null=null;styleReference:string|null=null;lastView:string|null=null;
 constructor(private root:HTMLElement,private owned:Map<string,HTMLElement>){}
 reset(){this.cardMemory=null;this.handles.clear();this.identities=new WeakMap();this.recent=[];this.lastGroup=null;this.styleReference=null;this.lastView=null;this.token='';}
 private available(el:HTMLElement){if(!inScope(this.root,el)||!el.isConnected||sensitive(el))return false;for(let node:HTMLElement|null=el;node;node=parentOf(node)){if(!shownOnScreen(node)||node!==el&&node.matches('[disabled],[aria-disabled=true]'))return false;}return true;}
 ref(el:HTMLElement){let id=this.identities.get(el);if(!id||!this.handles.has(id)){const owned=[...this.owned].find(([,n])=>n===el)?.[0];id='e_'+uid();this.identities.set(el,id);this.handles.set(id,{node:el,locator:describe(el,owned).locator,name:contextName(el),tag:el.tagName,style:JSON.stringify(readStyle(el))});}return id;}
 get(ref:string,checkStyle=false):HTMLElement{
  const handle=this.handles.get(ref);if(!handle)throw new Error('That reference expired. Select the element again.');
  const node=handle.node.isConnected?handle.node:resolve(handle.locator,this.root,this.owned);
  // A live container's aggregate name includes animated headlines and descendant
  // labels. Those are not its identity. Keep exact label checks for controls and
  // text leaves, and for any replacement node resolved after host re-rendering.
  const liveContainer=!!node&&node===handle.node&&node.isConnected&&!node.matches('button,a,input,textarea,select,[role=button],[role=link],[role=heading],h1,h2,h3,h4,h5,h6')&&!!node.children.length;
  if(!node||!this.available(node)||node.tagName!==handle.tag||(!liveContainer&&contextName(node)!==handle.name)||(checkStyle&&JSON.stringify(readStyle(node))!==handle.style))throw new Error('The referenced element changed while preparing this edit. Nothing was applied.');
  handle.node=node;this.identities.set(node,ref);return node;
 }
 collect(workflow:Workflow,stateId:string,selected:Selection|null,hover:HTMLElement|null,inspect:string[]=[],instruction=''):PageContext{
  const scope=workflow.id+':'+location.href;if(scope!==this.scope){this.reset();this.scope=scope;}else if(this.viewState!==stateId){const lastView=this.lastView;this.reset();this.lastView=workflow.states.some(s=>s.id===lastView)?lastView:null;}this.viewState=stateId;
  // Rebuild short-lived handles on each explicit context capture, retaining semantic memory only when revalidated.
  const retain=(id:string|null)=>{if(!id)return null;try{return this.get(id)?id:null;}catch{return null;}};
  this.recent=this.recent.map(retain).filter((id):id is string=>!!id).slice(-8);this.lastGroup=retain(this.lastGroup);this.styleReference=retain(this.styleReference);
  const focused=this.focusLocator?resolve(this.focusLocator,this.root,this.owned):null;if(this.focusLocator&&!focused)throw new Error('The focused section has changed. Choose the section again or return to whole-page chat.');
  const surface=focused||this.owned.get('view:'+stateId)||this.root;
  const resolved=focused||(selected?resolve(selected.locator,this.root,this.owned):null);
  const target=resolved&&this.available(resolved)?resolved:null;
  const staleSelection=!!selected&&!target;
  // Restore semantic copy memory from the saved design patch, scoped to this view's lineage.
  if(!this.cardMemory){const copies=renderLineage(workflow,stateId).flatMap(state=>state.operations).filter(op=>op.kind==='insert'&&op.node.copy).reverse();for(const op of copies){if(op.kind!=='insert')continue;const node=this.owned.get(op.node.id);if(node&&this.available(node)){this.cardMemory={node,locator:describe(node,op.node.id).locator};break;}}}
  let rememberedCard=this.cardMemory?.node;if(rememberedCard&&!this.available(rememberedCard))rememberedCard=resolve(this.cardMemory!.locator,this.root,this.owned)||undefined;if(rememberedCard&&!this.available(rememberedCard))rememberedCard=undefined;
  const copyOperation=workflow.states.flatMap(s=>s.operations).find(op=>op.kind==='insert'&&op.node.copy&&op.node.id===(selected?.locator.owned||(rememberedCard?this.ownedId(rememberedCard):undefined)));
  const copySource=copyOperation?.kind==='insert'?resolve(copyOperation.target,this.root,this.owned):null;
  const focus=target&&this.available(target)?target:hover&&this.available(hover)?hover:null;
  const parent=focus?parentOf(focus):null;
  const scopeNode=focus?(focus.matches('[role=dialog]')?focus:parent?.closest<HTMLElement>('[role=dialog],section,article,form,main')||parent||focus):surface;
  const peers=parent?[...parent.children].filter((n):n is HTMLElement=>n instanceof HTMLElement).slice(0,12):[];
  const descendants=focus?deepElements(focus,'h1,h2,h3,h4,h5,h6,[role=heading],button,a,label,input,select,textarea,p,div,span').slice(0,20):[];
  const groups=cardGroups(surface),regions=pageRegions(surface);
  const sceneNodes=[...regions.flatMap(region=>[region.node,...(parentOf(region.node)?[parentOf(region.node)!]:[])]),...groups.flatMap(group=>[group.container,...group.members]),...regions.flatMap(region=>[...region.node.children].filter((n):n is HTMLElement=>n instanceof HTMLElement).slice(0,6))];
  const cardContainers=[...new Set(deepElements(scopeNode,'button,a,[role=button],[role=link]').map(node=>findCard(node)?.root).filter((node):node is HTMLElement=>!!node))];
  const expanded=inspect.slice(0,8).flatMap(ref=>{let node:HTMLElement;try{node=this.get(ref);}catch{return [];}return [node,...deepElements(node,'button,a,input,select,textarea,[role=button],[role=link]'),...deepElements(node,'h1,h2,h3,h4,h5,h6,[role=heading]'),...deepElements(node,'*').slice(0,80)];});
  const request=instruction.toLowerCase().replace(/\s+/g,' ');
  // "On all cards" needs every match in view: up to 40, with full card context only for the first 6 so the element budget lasts.
  const bulk=!!request&&/\b(all|every|each|everywhere|throughout)\b/i.test(request);
  const mentioned=request?deepElements(surface,'button,a,h1,h2,h3,h4,h5,h6,[role=heading],span,p,label').filter(node=>{if(!this.available(node))return false;const name=contextName(node).toLowerCase();return name.length>=4&&name.length<=100&&request.includes(name);}).slice(0,bulk?40:6):[];
  const layoutItem=(node:HTMLElement)=>{let item=node;for(let depth=0;depth<5;depth++){const parent=parentOf(item);if(!parent||parent===this.root)return item;const css=getComputedStyle(parent);if(['grid','flex','inline-grid','inline-flex'].includes(css.display))return item;if(parent.querySelectorAll('h1,h2,h3,h4,h5,h6,[role=heading]').length>1)return item;item=parent;}return item;};
  // A card the request names comes with its inner structure (lists, checkbox rows, tables, forms), so the assistant can act on what is inside it, even below the fold.
  const inner=(root:HTMLElement)=>{
   // Lists, rows and forms first, then the card's own containers a few levels deep, whatever their tags: real apps build rows from plain divs.
   const marked=deepElements(root,'ul,ol,li,[role=list],[role=listitem],[role=group],table,tr,form,fieldset,details,label,[role=checkbox],input[type=checkbox]').filter(node=>this.available(node));
   const layers:HTMLElement[]=[];let level=[root];for(let depth=0;depth<4&&layers.length<40;depth++){level=level.flatMap(node=>[...node.children].filter((child):child is HTMLElement=>child instanceof HTMLElement&&this.available(child)&&child.getBoundingClientRect().height>=8));layers.push(...level);}
   return [...new Set([...marked,...layers])].slice(0,40);
  };
  const requested=mentioned.flatMap((node,index)=>{if(index>=6)return [node];const card=findCard(node),parent=parentOf(node),unit=card?layoutItem(card.root):null,layoutParent=unit?parentOf(unit):null;return [...(unit?[unit,...layoutParent?[layoutParent,...[...layoutParent.children].filter((n):n is HTMLElement=>n instanceof HTMLElement)]:[]]:[]),node,...(card?[card.root,card.heading,...card.description?[card.description]:[],...inner(card.root)]:[]),...(parent?[parent,...[...parent.children].filter((n):n is HTMLElement=>n instanceof HTMLElement)]:[])];});
  const sourceSide=request.match(/\b(left|right)[ -]+(?:navigation|nav|panel|sidebar)\b/i)?.[1];
  const regional=/\b(?:header|sidebar|navigation|nav|footer)\b/i.test(request)?regions.filter(region=>sourceSide?region.position===sourceSide:/footer/i.test(request)?region.kind==='footer':['header','sidebar','navigation'].includes(region.kind)):[];
  const regionNodes=regional.slice(0,3).flatMap(region=>{const node=region.node,parent=parentOf(node);return [node,...(parent?[parent]:[]),...[...node.children].filter((child):child is HTMLElement=>child instanceof HTMLElement),...deepElements(node,'header,nav,ul,ol,[role=navigation]')];});
  const parts=(node:HTMLElement)=>{const card=findCard(node);return card?.root===node?[node,card.heading,...(card.description?[card.description]:[])]:[node];};
  // Capture coherent structural units before incidental controls. Every exposed
  // card part and group member must survive the same bounded snapshot.
  const relevantGroups=/\b(?:cards?|grid|arrange|rearrange|stack)\b/i.test(request)?groups:[];
  relevantGroups.sort((a,b)=>Number(b.members.some(node=>mentioned.some(match=>node.contains(match))))-Number(a.members.some(node=>mentioned.some(match=>node.contains(match))))||Number(b.container.getBoundingClientRect().top<window.innerHeight&&b.container.getBoundingClientRect().bottom>0)-Number(a.container.getBoundingClientRect().top<window.innerHeight&&a.container.getBoundingClientRect().bottom>0));
  const groupNodes=relevantGroups.slice(0,2).flatMap(group=>[group.container,...group.members,...group.members.flatMap(parts)]);
  const memoryNodes=rememberedCard?[...parts(rememberedCard),...(parentOf(rememberedCard)?[parentOf(rememberedCard)!]:[])]:[];
  // An open app dialog is where the user's attention is, often right after Wandel opened it: its contents come first.
  const dialog=[...this.root.querySelectorAll<HTMLElement>('[role=dialog],[role=alertdialog],[aria-modal=true],dialog[open]')].find(node=>!node.closest('[data-dx-owned],[data-dx-ignore]')&&this.available(node));
  const dialogNodes=dialog?[dialog,...deepElements(dialog,'h1,h2,h3,h4,h5,h6,p,label,input,textarea,select,button,a,[role=button],[role=tab],[role=checkbox],li').filter(node=>this.available(node)).slice(0,50)]:[];
  // The page's grids, rows and lists, nearest to what the request names first; their containers and items are always in the snapshot.
  const structures=layoutStructures(surface===this.root?this.root:(parentOf(surface)||surface),[...mentioned,...(focus?[focus]:[]),...dialogNodes.slice(0,1)],8);
  const structureNodes=structures.flatMap(s=>[s.container,...s.items.slice(0,4)]);
  const styled=workflow.states.find(state=>state.id===stateId)?.operations.flatMap(op=>{if(op.kind!=='style'&&op.kind!=='appearance'&&op.kind!=='css')return [];const node=op.target.owned?this.owned.get(op.target.owned):resolve(op.target,this.root,new Map());return node?[node]:[];})||[];
  const candidates=[...dialogNodes,...styled,...structureNodes,surface,...expanded,...groupNodes,...requested,...regionNodes,...(focus?parts(focus):[]),...memoryNodes,...regions.map(region=>region.node),...groups.flatMap(group=>[group.container,...group.members]),...deepElements(surface,'button,a,[role=button],[role=link]').filter(node=>this.available(node)&&!!contextName(node)).slice(0,20),scopeNode,...(parent?[parent]:[]),...(copySource?[copySource]:[]),...this.recent.map(id=>this.get(id)),...(this.lastGroup?[this.get(this.lastGroup)]:[]),...(this.styleReference?[this.get(this.styleReference)]:[]),...cardContainers,...cardContainers.flatMap(parts),...sceneNodes,...peers,...descendants,...deepElements(scopeNode,'h1,h2,h3,h4,button,[role=button],[role=radio],label,input:not([type=password]):not([type=hidden]),section,article,p,a')];
  const nodes=[...new Set(candidates)].filter(n=>this.available(n)).slice(0,160);const allowed=new Set(nodes);
  const capturedParent=(node:HTMLElement)=>{let parent=parentOf(node);while(parent&&!allowed.has(parent))parent=parentOf(parent);return parent;};
  const copiedRoots=new Set(workflow.states.flatMap(s=>s.operations.flatMap(op=>op.kind==='insert'&&op.node.copy?[op.node.id]:[])));
  const elements:PageContext['elements']=nodes.map(node=>{const rect=node.getBoundingClientRect(),css=getComputedStyle(node),rawStyle=readStyle(node);const card=findCard(node),heading=(groups.some(group=>group.members.includes(node))||copiedRoots.has(this.ownedId(node)||''))?copiedHeading(node):card?.root===node?card.heading:null;const ref=this.ref(node),handle=this.handles.get(ref)!;handle.name=contextName(node);handle.style=JSON.stringify(rawStyle);return {ref,tag:node.tagName.toLowerCase(),role:node.getAttribute('role')||describe(node).locator.role,name:contextName(node),text:node.matches('input,textarea,select')?'':contextName(node),attributes:{...(!node.closest('[data-dx-owned]')&&(node.matches('[aria-haspopup],[aria-expanded=false],summary')||node.matches('button,[role=button]')&&/^(open|expand|show|view|see|more)\b/i.test((node.getAttribute('aria-label')||node.textContent||'').trim())||!node.matches('button,a,input,select,textarea,label')&&css.cursor==='pointer'&&rect.width>120)?{'wandel-opens':'true'}:{}),...(node.dataset.dxCustom&&node.shadowRoot?{'wandel-custom-text':cleanText([...node.shadowRoot.childNodes].filter(child=>child.nodeName!=='STYLE').map(child=>child.textContent||'').join(' ')).slice(0,300),'wandel-custom-options':[...node.shadowRoot.querySelectorAll('[data-option]')].map(o=>o.getAttribute('data-option')||cleanText(o.textContent||'')).join(' | ').slice(0,300)}:{}),...(heading?{'wandel-card':'true',...(card?.root===node?{'wandel-control-count':String(card.controls.length)}:{}),'wandel-heading':cleanText(heading.textContent||''),'wandel-heading-ref':this.ref(heading),'wandel-layout-item-ref':this.ref(layoutItem(node)),...(card?.root===node&&card.description?{'wandel-description-ref':this.ref(card.description)}:{})}:{}),...(node instanceof HTMLAnchorElement&&/^https?:/.test(node.href)?{href:cleanText(node.origin===location.origin?node.pathname:node.origin+node.pathname,300)}:{}),...Object.fromEntries(['id','data-testid','data-qa','type','aria-label','aria-pressed','aria-checked'].flatMap(key=>{const value=node.getAttribute(key);return value?[[key,cleanText(value)]]:[];}))},classes:[...node.classList].slice(0,8).map(v=>cleanText(v,80)),bounds:{x:Math.round(rect.x),y:Math.round(rect.y),width:Math.round(rect.width),height:Math.round(rect.height)},visible:true,disabled:false,parent:capturedParent(node)?this.ref(capturedParent(node)!):null,children:nodes.filter(n=>n!==node&&capturedParent(n)===node).slice(0,32).map(n=>this.ref(n)),style:{...(/gradient\(/.test(css.backgroundImage)?{'background-image':css.backgroundImage.slice(0,280)}:{}),...Object.fromEntries(Object.entries(rawStyle).filter(([key])=>['color','background-color','border','border-radius','box-shadow','font-family','font-size','font-weight','line-height','text-align','padding','margin','gap','flex-wrap','align-self','flex-grow','flex-shrink'].includes(key))),position:css.position,top:css.top,right:css.right,bottom:css.bottom,left:css.left,width:css.width,height:css.height,'box-sizing':css.boxSizing,'margin-left':css.marginLeft,'margin-right':css.marginRight,'margin-top':css.marginTop,'padding-left':css.paddingLeft,'padding-top':css.paddingTop,display:css.display,'flex-direction':css.flexDirection,'grid-template-columns':css.gridTemplateColumns,'align-items':css.alignItems,'justify-content':css.justifyContent,gap:css.gap},interactive:node.matches('button,a,input,select,textarea,[role=button],[role=radio]'),owned:!!this.ownedId(node)};});
  for(const element of elements)element.style=Object.fromEntries(Object.entries(element.style).filter(([key,value])=>!['auto','normal','none','0px','0px 0px','rgba(0, 0, 0, 0)'].includes(value)||['display','position','flex-direction'].includes(key)));
  while(JSON.stringify(elements).length>140000&&elements.length>8)elements.pop();
  const present=new Set(elements.map(e=>e.ref));if(this.handles.size>2048)for(const ref of this.handles.keys())if(!present.has(ref))this.handles.delete(ref);for(const element of elements){element.children=element.children.filter(ref=>present.has(ref));if(element.parent&&!present.has(element.parent))element.parent=null;for(const key of ['wandel-heading-ref','wandel-description-ref','wandel-layout-item-ref'])if(element.attributes[key]&&!present.has(element.attributes[key]))delete element.attributes[key];}
  this.revision=JSON.stringify(workflow);this.token=uid();
  const limitations=['DOM context excludes typed field values, credentials and private subtrees. A redacted viewport screenshot may accompany this context.'];
  if(focused)limitations.push('SECTION FOCUS: interpret this conversation as changes to this section and its contents. Preserve the rest of the page unless the user explicitly asks to expand the scope.');
  if(staleSelection)limitations.push('The previous selection expired. Resolve the current request from the page, groups and conversation; do not demand reselection.');
  const screenshotMasks=deepElements(this.root,'input,textarea,select,[contenteditable=true],[data-private],[data-sensitive],iframe,[data-dx-ignore]').filter(node=>!node.matches('[data-dx-ignore]')||!node.closest('[data-dx-owned]')).map(node=>node.getBoundingClientRect()).filter(rect=>rect.width>0&&rect.height>0&&rect.bottom>0&&rect.right>0&&rect.top<innerHeight&&rect.left<innerWidth).map(rect=>({x:Math.max(0,rect.left-3),y:Math.max(0,rect.top-3),width:rect.width+6,height:rect.height+6}));
  if(this.root.querySelector('iframe'))limitations.push('Frames are not inspected or edited in this slice. Select an accessible element in the main page.');
  const capture=watched();
  const layout=structures.map(s=>({ref:this.ref(s.container),kind:s.kind,name:s.name,columns:s.columns,items:s.items.slice(0,4).map(item=>this.ref(item))}));
  const listed=new Set(nodes);
  const copied=copiedElement(),sharedKeys=Object.keys(sharedValues()).slice(0,40);
  const route=workflow.states.find(state=>state.id===stateId)?.virtualRoute||new URL(workflow.origin+workflow.route).pathname,appMap=relevantEndpoints(currentAppMap(),instruction,route);
  return PageContextSchema.parse({...(appMap?{appMap}:{}),...(workflow.projectContext?.on&&workflow.projectContext.text.trim()?{projectContext:workflow.projectContext.text.trim()}:{}),...(sharedKeys.length?{sharedKeys}:{}),...(copied?{copiedElement:{label:copied.label,from:copied.from}}:{}),styledByWandel:[...new Set(styled)].filter(node=>listed.has(node)).map(node=>this.ref(node)).slice(0,60),layout,appToastKnown:!!appToastLook(),watched:capture?{id:capture.id,kind:capture.kind,title:capture.title,outline:capture.outline,trigger:capture.trigger}:null,workspace:{...emptyAssistantMemory(),...workflow.assistantMemory,name:workflow.name},token:this.token,screenshotMasks,page:this.ref(surface),workflowId:workflow.id,stateId,route:workflow.states.find(state=>state.id===stateId)?.virtualRoute||new URL(workflow.origin+workflow.route).pathname,viewport:{width:window.innerWidth,height:window.innerHeight,scrollX:window.scrollX,scrollY:window.scrollY},selected:target&&present.has(this.ref(target))?this.ref(target):null,copySource:copySource&&nodes.includes(copySource)?this.ref(copySource):null,lastCard:rememberedCard&&present.has(this.ref(rememberedCard))?this.ref(rememberedCard):null,regions:regions.filter(region=>present.has(this.ref(region.node))).map(region=>({ref:this.ref(region.node),kind:region.kind,position:region.position})),groups:groups.filter(group=>present.has(this.ref(group.container))&&group.members.every(member=>present.has(this.ref(member)))).map(group=>({ref:this.ref(group.container),kind:'cards' as const,members:group.members.map(member=>this.ref(member)),layout:group.layout})),hover:hover&&nodes.includes(hover)?this.ref(hover):null,styleReference:this.styleReference&&present.has(this.styleReference)?this.styleReference:null,elements,recent:this.recent.filter(ref=>present.has(ref)),lastGroup:this.lastGroup&&present.has(this.lastGroup)?this.lastGroup:null,lastView:this.lastView,views:workflow.states.map(s=>({id:s.id,title:cleanText(s.title),...(s.virtualRoute?{route:s.virtualRoute}:s.liveURL?{route:new URL(s.liveURL).pathname}:{})})),limitations});
 }
 focusCard(node:HTMLElement){if(this.available(node))this.cardMemory={node,locator:describe(node,this.ownedId(node)).locator};}
 ownedNode(id:string){return this.owned.get(id);}
 get rootNode(){return this.root;}
 ownedId(node:HTMLElement){return [...this.owned].find(([,n])=>n===node)?.[0];}
 guard(token:string,workflow:Workflow){if(!this.token||token!==this.token||this.scope!==workflow.id+':'+location.href||JSON.stringify(workflow)!==this.revision)throw new Error('The page or workflow changed while planning. Capture context and retry.');}
 remember(nodes:HTMLElement[],group?:HTMLElement,view?:string){for(const [ref,handle] of this.handles)if(handle.locator.owned){const current=this.owned.get(handle.locator.owned);if(current){handle.node=current;handle.name=contextName(current);handle.style=JSON.stringify(readStyle(current));this.identities.set(current,ref);}} if(this.cardMemory){const current=resolve(this.cardMemory.locator,this.root,this.owned);if(current)this.cardMemory.node=current;} if(nodes.length)this.recent=nodes.map(n=>this.ref(n)).slice(-8);if(group)this.lastGroup=this.ref(group);if(view)this.lastView=view;this.token='';}
}
