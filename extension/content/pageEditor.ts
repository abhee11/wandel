import type { Session } from './session';
import { lineage } from '../prototype/engine';
import { describe } from './locator';
import { editableText } from './text';
import { uid, type Command, type Selection, type Snapshot } from '../shared/model';

/** Isolated page chrome: never attaches editable fields or form events to the host app. */
export class PageEditor {
  readonly host=document.createElement('div');
  readonly shadow=this.host.attachShadow({mode:'open'});
  private bar=document.createElement('div');
  private handles=document.createElement('div');
  private scope:'element'|'section'|'page'='element';
  private message=document.createElement('div');
  private selectionKey='';
  private placement:'auto'|'after'|'before'|'inside'|'below'='auto';
  private inserting=false;
  private current:Snapshot;
  private unsubscribe:()=>void;
  private editing:{input:HTMLTextAreaElement;target:HTMLElement;selection:Selection;workflowId:string;stateId:string;original:string}|null=null;
  constructor(private session:Session){
    this.host.dataset.dxIgnore='true';this.host.dataset.dxEditor='true';
    this.host.style.cssText='all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
    const css=document.createElement('style');css.textContent=`
      [hidden]{display:none!important}:host{font:12px/1.4 system-ui;color:#252b3b}*{box-sizing:border-box}button,input,select,textarea{font:inherit}button{cursor:pointer}button:disabled{opacity:.4;cursor:default}
      .bar{font:12px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;position:fixed;display:flex;gap:3px;align-items:center;flex-wrap:wrap;max-width:calc(100vw - 24px);padding:5px;background:#fff;border:1px solid #daddea;border-radius:10px;box-shadow:0 5px 24px #25304426;pointer-events:auto}
      button,summary{border:0;border-radius:6px;padding:6px 8px;background:transparent;color:#555674;white-space:nowrap}button:hover,summary:hover{background:#f0effb}summary{cursor:pointer;list-style:none}summary::-webkit-details-marker{display:none}details{position:relative}.menu{position:absolute;left:0;top:34px;width:245px;padding:12px;background:#fff;border:1px solid #dddfea;border-radius:9px;box-shadow:0 6px 22px #25304426;max-height:55vh;overflow:auto}.right .menu{left:auto;right:0}
      label{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;color:#6a7187;margin:8px 0}input,select{width:100%;min-width:0;border:1px solid #dfe2ec;border-radius:5px;padding:5px;background:white;color:#3e465b}input[type=color]{width:42px;height:27px;padding:2px}input[type=number]{width:80px}.row{display:flex;gap:5px;margin:7px 0}.hint{color:#969cb0;font-size:10px;margin:7px 0}.divider{height:18px;width:1px;background:#e6e7ee;margin:0 2px}.message{font:12px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;position:fixed;bottom:15px;left:15px;background:#fff3e3;color:#875c28;border:1px solid #ebd4b6;border-radius:8px;padding:10px;max-width:330px;pointer-events:auto}.inline{position:fixed;resize:none;margin:0;border:2px solid #6b64d8;border-radius:3px;padding:0 2px;outline:none;background:#fff;color:#252b3b;pointer-events:auto;box-shadow:0 0 0 3px #7770df22}
      .context-prompt{flex-basis:100%;display:flex;gap:5px;border-top:1px solid #efedf5;padding:6px 2px 0;margin-top:2px}.context-prompt select{width:110px;font-size:11px}.context-prompt label{margin:0;flex:1;font-size:0}.context-prompt input{font-size:12px;min-width:160px}.crumbs{flex-basis:100%;display:flex;max-width:440px;overflow:auto;border-bottom:1px solid #efedf5;padding-bottom:4px}.crumbs button{font-size:10px}.handle{position:fixed;pointer-events:auto;border:1px solid #7770df;background:white;color:#6357c5;box-shadow:0 2px 6px #0002;padding:0;display:grid;place-items:center}.resize-handle{width:12px;height:12px;border-radius:2px;cursor:nwse-resize}.insert-handle{width:20px;height:20px;border-radius:50%;font:16px system-ui}.bar{max-width:min(480px,calc(100vw - 24px))}
      .quick-add{display:grid;grid-template-columns:1fr 1fr;gap:6px}.quick-add button{display:flex;align-items:center;justify-content:space-between;border:1px solid #e6e5f0;background:#faf9ff;padding:10px;font-weight:500}.quick-add kbd{font:10px system-ui;color:#9692ad;background:#eeeaf9;border-radius:3px;padding:1px 4px}.places{display:flex;gap:3px;flex-wrap:wrap;border-top:1px solid #efedf5;padding-top:9px;margin-top:10px}.places button{font-size:10px;padding:5px 6px}.places button[aria-pressed=true]{background:#eeebff;color:#6357c5}.add-title{font-size:10px;font-weight:600;color:#706982;margin:0 0 9px}.hint{line-height:1.5}
    `;
    this.bar.className='bar';this.bar.setAttribute('role','toolbar');this.bar.setAttribute('aria-label','Element actions');
    this.message.className='message';this.message.hidden=true;this.message.setAttribute('role','alert');
    this.shadow.append(css,this.bar,this.handles,this.message);document.documentElement.append(this.host);
    this.current=session.snapshot();this.unsubscribe=session.subscribe(s=>this.update(s));
    window.addEventListener('keydown',this.quickKey,true);window.addEventListener('dblclick',this.doubleClick,true);window.addEventListener('scroll',this.position,true);window.addEventListener('resize',this.position);
    this.shadow.addEventListener('toggle',this.position,true);
  }
  private error=(e:unknown)=>{this.message.textContent=e instanceof Error?e.message:'Change could not be applied.';this.message.hidden=false;this.message.style.left=this.bar.style.left||'12px';this.message.style.bottom='12px';};
  private run(c:Command){this.message.hidden=true;return this.session.dispatch(c).catch(this.error);}
  private boundRun(c:Command){const s=this.current;if(!s.selected)return Promise.resolve();this.message.hidden=true;return this.session.dispatchAt(s.selected,s.workflow.id,s.stateId,c).catch(this.error);}
  private button(text:string,label:string,action:()=>void,parent:HTMLElement=this.bar){const b=document.createElement('button');b.type='button';b.textContent=text;b.title=label;b.setAttribute('aria-label',label);b.onclick=action;parent.append(b);return b;}
  private menu(title:string,label:string){const details=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('div');summary.textContent=title;summary.title=label;summary.setAttribute('aria-label',label);body.className='menu';details.append(summary,body);this.bar.append(details);details.addEventListener('toggle',()=>{if(details.open){for(const other of this.bar.querySelectorAll('details'))if(other!==details)other.open=false;}});return body;}
  private input(label:string,parent:HTMLElement,type='text'){const row=document.createElement('label');row.textContent=label;const input=document.createElement('input');input.type=type;input.setAttribute('aria-label',label);row.append(input);parent.append(row);return input;}
  private select(label:string,options:[string,string][],parent:HTMLElement){const select=document.createElement('select');select.setAttribute('aria-label',label);for(const [value,text]of options){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}parent.append(select);return select;}
  private enterOrBlur(input:HTMLInputElement,action:(value:string)=>void){let last='';const commit=()=>{const value=input.value.trim();if(value&&value!==last){last=value;action(value);}};input.onblur=commit;input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();input.blur();}if(e.key==='Escape'){input.value='';input.blur();}};}
  private hex(color:string){if(/^#[a-f0-9]{6}$/i.test(color))return color;const parts=color.match(/[\d.]+/g);return parts&&parts.length>=3?'#'+parts.slice(0,3).map(n=>Math.round(Number(n)).toString(16).padStart(2,'0')).join(''):'#ffffff';}
  private update(s:Snapshot){
    this.current=s;const active=this.session.isAuthoring();this.bar.hidden=!active;this.host.style.display=active||s.replay?'block':'none';
    if(this.editing){if(!active||s.stateId!==this.editing.stateId||!this.editing.target.isConnected)this.finishInline(false);else{this.bar.hidden=true;return;}}
    const key=s.workflow.id+s.stateId+JSON.stringify(s.selected?.locator||null);
    if(key===this.selectionKey&&this.shadow.activeElement instanceof HTMLInputElement){for(const name of ['Undo','Redo']){const button=this.bar.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);if(button)button.disabled=s.replay||!(name==='Undo'?s.canUndo:s.canRedo);}this.position();return;}
    if(key!==this.selectionKey)this.scope='element';
    this.selectionKey=key;this.bar.replaceChildren();this.handles.replaceChildren();
    if(!active&&!s.replay)return;
    const crumbs=document.createElement('div');crumbs.className='crumbs';crumbs.setAttribute('aria-label','Flow steps');this.bar.append(crumbs);
    for(const [index,state] of lineage(s.workflow,s.stateId).entries()){const b=this.button(`${index?'› ':''}${state.title}`,`Go to ${state.title}`,()=>{void this.run({type:'state',id:state.id});},crumbs);b.disabled=s.replay;b.setAttribute('aria-current',String(state.id===s.stateId));}
    this.bar.hidden=false;
    const el=active?this.session.findSelected():null;
    if(el){
      if(editableText(el)||el.matches('input,textarea'))this.button('✎','Edit text in place',()=>this.startInline(el));
      const appearance=this.menu('◐','Appearance');const computed=getComputedStyle(el);
      for(const [key,label]of [['color','Text color'],['backgroundColor','Background color']]as const){const input=this.input(label,appearance,'color');input.value=this.hex(computed[key]);let group=uid();input.oninput=()=>{void this.boundRun({type:'style',style:{[key]:input.value},group});};input.onblur=()=>{group=uid();};}
      for(const [key,label]of [['width','Width'],['height','Height'],['fontSize','Font size']]as const){const input=this.input(label,appearance,'number');input.value=String(Math.round(parseFloat(computed[key])||0));input.min=key==='fontSize'?'6':'1';input.max=key==='fontSize'?'200':'4000';const group=uid();input.oninput=()=>{if(input.value&&input.validity.valid)void this.boundRun({type:'style',style:{[key]:Number(input.value)},group});};}
      const add=this.menu('+ Add','Add an element');const title=document.createElement('p');title.className='add-title';title.textContent='ADD AND START TYPING';add.append(title);
      const grid=document.createElement('div');grid.className='quick-add';add.append(grid);
      for(const [kind,label,key]of [['button','Button','B'],['text','Text','T'],['field','Input field','F'],['panel','Section','P']]as const){const button=this.button(label,`Add ${label.toLowerCase()} (${key})`,()=>{void this.quickInsert(kind);},grid);const shortcut=document.createElement('kbd');shortcut.textContent=key;button.append(shortcut);}
      const positions=document.createElement('div');positions.className='places';positions.setAttribute('aria-label','Insert position');add.append(positions);
      for(const [value,label]of [['auto','Auto'],['after','Beside'],['below','Below'],['inside','Inside'],['before','Before']]as const){const button=this.button(label,`Insert ${label.toLowerCase()}`,()=>{this.placement=value;for(const child of positions.querySelectorAll('button'))child.setAttribute('aria-pressed',String(child===button));},positions);button.setAttribute('aria-pressed',String(this.placement===value));button.disabled=value==='inside'&&el.matches('button,a,input,textarea,select,img,br,hr,[role="button"]');}
      const addHint=document.createElement('p');addHint.className='hint';addHint.textContent='Click a type, or press B · T · F · P on the page. A default name appears ready to edit. Auto places it inside containers or beside controls.';add.append(addHint);
      const ask=document.createElement('div');ask.className='context-prompt';
      const scope=this.select('Prompt target',[['element','This element'],['section','This section'],['page','Whole page']],ask);scope.value=this.scope;
      scope.onchange=()=>{this.scope=scope.value as typeof this.scope;this.session.highlightScope(this.scope);};
      const prompt=this.input('Change this element',ask);prompt.placeholder='What should change? ↵';prompt.maxLength=2000;
      prompt.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing&&prompt.value.trim()){
        e.preventDefault();prompt.disabled=true;this.message.hidden=true;
        void this.session.promptHere(prompt.value,this.scope).then(()=>{prompt.value='';}).catch(this.error).finally(()=>{prompt.disabled=false;});
      }};
      ask.style.order='2';this.bar.append(ask);
      if(el.matches('button,a,[role="button"]')){
        const next=this.menu('On click…','Click behavior');const title=this.input('New state',next);title.placeholder='State name, then Enter';this.enterOrBlur(title,text=>{void this.boundRun({type:'child',text});});
        const destination=this.select('Existing state',[['','Connect to…'],...s.workflow.states.map(st=>[st.id,st.title] as [string,string])],next);destination.onchange=()=>{if(destination.value)void this.boundRun({type:'link',id:destination.value});};
      }
      if(s.selected?.owned){const copy=s.workflow.states.flatMap(st=>st.operations).find(op=>op.kind==='insert'&&op.node.id===s.selected?.locator.owned);if(copy?.kind==='insert'&&copy.node.copy){const behavior=this.menu('Behavior','Copy behavior');const note=document.createElement('p');note.className='hint';note.textContent='Mirror forwards to the original control in Try flow. It can run the real app’s action. Typed field values are not saved.';behavior.append(note);this.button('Mirror original behavior','Mirror original behavior',()=>{void this.boundRun({type:'mirror'});},behavior);}}
      this.button('⧉','Duplicate item (Cmd/Ctrl+D)',()=>{void this.duplicate();});
      this.button('⌫','Remove element',()=>{void this.boundRun({type:'remove'});});
      const resize=this.button('','Drag to resize',()=>{},this.handles);resize.className='handle resize-handle';resize.onpointerdown=e=>this.session.beginGesture(el,'resize',e);
      for(const [position,label] of [['before','above'],['after','beside'],['below','below']] as const){const plus=this.button('+',`Add ${label} selection`,()=>{this.placement=position;(add.parentElement as HTMLDetailsElement).open=true;this.position();},this.handles);plus.className='handle insert-handle';plus.dataset.position=position;}
      const divider=document.createElement('span');divider.className='divider';this.bar.append(divider);
    }
    if(!el&&!s.replay&&s.library.length){const draft=s.library[0];if(draft.id!==s.workflow.id)this.button('Resume local draft','Resume local draft',()=>{void this.run({type:'load',id:draft.id});});}
    if(!el&&!s.replay){const hint=document.createElement('span');hint.textContent='Click an element on the page to edit it';hint.style.cssText='padding:6px 8px;color:#625c9a;';this.bar.append(hint);}
    this.button('↶','Undo',()=>{void this.run({type:'undo'});}).disabled=!s.canUndo||s.replay;
    this.button('↷','Redo',()=>{void this.run({type:'redo'});}).disabled=!s.canRedo||s.replay;
    this.button(s.replay?'✎ Edit':'▷ Try flow',s.replay?'Build':'Replay',()=>{void this.run({type:s.replay?'edit':'replay'});});
    const more=this.menu('⋯','Workflow actions');more.parentElement!.classList.add('right');
    const name=this.input('Workflow',more);name.value=s.workflow.name;name.disabled=s.replay;this.enterOrBlur(name,text=>{if(text!==this.current.workflow.name)void this.run({type:'rename',text});});
    const states=this.select('Current state',s.workflow.states.map(st=>[st.id,st.title]),more);states.value=s.stateId;states.disabled=s.replay;states.onchange=()=>{void this.run({type:'state',id:states.value});};
    this.button('Save version','Save version',()=>{void this.run({type:'save'});},more);
    if(s.versions.length){const versions=this.select('Restore version',[['','Restore version…'],...s.versions.map(v=>[String(v.number),`v${v.number} · ${v.name}`]as[string,string])],more);versions.onchange=()=>{if(versions.value&&(!s.dirty||confirm('Restore this version and discard unsaved changes?')))void this.run({type:'restore',version:Number(versions.value)});};}
    this.button('Restore original page','Restore original page',()=>{void this.run({type:'reset'});},more);
    if(s.replay)this.button('Back','Back one step',()=>{void this.run({type:'back'});},more).disabled=!s.canBack;
    this.position();
  }
  private position=()=>{
    const el=this.session.findSelected(),r=el?.getBoundingClientRect(),width=this.bar.offsetWidth||290;
    const left=r?Math.min(Math.max(12,r.left),Math.max(12,innerWidth-width-12)):12;
    const height=this.bar.offsetHeight||90;
    const top=r?Math.min(Math.max(12,r.bottom+26),Math.max(12,innerHeight-height-12)):Math.max(12,innerHeight-height-12);
    this.handles.hidden=!r||!this.session.isAuthoring()||!!this.editing;
    if(r)for(const handle of this.handles.querySelectorAll<HTMLElement>('.handle')){const pos=handle.dataset.position;const x=pos==='before'||pos==='below'?r.left+r.width/2:r.right;const y=pos==='before'?r.top:pos==='after'?r.top+r.height/2:r.bottom;handle.style.left=`${Math.max(4,Math.min(innerWidth-24,x-(pos?10:6)))}px`;handle.style.top=`${Math.max(4,Math.min(innerHeight-24,y-(pos?10:6)))}px`;}
    this.bar.style.left=`${left}px`;this.bar.style.top=`${top}px`;
    for(const menu of this.bar.querySelectorAll<HTMLElement>('.menu')){menu.style.top=top>innerHeight/2?'auto':'34px';menu.style.bottom=top>innerHeight/2?'38px':'auto';menu.style.maxWidth=`${Math.max(180,innerWidth-24)}px`;menu.style.transform='';if((menu.parentElement as HTMLDetailsElement).open){const bounds=menu.getBoundingClientRect();const shift=bounds.right>innerWidth-12?innerWidth-12-bounds.right:bounds.left<12?12-bounds.left:0;menu.style.transform=`translateX(${shift}px)`;}}
  };
  private quickKey=(event:KeyboardEvent)=>{
    if(!this.session.isAuthoring()||event.defaultPrevented||event.isComposing||event.repeat||event.altKey||this.editing)return;
    const origin=event.composedPath()[0];if(origin instanceof Element&&origin.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'))return;
    if((event.metaKey||event.ctrlKey)&&!event.shiftKey&&event.key.toLowerCase()==='d'){event.preventDefault();event.stopImmediatePropagation();void this.duplicate();return;}
    if(event.metaKey||event.ctrlKey)return;
    const kind=({b:'button',t:'text',f:'field',p:'panel'} as const)[event.key.toLowerCase() as 'b'|'t'|'f'|'p'];
    if(!kind)return;event.preventDefault();event.stopImmediatePropagation();void this.quickInsert(kind);
  };
  private async duplicate(){
    if(this.inserting)return;
    const s=this.current;if(!s.selected){this.error(new Error('Select an item to duplicate first.'));return;}
    this.inserting=true;
    try{await this.session.dispatchAt(s.selected,s.workflow.id,s.stateId,{type:'duplicateElement'});const target=this.session.findSelected();if(target&&this.session.isAuthoring()){target.scrollIntoView?.({block:'nearest'});if(editableText(target)||target.matches('input,textarea'))this.startInline(target);}}
    catch(error){this.error(error);}finally{this.inserting=false;}
  }
  private async quickInsert(kind:'button'|'text'|'field'|'panel'){
    if(this.inserting)return;
    const s=this.current,el=this.session.findSelected();
    if(!s.selected||!el){this.error(new Error('Select where the new item should go, then press B for a button, T for text, F for an input, or P for a section.'));return;}
    this.inserting=true;this.message.hidden=true;
    const position=this.placement==='auto'?(el.matches('div,section,article,main,aside,nav,header,footer,form,fieldset,td,th,[role="form"]')?'inside':'after'):this.placement;
    const text={button:'New button',text:'Your text here',field:'New field',panel:'New section'}[kind];
    try{
      const result=await this.session.dispatchAt(s.selected,s.workflow.id,s.stateId,{type:'prompt',prompt:'',plan:{steps:[{kind:'insert',target:'selected',position,element:kind,text,style:null}]}});
      if(result.workflow.id===s.workflow.id&&result.stateId===s.stateId&&this.session.isAuthoring()){
        const target=this.session.findSelected();if(target?.dataset.dxOwned){target.scrollIntoView?.({block:'nearest',inline:'nearest'});this.startInline(target);}
      }
    }catch(error){this.error(error);}finally{this.inserting=false;}
  }
  private doubleClick=(event:MouseEvent)=>{
    const target=event.target instanceof HTMLElement?event.target:event.target instanceof Element?event.target.closest<HTMLElement>('button,a,[role="button"]'):null;
    if(!this.session.isAuthoring()||!target||!this.session.root.contains(target)||target.closest('[data-dx-ignore]'))return;
    event.preventDefault();event.stopImmediatePropagation();this.startInline(target);
  };
  private startInline(target:HTMLElement){
    if(this.editing)this.finishInline(true);
    const node=editableText(target),field=target.matches('input,textarea');if(!node&&!field){this.error(new Error('Double-click the specific text label inside this element.'));return;}
    const rect=target.getBoundingClientRect(),css=getComputedStyle(target),input=document.createElement('textarea');input.className='inline';input.setAttribute('aria-label','Edit text');input.maxLength=300;input.value=field?(target.getAttribute('placeholder')||'New field'):node!.data.trim();
    Object.assign(input.style,{left:`${rect.left}px`,top:`${rect.top}px`,width:`${Math.max(90,rect.width)}px`,height:`${Math.max(30,rect.height)}px`,font:css.font||`${css.fontSize} ${css.fontFamily}`,color:css.color,lineHeight:css.lineHeight});
    this.editing={input,target,selection:describe(target,this.session.renderer.idFor(target)),workflowId:this.current.workflow.id,stateId:this.current.stateId,original:input.value};
    this.bar.hidden=true;this.handles.hidden=true;this.shadow.append(input);input.focus();input.select();
    input.onkeydown=e=>{e.stopPropagation();if(e.isComposing)return;if(e.key==='Escape'){e.preventDefault();this.finishInline(false);}else if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();this.finishInline(true);}};
    input.onblur=()=>this.finishInline(true);
  }
  private finishInline(commit:boolean){
    const edit=this.editing;if(!edit)return;this.editing=null;edit.input.onblur=null;const value=edit.input.value;edit.input.remove();
    if(commit&&value.trim()&&value!==edit.original){void this.session.dispatchAt(edit.selection,edit.workflowId,edit.stateId,{type:'text',text:value}).catch(this.error).finally(()=>this.update(this.session.snapshot()));}else this.update(this.current);
  }
  destroy(){this.finishInline(false);this.unsubscribe();window.removeEventListener('keydown',this.quickKey,true);window.removeEventListener('dblclick',this.doubleClick,true);window.removeEventListener('scroll',this.position,true);window.removeEventListener('resize',this.position);this.host.remove();}
}
