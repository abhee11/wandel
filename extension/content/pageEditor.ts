import {isTextEntry} from '../shared/keyboard';
import {ConnectionEditor} from './connectionEditor';
import {eventsFor} from './connections';
import {freeBuild} from '../shared/build';
import type { Session } from './session';
import { describe } from './locator';
import { editableText, textAtPoint, textPath } from './text';
import { canAlignText, canAlignVertically } from './textAlignment';
import { uid, type FieldType, type Command, type Selection, type Snapshot } from '../shared/model';

/** Isolated page chrome: never attaches editable fields or form events to the host app. */
export class PageEditor {
  readonly host=document.createElement('div');
  readonly shadow=this.host.attachShadow({mode:'open'});
  private bar=document.createElement('div');
  private handles=document.createElement('div');
  private scope:'element'|'section'|'page'='element';
  private message=document.createElement('div');
  private toast=document.createElement('div');
  private toastTimer:ReturnType<typeof setTimeout>|undefined;
  private selectionKey='';
  private placement:'auto'|'after'|'before'|'inside'|'below'='auto';
  private inserting=false;
  private current:Snapshot;
  private unsubscribe:()=>void;
  connectionAnchor(ratio:number){this.connectionEditor.anchor(ratio);}
  connectionAction(change:import('../shared/model').ConnectionAction){return this.connectionEditor.action(change);}
  private connectionActive=false;
  private connectionEditor:ConnectionEditor;
  private editing:{input:HTMLTextAreaElement;target:HTMLElement;selection:Selection;workflowId:string;stateId:string;original:string}|null=null;
  constructor(private session:Session){
    this.host.dataset.dxIgnore='true';this.host.dataset.dxEditor='true';
    this.host.style.cssText='all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
    const css=document.createElement('style');css.textContent=`
      [hidden]{display:none!important}:host{font:12px/1.4 system-ui;color:#252b3b}*{box-sizing:border-box}button,input,select,textarea{font:inherit}button{cursor:pointer}button:disabled{opacity:.4;cursor:default}
      .bar{z-index:2;font:12px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;position:fixed;display:flex;gap:3px;align-items:center;flex-wrap:wrap;max-width:calc(100vw - 24px);padding:5px;background:#fff;border:1px solid #daddea;border-radius:10px;box-shadow:0 5px 24px #25304426;pointer-events:auto}
      button,summary{border:0;border-radius:6px;padding:6px 8px;background:transparent;color:#555674;white-space:nowrap}button:hover,summary:hover{background:#f0effb}summary{cursor:pointer;list-style:none}summary::-webkit-details-marker{display:none}details{position:relative}.menu{position:absolute;left:0;top:34px;width:245px;padding:12px;background:#fff;border:1px solid #dddfea;border-radius:9px;box-shadow:0 6px 22px #25304426;max-height:55vh;overflow:auto}.right .menu{left:auto;right:0}
      label{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;color:#6a7187;margin:8px 0}input,select{width:100%;min-width:0;border:1px solid #dfe2ec;border-radius:5px;padding:5px;background:white;color:#3e465b}input[aria-invalid=true]{border-color:#cf3d59}input[type=color]{width:42px;height:27px;padding:2px}input[type=number]{width:80px}.row{display:flex;gap:5px;margin:7px 0}.hint{color:#969cb0;font-size:10px;margin:7px 0}.divider{height:18px;width:1px;background:#e6e7ee;margin:0 2px}.message{font:12px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;position:fixed;bottom:15px;left:15px;background:#fff3e3;color:#875c28;border:1px solid #ebd4b6;border-radius:8px;padding:10px;max-width:330px;pointer-events:auto}.inline{z-index:3;position:fixed;resize:none;margin:0;border:2px solid #6b64d8;border-radius:3px;padding:0 2px;outline:none;background:#fff;color:#252b3b;pointer-events:auto;box-shadow:0 0 0 3px #7770df22}
      .context-prompt{flex-basis:100%;display:flex;gap:5px;border-top:1px solid #efedf5;padding:6px 2px 0;margin-top:2px}.context-prompt select{width:110px;font-size:11px}.context-prompt label{margin:0;flex:1;font-size:0}.context-prompt input{font-size:12px;min-width:160px}.crumbs{flex-basis:100%;display:flex;max-width:440px;overflow:auto;border-bottom:1px solid #efedf5;padding-bottom:4px}.crumbs button{font-size:10px}.handle{position:fixed;pointer-events:auto;border:1px solid #7770df;background:white;color:#6357c5;box-shadow:0 2px 6px #0002;padding:0;display:grid;place-items:center}.resize-handle{width:12px;height:12px;border-radius:2px;cursor:nwse-resize}.insert-handle{width:20px;height:20px;border-radius:50%;font:16px system-ui}.bar{max-width:min(480px,calc(100vw - 24px))}
      .tool-row{display:flex;align-items:center;flex-wrap:wrap;gap:3px;flex-basis:100%}.tool-row+ .tool-row{border-top:1px solid #efedf5;padding-top:4px}.bar.control-bar{max-width:min(560px,calc(100vw - 24px))}.quick-add{display:grid;grid-template-columns:1fr 1fr;gap:6px}.quick-add button{display:flex;align-items:center;justify-content:space-between;border:1px solid #e6e5f0;background:#faf9ff;padding:10px;font-weight:500}.quick-add kbd{font:10px system-ui;color:#9692ad;background:#eeeaf9;border-radius:3px;padding:1px 4px}.places{display:flex;gap:3px;flex-wrap:wrap;border-top:1px solid #efedf5;padding-top:9px;margin-top:10px}.places button{font-size:10px;padding:5px 6px}.places button[aria-pressed=true]{background:#eeebff;color:#6357c5}.add-title{font-size:10px;font-weight:600;color:#706982;margin:0 0 9px}.hint{line-height:1.5}
    `;
    this.bar.className='bar';this.bar.setAttribute('role','toolbar');this.bar.setAttribute('aria-label','Element actions');
    this.message.className='message';this.message.hidden=true;this.message.setAttribute('role','alert');
    this.toast.className='message';this.toast.hidden=true;this.toast.setAttribute('role','status');this.toast.setAttribute('aria-live','polite');this.toast.style.cssText='background:#edf8f0;color:#276542;border-color:#b5dac2;z-index:10';
    this.shadow.append(css,this.bar,this.handles,this.message,this.toast);document.documentElement.append(this.host);
    this.connectionEditor=new ConnectionEditor(session,this.shadow,visible=>{this.connectionActive=visible;if(visible){this.bar.hidden=true;this.handles.hidden=true;}else if(this.current)this.update(this.current);});this.current=session.snapshot();this.unsubscribe=session.subscribe(s=>this.update(s));
    window.addEventListener('focusin',this.editorFocus,true);window.addEventListener('focusout',this.editorFocus,true);window.addEventListener('keydown',this.quickKey,true);window.addEventListener('dblclick',this.doubleClick,true);window.addEventListener('scroll',this.position,true);window.addEventListener('resize',this.position);
    this.shadow.addEventListener('toggle',this.position,true);
    this.shadow.addEventListener('keydown',e=>{const event=e as KeyboardEvent;if(event.key!=='Escape'||this.editing)return;event.preventDefault();event.stopPropagation();const open=this.bar.querySelector<HTMLDetailsElement>('details[open]');if(open){open.open=false;this.bar.querySelector<HTMLButtonElement>('button')?.focus();}else void this.run({type:'interact'});});
  }
  // Modal focus traps live in the host document. Keep Wandel's own UI isolated
  // while leaving focus events from the actual application untouched.
  private editorFocus=(event:FocusEvent)=>{
    if(this.session.isAuthoring()&&(event.composedPath().includes(this.host)||event.relatedTarget===this.host))event.stopImmediatePropagation();
  };
  private error=(e:unknown)=>{this.message.textContent=e instanceof Error?e.message:'Change could not be applied.';if(/sign in|authenticate this browser/i.test(this.message.textContent))this.button('Sign in to Wandel','Sign in to Wandel',()=>{void this.session.dispatch({type:'signIn'}).catch(this.error);},this.message);this.message.hidden=false;this.message.style.left=this.bar.style.left||'12px';this.message.style.bottom='12px';};
  success(message:string){clearTimeout(this.toastTimer);this.toast.textContent=message;this.toast.hidden=false;this.toastTimer=setTimeout(()=>{this.toast.hidden=true;},4000);}
  notify(message:string){this.error(new Error(message));}
  private run(c:Command){this.message.hidden=true;return this.session.dispatch(c).catch(this.error);}
  private boundRun(c:Command){const s=this.current;if(!s.selected)return Promise.resolve();this.message.hidden=true;return this.session.dispatchAt(s.selected,s.workflow.id,s.stateId,c).catch(this.error);}
  private button(text:string,label:string,action:()=>void,parent:HTMLElement=this.bar){const b=document.createElement('button');b.type='button';b.textContent=text;b.title=label;b.setAttribute('aria-label',label);b.onclick=action;parent.append(b);return b;}
  private menu(title:string,label:string){const details=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('div');summary.textContent=title;summary.title=label;summary.setAttribute('aria-label',label);body.className='menu';this.button('×','Close '+label.toLowerCase(),()=>{details.open=false;summary.focus();},body).style.cssText='float:right;padding:2px 6px;font-size:16px';details.append(summary,body);this.bar.append(details);details.addEventListener('toggle',()=>{if(details.open){for(const other of this.bar.querySelectorAll('details'))if(other!==details)other.open=false;}});return body;}
  private input(label:string,parent:HTMLElement,type='text'){const row=document.createElement('label');row.textContent=label;const input=document.createElement('input');input.type=type;input.setAttribute('aria-label',label);row.append(input);parent.append(row);return input;}
  private select(label:string,options:[string,string][],parent:HTMLElement){const select=document.createElement('select');select.setAttribute('aria-label',label);for(const [value,text]of options){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}parent.append(select);return select;}
  private enterOrBlur(input:HTMLInputElement,action:(value:string)=>void){let last='';const commit=()=>{const value=input.value.trim();if(value&&value!==last){last=value;action(value);}};input.onblur=commit;input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();input.blur();}if(e.key==='Escape'){input.value='';input.blur();}};}
  private plainText(el:HTMLElement){return !!editableText(el)&&!el.matches('button,a,[role=button],[role=link]')&&!el.querySelector('input,textarea,select');}
  private hex(color:string){if(/^#[a-f0-9]{6}$/i.test(color))return color;const parts=color.match(/[\d.]+/g);return parts&&parts.length>=3?'#'+parts.slice(0,3).map(n=>Math.round(Number(n)).toString(16).padStart(2,'0')).join(''):'#ffffff';}
  private update(s:Snapshot){
    this.current=s;if(s.panelMinimized){this.finishInline(false);this.bar.replaceChildren();this.handles.replaceChildren();this.bar.hidden=false;this.handles.hidden=true;this.host.style.display='block';this.bar.style.cssText='position:fixed;right:16px;bottom:16px;left:auto;top:auto;border-radius:28px;padding:6px;';this.button('W  Wandel ↗','Open Wandel panel',()=>{void this.run({type:'restorePanel'});});this.button('×','Close Wandel and keep draft',()=>{void this.run({type:'closeEditor'});});return;}this.handles.hidden=false;this.bar.style.removeProperty('right');this.bar.style.removeProperty('bottom');this.bar.style.removeProperty('padding');this.bar.style.removeProperty('border-radius');if(this.connectionActive){this.bar.hidden=true;this.handles.hidden=true;return;}const active=this.session.isAuthoring();this.bar.hidden=!active;this.host.style.display=s.panelMinimized||s.mode==='interact'||active||s.replay?'block':'none';
    if(this.editing){if(!active||s.stateId!==this.editing.stateId||!this.editing.target.isConnected)this.finishInline(false);else{this.bar.hidden=true;return;}}
    const key=(s.mode||'')+JSON.stringify(s.styleSource||null)+s.workflow.id+s.stateId+JSON.stringify(s.selected?.locator||null);
    if(key===this.selectionKey&&this.shadow.activeElement instanceof HTMLInputElement){for(const name of ['Undo','Redo']){const button=this.bar.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);if(button)button.disabled=s.replay||!(name==='Undo'?s.canUndo:s.canRedo);}this.position();return;}
    if(key!==this.selectionKey){this.scope='element';this.message.hidden=true;}
    this.selectionKey=key;this.bar.replaceChildren();this.handles.replaceChildren();
    if(s.mode==='interact'){
      const status=document.createElement('span');status.textContent='Interact · page clicks work';status.style.padding='0 6px';this.bar.append(status);
      if(s.canBack)this.button('← Back','Previous workflow step',()=>{void this.run({type:'back'});});
      this.button('−','Minimize Wandel panel',()=>{void this.run({type:'minimizePanel'});});
      this.button('Edit (E)','Resume selecting (V)',()=>{void this.run({type:'edit'});});
      this.button('×','Close Wandel and keep draft',()=>{void this.run({type:'closeEditor'});});this.bar.hidden=false;this.position();return;
    }
    if(!active&&!s.replay)return;
    if(active&&s.styleSource){const hint=document.createElement('span');hint.textContent='Style copied → Click a destination';hint.style.cssText='font-size:10px;color:#625c9a;';this.bar.append(hint);this.button('Cancel','Cancel style transfer',()=>{void this.run({type:'cancelStyle'});});this.position();return;}
    if(active){this.button('−','Minimize Wandel panel',()=>{void this.run({type:'minimizePanel'});});this.button('Interact (I)','Interact with page (V)',()=>{void this.run({type:'interact'});});}

    const crumbs=document.createElement('div');crumbs.className='crumbs';crumbs.setAttribute('aria-label','Flow steps');this.bar.append(crumbs);
    for(const [index,state] of s.workflow.states.entries()){const b=this.button(`${index?'› ':''}${state.title}`,`Go to ${state.title}`,()=>{void this.run({type:'state',id:state.id});},crumbs);b.disabled=s.replay;b.setAttribute('aria-current',String(state.id===s.stateId));}
    this.bar.hidden=false;
    const el=active?this.session.findSelected():null;
    if(el){
      if(eventsFor(el).length)this.button('Connect →','Connect to a view',()=>this.connectionEditor.open());
      let clickMenu:HTMLElement|undefined;
      if(editableText(el)||el.matches('input,textarea'))this.button('Text','Edit text in place',()=>this.startInline(el));
      const move=this.button('Move','Drag to move selected element',()=>{});move.style.cssText='cursor:grab;touch-action:none';move.onpointerdown=e=>{if(e.button===0)this.session.beginGesture(el,'move',e);};
      this.button('Copy style','Copy style',()=>{void this.boundRun({type:'copyStyle'});});
      const appearance=this.menu('Style','Appearance');const computed=getComputedStyle(el);
      for(const [key,label]of [['color','Text color'],['backgroundColor','Background color']]as const){
        const row=document.createElement('div');row.className='row';appearance.append(row);
        const input=this.input(label,row,'color');input.value=this.hex(computed[key]);
        const transparent=key==='backgroundColor'&&/^(transparent|rgba\(0, 0, 0, 0\))$/.test(computed[key]);input.style.opacity=transparent?'0.35':'1';input.title=transparent?'No fill — choose a color':label;const hex=this.input(label+' hex',row);hex.value=transparent?'':input.value;hex.placeholder=transparent?'No fill':'#7C3AED';hex.title='Use #RGB or #RRGGBB';hex.maxLength=7;hex.style.width='90px';hex.spellcheck=false;hex.parentElement!.firstChild!.textContent='Hex';for(const label of row.querySelectorAll('label'))label.style.cssText='flex-direction:column;align-items:flex-start;gap:3px;margin:4px 0';
        let group=uid();
        const apply=(value:string)=>{input.value=value;input.style.opacity='1';input.title=label;hex.placeholder='#7C3AED';void this.boundRun({type:'style',style:{[key]:value},group});};
        input.oninput=()=>{hex.value=input.value;hex.removeAttribute('aria-invalid');apply(input.value);};
        hex.oninput=()=>{const value=hex.value.trim().replace(/^#/,'');if(/^(?:[a-f0-9]{3}|[a-f0-9]{6})$/i.test(value)){hex.removeAttribute('aria-invalid');apply('#'+(value.length===3?value.split('').map(c=>c+c).join(''):value));}else hex.setAttribute('aria-invalid','true');};
        input.onblur=hex.onblur=()=>{group=uid();};
      }
      this.button('No fill','Clear background fill',()=>{void this.boundRun({type:'appearance',style:{'background-color':'transparent'}});},appearance);
      for(const [property,label,max]of [['border-radius','Corner radius',200],['padding','Padding',200]]as const){const input=this.input(label,appearance,'number');input.value=String(parseFloat(computed.getPropertyValue(property))||0);input.min='0';input.max=String(max);input.onchange=()=>{if(input.value&&input.validity.valid)void this.boundRun({type:'appearance',style:{[property]:input.value+'px'}});};}
      const weight=this.select('Font weight',[['400','Regular'],['500','Medium'],['600','Semibold'],['700','Bold']],appearance);weight.value=computed.fontWeight==='bold'?'700':computed.fontWeight;weight.onchange=()=>{void this.boundRun({type:'appearance',style:{'font-weight':weight.value}});};
      if(el.matches('a,[role="link"]')){const underline=this.button('Underline','Toggle link underline',()=>{void this.boundRun({type:'appearance',style:{'text-decoration-line':computed.textDecorationLine.includes('underline')?'none':'underline'}});},appearance);underline.setAttribute('aria-pressed',String(computed.textDecorationLine.includes('underline')));}
      for(const [key,label]of [['width','Width'],['height','Height'],['fontSize','Font size']]as const){const input=this.input(label,appearance,'number');input.value=String(Math.round(parseFloat(computed[key])||0));input.min=key==='fontSize'?'6':'1';input.max=key==='fontSize'?'200':'4000';const group=uid();input.oninput=()=>{if(input.value&&input.validity.valid)void this.boundRun({type:'style',style:{[key]:Number(input.value)},group});};}
      if(canAlignText(el)){
        const alignment=this.menu('Align','Text alignment');
        const horizontal=document.createElement('div');horizontal.className='row';horizontal.setAttribute('role','group');horizontal.setAttribute('aria-label','Horizontal alignment');alignment.append(horizontal);
        for(const value of ['left','center','right'] as const){const b=this.button(value,`Align text ${value}`,()=>{void this.boundRun({type:'alignText',horizontal:value});},horizontal);b.setAttribute('aria-pressed',String(computed.textAlign===value));}
        const vertical=document.createElement('div');vertical.className='row';vertical.setAttribute('role','group');vertical.setAttribute('aria-label','Vertical alignment');alignment.append(vertical);
        for(const value of ['top','middle','bottom'] as const){const b=this.button(value,`Align text ${value}`,()=>{void this.boundRun({type:'alignText',vertical:value});},vertical);b.disabled=!canAlignVertically(el);}
        const hint=document.createElement('p');hint.className='hint';hint.textContent=canAlignVertically(el)?'Vertical alignment uses the text box height. Resize it taller to see the effect.':'Vertical alignment is unavailable for native inputs or elements containing controls.';alignment.append(hint);
      }
      const add=this.menu('+ Add','Add an element');const title=document.createElement('p');title.className='add-title';title.textContent='ADD AND START TYPING';add.append(title);
      const grid=document.createElement('div');grid.className='quick-add';add.append(grid);
      for(const [kind,label,key]of [['button','Button','B'],['text','Text','T'],['field','Input field','F'],['panel','Section','P']]as const){const button=this.button(label,`Add ${label.toLowerCase()} (${key})`,()=>{void this.quickInsert(kind);},grid);const shortcut=document.createElement('kbd');shortcut.textContent=key;button.append(shortcut);}
      const fields=document.createElement('div');fields.className='quick-add';add.append(fields);
      for(const [type,label]of [['email','Email'],['password','Password'],['number','Number'],['tel','Phone'],['url','URL'],['date','Date'],['time','Time'],['checkbox','Checkbox'],['radio','Radio'],['textarea','Long text'],['select','Dropdown']]as const)this.button(label,'Add '+label.toLowerCase(),()=>{void this.quickInsert('field',type);},fields);
      const positions=document.createElement('div');positions.className='places';positions.setAttribute('aria-label','Insert position');add.append(positions);
      for(const [value,label]of [['auto','Auto'],['after','Beside'],['below','Below'],['inside','Inside'],['before','Before']]as const){const button=this.button(label,`Insert ${label.toLowerCase()}`,()=>{this.placement=value;for(const child of positions.querySelectorAll('button'))child.setAttribute('aria-pressed',String(child===button));},positions);button.setAttribute('aria-pressed',String(this.placement===value));button.disabled=value==='inside'&&el.matches('button,a,input,textarea,select,img,br,hr,[role="button"]');}
      const addHint=document.createElement('p');addHint.className='hint';addHint.textContent='Click a type, or press B · T · F · P on the page. A default name appears ready to edit. Auto places it inside containers or beside controls.';add.append(addHint);
      this.button('Layouts','Preview layouts for this section',()=>{void this.run({type:'layouts',count:3});});
      this.button('↑ Section','Select surrounding section',()=>{void this.boundRun({type:'selectSection'});});
      this.button('↑ Parent','Select parent container',()=>{void this.boundRun({type:'selectParent'});});
      const ask=this.menu('✧ Ask','Ask for a change');
      const scope=this.select('Prompt target',[['element','This element'],['section','This section'],['page','Whole page']],ask);scope.value=this.scope;
      scope.onchange=()=>{this.scope=scope.value as typeof this.scope;this.session.highlightScope(this.scope);};
      const prompt=this.input('Change this element',ask);prompt.placeholder='Describe a change or a whole flow… ↵';prompt.maxLength=2000;
      prompt.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing&&prompt.value.trim()){
        e.preventDefault();prompt.disabled=true;this.error(new Error('Planning your changes…'));
        const before=this.current.workflow.states.length;
        void this.session.promptHere(prompt.value,this.scope).then(result=>{prompt.value='';if(this.session.isPreviewingLayouts()){this.message.hidden=true;return;}const count=result.workflow.states.length-before;this.message.replaceChildren(document.createTextNode(result.unresolved.length?'Some targets could not be found. Undo or select the target again.':count?`${count} connected steps ready. `:'Changes ready. '));this.message.hidden=false;this.button('Try flow','Try generated flow',()=>{void this.run({type:'replay'});},this.message);this.button('Undo','Undo generated changes',()=>{void this.run({type:'undo'});},this.message);}).catch(this.error).finally(()=>{prompt.disabled=false;});
      }};
      this.button('Reimagine','Reimagine this section',()=>{void this.run({type:'layouts',count:3});},ask);

      if(el instanceof HTMLImageElement){
        const images=this.menu('Image','Image options');
        const help=document.createElement('p');help.textContent='Existing image is kept. Replace with a local image, fit, crop, or remove.';images.append(help);
        const upload=this.input('Replace image',images,'file');upload.accept='image/png,image/jpeg,image/webp,image/gif';upload.onchange=()=>{const file=upload.files?.[0];if(!file)return;if(file.size>500000){this.error(new Error('Choose an image smaller than 500 KB.'));return;}const reader=new FileReader();reader.onload=()=>{void this.boundRun({type:'image',src:String(reader.result),fit:'contain'});};reader.readAsDataURL(file);};
        this.button('Fit','Fit entire image',()=>{void this.boundRun({type:'image',src:el.src,fit:'contain'});},images);
        this.button('Crop','Crop image to its frame',()=>{void this.boundRun({type:'image',src:el.src,fit:'cover'});},images);
        this.button('Remove','Remove image',()=>{void this.boundRun({type:'remove'});},images);
      }
      const field=s.workflow.states.flatMap(st=>st.operations).find(op=>op.kind==='insert'&&op.node.id===s.selected?.locator.owned?.replace(/:input$/,''));
      if(field?.kind==='insert'&&field.node.kind==='field'&&!field.node.copy){
        const settings=this.menu('Field','Field settings');
        const type=this.select('Input type',[['text','Text'],['email','Email'],['password','Password'],['number','Number'],['tel','Phone'],['url','URL'],['date','Date'],['time','Time'],['checkbox','Checkbox'],['radio','Radio'],['textarea','Long text'],['select','Dropdown']],settings);type.value=field.node.inputType||'text';
        type.onchange=()=>{void this.boundRun({type:'fieldSettings',inputType:type.value as FieldType});};
        const required=this.input('Required',settings,'checkbox');required.checked=!!field.node.required;required.onchange=()=>{void this.boundRun({type:'fieldSettings',inputType:type.value as FieldType,required:required.checked});};
        if(type.value==='select'){const options=this.input('Options, comma separated',settings);options.value=(field.node.options||['Option 1','Option 2']).join(', ');this.enterOrBlur(options,value=>{void this.boundRun({type:'fieldSettings',inputType:'select',options:value.split(',').map(x=>x.trim()).filter(Boolean)});});}
        if(type.value==='radio'){const group=this.input('Radio group',settings);group.value=field.node.radioGroup||'default';this.enterOrBlur(group,value=>{void this.boundRun({type:'fieldSettings',inputType:'radio',radioGroup:value});});}
      }
      if(el.matches('button,a,[role="button"]')){
        const next=this.menu('On click…','Click behavior');clickMenu=next;const title=this.input('New state',next);title.placeholder='State name, then Enter';this.enterOrBlur(title,text=>{void this.boundRun({type:'child',text});});
        const destination=this.select('Existing state',[['','Connect to…'],...s.workflow.states.map(st=>[st.id,st.title] as [string,string])],next);destination.onchange=()=>{if(destination.value)void this.boundRun({type:'link',id:destination.value});};
      }
      if(!freeBuild&&s.selected?.owned&&el.matches('button,a,input,textarea,select,[role=button]')){const copy=s.workflow.states.flatMap(st=>st.operations).find(op=>op.kind==='insert'&&op.node.id===s.selected?.locator.owned?.replace(/:input$/,''));if(copy?.kind==='insert'&&copy.node.copy){const behavior=clickMenu||this.menu('Behavior','Copy behavior');const note=document.createElement('p');note.className='hint';note.textContent='Mirror forwards to the original control in Try flow. It can run the real app’s action. Typed field values are not saved.';behavior.append(note);this.button('Mirror original behavior','Mirror original behavior',()=>{void this.boundRun({type:'mirror'});},behavior);}}
      this.button('Duplicate','Duplicate item (Cmd/Ctrl+D)',()=>{void this.duplicate();});
      this.button('Delete','Remove element (Delete / Backspace)',()=>{void this.boundRun({type:'remove'});});
      const resize=this.button('','Drag to resize',()=>{},this.handles);resize.className='handle resize-handle';resize.onpointerdown=e=>this.session.beginGesture(el,'resize',e);
      if(!this.plainText(el))for(const [position,label] of [['before','above'],['after','beside'],['below','below']] as const){const plus=this.button('+',`Add ${label} selection`,()=>{this.placement=position;(add.parentElement as HTMLDetailsElement).open=true;this.position();},this.handles);plus.className='handle insert-handle';plus.dataset.position=position;}
      const divider=document.createElement('span');divider.className='divider';this.bar.append(divider);
    }
    if(!el&&!s.replay&&s.library.length){const draft=s.library[0];if(draft.id!==s.workflow.id)this.button('Resume local draft','Resume local draft',()=>{void this.run({type:'load',id:draft.id});});}
    if(!el&&!s.replay){const hint=document.createElement('span');hint.textContent='Click an element on the page to edit it';hint.style.cssText='padding:6px 8px;color:#625c9a;';this.bar.append(hint);}
    this.button('↶','Undo',()=>{void this.run({type:'undo'});}).disabled=!s.canUndo||s.replay;
    this.button('↷','Redo',()=>{void this.run({type:'redo'});}).disabled=!s.canRedo||s.replay;
    if(s.replay){this.button('← Back','Previous prototype step',()=>{void this.run({type:'back'});}).disabled=!s.canBack;this.button('↺ Restart','Restart prototype with sample data',()=>{void this.run({type:'replay'});});}
    this.button(s.replay?'✎ Edit':'▷ Try flow',s.replay?'Build':'Replay',()=>{void this.run({type:s.replay?'edit':'replay'});});
    const more=this.menu('⋯','Workflow actions');more.parentElement!.classList.add('right');
    more.prepend(crumbs);
    for(const label of ['Preview layouts for this section','Select surrounding section','Select parent container']){const control=this.bar.querySelector<HTMLButtonElement>('button[aria-label="'+label+'"]');if(control)more.append(control);}
    if(active){
      const hint=document.createElement('p');hint.className='hint';hint.textContent=s.styleSource?'Style copied. Ctrl/Cmd-click the destination.':'Copy style, then click a destination. You can also Ctrl/Cmd-click a source and destination. Esc returns to the page.';more.append(hint);
    }
    this.button('×','Close selection and interact',()=>{void this.run({type:'interact'});});
    const name=this.input('Workflow',more);name.value=s.workflow.name;name.disabled=s.replay;this.enterOrBlur(name,text=>{if(text!==this.current.workflow.name)void this.run({type:'rename',text});});
    const states=this.select('Current state',s.workflow.states.map(st=>[st.id,st.title]),more);states.value=s.stateId;states.disabled=s.replay;states.onchange=()=>{void this.run({type:'state',id:states.value});};
    this.button('Save version','Save version',()=>{void this.run({type:'save'});},more);
    if(s.versions.length){const versions=this.select('Restore version',[['','Restore version…'],...s.versions.map(v=>[String(v.number),`v${v.number} · ${v.name}`]as[string,string])],more);versions.onchange=()=>{if(versions.value&&(!s.dirty||confirm('Restore this version and discard unsaved changes?')))void this.run({type:'restore',version:Number(versions.value)});};}
    this.button('Restore original page','Restore original page',()=>{void this.run({type:'reset'});},more);
    if(s.replay)this.button('Back','Back one step',()=>{void this.run({type:'back'});},more).disabled=!s.canBack;
    if(el&&(el.matches('button,a,[role="button"],[role="link"]')||this.plainText(el))){
      const primary=document.createElement('div'),secondary=document.createElement('div');primary.className=secondary.className='tool-row';primary.setAttribute('role','group');primary.setAttribute('aria-label',this.plainText(el)?'Text editing':'Button and link editing');secondary.setAttribute('role','group');secondary.setAttribute('aria-label','Prototype and page actions');
      for(const name of ['Edit text in place','Drag to move selected element','Appearance','Text alignment','Copy style','Duplicate item (Cmd/Ctrl+D)','Remove element (Delete / Backspace)']){
        const control=[...this.bar.children].find(child=>child.getAttribute('aria-label')===name||child.querySelector('summary')?.getAttribute('aria-label')===name);if(control)primary.append(control);
      }
      secondary.append(...this.bar.childNodes);this.bar.append(primary,secondary);this.bar.classList.add('control-bar');
    }else this.bar.classList.remove('control-bar');
    this.position();
  }
  private position=()=>{
    if(this.current.panelMinimized)return;
    const el=this.session.findSelected(),r=el?.getBoundingClientRect(),width=this.bar.offsetWidth||290;
    const left=r?Math.min(Math.max(12,r.left),Math.max(12,innerWidth-width-12)):12;
    const height=this.bar.offsetHeight||90;
    const top=this.current.styleSource||(el&&this.plainText(el))?Math.max(12,innerHeight-height-12):r?(r.top-height-26>=12?r.top-height-26:Math.min(Math.max(12,r.bottom+26),Math.max(12,innerHeight-height-12))):Math.max(12,innerHeight-height-12);
    this.handles.hidden=this.connectionActive||!r||!this.session.isAuthoring()||!!this.editing;
    if(r)for(const handle of this.handles.querySelectorAll<HTMLElement>('.handle')){const pos=handle.dataset.position;const x=pos==='before'||pos==='below'?r.left+r.width/2:r.right;const y=pos==='before'?r.top:pos==='after'?r.top+r.height/2:r.bottom;handle.style.left=`${Math.max(4,Math.min(innerWidth-24,x-(pos?10:6)))}px`;handle.style.top=`${Math.max(4,Math.min(innerHeight-24,y-(pos?10:6)))}px`;}
    this.bar.style.left=`${left}px`;this.bar.style.top=`${top}px`;
    for(const menu of this.bar.querySelectorAll<HTMLElement>('.menu')){menu.style.top=top>innerHeight/2?'auto':'34px';menu.style.bottom=top>innerHeight/2?'38px':'auto';menu.style.maxWidth=`${Math.max(180,innerWidth-24)}px`;menu.style.transform='';if((menu.parentElement as HTMLDetailsElement).open){const bounds=menu.getBoundingClientRect();const shift=bounds.right>innerWidth-12?innerWidth-12-bounds.right:bounds.left<12?12-bounds.left:0;menu.style.transform=`translateX(${shift}px)`;}}
  };
  private quickKey=(event:KeyboardEvent)=>{
    if(event.isComposing||event.repeat||(event.altKey&&!(event.metaKey||event.ctrlKey))||this.editing)return;
    const path=event.composedPath(),origin=path[0];
    const selected=this.session.isAuthoring()?this.session.findSelected():null;
    const selectedControl=origin instanceof Element&&!!selected?.contains(origin)&&!path.includes(this.host);
    if(isTextEntry(origin)&&!selectedControl)return;
    if(event.key==='Escape'&&this.bar.querySelector('details[open]')){event.preventDefault();event.stopImmediatePropagation();this.bar.querySelector<HTMLDetailsElement>('details[open]')!.open=false;return;}
    if(!event.metaKey&&!event.ctrlKey&&!event.altKey&&this.session.mode()!=='closed'&&['e','i'].includes(event.key.toLowerCase())){
      event.preventDefault();event.stopImmediatePropagation();void this.switchMode(event.key.toLowerCase()==='e'?'edit':'interact');return;
    }
    if(!event.metaKey&&!event.ctrlKey&&event.key.toLowerCase()==='v'&&this.session.mode()!=='closed'&&!this.current.replay){event.preventDefault();event.stopImmediatePropagation();void this.switchMode(this.session.isAuthoring()?'interact':'edit');return;}
    if(!this.session.isAuthoring())return;
    // macOS labels Backspace as Delete; forward Delete is supported too.
    if((event.key==='Backspace'||event.key==='Delete')&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&this.current.selected&&this.session.findSelected()){
      event.preventDefault();event.stopImmediatePropagation();void this.boundRun({type:'remove'});return;
    }
    if((event.metaKey||event.ctrlKey)&&!event.shiftKey&&event.key.toLowerCase()==='d'){event.preventDefault();event.stopImmediatePropagation();void this.duplicate();return;}
    if((event.metaKey||event.ctrlKey)&&event.altKey&&['c','v'].includes(event.key.toLowerCase())){event.preventDefault();event.stopImmediatePropagation();void this.boundRun({type:event.key.toLowerCase()==='c'?'copyStyle':'pasteStyle'});return;}
    if(event.metaKey||event.ctrlKey)return;
    const kind=({b:'button',t:'text',f:'field',p:'panel'} as const)[event.key.toLowerCase() as 'b'|'t'|'f'|'p'];
    if(!kind)return;event.preventDefault();event.stopImmediatePropagation();void this.quickInsert(kind);
  };
  private async switchMode(type:'edit'|'interact'){try{if(this.current.panelMinimized)await this.session.dispatch({type:'restorePanel'});await this.session.dispatch({type});}catch(error){this.error(error);}}
  private async duplicate(){
    if(this.inserting)return;
    const s=this.current;if(!s.selected){this.error(new Error('Select an item to duplicate first.'));return;}
    this.inserting=true;
    try{await this.session.dispatchAt(s.selected,s.workflow.id,s.stateId,{type:'duplicateElement'});const target=this.session.findSelected();if(target&&this.session.isAuthoring()){target.scrollIntoView?.({block:'nearest'});if(editableText(target)||target.matches('input,textarea'))this.startInline(target);}}
    catch(error){this.error(error);}finally{this.inserting=false;}
  }
  private async quickInsert(kind:'button'|'text'|'field'|'panel',inputType:FieldType='text'){
    if(this.inserting)return;
    const s=this.current,el=this.session.findSelected();
    if(!s.selected||!el){this.error(new Error('Select where the new item should go, then press B for a button, T for text, F for an input, or P for a section.'));return;}
    this.inserting=true;this.message.hidden=true;
    const position=this.placement==='auto'?(el.matches('div,section,article,main,aside,nav,header,footer,form,fieldset,td,th,[role="form"]')?'inside':'after'):this.placement;
    const text=kind==='field'&&inputType!=='text'?({email:'Email',password:'Password',number:'Number',url:'Website',tel:'Phone',date:'Date',time:'Time',checkbox:'New checkbox',radio:'New option',textarea:'Message',select:'Choose an option'}[inputType]||'New field'):{button:'New button',text:'Your text here',field:'New field',panel:'New section'}[kind];
    try{
      const result=await this.session.dispatchAt(s.selected,s.workflow.id,s.stateId,{type:'insertElement',kind,text,inputType,position});
      if(result.workflow.id===s.workflow.id&&result.stateId===s.stateId&&this.session.isAuthoring()){
        const target=this.session.findSelected();if(target?.dataset.dxOwned){target.scrollIntoView?.({block:'nearest',inline:'nearest'});this.startInline(target);}
      }
    }catch(error){this.error(error);}finally{this.inserting=false;}
  }
  private doubleClick=(event:MouseEvent)=>{
    const target=event.target instanceof HTMLElement?event.target:event.target instanceof Element?event.target.closest<HTMLElement>('button,a,[role="button"]'):null;
    if(!target||!this.session.root.contains(target)||target.closest('[data-dx-ignore]'))return;
    const field=target.matches('[data-dx-field]')?target.closest<HTMLElement>('label'):null;
    const button=target.closest<HTMLElement>('button,a,[role="button"],[role="link"]');
    // A multi-label control can still expose the specific text span clicked.
    const label=field&&editableText(field)?field:button&&editableText(button)?button:target;
    if(label.closest('[contenteditable]:not([contenteditable="false"])'))return;
    const pointed=editableText(label)||textAtPoint(label,event.clientX,event.clientY);
    if(!pointed&&!label.matches('textarea,input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file])'))return;
    if(!this.session.isAuthoring()){
      if(this.session.mode()!=='interact'||!this.current.enabled)return;
      if(label.matches('input,textarea')&&!this.session.renderer.findOwned(label))return;
      event.preventDefault();event.stopImmediatePropagation();
      const snapshot=this.session.snapshot(),selection=describe(label,this.session.renderer.idFor(label));
      void this.session.dispatchAt(selection,snapshot.workflow.id,snapshot.stateId,{type:'edit'}).then(()=>this.startInline(label,pointed||undefined)).catch(this.error);return;
    }
    event.preventDefault();event.stopImmediatePropagation();this.startInline(label,pointed||undefined);
  };
  private startInline(target:HTMLElement,pointed?:Text){
    if(this.editing)this.finishInline(true);
    const node=pointed||editableText(target),field=target.matches('input,textarea');if(!node&&!field){this.error(new Error('Double-click the specific text label inside this element.'));return;}
    const rect=target.getBoundingClientRect(),css=getComputedStyle(target),input=document.createElement('textarea');input.className='inline';input.setAttribute('aria-label','Edit text');input.maxLength=300;input.value=field?(target.getAttribute('placeholder')||'New field'):node!.data.trim();
    Object.assign(input.style,{left:`${rect.left}px`,top:`${rect.top}px`,width:`${Math.max(90,rect.width)}px`,height:`${Math.max(30,rect.height)}px`,font:css.font||`${css.fontSize} ${css.fontFamily}`,color:css.color,lineHeight:css.lineHeight});
    const selection=describe(target,this.session.renderer.idFor(target));if(pointed&&!editableText(target))selection.locator.textPath=textPath(target,pointed);
    this.editing={input,target,selection,workflowId:this.current.workflow.id,stateId:this.current.stateId,original:input.value};
    this.bar.hidden=true;this.handles.hidden=true;this.shadow.append(input);input.focus();input.select();
    input.onkeydown=e=>{e.stopPropagation();if(e.isComposing)return;if(e.key==='Escape'){e.preventDefault();this.finishInline(false);}else if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();this.finishInline(true);}};
    input.onblur=()=>this.finishInline(true);
  }
  private finishInline(commit:boolean){
    const edit=this.editing;if(!edit)return;this.editing=null;edit.input.onblur=null;const value=edit.input.value;edit.input.remove();
    if(commit&&value.trim()&&value!==edit.original){void this.session.dispatchAt(edit.selection,edit.workflowId,edit.stateId,{type:'text',text:value}).catch(this.error).finally(()=>this.update(this.session.snapshot()));}else this.update(this.current);
  }
  destroy(){clearTimeout(this.toastTimer);this.connectionEditor.destroy();this.finishInline(false);this.unsubscribe();window.removeEventListener('focusin',this.editorFocus,true);window.removeEventListener('focusout',this.editorFocus,true);window.removeEventListener('keydown',this.quickKey,true);window.removeEventListener('dblclick',this.doubleClick,true);window.removeEventListener('scroll',this.position,true);window.removeEventListener('resize',this.position);this.host.remove();}
}
