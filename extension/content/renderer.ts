import type { Workflow, Operation, Locator } from '../shared/model';
import { lineage } from '../prototype/engine';
import { editableText } from './text';
import { resolve } from './locator';
const buttonStyle='display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid #b9c5f8;border-radius:8px;background:#edf0ff;color:#3446b3;font:600 13px/1.4 system-ui,sans-serif;padding:9px 14px;margin:4px;cursor:pointer;max-width:100%;white-space:normal;';
const panelStyle='display:block;box-sizing:border-box;min-width:0;border:1px solid #d5dcf5;border-radius:12px;padding:20px;margin:12px 0;background:#fff;color:#202638;font:14px/1.5 system-ui,sans-serif;box-shadow:0 3px 14px #283d7610;';
export class Renderer {
  owned=new Map<string,HTMLElement>();
  applied=new Map<string,{node?:HTMLElement;target:HTMLElement;before?:string;after?:string;textNode?:Text;attribute?:string;styles?:{key:string;before:string;priority:string;after:string}[]}>();
  private views=new Set<string>();
  forwarding=false;
  private mirrors=new Map<HTMLElement,Locator>();
  private triggers=new Map<HTMLElement,string>();
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

  constructor(public root:HTMLElement,private onClick:(id:string)=>void) {}
  idFor(el:Element) { for(const [id,node] of this.owned) if(node===el) return id; return undefined; }
  findOwned(el:Element) { let node:Element|null=el; while(node && node!==this.root.parentElement) { const id=this.idFor(node); if(id) return {id,node}; node=node.parentElement; } return null; }
  private make(id:string,kind:'button'|'panel'|'text'|'field',text:string) {
    const el=document.createElement(kind==='button'?'button':kind==='panel'?'section':kind==='field'?'label':'p');
    el.dataset.dxOwned=id; el.dataset.dxLabel=text;
    el.style.cssText=kind==='button'?buttonStyle:kind==='panel'?panelStyle:'display:block;color:#27314c;font:14px/1.6 system-ui,sans-serif;margin:10px 4px;';
    if(el instanceof HTMLButtonElement) el.type='button';
    // textContent is deliberate: model output can never become executable markup.
    el.textContent=text;
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
    const input=target.querySelector('input');if(input){input.placeholder=text;input.setAttribute('aria-label',text);}
  }
  reset() {
    for(const record of [...this.applied.values()].reverse()) {
      if(record.styles)for(const item of record.styles){if(record.target.style.getPropertyValue(item.key)===item.after){if(item.before)record.target.style.setProperty(item.key,item.before,item.priority);else record.target.style.removeProperty(item.key);}}
      if(record.attribute&&record.target.getAttribute(record.attribute)===record.after){if(record.before===undefined)record.target.removeAttribute(record.attribute);else record.target.setAttribute(record.attribute,record.before);}
      if(record.node) record.node.remove();
      else if(record.before!==undefined && record.textNode?.data===record.after) {record.textNode!.data=record.before;if(this.idFor(record.target))record.target.dataset.dxLabel=record.before;this.syncFieldLabel(record.target,record.before);}
    }
    for(const el of this.owned.values()) el.remove();
    this.applied.clear();this.mirrors.clear();this.triggers.clear();this.owned.clear();this.views.clear();
  }
  reconcile(w:Workflow,stateId:string):string[] {
    const errors:string[]=[];
    const chain=lineage(w,stateId);
    const finalText=new Map<Text,string>();
    for(const state of chain)for(const op of state.operations){const record=this.applied.get(op.id);if(op.kind==='text'&&record?.after!==undefined)record.textNode&&finalText.set(record.textNode,record.after);}
    const changedText=new Set([...finalText].filter(([target,text])=>target.isConnected&&target.data!==text).map(([target])=>target));
    for(const state of chain) {
      if(state.view==='panel' && !this.owned.get(`view:${state.id}`)?.isConnected) {
        const panel=this.make(`view:${state.id}`,'panel','');
        panel.dataset.dxLabel=state.title;
        const badge=document.createElement('span'); badge.textContent='PROTOTYPE STATE'; badge.style.cssText='font:600 10px system-ui;letter-spacing:1.5px;color:#77829d;';
        badge.dataset.dxIgnore='true';
        const heading=this.make(`heading:${state.id}`,'text',state.title);heading.style.cssText='font:600 22px/1.3 system-ui,sans-serif;margin:8px 0 16px;color:#202638;';
        panel.append(badge,heading);this.root.append(panel);this.views.add(state.id);
      }
      for(const op of state.operations) {
        const existing=this.applied.get(op.id);
        if(existing?.target.isConnected&&existing.attribute)continue;
        if(existing?.target.isConnected&&(existing.styles||op.kind==='mirror'||op.kind==='trigger'))continue;
        if(existing?.node?.isConnected && existing.target.isConnected) continue;
        if(existing && !existing.node && existing.target.isConnected && existing.textNode?.isConnected && op.kind==='text') {
          if(existing.textNode&&changedText.has(existing.textNode)) {
            if(!existing.textNode.isConnected){errors.push(`${op.text}: text changed on the host page`);continue;}
            existing.before=existing.textNode.data;existing.textNode.data=op.text;existing.after=op.text;this.syncFieldLabel(existing.target,op.text);
          }
          continue;
        }
        if(existing?.node) { existing.node.remove(); if(op.kind==='insert') this.owned.delete(op.node.id); }
        this.applied.delete(op.id);
        const target=resolve(op.target,this.root,this.owned);
        if(!target) { errors.push(`${op.kind==='insert'?op.node.text:op.kind==='text'?op.text:op.kind}: target missing or ambiguous`);continue; }
        try { this.apply(op,target); } catch(error) { errors.push(error instanceof Error?error.message:'Could not apply change.'); }
      }
    }
    return errors;
  }
  private apply(op:Operation,target:HTMLElement) {
    if(op.kind==='mirror'){this.mirrors.set(target,op.source);this.applied.set(op.id,{target});return;}
    if(op.kind==='trigger'){this.triggers.set(target,op.source);this.applied.set(op.id,{target});return;}
    if(op.kind==='style'||op.kind==='remove'){
      const properties:Record<string,string>={};
      if(op.kind==='remove')properties.display='none';
      else for(const [key,value] of Object.entries(op.style)){
        if(key==='x'||key==='y')continue;
        properties[key.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())]=typeof value==='number'?`${value}px`:value;
      }
      if(op.kind==='style'&&(op.style.x!==undefined||op.style.y!==undefined))properties.translate=`${op.style.x||0}px ${op.style.y||0}px`;
      if(op.kind==='style'&&(op.style.width!==undefined||op.style.height!==undefined||op.style.x!==undefined||op.style.y!==undefined)&&getComputedStyle(target).display==='inline')properties.display='inline-block';
      const styles=Object.entries(properties).map(([key,value])=>{const before=target.style.getPropertyValue(key),priority=target.style.getPropertyPriority(key);target.style.setProperty(key,value,'important');return {key,before,priority,after:target.style.getPropertyValue(key)};});
      this.applied.set(op.id,{target,styles});return;
    }
    if(op.kind==='text') {
      if(target.matches('input,textarea')){const before=target.getAttribute('placeholder')??undefined;target.setAttribute('placeholder',op.text);this.applied.set(op.id,{target,before,after:op.text,attribute:'placeholder'});return;}
      const textNode=editableText(target);if(!textNode)throw new Error('Double-click a specific text label to edit it.');
      const before=textNode.data;textNode.data=op.text;
      if(this.idFor(target)) target.dataset.dxLabel=op.text;
      this.syncFieldLabel(target,op.text);this.applied.set(op.id,{target,before,after:op.text,textNode});return;
    }
    if(op.position==='inside' && (target.matches('button,a,input,textarea,select,img,br,hr')||target.getAttribute('role')==='button')) throw new Error('Select a container to add UI inside it.');
    if(target.closest('table') && !target.closest('td,th')) throw new Error('Select a table cell or a container outside the table.');
    let node:HTMLElement;
    if(op.node.copy){
      const built:Node[]=[];
      for(const item of op.node.copy){
        const copy=item.tag==='#text'?document.createTextNode(item.text):document.createElement(item.tag);
        if(copy instanceof HTMLElement){
          copy.dataset.dxOwned=item.id;
          for(const [key,value] of Object.entries(item.style))copy.style.setProperty(key,value);
          if(copy instanceof HTMLButtonElement)copy.type='button';
          if(copy instanceof HTMLInputElement||copy instanceof HTMLTextAreaElement){if(copy instanceof HTMLInputElement)copy.type=item.inputType||'text';copy.placeholder=item.placeholder||'';copy.autocomplete='off';copy.addEventListener('keydown',e=>{if((e as KeyboardEvent).key==='Enter')e.preventDefault();});}
          this.owned.set(item.id,copy);
        }
        if(item.parent>=0)built[item.parent].appendChild(copy);built.push(copy);
      }
      node=built[0] as HTMLElement;this.owned.delete(op.node.copy[0].id);node.dataset.dxOwned=op.node.id;this.owned.set(op.node.id,node);
    }else node=this.make(op.node.id,op.node.kind,op.node.text);
    let insertion:HTMLElement=node;
    if(op.position==='below') { const wrap=document.createElement('div');wrap.dataset.dxOwned=`wrap:${op.id}`;wrap.style.cssText='display:block;flex-basis:100%;grid-column:1 / -1;width:100%;';wrap.append(node);insertion=wrap; }
    if(op.position==='inside') target.append(insertion);
    else if(op.position==='before') target.before(insertion);
    else target.after(insertion);
    this.applied.set(op.id,{node:insertion,target});
  }
  captureClick=(event:MouseEvent)=>{
    const target=event.target instanceof Element?this.findOwned(event.target):null;
    if(!target) return;
    if(event.target instanceof HTMLInputElement && target.node.tagName==='LABEL'){event.stopImmediatePropagation();return;}
    event.preventDefault();event.stopImmediatePropagation();this.onClick(target.id);
  };
}
