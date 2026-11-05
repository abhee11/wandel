import {mountPrototypePage,mountChartSection} from './prototypePage';
import {mountBlock,blockInteract} from './block';
import {Behaviors,safeDeclarations,choiceLabels} from './behavior';
import {applyArrangement} from './arrangement';
import {placeBelow,restoreInsertionStyles,type InsertionStyle} from './insertionPlacement';
import {applyTheme,restoreTheme,type ThemeStyle} from './theme';
import {configureField} from './fields';
import {mountControl} from './nativeControls';
import {applyAppearance,inspectLayout,buttonAppearance} from './nativeDesign';
import {mountChoices} from './nativeChoices';
import {mountSettings} from './settingsFeature';
import {copyDOM} from './copyDOM';
import {renderIcon} from './copyIcon';
import type { Workflow, Operation, Locator } from '../shared/model';
import { renderLineage, lineage } from '../prototype/engine';
import { editableText } from './text';
import { resolve } from './locator';
import {expectHidden,deferOwned,clearExpectations,expectation} from './visibility';
const buttonStyle='display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid #b9c5f8;border-radius:8px;background:#edf0ff;color:#3446b3;font:600 13px/1.4 system-ui,sans-serif;padding:9px 14px;margin:4px;cursor:pointer;max-width:100%;white-space:normal;';
const panelStyle='display:block;box-sizing:border-box;min-width:0;border:1px solid #d5dcf5;border-radius:12px;padding:20px;margin:12px 0;background:#fff;color:#202638;font:14px/1.5 system-ui,sans-serif;box-shadow:0 3px 14px #283d7610;';
export class Renderer {
  owned=new Map<string,HTMLElement>();
  applied=new Map<string,{node?:HTMLElement;target:HTMLElement;insertionStyles?:InsertionStyle[];icon?:{svg:SVGSVGElement;before:Node[];after:Node[];viewBox:string|null};placement?:{parent:Node;next:Node|null};orders?:{node:HTMLElement;before:string;priority:string;after:string}[];theme?:ThemeStyle[];before?:string;after?:string;textNode?:Text;attribute?:string;attributes?:{key:string;before:string|null;after:string|null}[];styles?:{node?:HTMLElement;key:string;before:string;priority:string;after:string}[]}>();
  private widgetCleanup=new Map<string,()=>void>();
  private views=new Set<string>();
  private templates=new Map<Text,string>();
  private bindings=new Map<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement,string>();
  readPrototypeInput(event:Event):{key:string;value:string}|undefined{
    const input=event.target;if(!(input instanceof HTMLInputElement||input instanceof HTMLTextAreaElement||input instanceof HTMLSelectElement))return;
    const key=this.bindings.get(input);return key?{key,value:input instanceof HTMLInputElement&&['checkbox','radio'].includes(input.type)?String(input.checked):input.value.slice(0,300)}:undefined;
  }
  updateData(data:Record<string,string>){
    for(const el of this.owned.values()){
      const walk=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n:Node|null;
      while((n=walk.nextNode()))if(n instanceof Text&&/\{\{[a-zA-Z][a-zA-Z0-9_]*\}\}/.test(n.data))this.templates.set(n,n.data);
    }
    for(const [node,template] of this.templates){if(!node.isConnected){this.templates.delete(node);continue;}const value=template.replace(/\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g,(_,key)=>Object.hasOwn(data,key)?data[key]:'');if(node.data!==value)node.data=value;}
    for(const [input,key] of this.bindings){const value=Object.hasOwn(data,key)?data[key]:'';if(input instanceof HTMLInputElement&&['checkbox','radio'].includes(input.type))input.checked=value==='true';else if(input.value!==value)input.value=value;}
  }
  forwarding=false;
  private mirrors=new Map<HTMLElement,Locator>();
  private triggers=new Map<HTMLElement,string>();
  sourcesFor(el:Element){const sources:string[]=[];for(let n:Element|null=el;n;n=n.parentElement){const id=this.idFor(n),trigger=this.triggers.get(n as HTMLElement);if(id)sources.push(id);if(trigger)sources.push(trigger);}return sources;}
  triggerFor(el:Element){for(let n:Element|null=el;n;n=n.parentElement){const id=this.triggers.get(n as HTMLElement);if(id)return id;}return undefined;}
  private mirrorFor(el:Element){for(let n:Element|null=el;n;n=n.parentElement){const locator=this.mirrors.get(n as HTMLElement);if(locator){const source=resolve(locator,this.root,this.owned);if(!source)throw new Error('The original mirrored control is missing or ambiguous. Return to Edit and reconnect it.');return source;}}return null;}
  forwardClick(el:Element){
    const source=this.mirrorFor(el);if(!source)return false;
    if(source.matches('input,textarea,label'))return false;
    const id=this.idFor(source)||this.triggerFor(source);this.forwarding=true;
    try{if(id)this.onClick(id);else source.click();}finally{this.forwarding=false;}return true;
  }
  forwardInput(event:Event){
    if(this.forwarding||!(event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement))return;
    const copy=event.target,root=this.mirrorFor(copy),source=root?.matches('input,textarea')?root:root?.querySelector('input,textarea');
    if(!(source instanceof HTMLInputElement||source instanceof HTMLTextAreaElement)||source===copy)return;
    this.forwarding=true;
    try{const key=source instanceof HTMLInputElement&&['checkbox','radio'].includes(source.type)?'checked':'value';
      const proto=source instanceof HTMLInputElement?HTMLInputElement.prototype:HTMLTextAreaElement.prototype;
      Object.getOwnPropertyDescriptor(proto,key)?.set?.call(source,key==='checked'?(copy as HTMLInputElement).checked:copy.value);
      source.dispatchEvent(new Event(event.type,{bubbles:true}));
    }finally{this.forwarding=false;}
  }

