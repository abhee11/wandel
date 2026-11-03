import {verifyNewButton} from './controlVerification';
import {verifyArrangement} from '../content/arrangement';
import {namedIcon} from '../content/copyIcon';
import {copyPlacement} from '../content/copyPlacement';
import {verifyContent,verifyBelow,verifyBeside,verifyChartSection,verifyNoOverlap,contentBaseline,ContentIssues} from './visualVerification';
import {layoutOperations} from './layout';
import {validateTheme,verifyTheme} from '../content/theme';
import {findCard} from './card';
import {captureCopy} from '../content/duplicate';
import {watched} from '../content/watch';
import {safeDeclarations} from '../content/behavior';
import {renameCopyHeading} from '../content/duplicateHeading';
import {sensitive} from './privacy';
import {clone,uid,OperationSchema,type Workflow,type Locator,type Operation,type CopyNode} from '../shared/model';
import {validateWorkflow,visibleNodeIds,renderLineage} from '../prototype/engine';
import {describe,resolve,structuralIdentity} from '../content/locator';
import {captureDesign,readStyle,visible,buttonAppearance} from '../content/nativeDesign';
import {editableText,percentageTextRuns,textPath} from '../content/text';
import {normalizePlan,validatePlanReferences} from './plan';
import {sameApplicationURL} from '../shared/liveNavigation';
import {AssistantPlanSchema,type AssistantPlan} from './schema';
import {ContextCollector} from './context';
const owned=(id:string):Locator=>({owned:id,tag:'',role:'',name:'',text:'',attrs:{},parent:{tag:'',id:'',role:'',label:''},previous:'',next:''});
export function compileAssistant(workflow:Workflow,stateId:string,planInput:unknown,collector:ContextCollector){
 const plan=normalizePlan(planInput);if(plan.status!=='edit')throw new Error('This response needs a clarification, not execution.');
 const next=clone(workflow),state=next.states.find(s=>s.id===stateId)!;let nextState=stateId;const afterAnchors=new Map<string,string>();const created:string[]=[];const checks:(()=>void)[]=[];let group:string|undefined,view:string|undefined,cardId:string|undefined;
 const arrangements:Operation[]=[];
 // Steps go to the current screen until a plan opens a variant of this page; later steps then design that variant.
 let opsState=state;const add=(op:Operation)=>opsState.operations.push(OperationSchema.parse(op));
 const outputs=new Map<string,{node:HTMLElement;id:string;locator:Locator}>();
 // Screens created in this plan whose timed progress bar can start a finish connection.
 const timedViews=new Map<string,{view:string;back:string}>();
 // Blocks created earlier in this plan, by host id: their options are known from the plan before the page shows them.
 const plannedBlocks=new Map<string,NonNullable<AssistantPlan['actions'][number]['block']>>();
 const withIds=(block:NonNullable<AssistantPlan['actions'][number]['block']>)=>({...block,nodes:block.nodes.map(part=>({...part,id:uid()}))});
 const locatorOf=(node:HTMLElement)=>{const locator=describe(node,collector.ownedId(node)).locator;if(!locator.owned&&!locator.name&&!locator.text)locator.structure=structuralIdentity(node);return locator;};
 // A host page may hold a card in an absolutely positioned layer inside a slot whose
 // height its script fixed inline; growing the card then needs that slot released.
 const releaseFixedHeights=(start:HTMLElement)=>{let layers:HTMLElement[]=[];for(let node:HTMLElement|null=start,depth=0;node&&depth<8&&!node.matches('html,body');node=node.parentElement,depth++){const css=getComputedStyle(node);if(css.position==='fixed')return;if(css.position==='absolute')layers.push(node);if(layers.length&&/px$/.test(node.style.height)){for(const layer of layers)add({id:uid(),kind:'style',target:locatorOf(layer),style:{position:'relative'}});add({id:uid(),kind:'style',target:locatorOf(node),style:{blockSize:'auto'}});layers=[];}}};
 const resolveLayoutSource=(locator:Locator)=>locator.owned?collector.ownedNode(locator.owned):resolve(locator,collector.rootNode,new Map());
 const locate=(ref:string)=>{if(outputs.has(ref))return outputs.get(ref)!;const node=collector.get(ref),id=collector.ownedId(node);const locator=id?owned(id):describe(node).locator;if(!id){locator.structure=structuralIdentity(node);const classes=node.getAttribute('class');if(classes)locator.attrs.class=classes;}return {node,id,locator};};
 // One more item in an existing list, menu or option group is a copy of an item there, renamed, never a new control styled from elsewhere:
 // it keeps the list's own look, spacing and direction. Several new items follow each other in the order given.
 const listItem=(node:HTMLElement,inside:boolean)=>{
  const item='li,[role=option],[role=menuitem],[role=menuitemradio],[role=menuitemcheckbox],[role=radio],[role=tab],[role=listitem],button,a';
  const small=(el:Element)=>{const r=el.getBoundingClientRect();return r.height>0&&r.height<140;};
  if(inside){const kids=[...node.children].filter((kid):kid is HTMLElement=>kid instanceof HTMLElement&&kid.matches(item)&&small(kid));return kids.length?kids[kids.length-1]:null;}
  const found=node.closest<HTMLElement>(item);return found&&(found===node||found.contains(node))&&small(found)&&!found.closest('nav,header')?found:null;
 };
 const lastCopy=new Map<HTMLElement,string>();let listCount=0;
 plan.actions=plan.actions.map(action=>{
  if(action.kind!=='create'||!['button','link','text'].includes(action.element||'')||action.targets.length!==1||!action.text?.trim()||action.targets[0].startsWith('new:')||!['after','before','beside','inside',null,undefined].includes(action.position))return action;
  let node:HTMLElement;try{node=collector.get(action.targets[0]);}catch{return action;}
  const item=listItem(node,action.position==='inside');if(!item||(action.element==='text'&&!item.matches('li,[role=option],[role=menuitem],[role=listitem]')))return action;
  const ref=collector.ref(item),resultRef=action.resultRef||'new:list-'+(++listCount),previous=lastCopy.get(item);lastCopy.set(item,resultRef);
  return {...action,kind:'duplicate' as const,element:null,targets:[ref],relativeTo:previous||ref,position:'after' as const,description:null,labels:[],styleRef:null,style:null,resultRef};
 });
 for(const action of plan.actions){
  const targets=action.targets.map(locate),styleReference=action.styleRef?collector.get(action.styleRef,true):null;
  const appearance=styleReference?readStyle(styleReference):undefined;
  if(action.kind==='theme'){
   if(targets.length!==1||!action.theme)throw new Error('Choose a page or region and a complete theme palette.');if(targets[0].node.matches('button,a,input,select,textarea'))throw new Error('Theme a page or container; use style for a single control.');validateTheme(action.theme);add({id:uid(),kind:'theme',target:targets[0].locator,theme:action.theme});const locator=targets[0].locator,node=targets[0].node;checks.push(()=>verifyTheme(locator.owned?collector.ownedNode(locator.owned)||node:node));
  }else if(action.kind==='layout'){
   if(targets.length!==1||!action.layout)throw new Error('Choose one layout container and a direction.');
   if(action.layout==='grid'||action.layout==='horizontal'||action.layout==='vertical'){
    const target=targets[0],arrangement={direction:action.layout,columns:action.columns||2,gap:action.style?.gap??action.style?.columnGap??24},before=new ContentIssues([...target.node.children].flatMap(child=>child instanceof HTMLElement?[...contentBaseline(child)]:[]));
    // Applied after preceding inserts/reorders, against the rendered children.
    if(action.style)add({id:uid(),kind:'style',target:target.locator,style:action.style});
    arrangements.push({id:uid(),kind:'style',target:target.locator,style:{},arrangement});
    checks.push(()=>{const node=target.id?collector.ownedNode(target.id):target.node;if(!node)throw new Error('The layout container disappeared.');verifyArrangement(node,arrangement,item=>before.get(item));});
    continue;
   }
   if(action.layout==='header'){
    const target=targets[0].node;
    const previous=renderLineage(next,stateId).flatMap(s=>s.operations).reverse().find(op=>{if(op.kind!=='style'||op.layoutChange?.direction!=='sidebar')return false;const source=resolveLayoutSource(op.layoutChange.source);return !!source&&(source===target||source.contains(target)||target.contains(source));});
    if(previous?.kind==='style'&&previous.layoutChange){
     const change=previous.layoutChange,headerSource=resolveLayoutSource(change.source),headerIssues=headerSource?contentBaseline(headerSource):new ContentIssues();
     for(const entry of next.states)entry.operations=entry.operations.filter(op=>!((op.kind==='style'||op.kind==='reorder')&&op.layoutChange?.id===change.id));
     checks.push(()=>{const header=resolveLayoutSource(change.source);if(!header)throw new Error('The restored navigation is missing.');verifyContent(header,node=>headerIssues.get(node));const rect=header.getBoundingClientRect();if(rect.width>0&&(rect.height>rect.width/2||getComputedStyle(header).flexDirection==='column'))throw new Error('The original navigation did not return to a horizontal header.');});
     continue;
    }
   }
   const layout=layoutOperations(targets[0].node,action.layout,collector.rootNode,targets[0].locator,node=>collector.ownedId(node),action.columns||2,id=>collector.ownedNode(id));if(action.layout==='sidebar'){
    const source=targets[0].node.closest<HTMLElement>('header,[role=banner]')||targets[0].node,sourceLocator=describe(source,collector.ownedId(source)).locator;sourceLocator.structure=structuralIdentity(source);
    const layoutChange={id:uid(),direction:'sidebar' as const,source:sourceLocator};
    layout.operations.forEach(op=>add(op.kind==='style'||op.kind==='reorder'?{...op,layoutChange}:op));
   }else layout.operations.forEach(add);if(action.style){const {display,flexDirection,gridTemplateColumns,...decoration}=action.style;if(Object.keys(decoration).length)add({id:uid(),kind:'style',target:targets[0].locator,style:decoration});}checks.push(layout.verify);
  }else if(action.kind==='duplicate'){
   if(targets.length!==1)throw new Error('Select one existing card to copy.');
   // A duplicate targets exactly the referenced element. Card heuristics may help
   // locate optional labels, but must never shrink, expand or reject this source.
   // The one exception: the only visible part of a list item stands for the item, so a copy becomes a new row of the list.
   let source=targets[0].node,sourceLocator=targets[0].locator;{const item=source.parentElement;if(!targets[0].id&&item?.matches('li')&&![...item.children].some(child=>child!==source&&child instanceof HTMLElement&&visible(child))){source=item;sourceLocator=locatorOf(item);}}
   if(source.matches('html,body'))throw new Error('Select an element inside the page to copy.');
   if(sensitive(source)||source.querySelector('[data-private],[data-sensitive]'))throw new Error('This card includes private content and cannot be duplicated by the assistant.');
   const selectedSource=source.matches('[aria-selected=true],[aria-checked=true],[aria-current]:not([aria-current=false])')||/\bselected\b/i.test(source.getAttribute('aria-label')||'');
   const identities=new Map<Node,number>(),copy=captureCopy(source,identities);if(findCard(source)?.controls.length===0)copy[0].style.width='auto';
   // A grid or row can stretch the original past its content; the copy keeps that rendered height as its minimum.
   {const height=Math.round(source.getBoundingClientRect().height);if(height>0)copy[0].style['min-height']=height+'px';}
   // Captured before the preview renders: the copy is held to its source's rendering, not to an ideal.
   const sourceIssues=contentBaseline(source),same=(a:string|null|undefined,b:string)=>a?.replace(/\s+/g,' ').trim()===b.replace(/\s+/g,' ').trim();
   const rename=(index:number|undefined,text:string)=>{if(index===undefined)throw new Error('The referenced text is missing.');if(copy[index].tag==='#text'){copy[index].text=text;return;}let written=false;for(let i=index+1;i<copy.length;i++){let parent=copy[i].parent;while(parent>index)parent=copy[parent].parent;if(parent!==index||copy[i].tag!=='#text')continue;if(!copy[i].text.trim())continue;copy[i].text=written?'':text;written=true;}if(!written)throw new Error('Choose a card with editable text labels.');};
   const headingIndex=action.text?.trim()?renameCopyHeading(source,action.text,copy,identities):undefined;
   // A card without a button still has a description when it holds one heading and a paragraph; the copy's text replaces it.
   const plainCard=(root:HTMLElement)=>{const headings=root.querySelectorAll('h1,h2,h3,h4,h5,h6,[role=heading]'),paragraphs=[...root.querySelectorAll<HTMLElement>('p')].filter(p=>p.textContent?.trim()&&!headings[0]?.contains(p));return headings.length===1&&paragraphs.length>=1&&paragraphs.length<=3?{description:paragraphs[0]}:null;};
   const card=action.description?.trim()?(findCard(source)?.description?findCard(source):plainCard(source)):null;
   let descriptionIndex:number|undefined;if(action.description?.trim()){if(card?.description&&source.contains(card.description)){descriptionIndex=identities.get(card.description);if(!same(card.description.textContent,action.description))rename(descriptionIndex,action.description);}else{descriptionIndex=copy.length;copy.push({id:uid(),parent:0,tag:'p',text:'',style:{'font-family':'inherit','font-size':'13px','line-height':'1.5',color:getComputedStyle(source).color,margin:'8px 0 0',width:'auto',height:'auto'}});copy.push({id:uid(),parent:descriptionIndex,tag:'#text',text:action.description,style:{}});}}
   // Renamed text needs room: wrappers between it and the card drop the width they had for the old text.
   for(const index of [headingIndex,descriptionIndex])for(let i=index===undefined?0:copy[index].parent;i>0;i=copy[i].parent)if(/px$/.test(copy[i].style.width||''))copy[i].style.width='auto';
   if(action.labels.length){const buttons=[...(source.matches('button,a,[role=button],[role=link]')?[source]:source.querySelectorAll<HTMLElement>('button,a,[role=button],[role=link]'))].map(node=>identities.get(node)).filter((index):index is number=>index!==undefined);if(buttons.length!==action.labels.length)throw new Error('Specify one label per button on the copied card.');buttons.forEach((index,i)=>rename(index,action.labels[i]));}
   // Visual copies are local prototypes, not production actions or navigations.
   for(const item of copy)delete item.href;
   // A copy of the selected item is another option, not a second selection: its checkmark stays behind.
   if(selectedSource)for(const item of copy)if(item.icon)item.style.display='none';
   // A destination (relativeTo) places the copy there, such as inside a new row; otherwise it sits beside or after its original.
   const destination=action.relativeTo?locate(action.relativeTo):null;
   if(destination){copy[0].style.width='auto';copy[0].style['min-width']='0';copy[0].style['max-width']='100%';}
   if(action.position!=='below'&&!destination)copyPlacement(source,node=>collector.ownedId(node)).forEach(add);
   const sourceBounds=source.getBoundingClientRect();
   const id=uid(),insertParts=copy,sourceParts=new Map<string,HTMLElement>();for(const [part,index] of identities)if(part instanceof HTMLElement)sourceParts.set(index===0?id:copy[index].id,part);
   // Beside: a card alone in a grid or row cell gets the next cell; inserting after the card itself would stack it inside its own cell.
   let besideAnchor=sourceLocator;if(action.position==='beside'){let cell:HTMLElement=source;while(cell.parentElement&&!cell.parentElement.matches('body,main')&&cell.parentElement.children.length===1)cell=cell.parentElement;const row=cell.parentElement,css=row&&getComputedStyle(row);if(cell!==source&&css&&(css.display.includes('grid')||css.display.includes('flex')&&!css.flexDirection.startsWith('column')))besideAnchor=locatorOf(cell);}
   add({id:uid(),kind:'insert',target:destination?destination.locator:besideAnchor,position:destination?((action.position==='over'?'inside':action.position)==='before'?'before':(action.position==='over'?'inside':action.position)==='after'?'after':'inside'):action.position==='beside'?'after':(action.position==='over'?'inside':action.position)||'after',node:{id,kind:'panel',text:action.text||'Card copy',copy}});created.push(id);cardId=id;checks.push(()=>{const copy=collector.ownedNode(id);if(!copy)throw new Error('The copied component is missing.');const copyBaseline=(node:HTMLElement)=>{const part=sourceParts.get(node===copy?id:node.dataset.dxOwned||'');return part&&sourceIssues.get(part);};verifyContent(copy,copyBaseline);const original=(targets[0].id&&collector.ownedNode(targets[0].id))||source;if(!destination&&action.position==='below')verifyBelow(copy,original,sourceBounds,node=>sourceIssues.get(node),copyBaseline);if(!destination&&action.position==='beside')verifyBeside(copy,original,sourceBounds);const label=(index:number|undefined)=>index===undefined?null:index===0?copy:collector.ownedNode(insertParts[index].id);if(action.text&&label(headingIndex)?.textContent?.replace(/\s+/g,' ').trim()!==action.text.replace(/\s+/g,' ').trim())throw new Error('The copied heading did not match the request.');if(action.description&&label(descriptionIndex)?.textContent?.replace(/\s+/g,' ').trim()!==action.description.replace(/\s+/g,' ').trim())throw new Error('The copied description did not match the request.');});
   if(action.resultRef){outputs.set(action.resultRef,{node:source,id,locator:owned(id)});for(const [part,index] of identities)if(part instanceof HTMLElement)outputs.set(action.resultRef+'/'+collector.ref(part),{node:part,id:index===0?id:copy[index].id,locator:owned(index===0?id:copy[index].id)});const controls=[...source.querySelectorAll<HTMLElement>('button,a,[role=button],[role=link]')];if(controls.length===1){const part=identities.get(controls[0]);if(part!==undefined)outputs.set(action.resultRef+':button',{node:controls[0],id:copy[part].id,locator:owned(copy[part].id)});}}
  }else if(action.kind==='reorder'){
   if(targets.length!==1||!action.relativeTo||!['before','after','inside'].includes(action.position||''))throw new Error('Choose an element and where it should move.');
   const anchor=locate(action.relativeTo);if(targets[0].node===anchor.node||targets[0].node.contains(anchor.node))throw new Error('An element cannot be moved into itself or its descendants. Inspect the surrounding layout container.');add({id:uid(),kind:'reorder',target:targets[0].locator,anchor:anchor.locator,position:action.position as 'before'|'after'|'inside'});
   const targetLocator=targets[0].locator,anchorLocator=anchor.locator,position=(action.position==='over'?'inside':action.position),before=new ContentIssues([...contentBaseline(targets[0].node),...contentBaseline(anchor.node)]);
   checks.push(()=>{const moved=targets[0].node.isConnected&&collector.rootNode.contains(targets[0].node)?targets[0].node:resolveLayoutSource(targetLocator),relative=anchor.node.isConnected&&collector.rootNode.contains(anchor.node)?anchor.node:resolveLayoutSource(anchorLocator);if(!moved||!relative)throw new Error('The moved element or its destination is missing.');const shared=moved.parentElement===relative.parentElement,cssOrder=shared&&moved.parentElement&&['flex','inline-flex','grid','inline-grid'].includes(getComputedStyle(moved.parentElement).display),ordered=cssOrder&&Number(getComputedStyle(moved).order)!==Number(getComputedStyle(relative).order)?(position==='before'?Number(getComputedStyle(moved).order)<Number(getComputedStyle(relative).order):Number(getComputedStyle(moved).order)>Number(getComputedStyle(relative).order)):!!(moved.compareDocumentPosition(relative)&(position==='before'?Node.DOCUMENT_POSITION_FOLLOWING:Node.DOCUMENT_POSITION_PRECEDING));if(position==='inside'?!relative.contains(moved):!shared||!ordered)throw new Error('The requested element order was not rendered.');
    for(const unit of [moved,relative]){verifyContent(unit,node=>before.get(node));const box=unit.getBoundingClientRect();if(!visible(unit)||!box.width||!box.height)throw new Error('A reordered element is no longer visible.');for(const chart of unit.querySelectorAll('svg')){const rect=chart.getBoundingClientRect();if(rect.width&&rect.height&&(rect.left<box.left-4||rect.right>box.right+4||rect.top<box.top-4||rect.bottom>box.bottom+4))throw new Error('A reordered chart or icon escaped its card. Move the complete layout wrapper.');}}
   });
  }else if(action.kind==='create'&&(action.element==='chart'||(action.element==='panel'||action.element==='block')&&targets.length>1)){
   // A section below several cards spans exactly their combined width.
   const chart=action.element==='chart'?action.chart:undefined,block=action.element==='block'&&action.block?withIds(action.block):undefined;
   if(action.element==='chart'&&!chart||targets.length>6)throw new Error('A chart section needs its data and at most six cards to sit below.');
   // A card's layout container is found past wrappers that hold only it: Wandel's placement wrapper or a host grid cell.
   const nodes=targets.map(target=>target.node),layoutParent=(node:HTMLElement)=>{let parent=node.parentElement;while(parent&&!parent.matches('body,main')&&(parent.dataset.dxOwned?.startsWith('wrap:')||parent.children.length===1)&&parent.parentElement)parent=parent.parentElement;return parent;},container=layoutParent(nodes[0]),cardBounds=nodes.map(node=>node.getBoundingClientRect());
   if(!container||container.matches('html,body')||nodes.some(node=>layoutParent(node)!==container))throw new Error('Choose cards that share one container for the section to span.');
   const bounds=nodes.map(node=>node.getBoundingClientRect()),left=Math.min(...bounds.map(b=>b.left)),right=Math.max(...bounds.map(b=>b.right)),bottom=Math.max(...bounds.map(b=>b.bottom)),css=getComputedStyle(container),card=readStyle(nodes[0]);
   // The section adopts the cards' surface so it reads as part of the same page.
   const surface:Record<string,string>={display:'block','box-sizing':'border-box','max-width':'100%','min-width':'0',height:'auto'};for(const key of (block?['color','font-family']:['background-color','border','border-radius','box-shadow','padding','color','font-family']) as ('color')[])if(card[key])surface[key]=card[key];if(block){surface.padding='0';surface['border-radius']='0';}
   const id=uid();let locator:Locator,grid:{start:number;span:number}|undefined;
   if(css.display.includes('grid')){
    // Occupy exactly the grid tracks under the cards, on the row after them; the
    // section is inserted after that row's last item so other cards keep their places.
    const gap=parseFloat(css.columnGap)||0;let x=container.getBoundingClientRect().left+(parseFloat(css.borderLeftWidth)||0)+(parseFloat(css.paddingLeft)||0);
    const tracks=css.gridTemplateColumns.split(' ').map(parseFloat).map(width=>{const start=x;x+=width+gap;return {start,end:start+width};});
    const start=tracks.findIndex(track=>Math.abs(track.start-left)<=2),end=tracks.findIndex(track=>Math.abs(track.end-right)<=2);
    if(start<0||end<start)throw new Error('The cards do not align with their grid columns, so the section cannot span them exactly.');
    grid={start:start+1,span:end-start+1};surface.width='auto';surface.margin='0';
    const row=[...container.children].filter((child):child is HTMLElement=>child instanceof HTMLElement&&visible(child)&&child.getBoundingClientRect().top<bottom-2).at(-1)||nodes.at(-1)!;
    locator=row===nodes.at(-1)&&!row.dataset.dxOwned?.startsWith('wrap:')?targets.reduce((a,b)=>a.node.compareDocumentPosition(b.node)&Node.DOCUMENT_POSITION_FOLLOWING?b:a).locator:describe(row,collector.ownedId(row)).locator;
    if(!locator.owned&&!locator.name&&!locator.text)locator.structure=structuralIdentity(row);
   }else{
    surface.width=Math.round(right-left)+'px';surface.margin=`24px 0 0 ${Math.round(left-container.getBoundingClientRect().left)}px`;
    locator=describe(container,collector.ownedId(container)).locator;if(!locator.owned&&!locator.name&&!locator.text)locator.structure=structuralIdentity(container);
   }
   add({id:uid(),kind:'insert',target:locator,position:'after',node:{id,kind:'panel',text:chart?.title||action.text||'',appearance:surface,...(chart?{chart}:{}),...(block?{block}:{}),...(grid?{grid}:{})}});created.push(id);group=id;
   const points=chart?.points.length;
   checks.push(()=>{const section=collector.ownedNode(id);if(!section)throw new Error('The new section is missing.');verifyContent(section);verifyChartSection(section,targets.map(target=>(target.id&&collector.ownedNode(target.id))||target.node),cardBounds,points);});
   if(action.resultRef){const representative=document.createElement('section');representative.textContent=chart?.title||action.text||'';outputs.set(action.resultRef,{node:representative,id,locator:owned(id)});}
  }else if(action.kind==='create'&&action.element==='block'){
   if(!action.block||targets.length!==1)throw new Error('A block needs its parts and one target to sit in, before or after.');
   // over floats the block at an exact spot on its target, without moving anything around it.
   const over=action.position==='over',position:'before'|'after'|'inside'|'below'=action.position==='over'?'inside':action.position==='beside'?'after':action.position||'after',block=withIds(action.block),id=uid();let {node:anchor,locator:anchorLocator}=targets[0];
   if(over&&anchor.matches('button,a,input,textarea,select,img,svg')&&anchor.parentElement){anchor=anchor.parentElement;anchorLocator=locatorOf(anchor);}
   if(over&&getComputedStyle(anchor).position==='static')add({id:uid(),kind:'style',target:anchorLocator,style:{position:'relative'}});
   if(position==='inside'&&anchor.matches('button,a,input,textarea,select,img'))throw new Error('Place a block inside a container, not a control.');
   // A section placed before or after an item of a horizontal row would squeeze into that row and shift its title, so it moves up to the row itself and gets its own line. Only beside keeps it in the row.
   let lifted=false;
   if(position!=='inside'&&(action.position!=='beside'||block.nodes[0].type==='crumbs')){const horizontal=(el:HTMLElement)=>{const css=getComputedStyle(el);return /flex/.test(css.display)&&/^row/.test(css.flexDirection);};for(let depth=0;depth<4&&anchor.parentElement&&!anchor.parentElement.matches('body')&&horizontal(anchor.parentElement);depth++){anchor=anchor.parentElement;anchorLocator=locatorOf(anchor);lifted=true;}}
   // Content that grows a card must also grow the slot the host page sized for it.
   if(position!=='before')releaseFixedHeights(anchor);
   // A bar or lifted section lines up with the row it sits next to, so its content starts where that row's content does.
   const inset=(lifted||block.nodes[0].type==='crumbs')&&position!=='inside'?(()=>{const css=getComputedStyle(anchor);return `0 ${css.paddingRight} 0 ${css.paddingLeft}`;})():'0';
   const offset=(value:unknown)=>typeof value==='number'?value+'px':typeof value==='string'&&/^-?\d+(\.\d+)?(px|%)$/.test(value)?value:undefined,spot=action.style as Record<string,unknown>|null;
   const floating=over?{position:'absolute','z-index':'20',width:'max-content','max-width':'100%',...Object.fromEntries((['top','right','bottom','left'] as const).map(side=>[side,offset(spot?.[side])]).filter(([,value])=>value)),...(!['top','bottom'].some(side=>offset(spot?.[side]))?{top:'0'}:{}),...(!['left','right'].some(side=>offset(spot?.[side]))?{left:'0'}:{})}:{};
   add({id:uid(),kind:'insert',target:anchorLocator,position,node:{id,kind:'panel',text:block.nodes.find(part=>part.type==='heading')?.text||'Section',block,appearance:{display:'block','box-sizing':'border-box',width:'100%','max-width':'100%','min-width':'0',height:'auto',padding:inset,'border-radius':'0',margin:over?'0':position==='before'?'0 0 24px':'24px 0 0','font-family':'inherit',color:'inherit',...floating}}});created.push(id);group=id;
   const parts=block.nodes.length;
   checks.push(()=>{const host=collector.ownedNode(id);if(!host)throw new Error('The new block is missing.');const rendered=host.querySelectorAll('[data-dx-owned]').length;if(rendered!==parts)throw new Error(`The block rendered ${rendered} of its ${parts} parts.`);verifyContent(host);if(!over)verifyNoOverlap(position==='inside'?(targets[0].id&&collector.ownedNode(targets[0].id))||anchor:host);});
   plannedBlocks.set(id,block);
   if(action.resultRef)outputs.set(action.resultRef,{node:anchor,id,locator:owned(id)});
  }else if(action.kind==='create'){
   if(!action.element||action.element==='chart'||action.element==='block'||(!action.text?.trim()&&!['panel','header'].includes(action.element))||targets.length!==1)throw new Error('Specify one insertion target, an element type, and its label.');
   const {node}=targets[0],id=uid(),anchorBounds=node.getBoundingClientRect(),anchorIssues=contentBaseline(node);let position=action.position==='beside'?'after':(action.position==='over'?'inside':action.position)||'after',locator=targets[0].locator;
   if(action.element==='header'){const content=node===collector.rootNode?(node.matches('main,[role=main]')?node:node.querySelector<HTMLElement>('main,[role=main]')||node):node;const first=[...content.children].find((child):child is HTMLElement=>child instanceof HTMLElement&&!sensitive(child)&&visible(child));locator=first?describe(first,collector.ownedId(first)).locator:describe(content,collector.ownedId(content)).locator;position=first?'before':'inside';}
   // A row that will hold copies needs the page's content width: placed after a card inside a narrow column it would squeeze them, so it moves after the widest layout container around that card.
   if(action.element==='panel'&&(position==='after'||position==='before')&&action.resultRef&&plan.actions.some(other=>other.kind==='duplicate'&&other.relativeTo===action.resultRef)){
    const content=(node.closest<HTMLElement>('main,[role=main]')||collector.rootNode).getBoundingClientRect().width;let row:HTMLElement=node;
    for(let depth=0;depth<8&&row.parentElement&&row.parentElement!==collector.rootNode&&row.getBoundingClientRect().width<content*0.8;depth++)row=row.parentElement;
    if(row!==node)locator=locatorOf(row);
   }
   if(action.element==='link'&&!action.href)throw new Error('A link needs a destination route.');
   const section=node.parentElement;if(action.element==='panel'&&position==='after'&&node.matches('h1,h2,h3,h4,[role=heading]')&&section&&!section.matches('body,main,[role=dialog]')&&section.querySelectorAll('h1,h2,h3,h4,[role=heading]').length===1&&section.querySelector('button,[role=button],[role=radio]'))locator=describe(section).locator;
   if(position==='inside'&&node.matches('button,a,input,textarea,select,img,br'))throw new Error('Select a container to add UI inside.');
   const design=captureDesign(node),style=action.element==='field'?design.text:appearance||(action.element==='header'?{...design.text,display:'flex','flex-direction':'row','flex-wrap':'wrap','align-items':'center',gap:'20px',padding:'16px 0',margin:'0'}:action.element==='link'?{...design.text,display:'inline-flex',padding:'4px 0',margin:'0','text-decoration-line':'underline'}:(action.element==='panel'?{display:'block',margin:'16px 0',padding:'0',border:'0','box-shadow':'none','background-color':'transparent',...design.text}:action.element==='button'?design.button:design.text));
   if(position==='after'&&afterAnchors.has(action.targets[0]))locator=owned(afterAnchors.get(action.targets[0])!);
   // As for blocks: a card in a fixed-height layer must grow, not spill over the cards below.
   if(position!=='before'&&action.element!=='header')releaseFixedHeights(node);
   add({id:uid(),kind:'insert',target:locator,position,node:{id,kind:action.element==='header'?'panel':action.element==='link'?'text':action.element,text:action.text||'',appearance:action.element==='button'?buttonAppearance(style):style,...(action.element==='field'?{inputType:action.inputType||'text',required:action.required||false,inputAppearance:appearance||design.field,...(action.options?{options:action.options}:{}),...(action.radioGroup?{radioGroup:action.radioGroup}:{})}:{}),...(action.element==='header'?{semanticTag:'header' as const}:action.element==='link'?{semanticTag:'a' as const,href:action.href!}:{})}});created.push(id);checks.push(()=>{const created=collector.ownedNode(id);if(!created)throw new Error('The new element is missing.');verifyContent(created);if(action.element==='button')verifyNewButton(created);if(position==='below')verifyBelow(created,node,anchorBounds,item=>anchorIssues.get(item));});if(action.element==='field')checks.push(()=>{const field=collector.ownedNode(id+':input');if(!(field instanceof HTMLInputElement||field instanceof HTMLTextAreaElement||field instanceof HTMLSelectElement)||field.required!==!!action.required||(field instanceof HTMLInputElement&&field.type!==(action.inputType||'text')))throw new Error('The requested field type or validation did not apply.');});if(action.element==='header')checks.push(()=>{const header=collector.ownedNode(id);if(!header||header.tagName!=='HEADER'||header.parentElement?.firstElementChild!==header)throw new Error('The new header was not placed above the content.');});if(action.element==='link')checks.push(()=>{const link=collector.ownedNode(id);if(!(link instanceof HTMLAnchorElement)||link.getAttribute('href')!==action.href)throw new Error('The new link does not have its requested destination.');});if(position==='after')afterAnchors.set(action.targets[0],id);if(action.element==='panel')group=id;if(action.resultRef){const representative=document.createElement(action.element==='header'?'header':action.element==='link'?'a':action.element==='button'?'button':'div');representative.textContent=action.text;outputs.set(action.resultRef,{node:representative,id,locator:owned(id)});}
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
  }else if(action.kind==='css'){
   // Any style on any element, as plain CSS declarations.
   if(!action.css||!safeDeclarations(action.css).length)throw new Error('Give the CSS declarations to apply, such as "display:none" or "gap:12px".');
   for(const target of targets)add({id:uid(),kind:'css',target:target.locator,css:action.css});
  }else if(action.kind==='behavior'){
   // When the target is clicked, hovered or the screen loads, the effects change other elements: expand, collapse, reveal, relabel, restyle.
   if(!action.effects?.length)throw new Error('Say what the behavior changes: show, hide, toggle, text or style, and on which elements.');
   const effects=action.effects.flatMap(effect=>effect.targets.map(ref=>({action:effect.action,target:locate(ref).locator,...(effect.value!=null?{value:effect.value}:{})})));
   for(const target of targets)add({id:uid(),kind:'behavior',target:target.locator,event:action.event||'click',effects});
  }else if(action.kind==='connect'&&action.destination&&/^e_/.test(action.destination)){
   // An existing application control as the destination: clicks on the trigger are forwarded to it, so its real modal, menu or action runs.
   if(targets.length!==1)throw new Error('Choose one trigger.');const host=locate(action.destination);
   if(host.id||!host.node.matches('button,a,summary,[role=button],[role=link],[role=tab],[role=menuitem],[aria-haspopup]'))throw new Error('Choose an existing button, link or menu of the application for this control to open.');
   // A copy made earlier in this plan is tracked by its source element, so only existing controls are checked against themselves.
   if(!outputs.has(action.targets[0])&&(host.node===targets[0].node||targets[0].node.contains(host.node)))throw new Error('A control cannot open itself. Choose a different application control.');
   add({id:uid(),kind:'mirror',target:targets[0].locator,source:host.locator});
  }else if(action.kind==='connect'){
   if(targets.length!==1)throw new Error('Choose one trigger.');const target=targets[0];let source=target.id;
   // A screen made earlier in this plan whose progress bar fills by itself moves on when it finishes; its next screen closes back to where that one would.
   const timed=timedViews.get(action.targets[0]),from=timed?.view||stateId,back=timed?.back||stateId;let event:'click'|'change'|'finish'=timed?'finish':'click';
   // Naming one option of a composed switcher, dropdown, tab row or menu connects just that option.
   const part=target.node.closest<HTMLElement>('[data-dx-block] [data-dx-owned]')||target.node.querySelector<HTMLElement>('select,[data-dx-tab],[data-dx-menu-item],[data-dx-custom]')?.closest<HTMLElement>('[data-dx-block] [data-dx-owned]')||null;
   const planned=target.id?plannedBlocks.get(target.id):undefined;
   if(action.text?.trim()&&planned){
    const wanted=action.text.trim().toLowerCase(),labels=(node:typeof planned.nodes[number])=>node.type==='custom'?[...(node.html||'').matchAll(/data-option\s*=\s*["']([^"']*)["']/g)].map(match=>match[1]):node.options||[];
    const match=planned.nodes.map(node=>({node,index:labels(node).findIndex(label=>label.trim().toLowerCase()===wanted)})).find(found=>found.index>=0);
    if(!match){const all=planned.nodes.flatMap(labels);if(all.length)throw new Error(`"${action.text}" is not one of this block's options (${[...new Set(all)].join(', ')}).`);}
    else{source=match.node.id+'#'+match.index;event=['select','crumbs'].includes(match.node.type)?'change':'click';}
   }else if(action.text?.trim()&&part?.dataset.dxOwned){
    const select=part.querySelector('select'),options=select?[...select.options].map(o=>o.text):[...(part.shadowRoot||part).querySelectorAll(part.shadowRoot?'[data-option]':'[data-dx-tab],[data-dx-menu-item]')].map(o=>o.getAttribute('data-option')||o.textContent||'');
    if(options.length){const index=options.findIndex(o=>o.trim().toLowerCase()===action.text!.trim().toLowerCase());if(index<0)throw new Error(`"${action.text}" is not one of this control's options (${options.join(', ')}).`);source=part.dataset.dxOwned+'#'+index;event=select?'change':'click';}
   }
   if(action.targets[0].startsWith('new:')&&outputs.get(action.targets[0])?.locator.owned?.startsWith('view:')&&!timed)throw new Error('A screen moves on by itself only when it has a progress bar with seconds; connect one of its buttons instead.');
   if(!source){source=uid();add({id:uid(),kind:'trigger',target:target.locator,source});}
   let destination=action.destination;
   // A page of this application becomes a live screen of the workflow; clicking opens the real page.
   if(destination&&/^(https?:\/\/|\/)/i.test(destination)&&!next.states.some(s=>s.id===destination)){
    let url:string;try{url=sameApplicationURL(new URL(destination,next.origin).href,next.origin);}catch(error){throw new Error((error instanceof Error?error.message:'Choose a page within this application.')+' Pages of other sites cannot be connected.');}
    const existing=next.states.find(s=>s.liveURL===url||s.id===next.entry&&next.origin+next.route===url);
    if(existing)destination=existing.id;else{if(next.states.length>=next.maxStates)throw new Error('The workflow reached its screen limit.');destination=uid();next.states.push({id:destination,title:new URL(url).pathname.slice(0,120)||'Page',parent:stateId,view:'base',liveURL:url,operations:[]});}
   }
   // What a watched click opened becomes a new screen holding its exact copy, shown the way it appeared: centred, or along an edge.
   if(destination?.startsWith('watched:')){
    const capture=watched();if(!capture||'watched:'+capture.id!==destination)throw new Error('Watch the click again: the captured result is no longer available.');
    if(capture.kind!=='modal'&&capture.kind!=='drawer')throw new Error(`Recreating a ${capture.kind==='toast'?'toast message':'menu or popover'} is not supported yet; modals and side panels are.`);
    if(next.states.length>=next.maxStates)throw new Error('The workflow reached its screen limit.');
    const view=uid(),title=action.newViewTitle?.trim()||capture.title;destination=view;
    let under=back;while(next.states.find(s=>s.id===under)?.presentation&&['modal','drawer'].includes(next.states.find(s=>s.id===under)!.presentation!)){const parent=next.states.find(s=>s.id===under)?.parent;if(!parent)break;under=parent;}
    next.states.push({id:view,title,parent:under,view:'panel',operations:[OperationSchema.parse({id:uid(),kind:'insert',target:owned('view:'+view),position:'inside',node:{id:uid(),kind:'panel',text:title,copy:capture.copy.map(part=>({...part,id:uid()}))}})],presentation:capture.kind,copied:{closes:capture.closes,...(capture.side?{side:capture.side}:{}),...(/^[\d.\spx%]+$/.test(capture.copy[0].style['border-radius']||'')?{radius:capture.copy[0].style['border-radius']}:{})}});
    next.edges.push({id:uid(),from:view,source:'modal:'+view+':close',to:back,event:'click'});
   }
   // A variant of this page: the same page as a new screen, with the changes the rest of the plan makes.
   if(!destination&&action.presentation==='page'){
    if(!action.newViewTitle?.trim())throw new Error('Name the new page.');if(next.states.length>=next.maxStates)throw new Error('The workflow reached its screen limit.');
    let base=stateId;while(next.states.find(s=>s.id===base)?.view==='panel'){const parent=next.states.find(s=>s.id===base)?.parent;if(!parent)break;base=parent;}
    destination=uid();next.states.push({id:destination,title:action.newViewTitle,parent:base,view:'base',variant:true,operations:[]});opsState=next.states.find(s=>s.id===destination)!;
   }
   if(!destination){if(!action.newViewTitle?.trim())throw new Error('Choose a destination or name a new prototype view.');if(next.states.length>=next.maxStates)throw new Error('The workflow reached its screen limit.');destination=uid();const modal=(action.presentation==='modal'||action.presentation==='drawer')&&!action.pageContent;
    // A modal opened from inside another modal takes its place instead of stacking on it; closing still returns to it.
    let under=back;while(modal&&['modal','drawer'].includes(next.states.find(s=>s.id===under)?.presentation||'')){const parent=next.states.find(s=>s.id===under)?.parent;if(!parent)break;under=parent;}
    next.states.push({id:destination,title:action.newViewTitle,parent:under,view:'panel',design:captureDesign(target.node),operations:[],...(modal?{presentation:action.presentation as 'modal'|'drawer'}:{}),...(action.pageContent?{presentation:'screen' as const,pageContent:action.pageContent,...(action.pageContent.route?{virtualRoute:action.pageContent.route}:{})}:{})});if(action.pageContent)next.edges.push({id:uid(),from:destination,source:'page:'+destination+':back',to:back,event:'click'});
    // A modal closes back to the page it opened from, and its contents are built with it.
    if(modal){next.edges.push({id:uid(),from:destination,source:'modal:'+destination+':close',to:back,event:'click'});if(action.block){const block=withIds(action.block),modalState=next.states.find(s=>s.id===destination)!;const timer=block.nodes.find(part=>part.type==='progress'&&part.seconds);if(action.resultRef){outputs.set(action.resultRef,{node:target.node,id:timer?.id||'view:'+destination,locator:owned(timer?.id||'view:'+destination)});if(timer)timedViews.set(action.resultRef,{view:destination,back});}modalState.operations.push(OperationSchema.parse({id:uid(),kind:'insert',target:owned('view:'+destination),position:'inside',node:{id:uid(),kind:'panel',text:action.newViewTitle,block,appearance:{display:'block','box-sizing':'border-box',width:'100%','max-width':'100%','min-width':'0',height:'auto',padding:'0',margin:'0','font-family':'inherit',color:'inherit'}}}));}}}
   if(!next.states.some(s=>s.id===destination))throw new Error('That destination no longer exists.');
   next.edges=next.edges.filter(e=>e.from!==from||e.source!==source);next.edges.push({id:uid(),from,source,to:destination,event});
   // A real application page opens when the connection is used; editing stays on the current page.
   if(!next.states.find(s=>s.id===destination)?.liveURL){view=destination;nextState=destination;}
  }else{
   for(const target of targets){
    if(action.kind==='iconOnly'){
     if(!target.node.matches('a,button,[role=link],[role=button]'))throw new Error('Use icon-only presentation on a navigation link or button.');
     const label=action.text?.trim()||target.node.getAttribute('aria-label')||target.node.textContent?.trim();if(!label)throw new Error('An icon-only control needs an accessible name.');add({id:uid(),kind:'iconOnly',target:target.locator,text:label});
     checks.push(()=>{const node=target.id?collector.ownedNode(target.id):target.node;if(!node?.querySelector('svg'))throw new Error('The icon-only control needs a visible icon.');});
    }else if(action.kind==='tooltip'){
     if(!action.text?.trim())throw new Error('What should the tooltip say?');add({id:uid(),kind:'tooltip',target:target.locator,text:action.text});
    }else if(action.kind==='icon'){
     if(!action.text)throw new Error('Specify the requested icon.');
     if(!target.node.querySelector('svg')&&target.node.matches('a,button,[role=link],[role=button]')){add({id:uid(),kind:'icon',target:target.locator,icon:namedIcon(action.text)});continue;}
     if(!target.id||target.node.matches('a,button,[role=link],[role=button]')){const icons=[...target.node.querySelectorAll('svg')];if(icons.length!==1)throw new Error('Inspect the specific badge or icon wrapper; this region has multiple symbols.');const bounds=icons[0].getBoundingClientRect();if(bounds.width>64||bounds.height>64)throw new Error('This SVG is larger than a small UI icon. Inspect a specific badge instead.');add({id:uid(),kind:'icon',target:target.locator,icon:namedIcon(action.text)});continue;}
     const insert=next.states.flatMap(s=>s.operations).find((op):op is Extract<Operation,{kind:'insert'}>=>op.kind==='insert'&&!!op.node.copy&&(op.node.id===target.id||op.node.copy.some(part=>part.id===target.id)));
     if(!insert?.node.copy)throw new Error('Choose an icon within a copied prototype component.');
     const parts=insert.node.copy,index=insert.node.id===target.id?0:parts.findIndex(part=>part.id===target.id);
     const icons=parts.filter((part,i)=>{if(!part.icon)return false;let parent=i;while(parent>=0){if(parent===index)return true;parent=parts[parent].parent;}return false;});
     // A metric tile can contain its main symbol and a smaller trend arrow.
     // Card-level icon edits replace the prominent symbol, preserving badges.
     const ranked=icons.map(part=>({part,area:(parseFloat(part.style.width||'')||24)*(parseFloat(part.style.height||'')||24)})).sort((a,b)=>b.area-a.area);
     if(!ranked.length){
      // A copy without an icon gains one beside its heading. Copies are in tree
      // pre-order, so the heading's subtree is contiguous and the icon follows it.
      const inside=(i:number,root:number)=>{for(let p=i;p>=0;p=parts[p].parent)if(p===root)return true;return false;};
      const heading=parts.findIndex((part,i)=>/^h[1-6]$/.test(part.tag)&&inside(i,index));
      if(heading<0)throw new Error('This copied component has no heading to place the icon beside.');
      let at=heading+1;while(at<parts.length&&inside(at,heading))at++;
      for(const part of parts)if(part.parent>=at)part.parent++;
      parts.splice(at,0,{id:uid(),parent:parts[heading].parent,tag:'span',text:'',icon:namedIcon(action.text),style:{display:'inline-flex',width:'24px',height:'24px','flex-shrink':'0',margin:'0 8px 0 0',...(parts[heading].style.color?{color:parts[heading].style.color}:{})}});
      continue;
     }
     if(ranked.length>1&&ranked[0].area<=ranked[1].area*1.2)throw new Error('This component has several equally prominent icons. Target its specific copied icon wrapper.');
     ranked[0].part.icon=namedIcon(action.text);
    }else if(action.kind==='text'){
     if(!action.text?.trim())throw new Error('Text replacement requires nonempty content. If the request is to show only an icon, use iconOnly on the link/button, retaining its accessible name and destination.');
     if(target.id?.startsWith('heading:')){next.states.find(s=>s.id===target.id!.slice(8))!.title=action.text;continue;}
     // React can split a badge label into several adjacent text nodes. For a
     // generated copy, update those serialized direct runs together, preserving
     // nested icons and other descendants instead of flattening the container.
     const copied=target.id?next.states.flatMap(s=>s.operations).find((op):op is Extract<Operation,{kind:'insert'}>=>op.kind==='insert'&&!!op.node.copy?.some(part=>part.id===target.id)):undefined;
     if(copied?.node.copy&&!percentageTextRuns(target.node)){const parts=copied.node.copy,index=parts.findIndex(part=>part.id===target.id),direct=parts.filter(part=>part.parent===index&&part.tag==='#text'&&part.text.trim());if(direct.length&&/^(span|p|label|button|a|h[1-6]|strong|em|small)$/.test(parts[index].tag)){direct.forEach((part,i)=>part.text=i===0?action.text!:'');continue;}}
     const percentage=percentageTextRuns(target.node);
     if(percentage){
      if(copied?.node.copy){const parts=copied.node.copy,index=parts.findIndex(part=>part.id===target.id),texts=parts.filter((part,i)=>{if(part.tag!=='#text'||!part.text.trim())return false;let parent=parts[i].parent;while(parent>=0){if(parent===index)return true;parent=parts[parent].parent;}return false;});texts.forEach((part,i)=>part.text=i===0?action.text!:'');}
      else percentage.forEach((run,i)=>add({id:uid(),kind:'text',target:{...target.locator,textPath:textPath(target.node,run)},text:i===0?action.text!:''}));
      continue;
     }
     if(!editableText(target.node))throw new Error('This target contains several independent labels. Inspect its child labels before choosing which text to change.');add({id:uid(),kind:'text',target:target.locator,text:action.text});
    }else if(action.kind==='remove')add({id:uid(),kind:'remove',target:target.locator});
    else if(action.kind==='style'&&appearance)add({id:uid(),kind:'appearance',target:target.locator,style:appearance});
    else if(action.kind==='style'||action.kind==='move'){
     if(!action.style||!Object.keys(action.style).length)throw new Error('Describe the style or movement to apply.');
     let style=action.style;if(action.kind==='move'){const parts=getComputedStyle(target.node).translate?.split(' ').map(parseFloat)||[];style={...style,x:(parts[0]||0)+(style.x||0),y:(parts[1]||0)+(style.y||0)};}
     // A grid span only works on a grid item; host pages often wrap a card in
     // positioning layers, so the span moves to the card's own grid slot.
     let locator=target.locator;if(style.gridColumn&&target.node.parentElement&&!getComputedStyle(target.node.parentElement).display.includes('grid')){for(let node:HTMLElement|null=target.node.parentElement,depth=0;node?.parentElement&&depth<5;node=node.parentElement,depth++)if(getComputedStyle(node.parentElement).display.includes('grid')){locator=locatorOf(node);const {gridColumn,...rest}=style;if(Object.keys(rest).length)add({id:uid(),kind:'style',target:target.locator,style:rest});style={gridColumn};break;}}
     add({id:uid(),kind:'style',target:locator,style});
    }else throw new Error('This action is not supported.');
   }
  }
 }
 arrangements.forEach(add);
 return {workflow:validateWorkflow(next),stateId:nextState,created,group,view,cardId,verify:()=>checks.forEach(check=>check())};
}
