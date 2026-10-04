import { captureCopy } from './duplicate';
import { RecordSchema, OperationSchema, StyleSchema, clone, routeOf, uid, type Workflow, type Selection, type Snapshot, type Command, type SavedRecord } from '../shared/model';
import { createWorkflow, addOperation, addChild, transition, History, validateWorkflow } from '../prototype/engine';
import { operationFromPlan } from '../ai/planner';
import { promptOperations } from '../ai/batch';
import { Repository } from '../storage/store';
import { PageEditor } from './pageEditor';
import { editableText } from './text';
import { Renderer } from './renderer';
import { describe, resolve } from './locator';
export class Session {
  workflow:Workflow; stateId:string; selected:Selection|null=null; picking=false; dragging=false; replay=false; enabled=true; dirty=false;
  private authoring=false;
  private interacting=false;
  private projectionActive=false;
  private resizeHeld=false;
  private selectionOutline=document.createElement('div');
  private selectionElement:HTMLElement|null=null;
  private selectionFrame:number|undefined;
  history=new History(); visits:string[]=[]; unresolved:string[]=[]; record:SavedRecord|null=null; library:SavedRecord[]=[];
  private pageEditor:PageEditor;
  private historyGroup:string|undefined;
  renderer:Renderer; private observer:MutationObserver; private timer:ReturnType<typeof setTimeout>|undefined;
  private draftTimer:ReturnType<typeof setTimeout>|undefined;
  private listeners=new Set<(s:Snapshot)=>void>(); private outline:HTMLElement; private queue:Promise<unknown>=Promise.resolve();
  constructor(public root:HTMLElement,public repository:Repository,public url:URL, private options:{ directSelection?:boolean;requestSave?:()=>void;requestClose?:()=>Promise<void>;requestPlan?:(prompt:string,selection:Selection)=>Promise<unknown> } = {}) {
    this.projectionActive=!!options.directSelection;this.workflow=createWorkflow(url);this.stateId=this.workflow.entry;
    this.renderer=new Renderer(root,id=>this.click(id));
    this.outline=document.createElement('div');this.outline.dataset.dxIgnore='true';this.outline.style.cssText='position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #6473f4;border-radius:4px;background:#6c7afa12;display:none;box-sizing:border-box;';document.documentElement.append(this.outline);
    this.selectionOutline.dataset.dxIgnore='true';this.selectionOutline.dataset.dxSelection='true';this.selectionOutline.setAttribute('aria-hidden','true');
    this.selectionOutline.style.cssText='position:fixed;pointer-events:none;z-index:2147483646;border:2px solid #7770df;border-radius:4px;background:rgba(119,112,223,.10);display:none;box-sizing:border-box;';document.documentElement.append(this.selectionOutline);
    window.addEventListener('scroll',this.paintSelection,true);window.addEventListener('resize',this.paintSelection);
    this.observer=new MutationObserver(()=>{clearTimeout(this.timer);this.timer=setTimeout(()=>this.render(),160);});
    this.pageEditor=new PageEditor(this);
    this.observe();
    window.addEventListener('click',this.handleClick,true);window.addEventListener('input',this.inputMirror,true);window.addEventListener('change',this.inputMirror,true);
    window.addEventListener('pointermove',this.hover,true);
    window.addEventListener('keydown',this.escape,true);window.addEventListener('keyup',this.keyup,true);
    window.addEventListener('pointerdown',this.dragStart,true);window.addEventListener('pointermove',this.dragMove,true);window.addEventListener('pointerup',this.dragEnd,true);window.addEventListener('pointercancel',this.cancelDrag,true);window.addEventListener('blur',this.blur);
  }
  async init() { await this.loadRoute(false); this.emit(); }
  private observe() { this.observer.observe(this.root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['id','data-testid','data-test','data-qa','aria-label','hidden']}); }
  private render(reset=false) {
    this.observer.disconnect();
    try { if(reset)this.renderer.reset(); this.unresolved=this.enabled&&this.projectionActive?this.renderer.reconcile(this.workflow,this.stateId):[]; } finally { this.observe(); }
    this.emit();
  }
  async loadRoute(restore=true) {
    this.library=await this.repository.list(this.url.origin,routeOf(this.url));
    const active=await this.repository.active(this.url.origin,routeOf(this.url));
    this.record=restore?this.library.find(r=>r.draft.id===active)||null:null;
    this.workflow=clone(this.record?.draft || createWorkflow(this.url));this.stateId=this.workflow.entry;this.enabled=this.record?.enabled??true;
    this.dirty=false;this.history=new History();this.visits=[];this.selected=null;this.picking=this.authoring;this.outline.style.display='none';this.replay=false;this.render(true);
  }
  navigate(url:URL):Promise<void> {const work=this.queue.then(()=>this.changeRoute(url));this.queue=work.catch(()=>undefined);return work;}
  private routeDrafts=new Map<string,{workflow:Workflow;dirty:boolean;record:SavedRecord|null;enabled:boolean}>();
  private async changeRoute(url:URL) {
    if(url.href===this.url.href)return;
    if(this.dirty)this.routeDrafts.set(this.workflow.id,{workflow:clone(this.workflow),dirty:this.dirty,record:this.record,enabled:this.enabled});
    this.suspend();this.url=url;await this.loadRoute(false);
    this.projectionActive=this.authoring;this.picking=this.authoring;this.render(true);
  }
  /** Synchronous teardown also runs before BFCache/pagehide freezes the document. */
  suspend(){this.resizeHeld=false;this.cancelDrag();this.projectionActive=false;this.picking=false;this.dragging=false;this.replay=false;this.selected=null;this.hovered=null;this.render(true);}

  subscribe(listener:(s:Snapshot)=>void) {this.listeners.add(listener);listener(this.snapshot());return()=>{this.listeners.delete(listener);};}
  snapshot():Snapshot {return clone({workflow:this.workflow,stateId:this.stateId,selected:this.selected,picking:this.picking,dragging:this.dragging,replay:this.replay,enabled:this.enabled,dirty:this.dirty,canUndo:!!this.history.past.length,canRedo:!!this.history.future.length,canBack:!!this.visits.length,unresolved:this.unresolved,currentVersion:this.record?.currentVersion||this.record?.versions.at(-1)?.number||0,versions:this.record?.versions.map(({number,savedAt,workflow})=>({number,savedAt,name:workflow.name}))||[],library:[...this.library.map(r=>({id:r.draft.id,name:this.routeDrafts.has(r.draft.id)?this.routeDrafts.get(r.draft.id)!.workflow.name+' (unsaved)':r.draft.name,versions:r.versions.length})),...[...this.routeDrafts.values()].filter(d=>d.workflow.origin===this.url.origin&&d.workflow.route===routeOf(this.url)&&!this.library.some(r=>r.draft.id===d.workflow.id)).map(d=>({id:d.workflow.id,name:d.workflow.name+' (unsaved)',versions:d.record?.versions.length||0}))]});}
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
  private get selecting() {return !this.interacting&&this.projectionActive&&this.enabled&&!this.replay&&(this.picking||!!this.options.directSelection);}
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
    const target=event.target instanceof HTMLElement?event.target:event.target instanceof Element?event.target.closest<HTMLElement>('button,a,[role="button"]'):null;
    if(!this.selecting||!target||!this.root.contains(target)||target.closest('[data-dx-ignore]')){this.hovered=null;this.outline.style.display='none';return;}
    this.hovered=target;this.paintHover(target);
  };
  private dragData:{el:HTMLElement;selection:Selection;mode:'move'|'resize';startX:number;startY:number;x:number;y:number;width:number;height:number;styles:{key:string;value:string;priority:string}[];dx:number;dy:number;pointerId?:number}|null=null;
  private suppressClick=false;
  private dimensions(el:HTMLElement){const css=getComputedStyle(el),rect=el.getBoundingClientRect();return {width:parseFloat(css.width)||rect.width||1,height:parseFloat(css.height)||rect.height||1};}
  private offset(el:HTMLElement){const parts=getComputedStyle(el).translate.split(' ').map(parseFloat);return {x:Number.isFinite(parts[0])?parts[0]:0,y:Number.isFinite(parts[1])?parts[1]:0};}
  private bound=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,Math.round(n)));
  private dragStart=(e:PointerEvent)=>{
    if(!this.selecting||e.button!==0||(!e.altKey&&!this.dragging&&!(e.target instanceof Node&&this.findSelected()?.contains(e.target))))return;
    const target=e.target instanceof HTMLElement?e.target:e.target instanceof Element?e.target.closest<HTMLElement>('button,a,[role="button"]'):null;
    if(!target||!this.root.contains(target)||target.closest('[data-dx-ignore],[contenteditable="true"]'))return;
    const el=e.altKey?target:this.selected?resolve(this.selected.locator,this.root,this.renderer.owned):null;
    if(!el||!el.contains(target))return;
    this.beginGesture(el,e.altKey&&this.resizeHeld?'resize':'move',e);
  };
  beginGesture(el:HTMLElement,mode:'move'|'resize',e:PointerEvent){
    if(!this.selecting)return;
    e.preventDefault();e.stopImmediatePropagation();
    this.dragData={el,selection:describe(el,this.renderer.idFor(el)),mode,startX:e.clientX,startY:e.clientY,...this.offset(el),...this.dimensions(el),styles:(mode==='resize'?['width','height','display']:['translate','display']).map(key=>({key,value:el.style.getPropertyValue(key),priority:el.style.getPropertyPriority(key)})),dx:0,dy:0,pointerId:e.pointerId};
    try{el.setPointerCapture(e.pointerId);}catch{/* Synthetic events or detached elements may not support capture. */}
    this.paintHover(el,mode==='resize'?'Resizing · Esc to cancel':'Moving · Esc to cancel');
  };
  private gestureStyle(d:NonNullable<Session['dragData']>) {return d.mode==='resize'?{width:this.bound(d.width+d.dx,1,4000),height:this.bound(d.height+d.dy,1,4000)}:{x:this.bound(d.x+d.dx,-10000,10000),y:this.bound(d.y+d.dy,-10000,10000)};}
  private dragMove=(e:PointerEvent)=>{
    const d=this.dragData;if(!d||(d.pointerId!==undefined&&e.pointerId!==undefined&&d.pointerId!==e.pointerId))return;
    e.preventDefault();e.stopImmediatePropagation();d.dx=e.clientX-d.startX;d.dy=e.clientY-d.startY;
    const style=this.gestureStyle(d);
    if('width' in style){if(getComputedStyle(d.el).display==='inline')d.el.style.setProperty('display','inline-block','important');d.el.style.setProperty('width',`${style.width}px`,'important');d.el.style.setProperty('height',`${style.height}px`,'important');}
    else {if(getComputedStyle(d.el).display==='inline')d.el.style.setProperty('display','inline-block','important');d.el.style.setProperty('translate',`${style.x}px ${style.y}px`,'important');}
    this.paintHover(d.el,d.mode==='resize'?`${Math.round(d.width+d.dx)} × ${Math.round(d.height+d.dy)} px · Esc to cancel`:'Moving · Esc to cancel');
  };
  private cancelDrag=()=>{
    const d=this.dragData;if(d){for(const {key,value,priority} of d.styles){if(value)d.el.style.setProperty(key,value,priority);else d.el.style.removeProperty(key);}try{if(d.pointerId!==undefined)d.el.releasePointerCapture(d.pointerId);}catch{/* Pointer may already be released. */}}
    this.dragData=null;this.outline.style.display='none';
  };
  private gestureError=(error:unknown)=>{this.unresolved=[error instanceof Error?error.message:'Gesture could not be applied.'];this.emit();};
  private dragEnd=(e:PointerEvent)=>{
    const d=this.dragData;if(!d)return;e.preventDefault();e.stopImmediatePropagation();this.cancelDrag();
    this.suppressClick=true;setTimeout(()=>{this.suppressClick=false;},0);
    if(Math.abs(d.dx)+Math.abs(d.dy)>2){this.selected=d.selection;void this.dispatch({type:'style',style:this.gestureStyle(d)}).catch(this.gestureError);}
  };
  private keyup=(e:KeyboardEvent)=>{if(e.code==='KeyS'||e.key.toLowerCase()==='s')this.resizeHeld=false;};
  private blur=()=>{this.resizeHeld=false;this.cancelDrag();};
  private escape=(e:KeyboardEvent)=>{
    const origin=e.composedPath()[0];const editable=origin instanceof Element&&!!origin.closest('input,textarea,select,[contenteditable="true"]');
    if(!editable&&this.selecting&&(e.code==='KeyS'||e.key.toLowerCase()==='s')){this.resizeHeld=true;if(e.altKey){e.preventDefault();e.stopImmediatePropagation();}return;}
    if(!editable&&this.selecting&&!this.dragData&&e.altKey&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&this.hovered?.isConnected){
      e.preventDefault();e.stopImmediatePropagation();
      const el=this.hovered,dx=e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0,dy=e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0;
      this.selected=describe(el,this.renderer.idFor(el));
      const {width,height}=this.dimensions(el),{x,y}=this.offset(el);
      void this.dispatch({type:'style',style:this.resizeHeld?{width:this.bound(width+dx,1,4000),height:this.bound(height+dy,1,4000)}:{x:this.bound(x+dx,-10000,10000),y:this.bound(y+dy,-10000,10000)}}).catch(this.gestureError);return;
    }
    if(!editable&&this.selecting&&(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.stopImmediatePropagation();void this.dispatch({type:e.shiftKey?'redo':'undo'});return;}
    if(e.key==='Escape'&&!editable&&!e.repeat&&this.projectionActive){
      e.preventDefault();e.stopImmediatePropagation();
      if(this.dragData){this.cancelDrag();this.dragging=false;return;}
      void this.dispatch({type:'escape'}).catch(this.gestureError);
    }
  };
  private inputMirror=(event:Event)=>{if(this.replay)try{this.renderer.forwardInput(event);}catch(error){this.gestureError(error);}};
  private handleClick=(event:MouseEvent)=>{
    if(this.renderer.forwarding)return;
    if(this.suppressClick){event.preventDefault();event.stopImmediatePropagation();return;}
    const original=event.target;const target=original instanceof HTMLElement?original:original instanceof Element?original.closest('button,a,[role=button]'):null;if(!(target instanceof HTMLElement)||!this.root.contains(target)||target.closest('[data-dx-ignore]'))return;
    if(this.selecting){event.preventDefault();event.stopImmediatePropagation();if(target.matches('input,textarea,select,[contenteditable="true"]')){const field=this.renderer.findOwned(target);if(field?.node instanceof HTMLElement)this.select(field.node);else this.select(target);return;}this.select(target.closest<HTMLElement>('button,a,[role="button"]')||target);return;}
    if(this.replay){
      const trigger=this.renderer.triggerFor(target);
      if(trigger){event.preventDefault();event.stopImmediatePropagation();this.click(trigger);return;}
      const owned=this.renderer.findOwned(target);
      if(owned&&transition(this.workflow,this.stateId,owned.id)){this.renderer.captureClick(event);return;}
      try{if(this.renderer.forwardClick(target)){event.preventDefault();event.stopImmediatePropagation();return;}}catch(error){event.preventDefault();event.stopImmediatePropagation();this.gestureError(error);return;}
      if(target.matches('input,textarea')&&this.renderer.findOwned(target)){event.stopImmediatePropagation();return;}
    }
    if(!this.interacting)this.renderer.captureClick(event);
  };
  private click(source:string) {
    const next=transition(this.workflow,this.stateId,source);
    if(next){this.visits.push(this.stateId);this.stateId=next;this.selected=null;this.render(true);this.renderer.owned.get(`view:${next}`)?.scrollIntoView?.({behavior:'smooth',block:'center'});}
    else if(!this.replay){const el=this.renderer.owned.get(source);if(el)this.select(el);}
  }
  private commit(next:Workflow,nextState=this.stateId,group?:string) {const validated=validateWorkflow(next);if(!group||group!==this.historyGroup)this.history.push(this.workflow,this.stateId);this.historyGroup=group;this.workflow=validated;this.workflow.updatedAt=new Date().toISOString();this.stateId=nextState;this.dirty=true;this.render(true);this.scheduleDraft();}
  private scheduleDraft(){
    clearTimeout(this.draftTimer);this.draftTimer=setTimeout(()=>{const work=this.queue.then(()=>this.checkpoint());this.queue=work.catch(this.gestureError);},500);
  }
  private async checkpoint(){
    const record:SavedRecord={draft:clone(this.workflow),enabled:this.enabled,currentVersion:this.record?.currentVersion||0,versions:this.record?.versions||[]};
    await this.repository.put(record);await this.repository.setActive(record.draft);
    this.library=await this.repository.list(this.url.origin,routeOf(this.url));this.emit();
  }
  scopedSelection(scope:'element'|'section'|'page'='element'){
    const selected=this.findSelected();if(!selected)throw new Error('Select an element first.');
    const target=scope==='page'?this.root:scope==='section'?(selected.closest<HTMLElement>('section,article,form,nav,main,aside')||selected.parentElement||selected):selected;
    return describe(target,this.renderer.idFor(target));
  }
  highlightScope(scope:'element'|'section'|'page'){this.selectionElement=resolve(this.scopedSelection(scope).locator,this.root,this.renderer.owned);this.paintSelection();}
  async promptHere(prompt:string,scope:'element'|'section'|'page'){
    const current=this.snapshot(),selection=this.scopedSelection(scope);
    let local=false;try{const target=resolve(selection.locator,this.root,this.renderer.owned);if(target){promptOperations(prompt,undefined,target,selection.locator,this.root,this.renderer.owned);local=true;}}catch{/* Broader requests use the connected planner. */}
    const plan=!local&&this.options.requestPlan?await this.options.requestPlan(prompt,selection):undefined;
    return this.dispatch({type:'prompt',prompt,scope,plan,context:{workflowId:current.workflow.id,stateId:current.stateId,selection:JSON.stringify(current.selected?.locator)}});
  }
  dispatch(command:Command):Promise<Snapshot> {
    const work=this.queue.then(()=>this.execute(command));this.queue=work.catch(()=>undefined);return work;
  }
  dispatchAt(selection:Selection,workflowId:string,stateId:string,command:Command):Promise<Snapshot>{
    const work=this.queue.then(()=>{
      if(this.workflow.id!==workflowId||this.stateId!==stateId)throw new Error('The workflow changed. Select the element again.');
      this.selected=selection;return this.execute(command);
    });this.queue=work.catch(()=>undefined);return work;
  }
  isAuthoring(){return this.selecting;}
  findSelected(){return this.selected?resolve(this.selected.locator,this.root,this.renderer.owned):null;}
  private async execute(c:Command):Promise<Snapshot> {
    if(this.dragData&&c.type!=='snapshot')this.cancelDrag();
    const editing=['prompt','text','child','link','rename','undo','redo','style','remove','drag','duplicateElement','mirror'];
    if(editing.includes(c.type)&&this.replay)throw new Error('Return to Edit to change the workflow.');
    if(['prompt','text','child','link','style','remove','drag','duplicateElement','mirror'].includes(c.type)&&!this.enabled)throw new Error('Enable the workflow before editing.');
    if(c.type==='snapshot')return this.snapshot();
    if(c.type!=='style')this.historyGroup=undefined;
    if(c.type==='escape'){
      if(!this.projectionActive)return this.snapshot();
      if(!this.interacting){
        this.interacting=true;this.picking=false;this.selected=null;this.hovered=null;this.replay=false;this.dragging=false;this.outline.style.display='none';this.emit();
      }else{
        // Checkpoint before closing; a failed write keeps the editor available.
        await this.checkpoint();
        if(this.options.requestClose)await this.options.requestClose();
        this.authoring=false;this.suspend();
      }
    }
    else if(c.type==='pick'){this.interacting=false;if(this.replay)throw new Error('Return to Edit to select elements.');this.projectionActive=true;this.picking=!this.picking;this.render();this.outline.style.display='none';}
    else if(c.type==='pause'){this.authoring=false;this.suspend();}
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
      if(!source||!source.matches('button,a,[role="button"],input:not([type="file"]),textarea,label'))throw new Error('Mirror a single button or input field, rather than a whole section.');
      this.commit(addOperation(this.workflow,this.stateId,OperationSchema.parse({id:uid(),kind:'mirror',target:this.selected.locator,source:insertion.target})));
    }
    else if(c.type==='duplicateElement'){
      const target=this.findSelected();if(!target||!this.selected)throw new Error('Select an item to duplicate first.');
      if(target===this.root||target.matches('html,body'))throw new Error('Select an item inside the page to duplicate.');
      const node={id:uid(),kind:'panel' as const,text:this.selected.label||'Copy',copy:captureCopy(target)};
      const op=OperationSchema.parse({id:uid(),kind:'insert',target:this.selected.locator,position:'after',node});
      this.commit(addOperation(this.workflow,this.stateId,op));
      const copied=this.renderer.owned.get(node.id);if(copied)this.select(copied);
    }
    else if(c.type==='reset'){
      this.cancelDrag();this.dragging=false;
      const next=clone(this.workflow);next.states=[{id:next.entry,title:'Existing application',parent:null,view:'base',operations:[]}];next.edges=[];
      this.selected=null;this.replay=false;this.picking=true;this.visits=[];this.commit(next,next.entry);
    }
    else if(c.type==='prompt'||c.type==='text') {
      if(!this.selected)throw new Error('Select an element on the page first.');
      if(c.type==='prompt'&&c.context&&(c.context.workflowId!==this.workflow.id||c.context.stateId!==this.stateId||c.context.selection!==JSON.stringify(this.selected.locator)))throw new Error('The page, state, or selection changed while planning. Submit the prompt again.');
      const selection=c.type==='prompt'&&c.scope?this.scopedSelection(c.scope):this.selected;
      const target=resolve(selection.locator,this.root,this.renderer.owned);
      if(!target)throw new Error('The selected element moved or is ambiguous. Select it again.');
      const ops=c.type==='prompt'?promptOperations(c.prompt,c.plan,target,selection.locator,this.root,this.renderer.owned):[operationFromPlan({kind:'text',position:'after',element:'text',text:c.text},this.selected.locator)];
      const op=ops.at(-1)!;
      if(ops.length===1&&op.kind==='text'&&!target.matches('input,textarea')&&!editableText(resolve(op.target,this.root,this.renderer.owned)||target))throw new Error('Double-click a specific text label to edit it.');
      if(op.kind==='insert'&&op.position==='inside'&&target.matches('button,a,input,textarea,select,img,br,hr'))throw new Error('Select a panel or container to add UI inside.');
      let next=this.workflow;for(const operation of ops)next=addOperation(next,this.stateId,operation);
      this.commit(next);
      if(op.kind==='remove'){this.selected=null;}else if(op.kind==='insert'){const node=this.renderer.owned.get(op.node.id);if(node)this.select(node);}else {const renamed=target.isConnected?target:resolve(op.target,this.root,this.renderer.owned);if(renamed)this.select(renamed);else this.selected=null;}
    }
    else if(c.type==='child') {
      const target=this.findSelected();if(!target||!this.selected||!target.matches('button,a,[role="button"]'))throw new Error('Select a button to define its click.');
      let source=this.selected.locator.owned||this.renderer.triggerFor(target),workflow=this.workflow;
      if(!source){source=uid();workflow=addOperation(workflow,this.stateId,{id:uid(),kind:'trigger',target:this.selected.locator,source});}
      const child=addChild(workflow,this.stateId,source,c.text);this.commit(child.workflow,child.stateId);this.visits=[];
      this.select(this.renderer.owned.get(`view:${child.stateId}`)!);this.renderer.owned.get(`view:${child.stateId}`)?.scrollIntoView?.({behavior:'smooth',block:'center'});
    }
    else if(c.type==='link') {
      const target=this.findSelected();if(!target||!this.selected||!target.matches('button,a,[role="button"]'))throw new Error('Select a button first.');
      let source=this.selected.locator.owned||this.renderer.triggerFor(target),workflow=this.workflow;
      if(!source){source=uid();workflow=addOperation(workflow,this.stateId,{id:uid(),kind:'trigger',target:this.selected.locator,source});}
      const next=clone(workflow);next.edges=next.edges.filter(e=>e.from!==this.stateId||e.source!==source);next.edges.push({id:uid(),from:this.stateId,source,to:c.id});this.commit(next);
    }
    else if(c.type==='state') {if(!this.workflow.states.some(s=>s.id===c.id))throw new Error('State not found.');this.stateId=c.id;this.selected=null;this.visits=[];this.render(true);}
    else if(c.type==='rename') {const next=clone(this.workflow);next.name=c.text.trim();this.commit(next);}
    else if(c.type==='undo'||c.type==='redo') {const next=this.history[c.type](this.workflow,this.stateId);if(next){this.workflow=next.workflow;this.stateId=next.stateId;this.selected=null;this.dirty=true;this.visits=[];this.render(true);}}
    else if(c.type==='replay'){this.interacting=false;this.projectionActive=true;this.cancelDrag();this.dragging=false;this.replay=true;this.picking=false;this.outline.style.display='none';this.selected=null;this.stateId=this.workflow.entry;this.visits=[];this.render(true);}
    else if(c.type==='edit'){this.interacting=false;this.authoring=true;this.projectionActive=true;this.replay=false;this.picking=true;this.render(true);}
    else if(c.type==='back'){const previous=this.visits.pop();if(previous){this.stateId=previous;this.selected=null;this.render(true);}}
    else if(c.type==='save'&&this.options.requestSave){this.options.requestSave();}
    else if(c.type==='save'||c.type==='saveTemporary'){this.record=await this.repository.save(this.workflow,this.enabled);this.workflow=clone(this.record.draft);await this.repository.setActive(this.workflow);this.dirty=false;this.library=await this.repository.list(this.url.origin,routeOf(this.url));}
    else if(c.type==='enabled'){this.enabled=c.value;this.cancelDrag();this.dragging=false;this.selected=null;this.picking=c.value&&this.authoring;this.outline.style.display='none';if(this.record){this.record.enabled=c.value;await this.repository.put(this.record);}this.render(true);}
    else if(c.type==='loadRecord'){
      const record=RecordSchema.parse(c.record);validateWorkflow(record.draft);record.versions.forEach(v=>validateWorkflow(v.workflow));
      if(record.draft.origin!==this.url.origin||record.draft.route!==routeOf(this.url))throw new Error('Open the matching application page before loading this flow.');
      await this.repository.put(record);await this.repository.setActive(record.draft);this.projectionActive=true;await this.loadRoute();
    }
    else if(c.type==='acknowledgeSave'){
      const record=RecordSchema.parse(c.record);if(record.draft.id!==this.workflow.id)throw new Error('Workflow changed during save.');
      validateWorkflow(record.draft);record.versions.forEach(v=>validateWorkflow(v.workflow));
      await this.repository.put(record);this.record=record;if(JSON.stringify(this.workflow)===JSON.stringify(c.expected))this.dirty=false;this.library=await this.repository.list(this.url.origin,routeOf(this.url));
    }
    else if(c.type==='restore'){this.record=await this.repository.restore(this.workflow.id,c.version);this.library=await this.repository.list(this.url.origin,routeOf(this.url));this.workflow=clone(this.record.draft);this.stateId=this.workflow.entry;this.history=new History();this.selected=null;this.dirty=false;this.visits=[];this.render(true);}
    else if(c.type==='load'){const draft=this.routeDrafts.get(c.id);if(draft&&draft.workflow.origin===this.url.origin&&draft.workflow.route===routeOf(this.url)){this.workflow=clone(draft.workflow);this.record=draft.record;this.dirty=draft.dirty;this.enabled=draft.enabled;this.stateId=this.workflow.entry;this.selected=null;this.history=new History();this.projectionActive=true;this.render(true);this.emit();return this.snapshot();}const record=await this.repository.get(c.id);if(!record || record.draft.origin!==this.url.origin || record.draft.route!==routeOf(this.url))throw new Error('Workflow does not match this page.');await this.repository.setActive(record.draft);this.projectionActive=true;await this.loadRoute();}
    else if(c.type==='duplicate'){const next=clone(this.workflow);next.id=uid();next.name+=' — copy';next.createdAt=new Date().toISOString();this.workflow=next;this.record=null;this.dirty=true;this.history=new History();this.render(true);}
    else if(c.type==='delete'){await this.repository.delete(this.workflow.id);this.record=null;this.workflow=createWorkflow(this.url);this.stateId=this.workflow.entry;this.dirty=false;this.selected=null;this.history=new History();this.library=await this.repository.list(this.url.origin,routeOf(this.url));this.render(true);}
    else if(c.type==='new'){this.workflow=createWorkflow(this.url);this.record=null;this.stateId=this.workflow.entry;this.selected=null;this.history=new History();this.visits=[];this.replay=false;this.enabled=true;this.dirty=false;this.render(true);}
    if(this.dirty&&editing.includes(c.type))this.scheduleDraft();
    this.emit();return this.snapshot();
  }
  destroy(){clearTimeout(this.draftTimer);window.removeEventListener('input',this.inputMirror,true);window.removeEventListener('change',this.inputMirror,true);if(this.selectionFrame!==undefined)window.cancelAnimationFrame(this.selectionFrame);this.selectionFrame=undefined;window.removeEventListener('scroll',this.paintSelection,true);window.removeEventListener('resize',this.paintSelection);this.selectionOutline.remove();this.pageEditor.destroy();this.cancelDrag();window.removeEventListener('pointerdown',this.dragStart,true);window.removeEventListener('pointermove',this.dragMove,true);window.removeEventListener('pointerup',this.dragEnd,true);window.removeEventListener('pointercancel',this.cancelDrag,true);window.removeEventListener('blur',this.blur);this.observer.disconnect();clearTimeout(this.timer);window.removeEventListener('click',this.handleClick,true);window.removeEventListener('pointermove',this.hover,true);window.removeEventListener('keydown',this.escape,true);window.removeEventListener('keyup',this.keyup,true);this.renderer.reset();this.outline.remove();this.listeners.clear();}
}