  constructor(public root:HTMLElement,private onClick:(id:string)=>void,private onChoice?:(id:string)=>void) {this.behaviors.onReveal=revealed=>this.checkRevealed(revealed);}
  /** Called with layout issues found in content a click or hover just revealed; an empty list means it rendered correctly. */
  onReveal?:(issues:string[],revealed:HTMLElement[])=>void;
  // Revealed content is validated like any other once it is on screen, after the browser has laid it out.
  private checkRevealed(revealed:HTMLElement[]){
    const settle=()=>{const live=revealed.filter(el=>el.isConnected&&!expectation(el));if(!live.length)return;const nodes=[...this.owned.values()].filter(node=>live.some(el=>el===node||el.contains(node)));this.onReveal?.(nodes.length?inspectLayout(nodes):[],live);};
    requestAnimationFrame(()=>requestAnimationFrame(settle));
  }
  idFor(el:Element) { for(const [id,node] of this.owned) if(node===el) return id; return undefined; }
  findOwned(el:Element) { let node:Element|null=el; while(node && node!==this.root.parentElement) { const id=this.idFor(node); if(id) return {id,node}; node=node.parentElement; } return null; }
  private make(id:string,kind:'button'|'panel'|'text'|'field',text:string,semanticTag?:'header'|'nav'|'a') {
    const el=document.createElement(semanticTag|| (kind==='button'?'button':kind==='panel'?'section':kind==='field'?'label':'p'));
    el.dataset.dxOwned=id; el.dataset.dxLabel=text;
    el.style.cssText=kind==='button'?buttonStyle:kind==='panel'?panelStyle:'display:block;color:#27314c;font:14px/1.6 system-ui,sans-serif;margin:10px 4px;';
    if(el instanceof HTMLButtonElement) el.type='button';
    // textContent is deliberate: model output can never become executable markup.
    if(semanticTag==='header'||semanticTag==='nav'){el.setAttribute('aria-label',text);el.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:20px;box-sizing:border-box;width:100%;padding:16px 0;color:inherit;';}else el.textContent=text;
    if(kind==='field') {
      el.style.cssText='display:flex;flex-direction:column;gap:6px;margin:10px 0;color:inherit;font:inherit;';
      const input=document.createElement('input');input.type='text';input.autocomplete='off';
      input.setAttribute('aria-label',text);input.placeholder=text;
      input.style.cssText='box-sizing:border-box;width:100%;min-width:0;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#202638;font:inherit;';
      // Deliberately no name/value persistence: these are prototype fields.
      input.addEventListener('keydown',event=>{if(event.key==='Enter')event.preventDefault();});
      el.append(input);
    }
    this.owned.set(id,el); return el;
  }
  private syncFieldLabel(target:HTMLElement,text:string){
    if(!this.idFor(target)||target.tagName!=='LABEL')return;
    const input=target.querySelector<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>('input,textarea,select');if(input){if(!(input instanceof HTMLSelectElement))input.placeholder=text;input.setAttribute('aria-label',text);}
  }
  readonly behaviors=new Behaviors();
  reset() {
    this.behaviors.reset();clearExpectations();
    for(const cleanup of this.widgetCleanup.values())cleanup();this.widgetCleanup.clear();
    for(const record of [...this.applied.values()].reverse()) {
      if(record.insertionStyles)restoreInsertionStyles(record.insertionStyles);
      const icon=record.icon;if(icon&&icon.after.every((node,index)=>icon.svg.childNodes[index]===node)&&icon.svg.childNodes.length===icon.after.length){icon.svg.replaceChildren(...icon.before);if(icon.viewBox===null)icon.svg.removeAttribute('viewBox');else icon.svg.setAttribute('viewBox',icon.viewBox);}
      for(const item of record.orders||[])if(item.node.style.getPropertyValue('order')===item.after){if(item.before)item.node.style.setProperty('order',item.before,item.priority);else item.node.style.removeProperty('order');}
      if(record.theme)restoreTheme(record.theme);
      if(record.styles)for(const item of [...record.styles].reverse()){const node=item.node||record.target;if(node.style.getPropertyValue(item.key)===item.after){if(item.before)node.style.setProperty(item.key,item.before,item.priority);else node.style.removeProperty(item.key);}}
      for(const item of record.attributes||[])if(record.target.getAttribute(item.key)===item.after){if(item.before===null)record.target.removeAttribute(item.key);else record.target.setAttribute(item.key,item.before);}
      if(record.attribute&&record.target.getAttribute(record.attribute)===record.after){if(record.before===undefined)record.target.removeAttribute(record.attribute);else record.target.setAttribute(record.attribute,record.before);}
      if(record.placement&&record.target.isConnected&&record.placement.parent.isConnected){const {parent,next}=record.placement;parent.insertBefore(record.target,next?.parentNode===parent?next:null);}
      if(record.node) record.node.remove();
      else if(record.before!==undefined && record.textNode?.data===record.after) {record.textNode!.data=record.before;if(this.idFor(record.target))record.target.dataset.dxLabel=record.before;this.syncFieldLabel(record.target,record.before);}
    }
    for(const el of this.owned.values()) el.remove();
    this.templates.clear();this.bindings.clear();this.applied.clear();this.mirrors.clear();this.triggers.clear();this.owned.clear();this.views.clear();
  }
  // A page may lay a full-card click target (an absolutely positioned, stacked overlay) over a card; controls added
  // inside that card, and page elements Wandel connected, are raised above it so their own clicks reach them.
  private raiseOverCovers(){
    // Page elements given a click connection or a forwarded action are click targets too, whatever their tag.
    const connected=new Set<HTMLElement>([...this.triggers.keys(),...this.mirrors.keys()]);
    for(const node of new Set([...this.owned.values(),...connected])){
      if(!node.isConnected||!connected.has(node)&&!node.matches('button,a,input,textarea,select,label,[role=button],[role=link],[role=checkbox],[role=radio]'))continue;
      const r=node.getBoundingClientRect();if(!r.width||!r.height)continue;let cover=0;
      for(let ancestor=node.parentElement,depth=0;ancestor&&depth<6&&!ancestor.matches('body,html');ancestor=ancestor.parentElement,depth++)for(const child of ancestor.children){
        if(!(child instanceof HTMLElement)||child.contains(node)||child.closest('[data-dx-owned]'))continue;const css=getComputedStyle(child),z=parseInt(css.zIndex,10);
        if(!['absolute','fixed'].includes(css.position)||Number.isNaN(z))continue;const c=child.getBoundingClientRect();
        if(c.left<=r.left+1&&c.right>=r.right-1&&c.top<=r.top+1&&c.bottom>=r.bottom-1)cover=Math.max(cover,z+1);
      }
      if(cover){if(getComputedStyle(node).position==='static')node.style.setProperty('position','relative','important');node.style.setProperty('z-index',String(cover),'important');}
    }
  }
  reconcile(w:Workflow,stateId:string,data:Record<string,string>=Object.fromEntries((w.variables||[]).map(v=>[v.key,v.value]))):string[] {
    const errors:string[]=[];
    const chain=renderLineage(w,stateId);
    const deferred=new Set<string>();
    const popupClosed=(locator:Locator)=>{const popup=locator.popup;if(!popup)return false;return ![...this.root.querySelectorAll<HTMLElement>('[role=listbox],[role=menu]')].some(el=>el.getAttribute('role')===popup.role&&(!popup.id||el.id===popup.id)&&(!popup.label||el.getAttribute('aria-label')===popup.label)&&el.getBoundingClientRect().height>0);};
    const choiceGroups=new Map<string,Set<string>>();for(const state of chain)for(const op of state.operations)if(op.kind==='choice'){const values=choiceGroups.get(op.group)||new Set<string>();values.add(op.text);choiceGroups.set(op.group,values);}
    this.behaviors.syncChoices(w.id,choiceGroups);
    const pageChoices=new Map<string,string>(),selectedChoices=new Map<string,string>();
    for(const state of chain)for(const op of state.operations)if(op.kind==='choice'){
      if(w.edges.some(edge=>edge.source===op.target.owned&&edge.from===chain.at(-1)?.id))pageChoices.set(op.group,op.originalText);
      if(w.edges.some(edge=>edge.source===op.target.owned&&chain.some(s=>s.id===edge.to)))selectedChoices.set(op.group,op.text);
    }
    for(const [group,text] of [...pageChoices,...selectedChoices])this.behaviors.setChoice(group,text);

    // Bind native elements against one DOM snapshot. Earlier operations in the
    // batch can change ancestor structure or descendant labels; those changes
    // must not make a later operation lose its already identified element.
    const nativeTargets=new Map<Locator,HTMLElement>();
    for(const state of chain)for(const op of state.operations){
      if(op.kind!=='choice'&&this.applied.get(op.id)?.target.isConnected)continue;
      for(const locator of [op.target,...(op.kind==='reorder'?[op.anchor]:op.kind==='choice'?[op.original,...(op.container?[op.container]:[]),...op.labels]:[])]){
        if(locator.owned||nativeTargets.has(locator))continue;
        const node=resolve(locator,this.root,this.owned);if(node)nativeTargets.set(locator,node);
      }
    }
    const finalText=new Map<Text,string>();
    for(const state of chain)for(const op of state.operations){const record=this.applied.get(op.id);if(op.kind==='text'&&record?.after!==undefined)record.textNode&&finalText.set(record.textNode,record.after);}
    const changedText=new Set([...finalText].filter(([target,text])=>target.isConnected&&target.data!==text).map(([target])=>target));
    for(const state of chain) {
      if(state.view==='panel' && !this.owned.get(`view:${state.id}`)?.isConnected) {
        const panel=this.make(`view:${state.id}`,'panel','');
        panel.dataset.dxLabel=state.title;
        if(state.presentation==='screen')panel.style.cssText+='position:fixed;inset:32px 16px 16px;z-index:2147483000;overflow:auto;margin:0;padding:32px clamp(20px,5vw,80px);isolation:isolate;';
        if(state.design)applyAppearance(panel,state.design.surface);if(state.presentation==='screen'){panel.style.setProperty('background-color',state.design?.surface['background-color']&&!['transparent','rgba(0, 0, 0, 0)'].includes(state.design.surface['background-color'])?state.design.surface['background-color']:'#fff');panel.style.width='auto';panel.style.height='auto';panel.style.maxWidth='none';panel.style.margin='0';panel.style.boxSizing='border-box';}
        const badge=document.createElement('span'); badge.textContent='PROTOTYPE STATE'; badge.style.cssText='font:600 10px system-ui;letter-spacing:1.5px;color:#77829d;';
        badge.dataset.dxIgnore='true';badge.dataset.dxBadge='true';
        const heading=document.createElement('h1');heading.dataset.dxOwned=`heading:${state.id}`;heading.textContent=state.title;this.owned.set(`heading:${state.id}`,heading);heading.style.cssText='font:600 22px/1.3 system-ui,sans-serif;margin:8px 0 16px;color:#202638;';
        if(state.design)applyAppearance(heading,state.design.heading);
        if(state.presentation==='modal'||state.presentation==='drawer'){
          // A modal sits centred over the page it opened from and a drawer along one edge; the outer shadow dims that page.
          const drawer=state.presentation==='drawer',side=state.copied?.side||'right',copied=!!state.copied;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',state.title);
          const place=drawer?`top:0;${side}:0;height:100vh;max-height:100vh;width:${copied?'auto':'min(440px,calc(100vw - 32px))'};max-width:calc(100vw - 32px);`:`left:50%;top:50%;transform:translate(-50%,-50%);width:${copied?'auto':'min(560px,calc(100vw - 32px))'};max-width:calc(100vw - 32px);max-height:calc(100vh - 64px);`;
          panel.style.cssText+=`position:fixed;${place}overflow:auto;z-index:2147483000;margin:0;box-sizing:border-box;${copied?`padding:0;border-radius:${state.copied!.radius||'0'};`:`padding:28px 28px 24px;border-radius:${drawer?'0':state.design?.surface['border-radius']&&parseFloat(state.design.surface['border-radius'])>0?state.design.surface['border-radius']:'16px'};`}box-shadow:0 0 0 100vmax rgba(17,16,30,.45)${copied?'':',0 24px 64px rgba(17,16,30,.3)'};`;
          // A dialog is a plain surface sized to its contents, whatever the card it opened from looked like; a copied one is the captured surface itself.
          for(const [key,value] of [['background-color',copied?'transparent':'#fff'],['background-image','none'],['height',drawer?'100vh':'auto'],['min-height','0'],['border',copied?'0':'']].filter(([,value])=>value))panel.style.setProperty(key,value,'important');
          if(copied&&drawer)panel.style.setProperty('display','flex','important');
          heading.style.margin='0 40px 12px 0';const close=document.createElement('button');close.type='button';close.dataset.dxOwned=`modal:${state.id}:close`;close.setAttribute('aria-label','Close');close.textContent='×';close.style.cssText='position:absolute;top:14px;right:14px;z-index:1;width:32px;height:32px;border:0;border-radius:8px;background:transparent;font:400 24px/1 system-ui;color:#55516a;cursor:pointer;';this.owned.set(`modal:${state.id}:close`,close);
          // A copy keeps its own title and close button; Wandel adds a close only when the copy has none.
          if(copied){if(!state.copied!.closes)panel.append(close);}else panel.append(close,heading);
        }else if(state.pageContent){panel.append(heading);mountPrototypePage(panel,state.id,state.pageContent,heading,(id,node)=>this.owned.set(id,node),this.onClick);}else panel.append(badge,heading);this.root.append(panel);this.views.add(state.id);
      }
      // The placeholder label marks an empty screen only; a designed screen reads as a page.
      const placeholder=this.owned.get(`view:${state.id}`)?.querySelector<HTMLElement>('[data-dx-badge]');if(placeholder)placeholder.hidden=state.operations.length>0;
      for(const op of state.operations) {
        const existing=this.applied.get(op.id);
        if(existing?.target.isConnected&&existing.theme)continue;
        if(existing?.target.isConnected&&(existing.attribute||existing.placement||existing.orders||existing.icon))continue;
        if(existing?.target.isConnected&&(existing.styles||op.kind==='mirror'||op.kind==='trigger'))continue;
        if(existing?.node?.isConnected && existing.target.isConnected) continue;
        if(existing && !existing.node && existing.target.isConnected && existing.textNode?.isConnected && op.kind==='text') {
          if(existing.textNode&&changedText.has(existing.textNode)) {
            if(!existing.textNode.isConnected){errors.push(`${op.text}: text changed on the host page`);continue;}
            existing.before=existing.textNode.data;existing.textNode.data=op.text;existing.after=op.text;this.syncFieldLabel(existing.target,op.text);
          }
          continue;
        }
        if(existing?.insertionStyles)restoreInsertionStyles(existing.insertionStyles);
        if(existing?.node) { existing.node.remove(); if(op.kind==='insert'){this.owned.delete(op.node.id);this.owned.delete('wrap:'+op.id);} }
        this.applied.delete(op.id);
        if(op.kind==='choice')this.behaviors.choiceTitle(op.group,op.labels.map(label=>resolve(label,this.root,this.owned)).filter((el):el is HTMLElement=>!!el&&!el.closest('[role=listbox],[role=menu],[role=option],[role=menuitemradio]')));
        const bound=nativeTargets.get(op.target),target=bound?.isConnected?bound:resolve(op.target,this.root,this.owned);
        if(!target&&(popupClosed(op.target)||!!op.target.owned&&deferred.has(op.target.owned))){if(op.kind==='insert'){deferred.add(op.node.id);deferOwned(op.node.id);for(const part of op.node.copy||[]){deferred.add(part.id);deferOwned(part.id);}}continue;}
        // A behavior that shows or hides content in a closed menu or unopened screen waits with that content; it is not missing.
        if(op.kind==='behavior'&&op.effects.some(effect=>!resolve(effect.target,this.root,this.owned)&&(popupClosed(effect.target)||!!effect.target.owned&&deferred.has(effect.target.owned))))continue;
        if(!target) { errors.push(`${op.kind==='insert'?op.node.text:op.kind==='text'?op.text:op.kind}: target missing or ambiguous`);continue; }
        try { this.apply(op,target,op.kind==='reorder'?nativeTargets.get(op.anchor):undefined,nativeTargets); } catch(error) { errors.push(error instanceof Error?error.message:'Could not apply change.'); }
      }
    }
    this.updateData(data);this.raiseOverCovers();
    this.recordExpectations(chain);
    // Copied markup contains layout helpers, empty spans and line breaks. Their
    // zero-sized boxes are not failed controls. Validate the copied unit and its
    // actual controls while retaining every part as an individually editable node.
    const copyParts=new Set(chain.flatMap(state=>state.operations.flatMap(op=>op.kind==='insert'&&op.node.copy?op.node.copy.slice(1).map(part=>part.id):[])));
    // Intentionally hidden content (until a click, by request, or in a closed disclosure) is skipped by inspectLayout and checked once shown.
    const inspected=[...this.owned].filter(([id,node])=>!copyParts.has(id)||node.matches('button,a,input,textarea,select,[role=button],[role=link],[role=checkbox],[role=radio]')).map(([,node])=>node);
    return [...errors,...inspectLayout(inspected)];
  }
  /** Tell layout inspection and the plan's checks which elements this prototype hides on purpose.
   * A click or hover that shows or toggles an element makes it hidden until interaction;
   * a requested hide keeps it hidden; a load-time hide that nothing ever reverses is reported. */
  private recordExpectations(chain:Workflow['states']){
    const revealed=new Set<HTMLElement>(),hiddenLater=new Set<HTMLElement>(),hiddenAtLoad=new Set<HTMLElement>();
    for(const state of chain)for(const op of state.operations){
      if(op.kind!=='behavior')continue;
      for(const effect of op.effects){
        if(effect.action!=='show'&&effect.action!=='hide'&&effect.action!=='toggle')continue;
        const el=resolve(effect.target,this.root,this.owned);if(!el)continue;
        if(op.event==='load'){if(effect.action!=='show')hiddenAtLoad.add(el);}
        else if(effect.action==='hide')hiddenLater.add(el);else revealed.add(el);
      }
    }
    for(const el of revealed)expectHidden(el,'interaction');
    for(const el of hiddenLater)expectHidden(el,'hidden');
    for(const el of hiddenAtLoad)expectHidden(el,'unrevealed');
    // Hidden by a requested style or remove; a reveal behavior above already marked those it shows.
    for(const record of this.applied.values())if(record.styles?.some(s=>s.key==='display'&&s.after==='none'))expectHidden(record.target,'hidden');
  }
  validateInputs(source:string){
    const button=this.owned.get(source)||[...this.triggers].find(([,id])=>id===source)?.[0];const view=button?.closest<HTMLElement>('form,article,section,[role=dialog],[data-dx-owned^="view:"]')||this.root;
    const inputs=[...view.querySelectorAll<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>('[data-dx-field]')].filter(input=>!input.closest('form')||input.closest('form')===button?.closest('form'));
    for(const input of inputs){if(!input.checkValidity()){input.setAttribute('aria-invalid','true');input.reportValidity();return false;}input.removeAttribute('aria-invalid');}return true;
  }
  private apply(op:Operation,target:HTMLElement,boundAnchor?:HTMLElement,bindings=new Map<Locator,HTMLElement>()) {
    if(op.kind==='theme'){this.applied.set(op.id,{target,theme:applyTheme(target,op.theme)});return;}
    if(op.kind==='reorder'){
      const anchor=boundAnchor?.isConnected?boundAnchor:resolve(op.anchor,this.root,this.owned);if(!anchor||anchor===target||target.contains(anchor))throw new Error('Choose a distinct destination outside the moved element.');
      if(op.position==='inside'&&anchor.matches('button,a,input,textarea,select,img,br,hr'))throw new Error('Choose a container as the destination.');
      // Keep framework-owned charts mounted when rearranging sibling layout
      // items. Detaching them can invalidate their responsive chart geometry.
      const parent=target.parentElement;
      if(op.position!=='inside'&&parent===anchor.parentElement&&parent&&['flex','inline-flex','grid','inline-grid'].includes(getComputedStyle(parent).display)){
        const items=[...parent.children].filter((node):node is HTMLElement=>node instanceof HTMLElement).sort((a,b)=>(parseInt(getComputedStyle(a).order)||0)-(parseInt(getComputedStyle(b).order)||0));
        items.splice(items.indexOf(target),1);items.splice(items.indexOf(anchor)+(op.position==='after'?1:0),0,target);
        const orders=items.map((node,index)=>{const before=node.style.getPropertyValue('order'),priority=node.style.getPropertyPriority('order'),after=String(index);node.style.setProperty('order',after,'important');return {node,before,priority,after};});
        this.applied.set(op.id,{target,orders});return;
      }
      const placement={parent:target.parentNode!,next:target.nextSibling};
      if(op.position==='inside')anchor.append(target);else if(op.position==='before')anchor.before(target);else anchor.after(target);
      this.applied.set(op.id,{target,placement});return;
    }
    if(op.kind==='mirror'){this.mirrors.set(target,op.source);this.applied.set(op.id,{target});return;}
    if(op.kind==='iconOnly'){
      if(!target.matches('a,button,[role=link],[role=button]')||!target.querySelector('svg'))throw new Error('Icon-only presentation needs a link or button with an icon.');
      const before=target.getAttribute('aria-label')??undefined,priorIconOnly=target.getAttribute('data-dx-icon-only');target.setAttribute('aria-label',op.text);target.setAttribute('data-dx-icon-only','true');
      const runs:{text:Text;wrapper:HTMLSpanElement}[]=[],walk=document.createTreeWalker(target,NodeFilter.SHOW_TEXT);let current:Node|null;
      while((current=walk.nextNode()))if(current instanceof Text&&current.data.trim()&&!current.parentElement?.closest('svg'))runs.push({text:current,wrapper:document.createElement('span')});
      for(const {text,wrapper} of runs){wrapper.dataset.dxIgnore='true';wrapper.style.cssText='position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip-path:inset(50%)!important;white-space:nowrap!important;border:0!important';text.replaceWith(wrapper);wrapper.append(text);}
      this.widgetCleanup.set(op.id,()=>{for(const {text,wrapper} of runs)if(wrapper.parentNode)wrapper.replaceWith(text);});
      this.applied.set(op.id,{target,before,after:op.text,attribute:'aria-label',attributes:[{key:'data-dx-icon-only',before:priorIconOnly,after:'true'}]});return;
    }
    if(op.kind==='tooltip'){
      const before=target.getAttribute('title')??undefined;target.setAttribute('title',op.text);this.applied.set(op.id,{target,before,after:op.text,attribute:'title'});return;
    }
    if(op.kind==='icon'){
      if(!target.querySelector('svg')&&target.matches('a,button,[role=link],[role=button]')){
        const svg=renderIcon(op.icon);svg.dataset.dxIgnore='true';svg.style.cssText='display:inline-block;width:1em;height:1em;flex-shrink:0;vertical-align:-0.125em;margin-inline-end:0.4em;pointer-events:none';target.prepend(svg);this.applied.set(op.id,{target,node:svg as unknown as HTMLElement});return;
      }
      const icons=target.querySelectorAll('svg');if(icons.length!==1)throw new Error('The badge icon is missing or ambiguous.');const svg=icons[0],box=svg.getBoundingClientRect();if(box.width>64||box.height>64)throw new Error('Only small UI icons can be replaced.');
      const before=[...svg.childNodes],viewBox=svg.getAttribute('viewBox'),replacement=renderIcon(op.icon),after=[...replacement.childNodes];svg.setAttribute('viewBox',op.icon.viewBox);svg.replaceChildren(...after);this.applied.set(op.id,{target,icon:{svg,before,after,viewBox}});return;
    }
    if(op.kind==='css'){
      const styles=safeDeclarations(op.css).map(([key,value])=>{const before=target.style.getPropertyValue(key),priority=target.style.getPropertyPriority(key);target.style.setProperty(key,value,'important');return {key,before,priority,after:target.style.getPropertyValue(key)};});
      if(!styles.length)throw new Error('The style change had no usable CSS.');this.applied.set(op.id,{target,styles});return;
    }
    if(op.kind==='choice'){
      // The original option and the title live in the app's own markup; when the menu is closed they are simply not there yet.
      const original=bindings.get(op.original)||this.behaviors.choiceOriginal(op.group)||resolve(op.original,this.root,this.owned),carrier=resolve(op.carrier,this.root,this.owned)||target;
      if(original){const container=op.container?resolve(op.container,this.root,this.owned)||undefined:undefined;const labels=op.labels.map(label=>resolve(label,this.root,this.owned)).filter((el):el is HTMLElement=>!!el&&!el.closest('[role=listbox],[role=menu],[role=option],[role=menuitemradio]'));this.behaviors.addChoice(op.group,{original,container,item:target,carrier,text:op.text,originalText:op.originalText,background:op.background,labels:labels.length?labels:container?choiceLabels(this.root,container,[op.originalText,op.text]):[]});}
      this.applied.set(op.id,{target});return;
    }
    if(op.kind==='behavior'){
      const effects=op.effects.map(effect=>{const el=resolve(effect.target,this.root,this.owned);if(!el)throw new Error('An element this behavior changes is missing.');return {action:effect.action,el,...(effect.value!==undefined?{value:effect.value}:{})};});
      this.behaviors.add(target,op.event,effects,op.id);this.applied.set(op.id,{target});return;
    }
    // A connected page element shows the pointer a link would; the reset restores its own cursor.
    if(op.kind==='trigger'){this.triggers.set(target,op.source);const before=target.style.getPropertyValue('cursor'),priority=target.style.getPropertyPriority('cursor');target.style.setProperty('cursor','pointer');this.applied.set(op.id,{target,styles:[{key:'cursor',before,priority,after:target.style.getPropertyValue('cursor')}]});return;}
    if(op.kind==='style'||op.kind==='remove'||op.kind==='appearance'){
      const properties:Record<string,string>={};
      if(op.kind==='remove')properties.display='none';
      else for(const [key,value] of Object.entries(op.style)){
        if(op.kind==='appearance'){properties[key]=String(value);continue;}
        if(key==='x'||key==='y')continue;
        properties[key.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())]=typeof value==='number'&&!['fontWeight','lineHeight','opacity','order','flexGrow','flexShrink'].includes(key)?`${value}px`:String(value);
      }
      if(op.kind==='style'&&(op.style.x!==undefined||op.style.y!==undefined)){properties.position=op.style.position||(getComputedStyle(target).position==='static'?'relative':getComputedStyle(target).position);properties['z-index']='1000';}
      if(op.kind==='style'&&(op.style.x!==undefined||op.style.y!==undefined))properties.translate=`${op.style.x||0}px ${op.style.y||0}px`;
      if(op.kind==='style'&&(op.style.width!==undefined||op.style.height!==undefined||op.style.x!==undefined||op.style.y!==undefined)&&getComputedStyle(target).display==='inline')properties.display='inline-block';
      // A new background colour replaces a gradient the element paints over it; images (logos, photos) stay.
      if(op.kind==='style'&&op.style.backgroundColor!==undefined&&/gradient\(/.test(getComputedStyle(target).backgroundImage))properties['background-image']='none';
      const styles=Object.entries(properties).map(([key,value])=>{const before=target.style.getPropertyValue(key),priority=target.style.getPropertyPriority(key);target.style.setProperty(key,value,'important');return {key,before,priority,after:target.style.getPropertyValue(key)};});
      if(op.kind==='style'&&op.arrangement)styles.push(...applyArrangement(target,op.arrangement));
      this.applied.set(op.id,{target,styles});return;
    }
    if(op.kind==='image'){
      if(!(target instanceof HTMLImageElement))throw new Error('Select an image to replace or crop.');
      const before=target.getAttribute('src')??undefined,fit=target.style.getPropertyValue('object-fit'),priority=target.style.getPropertyPriority('object-fit');
      const srcset=target.getAttribute('srcset');target.removeAttribute('srcset');target.setAttribute('src',op.src);target.style.setProperty('object-fit',op.fit,'important');
      this.applied.set(op.id,{target,before,after:op.src,attribute:'src',attributes:[{key:'srcset',before:srcset,after:null}],styles:[{key:'object-fit',before:fit,priority,after:op.fit}]});return;
    }
    if(op.kind==='text') {
      if(target.matches('input,textarea')){const before=target.getAttribute('placeholder')??undefined;target.setAttribute('placeholder',op.text);this.applied.set(op.id,{target,before,after:op.text,attribute:'placeholder'});return;}
      const textNode=editableText(target,op.target.textPath);if(!textNode)throw new Error('Double-click a specific text label to edit it.');
      const before=textNode.data;textNode.data=op.text;
      if(this.idFor(target)) target.dataset.dxLabel=op.text;
      this.syncFieldLabel(target,op.text);this.applied.set(op.id,{target,before,after:op.text,textNode});return;
    }
    if(op.position==='inside' && (target.matches('button,a,input,textarea,select,img,br,hr')||target.getAttribute('role')==='button')) throw new Error('Select a container to add UI inside it.');
    if(target.closest('table') && !target.closest('td,th')) throw new Error('Select a table cell or a container outside the table.');
    let node:HTMLElement;
    if(op.node.copy){
      node=copyDOM(op.node.copy,this.owned);this.owned.delete(op.node.copy[0].id);node.dataset.dxOwned=op.node.id;this.owned.set(op.node.id,node);
    }else node=this.make(op.node.id,op.node.kind,op.node.text,op.node.semanticTag);
    if(op.node.href){if(!(node instanceof HTMLAnchorElement))throw new Error('Only a link can have a navigation destination.');node.setAttribute('href',op.node.href);}
    // A link with no destination is a prototype menu item: still reachable and announced as a link.
    else if(node instanceof HTMLAnchorElement){node.setAttribute('role','link');node.tabIndex=0;}
    if(op.node.appearance){if(op.node.kind==='button'){for(const [key,value]of Object.entries(buttonAppearance(op.node.appearance)))node.style.setProperty(key,value,'important');node.style.setProperty('cursor','pointer','important');node.style.setProperty('min-height','40px','important');}else{node.style.border='0';node.style.boxShadow='none';node.style.backgroundColor='transparent';node.style.color='inherit';node.style.font='inherit';applyAppearance(node,op.node.appearance);}}
    if(op.node.kind==='field'&&!op.node.copy){const field=configureField(node,op.node);field.dataset.dxOwned=op.node.id+':input';this.owned.set(op.node.id+':input',field);if(op.node.binding)this.bindings.set(field,op.node.binding);}
    if(op.node.control)mountControl(node,op.node);
    if(op.node.chart)mountChartSection(node,op.node.chart);
    if(op.node.block)mountBlock(node,op.node.block,(id,part)=>this.owned.set(id,part));
    if(op.node.grid)node.style.setProperty('grid-column',`${op.node.grid.start} / span ${op.node.grid.span}`,'important');
    if(op.node.isolated){
      const canvas=document.createElement('div');canvas.dataset.dxCanvas='true';canvas.style.cssText='position:fixed!important;inset:52px 16px 16px!important;z-index:2147483000!important;overflow:auto!important;isolation:isolate!important;background:#f4f3f8!important;border:1px solid #d6d3e3!important;border-radius:16px!important;box-shadow:0 15px 80px #18122e44!important;padding:24px!important;';
      canvas.append(node);this.root.append(canvas);this.applied.set(op.id,{node:canvas,target});return;
    }
    let insertion:HTMLElement=node,insertionStyles:InsertionStyle[]|undefined;
    if(op.position==='below'){const placed=placeBelow(target,node,op.id);insertion=placed.wrap;insertionStyles=placed.styles;this.owned.set('wrap:'+op.id,placed.wrap);}
    if(op.position==='inside') target.append(insertion);
    else if(op.position==='before') target.before(insertion);
    else target.after(insertion);
    if(op.node.choices)mountChoices(node,op.node.choices,op.node.text,(id,button)=>this.owned.set(id,button),this.onChoice);
    if(op.node.widget){this.widgetCleanup.get(op.id)?.();this.widgetCleanup.set(op.id,mountSettings(node,target,op.node.widget));}
    this.applied.set(op.id,{node:insertion,target,insertionStyles});
  }
  captureClick=(event:MouseEvent)=>{
    // Tiles, choices and disclosures inside composed blocks keep local prototype state.
    const behaviors=this.behaviors.forClick(event.composedPath()[0] instanceof Element?event.composedPath()[0] as Element:event.target as Element);if(behaviors){event.preventDefault();event.stopImmediatePropagation();for(const b of behaviors)this.behaviors.run(b.effects,b.key);return;}
    // A tab or menu item also follows its connection, if it has one, after showing its new state.
    if(blockInteract(event.target)&&!(event.target instanceof Element&&event.target.closest('[data-dx-tab],[data-dx-menu-item]'))){event.preventDefault();event.stopImmediatePropagation();return;}
    // One tab or menu item of a composed part is its own source; the session falls back to the whole part.
    const item=event.target instanceof Element?event.target.closest<HTMLElement>('[data-dx-tab],[data-dx-menu-item]'):null,part=item?.closest<HTMLElement>('[data-dx-block] [data-dx-owned]');
    const inner=event.composedPath()[0];if(inner instanceof Element&&inner.getRootNode() instanceof ShadowRoot){const root=inner.getRootNode() as ShadowRoot,host=root.host as HTMLElement,option=inner.closest('[data-option]');if(host.dataset.dxCustom&&host.dataset.dxOwned&&option){event.preventDefault();event.stopImmediatePropagation();const label=option.getAttribute('data-option');this.onClick(host.dataset.dxOwned+'#'+[...root.querySelectorAll('[data-option]')].findIndex(o=>o.getAttribute('data-option')===label));return;}}
    if(item&&part?.dataset.dxOwned){event.preventDefault();event.stopImmediatePropagation();this.onClick(part.dataset.dxOwned+'#'+[...item.parentElement!.children].filter(child=>child.matches('[data-dx-tab],[data-dx-menu-item]')).indexOf(item));return;}
    const target=event.target instanceof Element?this.findOwned(event.target):null;
    if(!target) return;
    const link=event.target instanceof Element?event.target.closest('a[href]'):null;if(link&&this.idFor(link))return;
    if((event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement||event.target instanceof HTMLSelectElement) && target.node.tagName==='LABEL'){event.stopImmediatePropagation();return;}
    event.preventDefault();event.stopImmediatePropagation();this.onClick(target.id);
  };
}
