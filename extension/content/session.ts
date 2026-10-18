import {AssistantController} from '../assistant/controller';
import {inScope} from '../assistant/dom';
import {stateURL,sameApplicationURL,type LiveNavigation,type LiveContext} from '../shared/liveNavigation';
import {isTextEntry} from '../shared/keyboard';
import {fieldFor,eventsFor,conditionPasses} from './connections';
import {choicePlan} from '../ai/choicePlan';
import {captureDesign,nativeOperations,inferDestination,readStyle} from './nativeDesign';
import {nativeChoices} from './nativeChoices';
import {advancedTarget,isSettingsRequest} from './settingsFeature';
import {chooseLayout} from './layouts';
import {freeBuild,assistantBuild} from '../shared/build';
import {sectionOperations} from '../ai/section';
import {sectionTarget} from './selection';
import {compileFlow,buttonTheme} from '../ai/flow';
import {BatchSchema} from '../ai/planSchema';
import { captureCopy } from './duplicate';
import { VisitedScreenSchema, ConnectionSpecSchema, RecordSchema, OperationSchema, StyleSchema, clone, routeOf, uid, type Workflow, type Selection, type Snapshot, type Command, type SavedRecord, type CopyNode, type ConnectionEvent,type ConnectionWorkspace } from '../shared/model';
import { createWorkflow, addOperation, addChild, addCapturedScreen, addLiveScreen, transition, History, validateWorkflow } from '../prototype/engine';
import { operationFromPlan } from '../ai/planner';
import { promptOperations } from '../ai/batch';
import { Repository } from '../storage/store';
import { PageEditor } from './pageEditor';
import { editableText } from './text';
import { textAlignment } from './textAlignment';
import { Renderer } from './renderer';
import { describe, resolve } from './locator';
export class Session {
  private assistant:AssistantController|undefined;
  workflow:Workflow; stateId:string; selected:Selection|null=null; picking=false; dragging=false; replay=false; enabled=true; dirty=false;
  connectionWorkspace:ConnectionWorkspace|null=null;
  get connectionViewport(){return this.options.connectionViewport?.()||{width:innerWidth,height:innerHeight};}
  get externalConnections(){return !!this.options.externalConnections;}
  publishConnection(view:ConnectionWorkspace|null){this.connectionWorkspace=view;this.emit();}
  openConnectionPanel(){try{const request=this.options.requestConnections?.();if(request)void request.catch(()=>this.pageEditor.notify('Click the Wandel extension icon to open Connections in the right panel.'));}catch{this.pageEditor.notify('Click the Wandel extension icon to open Connections in the right panel.');}}
  private seenViews=new Set<string>();
  private replayData:Record<string,string>={};
  private replayHistory:Record<string,string>[]=[];
  private defaults(){return Object.fromEntries((this.workflow.variables||[]).map(v=>[v.key,v.value]));}
  private authoring=false;
  private interacting=false;
  private panelMinimized=false;
  private restoringPanel=false;
  panelAttached(){if(this.liveSession)return true;if(!this.panelMinimized&&!this.restoringPanel)return false;this.restoringPanel=false;this.panelMinimized=false;this.emit();return true;}
  private styleClipboard:{selection:Selection;style:CopyNode['style']}|null=null;
  private projectionActive=false;
  private resizeHeld=false;
  private selectionOutline=document.createElement('div');
  private selectionElement:HTMLElement|null=null;
  private selectionFrame:number|undefined;
  history=new History(); visits:string[]=[]; unresolved:string[]=[]; record:SavedRecord|null=null; library:SavedRecord[]=[];
  private pageEditor:PageEditor;
  private historyGroup:string|undefined;
  private closeLayouts:(()=>void)|undefined;
  renderer:Renderer; private observer:MutationObserver; private timer:ReturnType<typeof setTimeout>|undefined;
  private draftTimer:ReturnType<typeof setTimeout>|undefined;
  private listeners=new Set<(s:Snapshot)=>void>(); private outline:HTMLElement; private queue:Promise<unknown>=Promise.resolve();
  constructor(public root:HTMLElement,public repository:Repository,public url:URL, private options:{ assistantEnabled?:boolean;liveNavigation?:LiveNavigation;connectionViewport?:()=>{width:number;height:number};externalConnections?:boolean;requestConnections?:()=>void|Promise<void>;directSelection?:boolean;requestSave?:()=>void;requestSignIn?:()=>Promise<void>;requestClose?:()=>Promise<void>;requestPlan?:(prompt:string,selection:Selection)=>Promise<unknown> } = {}) {
    this.projectionActive=!!options.directSelection;this.workflow=createWorkflow(url);this.stateId=this.workflow.entry;
    this.renderer=new Renderer(root,id=>this.click(id),id=>{if(this.runningConnections)this.click(id);else{const node=this.renderer.owned.get(id);if(node)this.select(node);}});
    this.outline=document.createElement('div');this.outline.dataset.dxIgnore='true';this.outline.style.cssText='position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #6473f4;border-radius:4px;background:#6c7afa12;display:none;box-sizing:border-box;';document.documentElement.append(this.outline);
    this.selectionOutline.dataset.dxIgnore='true';this.selectionOutline.dataset.dxSelection='true';this.selectionOutline.setAttribute('aria-hidden','true');
    this.selectionOutline.style.cssText='position:fixed;pointer-events:none;z-index:2147483646;border:2px solid #7770df;border-radius:4px;background:rgba(119,112,223,.10);display:none;box-sizing:border-box;';document.documentElement.append(this.selectionOutline);
    window.addEventListener('scroll',this.paintSelection,true);window.addEventListener('resize',this.paintSelection);
    this.observer=new MutationObserver(()=>{clearTimeout(this.timer);this.timer=setTimeout(()=>this.render(),160);});
    this.pageEditor=new PageEditor(this);
    this.observe();
    window.addEventListener('change',this.connectionChange,true);window.addEventListener('keydown',this.connectionEnter,true);window.addEventListener('click',this.handleClick,true);window.addEventListener('input',this.inputMirror,true);window.addEventListener('change',this.inputMirror,true);
    window.addEventListener('pointermove',this.hover,true);
    window.addEventListener('keydown',this.escape,true);window.addEventListener('keyup',this.keyup,true);
    window.addEventListener('dragstart',this.nativeDrag,true);window.addEventListener('pointerdown',this.dragStart,true);window.addEventListener('pointermove',this.dragMove,true);window.addEventListener('pointerup',this.dragEnd,true);window.addEventListener('pointercancel',this.cancelDrag,true);window.addEventListener('blur',this.blur);
  }
  async init() {if(!await this.resumeLive())await this.loadRoute(false);this.emit();}
  private observe() { this.observer.observe(this.root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['id','data-testid','data-test','data-qa','aria-label','hidden']}); }
  private render(reset=false) {
    this.observer.disconnect();
    try {const matchingPage=stateURL(this.workflow,this.stateId)===this.url.href;if(reset||!matchingPage)this.renderer.reset();this.unresolved=this.enabled&&this.projectionActive?(matchingPage?this.renderer.reconcile(this.workflow,this.stateId,this.runningConnections?this.replayData:this.defaults()):['This step belongs to another application page. Open its connected route before editing.']):[];} finally { this.observe(); }
    this.emit();
  }
  async loadRoute(restore=true) {
    this.liveSession=false;this.navigating=false;
    this.replayData={};this.replayHistory=[];
    this.library=await this.repository.list(this.url.origin,routeOf(this.url));
    const active=await this.repository.active(this.url.origin,routeOf(this.url));
    this.record=restore?this.library.find(r=>r.draft.id===active)||null:null;
    this.workflow=clone(this.record?.draft || createWorkflow(this.url));this.stateId=this.workflow.states.find(s=>s.liveURL===this.url.href)?.id||this.workflow.entry;this.enabled=this.record?.enabled??true;
    this.dirty=false;this.history=new History();this.visits=[];this.selected=null;this.picking=this.authoring;this.outline.style.display='none';this.replay=false;this.render(true);
  }
  navigate(url:URL):Promise<void> {const work=this.queue.then(()=>this.changeRoute(url));this.queue=work.catch(()=>undefined);return work;}
  private routeDrafts=new Map<string,{workflow:Workflow;dirty:boolean;record:SavedRecord|null;enabled:boolean}>();
  private async changeRoute(url:URL) {
    if(url.href===this.url.href)return;
    if(this.dirty)this.routeDrafts.set(this.workflow.id,{workflow:clone(this.workflow),dirty:this.dirty,record:this.record,enabled:this.enabled});
    this.suspend();this.url=url;if(await this.resumeLive())return;await this.loadRoute(false);
    this.projectionActive=this.authoring;this.picking=this.authoring;this.render(true);
  }
  private liveSession=false;
  private navigating=false;
  private leaving=false;
  private liveDialogs:Record<string,string>={};
  async pageRestored(){this.leaving=false;await this.resumeLive();}
  pageLeaving(){this.leaving=true;this.suspend();}
  private async resumeLive(){
    if(!this.options.liveNavigation)return false;
    let context:LiveContext|null;try{context=await this.options.liveNavigation.read();}catch(error){this.pageEditor.notify(error instanceof Error?error.message:'Could not restore this workflow.');return false;}
    if(!context)return false;const record=await this.repository.get(context.workflowId);if(!record)return false;
    if(record.draft.origin!==this.url.origin||stateURL(record.draft,context.stateId)!==this.url.href)return false;
    this.workflow=clone(record.draft);this.record=record;this.stateId=context.stateId;this.enabled=record.enabled;this.visits=context.visits;this.liveDialogs=context.dialogs;this.liveSession=true;this.leaving=false;this.navigating=false;
    this.authoring=true;this.projectionActive=true;this.interacting=context.mode==='interact';this.replay=context.mode==='replay';this.picking=context.mode==='edit';this.panelMinimized=context.minimized;this.replayData=this.defaults();this.selected=null;this.dirty=false;this.history=new History();
    this.library=await this.repository.list(this.url.origin,this.workflow.route);this.render(true);this.restoreDialog();return true;
  }
  private restoreDialog(){
    const title=this.liveDialogs[this.stateId];if(!title)return;
    const dialogs=[...this.root.querySelectorAll('[role=dialog],dialog[open]')];if(dialogs.some(d=>d.textContent?.includes(title)))return;
    const candidates=[...this.root.querySelectorAll<HTMLElement>('button,[role=button],[aria-haspopup=dialog]')].filter(n=>!n.closest('[role=dialog],dialog,[data-dx-ignore]')&&(n.textContent?.trim()===title||n.getAttribute('aria-label')===title));
    if(candidates.length===1){this.renderer.forwarding=true;try{candidates[0].click();}finally{this.renderer.forwarding=false;}}else this.pageEditor.notify('Open “'+title+'” in the application to return to this step. Your workflow is restored.');
  }
  private async navigateState(id:string,visits:string[],mode:'edit'|'interact'|'replay'=this.mode()==='closed'?'edit':this.mode() as 'edit'|'interact'|'replay'){
    const url=sameApplicationURL(stateURL(this.workflow,id),this.workflow.origin);if(url===this.url.href)return false;
    if(!this.options.liveNavigation)throw new Error('Live application navigation is unavailable. Reload Wandel and refresh this page.');
    const dialog=[...this.root.querySelectorAll<HTMLElement>('[role=dialog],dialog[open]')].filter(n=>n.getBoundingClientRect().width>0).at(-1);
    const title=(dialog?.querySelector('h1,h2,h3')?.textContent||dialog?.getAttribute('aria-label')||'').trim().slice(0,120);if(title)this.liveDialogs[this.stateId]=title;
    await this.checkpoint();this.navigating=true;
    try{await this.options.liveNavigation.go(url,{workflowId:this.workflow.id,stateId:id,visits:visits.slice(-60),mode,minimized:this.panelMinimized,dialogs:this.liveDialogs});}catch(error){this.navigating=false;throw error;}return true;
  }
  /** Synchronous teardown also runs before BFCache/pagehide freezes the document. */
  suspend(){this.assistant?.reset();this.restoringPanel=false;this.panelMinimized=false;this.styleClipboard=null;this.replayData={};this.replayHistory=[];this.closeLayouts?.();this.resizeHeld=false;this.cancelDrag();this.projectionActive=false;this.picking=false;this.dragging=false;this.replay=false;this.selected=null;this.hovered=null;this.render(true);}

  subscribe(listener:(s:Snapshot)=>void) {this.listeners.add(listener);listener(this.snapshot());return()=>{this.listeners.delete(listener);};}
  snapshot():Snapshot {this.seenViews.add(this.stateId);return clone({...(this.assistant?{assistant:this.assistant.snapshot()}:{}),liveSession:this.liveSession,panelMinimized:this.panelMinimized,panelRestoring:this.restoringPanel,connectionWorkspace:this.connectionWorkspace,visited:[...this.seenViews],mode:this.mode(),styleSource:this.styleClipboard?.selection||null,workflow:this.workflow,stateId:this.stateId,selected:this.selected,picking:this.picking,dragging:this.dragging,replay:this.replay,enabled:this.enabled,dirty:this.dirty,canUndo:!!this.history.past.length,canRedo:!!this.history.future.length,canBack:!!this.visits.length,unresolved:this.unresolved,currentVersion:this.record?.currentVersion||this.record?.versions.at(-1)?.number||0,versions:this.record?.versions.map(({number,savedAt,workflow})=>({number,savedAt,name:workflow.name}))||[],library:[...this.library.map(r=>({id:r.draft.id,name:this.routeDrafts.has(r.draft.id)?this.routeDrafts.get(r.draft.id)!.workflow.name+' (unsaved)':r.draft.name,versions:r.versions.length})),...[...this.routeDrafts.values()].filter(d=>d.workflow.origin===this.url.origin&&d.workflow.route===routeOf(this.url)&&!this.library.some(r=>r.draft.id===d.workflow.id)).map(d=>({id:d.workflow.id,name:d.workflow.name+' (unsaved)',versions:d.record?.versions.length||0}))]});}
  private lastEmission='';
  private emit() {this.updateSelection();const s=this.snapshot(),serialized=JSON.stringify(s);if(serialized===this.lastEmission)return;this.lastEmission=serialized;this.listeners.forEach(fn=>fn(s));}
  private updateSelection(){
    this.selectionElement=this.selecting?this.findSelected():null;
    if(!this.selectionElement){this.selectionOutline.style.display='none';if(this.selectionFrame!==undefined)window.cancelAnimationFrame(this.selectionFrame);this.selectionFrame=undefined;return;}
    this.paintSelection();
    if(this.selectionFrame===undefined&&typeof window.requestAnimationFrame==='function')this.selectionFrame=window.requestAnimationFrame(this.trackSelection);
  }
  private trackSelection=()=>{this.selectionFrame=undefined;if(!this.selectionElement?.isConnected){this.updateSelection();return;}this.paintSelection();this.selectionFrame=window.requestAnimationFrame(this.trackSelection);};
  private paintSelection=()=>{
    const el=this.selectionElement;if(!el?.isConnected){this.selectionOutline.style.display='none';return;}
    const r=el.getBoundingClientRect();
    const styles={display:r.width&&r.height?'block':'none',left:`${r.left}px`,top:`${r.top}px`,width:`${r.width}px`,height:`${r.height}px`};
    for(const [key,value] of Object.entries(styles))if(this.selectionOutline.style.getPropertyValue(key)!==value)this.selectionOutline.style.setProperty(key,value);
  };
  private select(el:HTMLElement) {this.historyGroup=undefined;this.selected=describe(el,this.renderer.idFor(el));this.outline.style.display='none';this.emit();}
  private get selecting() {return !this.panelMinimized&&!this.interacting&&this.projectionActive&&this.enabled&&!this.replay&&(this.picking||!!this.options.directSelection);}
  private hovered:HTMLElement|null=null;
  private hoverHint:HTMLElement|null=null;
  private paintHover(el:HTMLElement,text?:string) {
    const r=el.getBoundingClientRect();
    Object.assign(this.outline.style,{display:'block',left:`${r.left}px`,top:`${r.top}px`,width:`${r.width}px`,height:`${r.height}px`});
    if(!this.hoverHint){this.hoverHint=document.createElement('span');this.hoverHint.style.cssText='position:absolute;left:0;white-space:nowrap;background:#5451bf;color:#fff;padding:5px 8px;border-radius:5px;font:11px/1.4 system-ui,sans-serif;box-shadow:0 2px 6px #0002;';this.outline.append(this.hoverHint);}
    this.hoverHint.style.top=r.top<34?'100%':'-30px';
    this.hoverHint.textContent=text||'Click to select · Double-click to edit · Drag selected item to move';
  }
  private hover=(event:PointerEvent)=>{
    if(this.dragData)return;
    const origin=(assistantBuild||this.options.assistantEnabled)?event.composedPath()[0]:event.target;const target=origin instanceof HTMLElement?origin:origin instanceof Element?origin.closest<HTMLElement>('button,a,[role="button"],[role="link"]'):null;
    if(!this.selecting||!target||!((assistantBuild||this.options.assistantEnabled)?inScope(this.root,target):this.root.contains(target))||target.closest('[data-dx-ignore]')){this.hovered=null;this.outline.style.display='none';return;}
    this.hovered=target;this.paintHover(target);
  };
  private dragData:{el:HTMLElement;selection:Selection;mode:'move'|'resize';startX:number;startY:number;x:number;y:number;width:number;height:number;styles:{key:string;value:string;priority:string}[];dx:number;dy:number;pointerId?:number;pending:boolean}|null=null;
  private suppressClick=false;
  private dimensions(el:HTMLElement){const css=getComputedStyle(el),rect=el.getBoundingClientRect();return {width:parseFloat(css.width)||rect.width||1,height:parseFloat(css.height)||rect.height||1};}
  private offset(el:HTMLElement){const parts=getComputedStyle(el).translate.split(' ').map(parseFloat);return {x:Number.isFinite(parts[0])?parts[0]:0,y:Number.isFinite(parts[1])?parts[1]:0};}
  private bound=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,Math.round(n)));
  private nativeDrag=(event:DragEvent)=>{
    const target=event.target;if(this.selecting&&target instanceof Element&&this.root.contains(target)&&!target.closest('[data-dx-ignore]')){event.preventDefault();event.stopImmediatePropagation();}
  };
  private dragStart=(e:PointerEvent)=>{
    if(!this.selecting||e.ctrlKey||e.metaKey||e.button!==0)return;
    const target=e.target instanceof HTMLElement?e.target:e.target instanceof Element?e.target.closest<HTMLElement>('button,a,[role="button"],[role="link"]'):null;
    if(!target||!this.root.contains(target)||target.closest('[data-dx-ignore],[data-dx-interactive],[contenteditable="true"]'))return;
    if(target.matches('[data-dx-field]')){
      this.select(target);this.beginGesture(target,e.altKey&&this.resizeHeld?'resize':'move',e,!e.altKey&&!this.dragging);return;
    }
    if(!e.altKey&&!this.dragging&&!this.findSelected()?.contains(target))return;
    const el=e.altKey?target:this.findSelected();
    if(!el||!el.contains(target))return;
    this.beginGesture(el,e.altKey&&this.resizeHeld?'resize':'move',e,!e.altKey&&!this.dragging);
  };
  beginGesture(el:HTMLElement,mode:'move'|'resize',e:PointerEvent,pending=false){
    if(!this.selecting)return;
    if(!pending){e.preventDefault();e.stopImmediatePropagation();}
    this.dragData={el,selection:describe(el,this.renderer.idFor(el)),mode,startX:e.clientX,startY:e.clientY,...this.offset(el),...this.dimensions(el),styles:(mode==='resize'?['width','height','display']:['translate','display','position','z-index']).map(key=>({key,value:el.style.getPropertyValue(key),priority:el.style.getPropertyPriority(key)})),dx:0,dy:0,pointerId:e.pointerId,pending};
    if(!pending){try{el.setPointerCapture(e.pointerId);}catch{/* Synthetic events may not support pointer capture. */}this.paintHover(el,mode==='resize'?'Resizing · Esc to cancel':'Moving · Esc to cancel');}
  };
  private gestureStyle(d:NonNullable<Session['dragData']>) {return d.mode==='resize'?{width:this.bound(d.width+d.dx,1,4000),height:this.bound(d.height+d.dy,1,4000)}:{x:this.bound(d.x+d.dx,-10000,10000),y:this.bound(d.y+d.dy,-10000,10000)};}
  private dragMove=(e:PointerEvent)=>{
    const d=this.dragData;if(!d||(d.pointerId!==undefined&&e.pointerId!==undefined&&d.pointerId!==e.pointerId))return;
    d.dx=e.clientX-d.startX;d.dy=e.clientY-d.startY;
    if(d.pending&&Math.abs(d.dx)+Math.abs(d.dy)<4)return;
    if(d.pending){d.pending=false;try{d.el.setPointerCapture(e.pointerId);}catch{/* Pointer capture unavailable. */}}
    e.preventDefault();e.stopImmediatePropagation();
    const style=this.gestureStyle(d);
    if('width' in style){if(getComputedStyle(d.el).display==='inline')d.el.style.setProperty('display','inline-block','important');d.el.style.setProperty('width',`${style.width}px`,'important');d.el.style.setProperty('height',`${style.height}px`,'important');}
    else {d.el.style.setProperty('position',getComputedStyle(d.el).position==='static'?'relative':getComputedStyle(d.el).position,'important');d.el.style.setProperty('z-index','1000','important');if(getComputedStyle(d.el).display==='inline')d.el.style.setProperty('display','inline-block','important');d.el.style.setProperty('translate',`${style.x}px ${style.y}px`,'important');}
    this.paintHover(d.el,d.mode==='resize'?`${Math.round(d.width+d.dx)} × ${Math.round(d.height+d.dy)} px · Esc to cancel`:'Moving · Esc to cancel');
  };
  private cancelDrag=()=>{
    const d=this.dragData;if(d){for(const {key,value,priority} of d.styles){if(value)d.el.style.setProperty(key,value,priority);else d.el.style.removeProperty(key);}try{if(d.pointerId!==undefined)d.el.releasePointerCapture(d.pointerId);}catch{/* Pointer may already be released. */}}
    this.dragData=null;this.outline.style.display='none';
  };
  private gestureError=(error:unknown)=>{this.unresolved=[error instanceof Error?error.message:'Gesture could not be applied.'];this.emit();};
  private dragEnd=(e:PointerEvent)=>{
    const d=this.dragData;if(!d)return;if(d.pending){this.dragData=null;return;}e.preventDefault();e.stopImmediatePropagation();this.cancelDrag();
    this.suppressClick=true;setTimeout(()=>{this.suppressClick=false;},0);
    if(Math.abs(d.dx)+Math.abs(d.dy)>2){this.selected=d.selection;void this.dispatch({type:'style',style:this.gestureStyle(d)}).catch(this.gestureError);}
  };
  private keyup=(e:KeyboardEvent)=>{if(e.code==='KeyS'||e.key.toLowerCase()==='s')this.resizeHeld=false;};
  private blur=()=>{this.resizeHeld=false;this.cancelDrag();};
  private escape=(e:KeyboardEvent)=>{
    if(e.key==='Escape'&&this.closeLayouts){e.preventDefault();e.stopImmediatePropagation();this.closeLayouts();return;}
    const path=e.composedPath(),origin=path[0];const selected=this.selecting?this.findSelected():null;const editable=isTextEntry(origin)&&!(origin instanceof Element&&selected?.contains(origin)&&!path.includes(this.pageEditor.host));
    if(!editable&&this.selecting&&(e.code==='KeyS'||e.key.toLowerCase()==='s')){this.resizeHeld=true;if(e.altKey){e.preventDefault();e.stopImmediatePropagation();}return;}
    if(!editable&&this.selecting&&!this.dragData&&e.altKey&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&this.hovered?.isConnected){
      e.preventDefault();e.stopImmediatePropagation();
      const el=this.hovered,dx=e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0,dy=e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0;
      this.selected=describe(el,this.renderer.idFor(el));
      const {width,height}=this.dimensions(el),{x,y}=this.offset(el);
      void this.dispatch({type:'style',style:this.resizeHeld?{width:this.bound(width+dx,1,4000),height:this.bound(height+dy,1,4000)}:{x:this.bound(x+dx,-10000,10000),y:this.bound(y+dy,-10000,10000)}}).catch(this.gestureError);return;
    }
    if(!editable&&this.selecting&&(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.stopImmediatePropagation();void this.dispatch({type:e.shiftKey?'redo':'undo'});return;}
    if(e.key==='Escape'&&e.composedPath().some(node=>node instanceof HTMLElement&&node.hasAttribute('data-dx-editor')))return;
    if(e.key==='Escape'&&!editable&&!e.repeat&&this.projectionActive){
      e.preventDefault();e.stopImmediatePropagation();
      if(this.dragData){this.cancelDrag();this.dragging=false;return;}
      void this.dispatch({type:'escape'}).catch(this.gestureError);
    }
  };
  private get runningConnections(){return this.projectionActive&&this.enabled&&(this.replay||this.interacting||this.panelMinimized);}
  connectionSaved(){this.pageEditor.success("Connected. Switch to Interact to use it.");}
  private inputMirror=(event:Event)=>{if(this.runningConnections)try{const update=this.renderer.readPrototypeInput(event);if(update){this.replayData[update.key]=update.value;this.renderer.updateData(this.replayData);event.stopImmediatePropagation();return;}if(this.replay)this.renderer.forwardInput(event);}catch(error){this.gestureError(error);}};
  private handleClick=(event:MouseEvent)=>{
    if(this.renderer.forwarding)return;
    if(this.suppressClick){event.preventDefault();event.stopImmediatePropagation();return;}
    const original=(this.assistant||assistantBuild||this.options.assistantEnabled)?(event.composedPath()[0]||event.target):event.target;const target=original instanceof HTMLElement?original:original instanceof Element?original.closest('button,a,[role=button]'):null;if(!(target instanceof HTMLElement)||!((this.assistant||assistantBuild||this.options.assistantEnabled)?inScope(this.root,target):this.root.contains(target))||target.closest('[data-dx-ignore]'))return;
    if(target.closest('[data-dx-interactive]'))return;
    if(this.selecting&&(event.ctrlKey||event.metaKey||this.styleClipboard)){
      event.preventDefault();event.stopImmediatePropagation();
      const el=target.closest<HTMLElement>('button,a,[role="button"],[role="link"]')||target;
      const selection=describe(el,this.renderer.idFor(el));
      if(!this.styleClipboard){this.styleClipboard={selection,style:readStyle(el)};this.select(el);}
      else void this.dispatchAt(selection,this.workflow.id,this.stateId,{type:'pasteStyle'}).catch(this.gestureError);
      return;
    }
    if(this.selecting){event.preventDefault();event.stopImmediatePropagation();if(target.closest('[contenteditable]:not([contenteditable="false"])')){const editor=target.closest<HTMLElement>('[contenteditable]:not([contenteditable="false"])')!;this.select(editor.closest<HTMLElement>('[data-block-id]')||editor.parentElement||editor);return;}if(target.matches('input,textarea,select')){const field=this.renderer.findOwned(target);if(field?.node instanceof HTMLElement)this.select(field.node);else this.select(target);return;}this.select(event.shiftKey?sectionTarget(target,this.root):target.closest<HTMLElement>('button,a,[role="button"],[role="link"]')||target);return;}
    if(this.runningConnections){
      const label=target.closest('label'),labelField=label?fieldFor(label):null;
      if(labelField&&labelField!==target&&labelField instanceof HTMLInputElement&&['checkbox','radio'].includes(labelField.type)){
        const source=this.connectionSource(labelField,'change');
        if(source){event.preventDefault();event.stopImmediatePropagation();const checked=labelField.type==='radio'||!labelField.checked,state=this.stateId,workflow=this.workflow.id;queueMicrotask(()=>{if(this.runningConnections&&state===this.stateId&&workflow===this.workflow.id&&labelField.isConnected){labelField.checked=checked;this.click(source,'change');}});return;}
        if(labelField.hasAttribute('data-dx-field')){event.stopImmediatePropagation();return;}
      }
      const changeSource=this.connectionSource(target,'change');
      if(changeSource&&target instanceof HTMLInputElement&&['checkbox','radio'].includes(target.type)){
        const checked=target.checked;event.preventDefault();event.stopImmediatePropagation();const state=this.stateId,workflow=this.workflow.id;
        queueMicrotask(()=>{if(this.runningConnections&&state===this.stateId&&workflow===this.workflow.id&&target.isConnected){target.checked=checked;this.click(changeSource,'change');}});return;
      }
      const trigger=this.connectionSource(target,'click');
      if(trigger){event.preventDefault();event.stopImmediatePropagation();this.click(trigger);return;}
      const owned=this.renderer.findOwned(target);
      if(owned&&this.workflow.edges.some(edge=>edge.from===this.stateId&&edge.source===owned.id&&(edge.event||'click')==='click')){this.renderer.captureClick(event);return;}
      if(this.replay)try{if(this.renderer.forwardClick(target)){event.preventDefault();event.stopImmediatePropagation();return;}}catch(error){event.preventDefault();event.stopImmediatePropagation();this.gestureError(error);return;}
      if(target.matches('input,textarea')&&this.renderer.findOwned(target)){event.stopImmediatePropagation();return;}
    }
    if(target.matches('[data-dx-field]'))return;
    if(!this.interacting&&!this.panelMinimized)this.renderer.captureClick(event);
  };
  private connectionSource(target:Element,event:ConnectionEvent){return this.renderer.sourcesFor(target).find(source=>this.workflow.edges.some(edge=>edge.from===this.stateId&&edge.source===source&&(edge.event||'click')===event));}
  private connectionChange=(event:Event)=>{if(!this.runningConnections||!(event.target instanceof Element))return;const source=this.connectionSource(event.target,'change');if(source){event.stopImmediatePropagation();this.click(source,'change');}};
  private connectionEnter=(event:KeyboardEvent)=>{if(!this.runningConnections||event.key!=='Enter'||event.shiftKey||event.isComposing||event.repeat||!(event.target instanceof Element)||event.target.closest('[data-dx-ignore]'))return;const source=this.connectionSource(event.target,'enter');if(source){event.preventDefault();event.stopImmediatePropagation();this.click(source,'enter');}};
  private click(source:string,event:ConnectionEvent='click') {
    const edge=this.workflow.edges.find(edge=>edge.from===this.stateId&&edge.source===source&&(edge.event||'click')===event);
    if(edge?.conditions?.some(condition=>!fieldFor(resolve(condition.target,this.root,this.renderer.owned)))){this.pageEditor.notify('A connection field is missing. Return to Edit and reconnect it.');return;}
    const passes=!!edge&&(edge.conditions||[]).every(condition=>conditionPasses(condition,fieldFor(resolve(condition.target,this.root,this.renderer.owned))));
    const next=edge?(passes?edge.to:edge.otherwise):undefined;
    if(edge&&!next){this.pageEditor.notify('Complete the connection conditions before continuing.');return;}
    if(next&&passes&&this.runningConnections&&this.workflow.states.findIndex(s=>s.id===next)>this.workflow.states.findIndex(s=>s.id===this.stateId)&&!this.renderer.validateInputs(source))return;
    if(next&&stateURL(this.workflow,next)!==this.url.href){
      if(this.navigating)return;const from=this.stateId,workflow=this.workflow.id;this.navigating=true;
      const work=this.queue.then(async()=>{if(this.stateId!==from||this.workflow.id!==workflow){this.navigating=false;return;}try{await this.navigateState(next,[...this.visits,from]);}catch(error){this.navigating=false;this.pageEditor.notify(error instanceof Error?error.message:'Could not open the connected page.');}});this.queue=work;return;
    }
    if(next){this.replayHistory.push(clone(this.replayData));for(const effect of (passes?edge?.effects:[])||[])this.replayData[effect.key]=effect.value;this.visits.push(this.stateId);this.stateId=next;this.selected=null;this.render(true);this.renderer.owned.get(`view:${next}`)?.scrollIntoView?.({behavior:'smooth',block:'center'});}
    else if(!this.replay){const el=this.renderer.owned.get(source);if(el)this.select(el);}
  }
  private commit(next:Workflow,nextState=this.stateId,group?:string,repaint=true) {const validated=validateWorkflow(next);if(!group||group!==this.historyGroup)this.history.push(this.workflow,this.stateId);this.historyGroup=group;this.workflow=validated;this.workflow.updatedAt=new Date().toISOString();this.stateId=nextState;this.dirty=true;if(repaint)this.render(true);this.scheduleDraft();}
  private scheduleDraft(){
    clearTimeout(this.draftTimer);this.draftTimer=setTimeout(()=>{const work=this.queue.then(()=>this.checkpoint());this.queue=work.catch(this.gestureError);},500);
  }
  private async checkpoint(){
    const record:SavedRecord={draft:clone(this.workflow),enabled:this.enabled,currentVersion:this.record?.currentVersion||0,versions:this.record?.versions||[]};
    await this.repository.put(record);await this.repository.setActive(record.draft);
    await this.rememberLivePosition();
    this.library=await this.repository.list(this.url.origin,routeOf(this.url));this.emit();
  }
  private async rememberLivePosition(){if(this.liveSession&&!this.navigating)await this.options.liveNavigation?.remember?.({workflowId:this.workflow.id,stateId:this.stateId,visits:this.visits.slice(-60),mode:this.mode()==='closed'?'edit':this.mode() as 'edit'|'interact'|'replay',minimized:this.panelMinimized,dialogs:this.liveDialogs});}
  scopedSelection(scope:'element'|'section'|'page'='element'){
    const selected=this.findSelected();if(!selected)throw new Error('Select an element first.');
    const target=scope==='page'?this.root:scope==='section'?sectionTarget(selected,this.root):selected;
    return describe(target,this.renderer.idFor(target));
  }
  highlightScope(scope:'element'|'section'|'page'){this.selectionElement=resolve(this.scopedSelection(scope).locator,this.root,this.renderer.owned);this.paintSelection();}
  isPreviewingLayouts(){return Boolean(this.closeLayouts);}
  async promptHere(prompt:string,scope:'element'|'section'|'page'){
    if(isSettingsRequest(prompt))return this.dispatch({type:'settingsPrompt',prompt});
    if(/(?:generate|show|create).*(?:layouts?|alternatives)|^reimagine (?:this|this section)[.!]?$/i.test(prompt)){this.openLayouts(/\b5\b|five/i.test(prompt)?5:3);return this.snapshot();}
    const current=this.snapshot(),selection=this.scopedSelection(scope);
    const choices=choicePlan(prompt);
    if(choices)return this.dispatch({type:'prompt',prompt,scope,plan:choices,context:{workflowId:current.workflow.id,stateId:current.stateId,selection:JSON.stringify(current.selected?.locator)}});

    let local=false;try{if(/\b(flow|workflow|journey|multi.step|screens?|feature|approve|reject|dropdown|menu|tabs?|switch|toggle|options|validation|cards?)\b/i.test(prompt))throw new Error('Plan a flow');const target=resolve(selection.locator,this.root,this.renderer.owned);if(target){promptOperations(prompt,undefined,target,selection.locator,this.root,this.renderer.owned);local=true;}}catch{/* Broader requests use the connected planner. */}
    if(freeBuild&&!local)throw new Error('This local release supports quick edits such as Add Review beside this, Rename this to Review, and Make this red. Build connected steps using On click.');
    const plan=!local&&this.options.requestPlan?await this.options.requestPlan(prompt,selection):undefined;
    return this.dispatch({type:'prompt',prompt,scope,plan,context:{workflowId:current.workflow.id,stateId:current.stateId,selection:JSON.stringify(current.selected?.locator)}});
  }
  openLayouts(count=3){
    if(!this.isAuthoring())throw new Error('Return to Edit and select a section.');
    const selected=this.findSelected();if(!selected)throw new Error('Select a section first.');
    const target=sectionTarget(selected,this.root),selection=describe(target,this.renderer.idFor(target));
    if(target===this.root)throw new Error('Select a section inside the page, rather than the entire document.');
    if(!resolve(selection.locator,this.root,this.renderer.owned))throw new Error('This section cannot be identified reliably. Select a smaller section or one with a distinct heading.');
    const expected=JSON.stringify(this.workflow),state=this.stateId;
    this.closeLayouts?.();this.closeLayouts=chooseLayout(target,count,(copy,name)=>{
      const work=this.queue.then(()=>{
        if(JSON.stringify(this.workflow)!==expected||this.stateId!==state||!this.isAuthoring())throw new Error('The workflow changed while previewing. Generate layouts again.');
        if(resolve(selection.locator,this.root,this.renderer.owned)!==target)throw new Error('The original section changed. Select it again.');
        const id=uid(),operation=OperationSchema.parse({id:uid(),kind:'insert',target:selection.locator,position:'before',node:{id,kind:'panel',text:name+' layout',isolated:true,copy}});
        this.commit(addOperation(this.workflow,this.stateId,operation));const node=this.renderer.owned.get(id);if(node)this.select(node);this.emit();
      });this.queue=work.catch(this.gestureError);
    },()=>{this.closeLayouts=undefined;});
  }
  dispatch(command:Command):Promise<Snapshot> {
    if(command.type==='connectionAction')return this.pageEditor.connectionAction(command.change).then(()=>this.snapshot());
    const work=this.queue.then(()=>this.execute(command));this.queue=work.catch(()=>undefined);return work;
  }
  dispatchAt(selection:Selection,workflowId:string,stateId:string,command:Command):Promise<Snapshot>{
    const work=this.queue.then(()=>{
      if(this.workflow.id!==workflowId||this.stateId!==stateId)throw new Error('The workflow changed. Select the element again.');
      this.selected=selection;return this.execute(command);
    });this.queue=work.catch(()=>undefined);return work;
  }
  mode():'edit'|'interact'|'replay'|'closed'{return !this.projectionActive?'closed':this.replay?'replay':this.interacting?'interact':'edit';}
  isAuthoring(){return this.selecting;}
  findSelected(){return this.selected?resolve(this.selected.locator,this.root,this.renderer.owned):null;}
  private async execute(c:Command):Promise<Snapshot> {
    if(['reset','new'].includes(c.type)){await this.options.liveNavigation?.clear();this.liveSession=false;}
    if(this.dragData&&c.type!=='snapshot')this.cancelDrag();
    const editing=['appearance','alignText','insertElement','fieldSettings','pasteStyle','image','prompt','text','child','link','undo','redo','style','remove','drag','duplicateElement','mirror'];
    if(editing.includes(c.type)&&this.replay)throw new Error('Return to Edit to change the workflow.');
    if(['appearance','alignText','insertElement','fieldSettings','pasteStyle','image','prompt','text','child','link','style','remove','drag','duplicateElement','mirror'].includes(c.type)&&!this.enabled)throw new Error('Enable the workflow before editing.');
    if(c.type==='connectionAnchor'){this.pageEditor.connectionAnchor(c.ratio);return this.snapshot();}
    if(c.type==='snapshot')return this.snapshot();
    if(c.type.startsWith('assistant')){
      if(!assistantBuild&&!this.options.assistantEnabled)throw new Error('Use the separate assistant beta build for this feature.');
      if(!this.isAuthoring())throw new Error('Switch to Edit to use the conversational assistant.');
      this.assistant??=new AssistantController(this.root,this.renderer.owned);
      if(c.type==='assistantContext')this.assistant.collect(this.workflow,this.stateId,this.selected,this.hovered);
      if(c.type==='assistantReset')this.assistant.reset();
      if(c.type==='assistantStyle')this.assistant.style(c.ref);
      if(c.type==='assistantCandidates')this.assistant.highlight(c.refs);
      if(c.type==='assistantCandidate'){this.assistant.clearHighlights();const node=this.assistant.collector.get(c.ref);this.select(node);}
      if(c.type==='assistantApply'){
        const result=this.assistant.apply(c.plan,c.token,this.workflow,this.stateId,(next,stateId)=>{
          const previous=this.workflow,previousState=this.stateId,dirty=this.dirty,past=[...this.history.past],future=[...this.history.future];
          try{this.commit(next,stateId);if(this.unresolved.length)throw new Error('Preview could not be applied: '+this.unresolved[0]);}
          catch(error){this.workflow=previous;this.stateId=previousState;this.dirty=dirty;this.history.past=past;this.history.future=future;this.render(true);throw error;}
        });
        if(result.view){const heading=this.renderer.owned.get('heading:'+result.view);if(heading)this.select(heading);}
        const recent=result.view?null:this.assistant.collector.recent.at(-1);if(recent){try{this.select(this.assistant.collector.get(recent));}catch{this.selected=null;}}
      }
      this.emit();return this.snapshot();
    }

    if(c.type==='minimizePanel'){
      await this.checkpoint();this.cancelDrag();if(!this.runningConnections)this.replayData=this.defaults();this.panelMinimized=true;this.outline.style.display='none';this.emit();
      try{await this.rememberLivePosition();await this.options.requestClose?.();}catch(error){this.panelMinimized=false;this.emit();throw error;}return this.snapshot();
    }
    if(c.type==='restorePanel'){
      this.restoringPanel=true;try{await this.options.requestConnections?.();}catch(error){this.restoringPanel=false;throw error;}this.panelMinimized=false;this.emit();return this.snapshot();
    }
    if(c.type==='interact'){
      if(!this.runningConnections)this.replayData=this.defaults();
      this.cancelDrag();this.interacting=true;this.picking=false;this.replay=false;this.dragging=false;this.selected=null;this.hovered=null;this.styleClipboard=null;this.outline.style.display='none';this.emit();if(this.liveSession)await this.checkpoint();return this.snapshot();
    }
    if(c.type==='closeEditor'){
      await this.checkpoint();await this.options.liveNavigation?.clear();this.liveSession=false;if(this.options.requestClose)await this.options.requestClose();this.authoring=false;this.suspend();this.emit();return this.snapshot();
    }
    if(c.type==='importScreen'){
      if(!this.isAuthoring())throw new Error('Return to Edit before choosing a destination.');
      const {workflow:next}=addCapturedScreen(this.workflow,this.stateId,c.screen);
      this.commit(next);this.emit();return this.snapshot();
    }
    if(c.type==='connect'){
      if(!this.isAuthoring())throw new Error('Return to Edit to connect views.');
      const spec=ConnectionSpecSchema.parse({to:c.to,newTitle:c.newTitle,screen:c.screen,event:c.event,conditions:c.conditions,otherwise:c.otherwise});
      const selected=this.findSelected();if(!selected||!this.selected)throw new Error('Select the source control again.');
      const target=selected.matches('button,a,[role="button"],[role="link"],[role="link"]')?selected:fieldFor(selected);
      if(!target||!eventsFor(target).includes(spec.event))throw new Error('Choose a supported event for this control.');
      for(const condition of spec.conditions)if(!fieldFor(resolve(condition.target,this.root,this.renderer.owned)))throw new Error('A condition field is missing. Select it again.');
      let next=clone(this.workflow),source=this.renderer.idFor(target)||this.renderer.triggerFor(target);
      if(!source){source=uid();next=addOperation(next,this.stateId,{id:uid(),kind:'trigger',target:describe(target).locator,source});}
      let to=spec.to;
      if(spec.screen){const captured=addLiveScreen(next,this.stateId,spec.screen);next=captured.workflow;to=captured.stateId;}
      if(spec.newTitle){const created=addChild(next,this.stateId,source,spec.newTitle);next=created.workflow;to=created.stateId;next.states.find(s=>s.id===to)!.design=captureDesign(selected);}
      if(!to||!next.states.some(s=>s.id===to))throw new Error('Choose a saved destination view.');
      const previous=next.edges.find(e=>e.from===this.stateId&&e.source===source);
      next.edges=next.edges.filter(e=>e.from!==this.stateId||e.source!==source);
      next.edges.push({id:uid(),from:this.stateId,source,to,event:spec.event,conditions:spec.conditions,...(spec.otherwise?{otherwise:spec.otherwise}:{}),...(previous?.to===to&&previous.effects?{effects:previous.effects}:{})});
      this.commit(next);this.emit();return this.snapshot();
    }
    if(c.type==='replayConnection'){
      const edge=this.workflow.edges.find(e=>e.id===c.id);if(!edge)throw new Error('This connection no longer exists.');
      if(await this.navigateState(edge.from,[],'replay'))return this.snapshot();this.replayData=this.defaults();this.replayHistory=[];this.interacting=false;this.projectionActive=true;this.replay=true;this.picking=false;this.selected=null;this.stateId=edge.from;this.visits=[];this.render(true);return this.snapshot();
    }
    if(c.type==='appearance'){
      const target=this.findSelected(),locator=this.selected?.locator;if(!target||!locator)throw new Error('Select an element to style.');
      this.commit(addOperation(this.workflow,this.stateId,OperationSchema.parse({id:uid(),kind:'appearance',target:locator,style:c.style})));
      const current=resolve(locator,this.root,this.renderer.owned);if(current)this.select(current);this.emit();return this.snapshot();
    }
    if(c.type==='alignText'){
      const target=this.findSelected();if(!target||!this.selected)throw new Error('Select text to align first.');
      const style=textAlignment(target,c),locator=this.selected.locator;
      this.commit(addOperation(this.workflow,this.stateId,OperationSchema.parse({id:uid(),kind:'appearance',target:this.selected.locator,style})));
      const current=resolve(locator,this.root,this.renderer.owned);if(current)this.select(current);this.emit();return this.snapshot();
    }
    if(c.type==='cancelStyle'){this.styleClipboard=null;this.emit();return this.snapshot();}
    if(c.type==='copyStyle'){
      const el=this.findSelected();if(!el||!this.selected)throw new Error('Select the source element first.');
      this.styleClipboard={selection:clone(this.selected),style:readStyle(el)};this.emit();return this.snapshot();
    }
    if(c.type==='pasteStyle'){
      if(!this.styleClipboard||!this.selected)throw new Error('Ctrl/Cmd-click a source, then a destination.');
      const target=this.findSelected();if(!target)throw new Error('Select the destination again.');const locator=this.selected.locator;
      this.commit(addOperation(this.workflow,this.stateId,OperationSchema.parse({id:uid(),kind:'appearance',target:this.selected.locator,style:this.styleClipboard.style})));
      const current=resolve(locator,this.root,this.renderer.owned);if(current)this.select(current);this.styleClipboard=null;this.emit();return this.snapshot();
    }
    if(c.type==='insertElement'){
      const target=this.findSelected();if(!target||!this.selected)throw new Error('Select where the new element should go.');
      const text=c.text?.trim()||({button:'New button',text:'Your text here',field:'New field',panel:'New section'}[c.kind]);
      const op=OperationSchema.parse({id:uid(),kind:'insert',target:this.selected.locator,position:c.position,node:{id:uid(),kind:c.kind,text,...(c.kind==='field'?{inputType:c.inputType||'text',...(c.inputType==='select'?{options:['Option 1','Option 2']}:{})}:{})}});
      const operations=nativeOperations([op],target);let next=this.workflow;for(const operation of operations)next=addOperation(next,this.stateId,operation);
      this.commit(next);if(op.kind==='insert'){const node=this.renderer.owned.get(op.node.id);if(node)this.select(node);}this.emit();return this.snapshot();
    }
    if(c.type==='fieldSettings'){
      const id=this.selected?.locator.owned?.replace(/:input$/,'');if(!id)throw new Error('Select a prototype field to change its type.');
      const next=clone(this.workflow),op=next.states.flatMap(s=>s.operations).find(op=>op.kind==='insert'&&op.node.id===id);
      if(op?.kind!=='insert'||op.node.kind!=='field'||op.node.copy)throw new Error('Select a field added with Wandel.');
      op.node.inputType=c.inputType;if(c.required!==undefined)op.node.required=c.required;if(c.options)op.node.options=c.options;if(c.radioGroup!==undefined)op.node.radioGroup=c.radioGroup;
      const validated=OperationSchema.parse(op);Object.assign(op,validated);this.commit(next);const node=this.renderer.owned.get(id);if(node)this.select(node);this.emit();return this.snapshot();
    }

    if(c.type==='selectDestination'){
      if(this.replay)throw new Error('Return to Edit before choosing a destination.');
      if(!c.prompt.trim()||c.prompt.length>2000)throw new Error('Describe a change under 2,000 characters.');
      if(this.selected&&!this.findSelected())throw new Error('The selected section is no longer available. Select it again.');
      if(!this.selected||/\b(?:in|inside|within|to)\s+(?:the\s+)?["“]?[\w -]{2,60}["”]?\s+(?:section|settings?|panel|dialog)\b/i.test(c.prompt))this.select(inferDestination(c.prompt,this.root));
      this.emit();return this.snapshot();
    }
    if(c.type==='validateSelection'){
      if(!this.findSelected())throw new Error('The selected section is no longer available. Click its heading or content area again before generating.');
      return this.snapshot();
    }
    if(c.type==='settingsPlayback'){
      const state=this.stateId,workflow=this.workflow.id;
      const buttons=()=>[...this.root.querySelectorAll<HTMLButtonElement>('[data-dx-interactive] button')];
      if(!buttons().length)throw new Error('Open the state containing the prototype settings before playing.');
      for(const label of ['Dark','Light','Resize preview','Mobile · 375','Tablet · 768','Reset size','Close','Original']){
        if(!this.projectionActive||this.stateId!==state||this.workflow.id!==workflow)break;
        buttons().find(b=>b.textContent===label)?.click();
        await new Promise(resolve=>setTimeout(resolve,650));
      }
      return this.snapshot();
    }
    if(c.type==='settingsPrompt'){
      if(this.replay)throw new Error('Return to Edit before adding settings.');
      if(!isSettingsRequest(c.prompt)||c.prompt.length>2000)throw new Error('Describe the theme or screen size options to add to Advanced settings.');
      let target:HTMLElement;
      try{target=advancedTarget(this.root);}catch(error){const selected=this.findSelected();if(!selected||selected===this.root||selected.matches('button,a,input,select,textarea')||!selected.querySelector('input'))throw error;target=selected;}
      const locator=describe(target,this.renderer.idFor(target)).locator;
      if(resolve(locator,this.root,this.renderer.owned)!==target)throw new Error('This section is ambiguous. Select a more distinctive settings container.');
      let next=this.workflow;
      for(const widget of ['theme','viewport'] as const){
        if(!(widget==='theme'?/theme|dark|light/i:/resize|screen size/i).test(c.prompt))continue;
        const duplicate=next.states.find(st=>st.id===this.stateId)!.operations.some(op=>op.kind==='insert'&&op.node.widget===widget&&JSON.stringify(op.target)===JSON.stringify(locator));
        if(!duplicate)next=addOperation(next,this.stateId,{id:uid(),kind:'insert',target:locator,position:'inside',node:{id:uid(),kind:'panel',text:widget==='theme'?'Appearance':'Screen size',widget}});
      }
      this.enabled=true;this.projectionActive=true;this.authoring=true;this.interacting=false;this.picking=true;
      this.commit(next);this.select(target);target.querySelector<HTMLElement>('[data-dx-interactive]')?.scrollIntoView?.({behavior:'smooth',block:'center'});return this.snapshot();
    }
    if(c.type==='layouts'){this.openLayouts(c.count);return this.snapshot();}
    if(c.type==='image'){const target=this.findSelected();if(!(target instanceof HTMLImageElement)||!this.selected)throw new Error('Select an image first.');this.commit(addOperation(this.workflow,this.stateId,OperationSchema.parse({id:uid(),kind:'image',target:this.selected.locator,src:c.src,fit:c.fit})));this.emit();return this.snapshot();}
    if(c.type!=='style')this.historyGroup=undefined;
    if(c.type==='escape'){
      if(!this.projectionActive)return this.snapshot();
      if(!this.interacting){
        this.interacting=true;this.styleClipboard=null;this.picking=false;this.selected=null;this.hovered=null;this.replay=false;this.dragging=false;this.outline.style.display='none';this.emit();
      }else{
        // Checkpoint before closing; a failed write keeps the editor available.
        await this.checkpoint();
        if(this.options.requestClose)await this.options.requestClose();
        this.authoring=false;this.suspend();
      }
    }
    else if(c.type==='signIn'){if(!this.options.requestSignIn)throw new Error('Open the Wandel panel and sign in under Account.');await this.options.requestSignIn();}
    else if(c.type==='selectSection'||c.type==='selectParent'){const current=this.findSelected();if(!current)throw new Error('Select an element first.');const target=c.type==='selectSection'?sectionTarget(current,this.root):current.parentElement;if(target&&this.root.contains(target))this.select(target);}
    else if(c.type==='pick'){if(this.replay)throw new Error('Return to Edit to select elements.');const selecting=this.selecting;this.interacting=selecting;this.projectionActive=true;this.picking=!selecting;if(selecting){this.selected=null;this.styleClipboard=null;}this.render();this.outline.style.display='none';}
    else if(c.type==='pause'){if(!this.panelMinimized&&!this.navigating&&!this.leaving){await this.options.liveNavigation?.clear();this.liveSession=false;this.authoring=false;this.suspend();}}
    else if(c.type==='drag'){if(!this.selected)throw new Error('Select an element first.');this.dragging=!this.dragging;this.picking=true;}
    else if(c.type==='style'||c.type==='remove'){
      if(!this.selected)throw new Error('Select an element first.');
      const locator=this.selected.locator;
      if(!resolve(locator,this.root,this.renderer.owned))throw new Error('Select the element again.');
      const op=OperationSchema.parse(c.type==='style'?{id:uid(),kind:'style',target:locator,style:StyleSchema.parse(c.style)}:{id:uid(),kind:'remove',target:locator});
      let next=addOperation(this.workflow,this.stateId,op);
      if(c.type==='style'&&c.group&&c.group===this.historyGroup){const previous=this.workflow.states.find(st=>st.id===this.stateId)!.operations.at(-1);if(previous?.kind==='style'&&JSON.stringify(previous.target)===JSON.stringify(locator)){next=clone(this.workflow);next.states.find(st=>st.id===this.stateId)!.operations.splice(-1,1,{...previous,style:{...previous.style,...c.style}});}}
      this.commit(next,this.stateId,c.type==='style'?c.group:undefined);
      if(c.type==='remove'){this.selected=null;this.dragging=false;}else{const el=resolve(locator,this.root,this.renderer.owned);if(el){this.hovered=el;this.select(el);this.historyGroup=c.type==='style'?c.group:undefined;}}
    }
    else if(c.type==='mirror'){
      if(!this.selected?.owned)throw new Error('Duplicate a button or field first, then mirror its behavior.');
      const insertion=this.workflow.states.flatMap(s=>s.operations).find(o=>o.kind==='insert'&&o.node.id===this.selected!.locator.owned);
      if(insertion?.kind!=='insert'||!insertion.node.copy)throw new Error('Select a copied button or field.');
      const source=resolve(insertion.target,this.root,this.renderer.owned);
      if(!source||!source.matches('button,a,[role="button"],[role="link"],input:not([type="file"]),textarea,label'))throw new Error('Mirror a single button or input field, rather than a whole section.');
      this.commit(addOperation(this.workflow,this.stateId,OperationSchema.parse({id:uid(),kind:'mirror',target:this.selected.locator,source:insertion.target})));
    }
    else if(c.type==='duplicateElement'){
      const target=this.findSelected();if(!target||!this.selected)throw new Error('Select an item to duplicate first.');
      if(target===this.root||target.matches('html,body'))throw new Error('Select an item inside the page to duplicate.');
      const original=this.workflow.states.flatMap(st=>st.operations).find(op=>op.kind==='insert'&&op.node.id===this.selected?.locator.owned?.replace(/:input$/,''));
      const node=original?.kind==='insert'&&original.node.kind==='field'&&!original.node.copy?{...clone(original.node),id:uid(),binding:undefined}:{id:uid(),kind:'panel' as const,text:this.selected.label||'Copy',copy:captureCopy(target)};
      const anchor=original?.kind==='insert'&&original.node.kind==='field'?{...this.selected.locator,owned:original.node.id}:this.selected.locator;
      const op=OperationSchema.parse({id:uid(),kind:'insert',target:anchor,position:'after',node});
      this.commit(addOperation(this.workflow,this.stateId,op));
      const copied=this.renderer.owned.get(node.id);if(copied)this.select(copied);
    }
    else if(c.type==='reset'){
      this.cancelDrag();this.dragging=false;
      const next=clone(this.workflow);next.states=[{id:next.entry,title:'Existing application',parent:null,view:'base',operations:[]}];next.edges=[];
      this.selected=null;this.replay=false;this.picking=true;this.visits=[];this.commit(next,next.entry);
    }
    else if(c.type==='prompt'||c.type==='text') {
      const generatedPlan=c.type==='prompt'?(choicePlan(c.prompt)||c.plan):undefined;

      if(!this.selected)throw new Error('Select an element on the page first.');
      if(c.type==='prompt'&&c.context&&(c.context.workflowId!==this.workflow.id||c.context.stateId!==this.stateId||c.context.selection!==JSON.stringify(this.selected.locator)))throw new Error('The page, state, or selection changed while planning. Submit the prompt again.');
      const selection=c.type==='prompt'&&c.scope?this.scopedSelection(c.scope):this.selected;
      const target=resolve(selection.locator,this.root,this.renderer.owned);
      if(!target)throw new Error('The selected element moved or is ambiguous. Select it again.');
      if(c.type==='prompt'&&generatedPlan&&typeof generatedPlan==='object'&&'section' in generatedPlan&&generatedPlan.section){
        const plan=BatchSchema.parse(generatedPlan);
        if(target===this.root||target.matches('html,body'))throw new Error('Select a section inside the page before reimagining it.');
        const redesign=sectionOperations(selection.locator,plan.section,buttonTheme(target),captureDesign(target));
        let next=this.workflow;for(const operation of nativeOperations(redesign.operations,target))next=addOperation(next,this.stateId,operation);
        this.commit(next);const panel=this.renderer.owned.get(redesign.id);if(panel)this.select(panel);this.emit();return this.snapshot();
      }
      if(c.type==='prompt'&&generatedPlan&&typeof generatedPlan==='object'&&'flow' in generatedPlan&&generatedPlan.flow){
        const plan=BatchSchema.parse(generatedPlan);
        const generated=compileFlow(this.workflow,this.stateId,selection.locator,plan.flow,buttonTheme(target),target===this.root||target.matches('div,section,article,main,form,[role="dialog"],[role="region"]')||!!selection.locator.owned?.startsWith('view:'),captureDesign(target));
        const parent=generated.workflow.states.find(s=>s.id===this.stateId)!;
        const existing=this.workflow.states.find(s=>s.id===this.stateId)!.operations.length;
        parent.operations=[...parent.operations.slice(0,existing),...nativeOperations(parent.operations.slice(existing),target)];
        this.commit(generated.workflow);
        const entry=this.renderer.owned.get(generated.entry);if(entry)this.select(entry);
        this.emit();return this.snapshot();
      }
      const ops=c.type==='prompt'?nativeOperations(nativeChoices(c.prompt,promptOperations(c.prompt,generatedPlan,target,selection.locator,this.root,this.renderer.owned),target),target):[operationFromPlan({kind:'text',position:'after',element:'text',text:c.text},this.selected.locator)];
      if(c.type==='prompt'&&choicePlan(c.prompt)&&!ops.some(op=>op.kind==='insert'&&op.node.choices))throw new Error('Select the open category container that includes an existing pill section, such as Metrics. No changes were applied.');
      const op=ops.at(-1)!;
      if(ops.length===1&&op.kind==='text'&&!target.matches('input,textarea')&&!editableText(resolve(op.target,this.root,this.renderer.owned)||target,op.target.textPath))throw new Error('Double-click a specific text label to edit it.');
      if(op.kind==='insert'&&op.position==='inside'&&target.matches('button,a,input,textarea,select,img,br,hr'))throw new Error('Select a panel or container to add UI inside.');
      let next=this.workflow;for(const operation of ops)next=addOperation(next,this.stateId,operation);
      this.commit(next);
      if(op.kind==='remove'){this.selected=null;}else if(op.kind==='insert'){const node=this.renderer.owned.get(op.node.id);if(node)this.select(node);}else {const renamed=target.isConnected?target:resolve(op.target,this.root,this.renderer.owned);if(renamed)this.select(renamed);else this.selected=null;}
    }
    else if(c.type==='child') {
      const target=this.findSelected();if(!target||!this.selected||!target.matches('button,a,[role="button"],[role="link"]'))throw new Error('Select a button to define its click.');
      let source=this.selected.locator.owned||this.renderer.triggerFor(target),workflow=this.workflow;
      if(!source){source=uid();workflow=addOperation(workflow,this.stateId,{id:uid(),kind:'trigger',target:this.selected.locator,source});}
      const child=addChild(workflow,this.stateId,source,c.text);child.workflow.states.find(s=>s.id===child.stateId)!.design=captureDesign(target);this.commit(child.workflow,child.stateId);this.visits=[];
      this.select(this.renderer.owned.get(`view:${child.stateId}`)!);this.renderer.owned.get(`view:${child.stateId}`)?.scrollIntoView?.({behavior:'smooth',block:'center'});
    }
    else if(c.type==='link') {
      const target=this.findSelected();if(!target||!this.selected||!target.matches('button,a,[role="button"],[role="link"]'))throw new Error('Select a button first.');
      let source=this.selected.locator.owned||this.renderer.triggerFor(target),workflow=this.workflow;
      if(!source){source=uid();workflow=addOperation(workflow,this.stateId,{id:uid(),kind:'trigger',target:this.selected.locator,source});}
      const next=clone(workflow);next.edges=next.edges.filter(e=>e.from!==this.stateId||e.source!==source);next.edges.push({id:uid(),from:this.stateId,source,to:c.id});this.commit(next);
    }
    else if(c.type==='state') {if(!this.workflow.states.some(s=>s.id===c.id))throw new Error('State not found.');if(await this.navigateState(c.id,[...this.visits,this.stateId]))return this.snapshot();this.stateId=c.id;this.selected=null;this.visits=[];this.render(true);if(this.liveSession)await this.checkpoint();}
    else if(c.type==='rename') {const next=clone(this.workflow);next.name=c.text.trim();this.commit(next,this.stateId,undefined,false);}
    else if(c.type==='undo'||c.type==='redo') {const next=this.history[c.type](this.workflow,this.stateId);if(next){this.workflow=next.workflow;this.stateId=next.stateId;this.selected=null;this.dirty=true;this.visits=[];this.render(true);}}
    else if(c.type==='replay'){if(await this.navigateState(this.workflow.entry,[],'replay'))return this.snapshot();this.replayData=this.defaults();this.replayHistory=[];this.interacting=false;this.projectionActive=true;this.cancelDrag();this.dragging=false;this.replay=true;this.picking=false;this.outline.style.display='none';this.selected=null;this.stateId=this.workflow.entry;this.visits=[];this.render(true);}
    else if(c.type==='edit'){this.panelMinimized=false;const wasReplay=this.replay;this.replayData={};this.replayHistory=[];this.interacting=false;this.authoring=true;this.projectionActive=true;this.replay=false;this.picking=true;this.render(wasReplay);if(this.liveSession)await this.checkpoint();}
    else if(c.type==='back'){const previous=this.visits.at(-1);if(previous){if(await this.navigateState(previous,this.visits.slice(0,-1)))return this.snapshot();this.visits.pop();this.replayData=this.replayHistory.pop()||this.defaults();this.stateId=previous;this.selected=null;this.render(true);if(this.liveSession)await this.checkpoint();}}
    else if(c.type==='save'&&this.options.requestSave){this.options.requestSave();}
    else if(c.type==='save'||c.type==='saveTemporary'){this.record=await this.repository.save(this.workflow,this.enabled);this.workflow=clone(this.record.draft);await this.repository.setActive(this.workflow);this.dirty=false;this.library=await this.repository.list(this.url.origin,routeOf(this.url));await this.rememberLivePosition();}
    else if(c.type==='enabled'){this.enabled=c.value;this.cancelDrag();this.dragging=false;this.selected=null;this.picking=c.value&&this.authoring;this.outline.style.display='none';if(this.record){this.record.enabled=c.value;await this.repository.put(this.record);}this.render(true);}
    else if(c.type==='loadRecord'){
      const record=RecordSchema.parse(c.record);validateWorkflow(record.draft);record.versions.forEach(v=>validateWorkflow(v.workflow));
      if(record.draft.origin!==this.url.origin||![record.draft.origin+record.draft.route,...record.draft.states.flatMap(s=>s.liveURL?[s.liveURL]:[])].includes(this.url.href))throw new Error('Open the matching application page before loading this flow.');
      await this.repository.put(record);await this.options.liveNavigation?.clear();this.liveSession=false;await this.repository.setActive(record.draft);this.projectionActive=true;await this.loadRoute();
    }
    else if(c.type==='acknowledgeSave'){
      const record=RecordSchema.parse(c.record);if(record.draft.id!==this.workflow.id)throw new Error('Workflow changed during save.');
      validateWorkflow(record.draft);record.versions.forEach(v=>validateWorkflow(v.workflow));
      await this.repository.put(record);this.record=record;if(JSON.stringify(this.workflow)===JSON.stringify(c.expected))this.dirty=false;this.library=await this.repository.list(this.url.origin,routeOf(this.url));
    }
    else if(c.type==='restore'){this.record=await this.repository.restore(this.workflow.id,c.version);this.library=await this.repository.list(this.url.origin,routeOf(this.url));this.workflow=clone(this.record.draft);this.stateId=this.workflow.entry;this.history=new History();this.selected=null;this.dirty=false;this.visits=[];if(await this.navigateState(this.stateId,[]))return this.snapshot();this.render(true);}
    else if(c.type==='load'){const draft=this.routeDrafts.get(c.id);if(draft&&draft.workflow.origin===this.url.origin&&draft.workflow.route===routeOf(this.url)){this.workflow=clone(draft.workflow);this.record=draft.record;this.dirty=draft.dirty;this.enabled=draft.enabled;this.stateId=this.workflow.entry;this.selected=null;this.history=new History();this.projectionActive=true;this.render(true);this.emit();return this.snapshot();}const record=await this.repository.get(c.id);if(!record || record.draft.origin!==this.url.origin || ![record.draft.origin+record.draft.route,...record.draft.states.flatMap(s=>s.liveURL?[s.liveURL]:[])].includes(this.url.href))throw new Error('Workflow does not match this page.');await this.options.liveNavigation?.clear();this.liveSession=false;await this.repository.setActive(record.draft);this.projectionActive=true;await this.loadRoute();}
    else if(c.type==='duplicate'){const next=clone(this.workflow);next.id=uid();next.name+=' — copy';next.createdAt=new Date().toISOString();this.workflow=next;this.record=null;this.dirty=true;this.history=new History();this.render(true);}
    else if(c.type==='delete'){await this.repository.delete(this.workflow.id);this.record=null;this.workflow=createWorkflow(this.url);this.stateId=this.workflow.entry;this.dirty=false;this.selected=null;this.history=new History();this.library=await this.repository.list(this.url.origin,routeOf(this.url));this.render(true);}
    else if(c.type==='new'){this.workflow=createWorkflow(this.url);this.record=null;this.stateId=this.workflow.entry;this.selected=null;this.history=new History();this.visits=[];this.replay=false;this.enabled=true;this.dirty=false;this.render(true);}
    if(this.dirty&&editing.includes(c.type))this.scheduleDraft();
    this.emit();return this.snapshot();
  }
  destroy(){this.assistant?.reset();this.closeLayouts?.();clearTimeout(this.draftTimer);window.removeEventListener('change',this.connectionChange,true);window.removeEventListener('keydown',this.connectionEnter,true);window.removeEventListener('input',this.inputMirror,true);window.removeEventListener('change',this.inputMirror,true);if(this.selectionFrame!==undefined)window.cancelAnimationFrame(this.selectionFrame);this.selectionFrame=undefined;window.removeEventListener('scroll',this.paintSelection,true);window.removeEventListener('resize',this.paintSelection);this.selectionOutline.remove();this.pageEditor.destroy();this.cancelDrag();window.removeEventListener('dragstart',this.nativeDrag,true);window.removeEventListener('pointerdown',this.dragStart,true);window.removeEventListener('pointermove',this.dragMove,true);window.removeEventListener('pointerup',this.dragEnd,true);window.removeEventListener('pointercancel',this.cancelDrag,true);window.removeEventListener('blur',this.blur);this.observer.disconnect();clearTimeout(this.timer);window.removeEventListener('click',this.handleClick,true);window.removeEventListener('pointermove',this.hover,true);window.removeEventListener('keydown',this.escape,true);window.removeEventListener('keyup',this.keyup,true);this.renderer.reset();this.outline.remove();this.listeners.clear();}
}
