import {ConnectionWire} from './connectionWire';
import type {Session} from './session';
import {describe,resolve} from './locator';
import {fieldFor,eventsFor} from './connections';
import {copyDOM} from './copyDOM';
import {configureField} from './fields';
import {applyAppearance} from './nativeDesign';
import {editableText} from './text';
import {VisitedScreenSchema,clone,type Snapshot,type Selection,type ConnectionCondition,type ConnectionEvent,type ConnectionAction,type VisitedScreen} from '../shared/model';

/** A visual rule editor; preview nodes never operate the host application. */
export class ConnectionEditor{
 private wire:ConnectionWire;
 private panel=document.createElement('section');private current:Snapshot;private unsubscribe:()=>void;
 private source:Selection|null=null;private from='';private workflow='';private visible=false;private picking=false;
 private pendingScreen:VisitedScreen|undefined;
 private message='';private error=false;
 private collapsed=false;private expanded=false;
 private to='';private newTitle='';private event:ConnectionEvent='click';private conditions:ConnectionCondition[]=[];private otherwise='';private saved='';private busy=false;
 constructor(private session:Session,private shadow:ShadowRoot,private onVisibility:(visible:boolean)=>void){
  this.wire=new ConnectionWire(shadow,()=>session.connectionViewport);
  const css=document.createElement('style');css.textContent=`.connection-editor{position:fixed;right:16px;top:16px;bottom:16px;width:min(760px,calc(100vw - 32px));z-index:8;pointer-events:auto;background:#fff;border:1px solid #dbd8ea;border-radius:16px;box-shadow:0 12px 60px #25204433;padding:18px;overflow:auto;font:13px/1.5 system-ui;color:#29273b}.connection-editor header{display:flex;align-items:center;justify-content:space-between}.connection-editor h2{margin:0;font-size:18px}.connection-editor h3{margin:0 0 8px;font-size:12px}.connection-columns{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0}.connection-preview{border:1px solid #e0deeb;background:#faf9fe;border-radius:10px;padding:14px;min-height:130px;max-height:210px;overflow:auto;pointer-events:none}.connection-preview button{border:1px solid #c9c2e7;background:#f1edff;padding:8px 12px;white-space:normal}.connection-preview h4{margin:0 0 8px}.connection-options{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.connection-options button[aria-pressed=true]{background:#eee9ff;color:#5e45c7;outline:1px solid #a69be4}.connection-editor label{display:block;margin:8px 0;font-size:12px}.connection-editor input,.connection-editor select{display:block;width:100%;margin-top:4px;font:13px system-ui;padding:8px}.connection-rule{padding:12px;background:#f3f0ff;border-radius:8px;margin:12px 0}.connection-condition{display:grid;grid-template-columns:1.3fr 1fr auto;gap:8px;align-items:center;border-top:1px solid #eceaf3;padding:8px 0}.connection-condition input{grid-column:1/3}.connection-editor footer{display:flex;gap:8px;justify-content:flex-end;position:sticky;bottom:-18px;background:white;padding:12px 0;border-top:1px solid #eceaf3;margin-top:16px;z-index:1}.connection-primary{background:#6a53d1;color:white}.connection-note{font-size:11px;color:#797389}.connection-pick{position:fixed;right:16px;bottom:16px;padding:12px;background:#fff;border:1px solid #a99de0;border-radius:10px;z-index:8;pointer-events:auto}.connection-editor [role=alert]{color:#a12b49}.connection-editor [role=status]{color:#356a50}@media(max-width:600px){.connection-columns{grid-template-columns:1fr}.connection-preview{max-height:120px}}`;
  css.textContent+=`
.connection-editor,.connection-editor *,.connection-pick,.connection-pick *{box-sizing:border-box}.connection-editor{left:16px;right:16px;top:auto;bottom:12px;width:auto;max-width:1440px;margin:0 auto;height:min(640px,72vh);padding:0;display:flex;flex-direction:column;overflow:hidden;border-radius:16px;box-shadow:0 8px 48px #25204433}.connection-editor[hidden],.connection-pick[hidden]{display:none}.connection-editor.connection-expanded{height:calc(100dvh - 24px)}.connection-editor header{flex:none;gap:12px;padding:12px 18px;border-bottom:1px solid #eceaf3;background:#faf9fe}.connection-editor h2{font-size:15px}.connection-header-actions{display:flex;gap:6px;align-items:center}.connection-editor button,.connection-pick button{cursor:pointer;font:12px system-ui;padding:8px 10px;border:1px solid #e1ddec;border-radius:7px;background:white;color:#51476e}.connection-editor button:disabled{opacity:.45;cursor:default}.connection-editor .connection-primary{background:#6a53d1;color:white;border-color:#6a53d1}.connection-body{min-height:0;flex:1;overflow:auto;display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:24px;padding:16px 18px}.connection-columns{margin:0;align-content:start;min-width:0}.connection-columns>div{min-width:0}.connection-preview{max-height:280px;min-height:170px}.connection-settings{min-width:0}.connection-options button{white-space:normal;overflow-wrap:anywhere;text-align:left;max-width:100%}.connection-preview{overflow-wrap:anywhere}.connection-preview *{max-width:100%}.connection-editor footer button{flex-shrink:0}.connection-editor footer{flex:none;position:static;margin:0;padding:10px 18px;align-items:center}.connection-editor footer [role=status],.connection-editor footer [role=alert]{margin:0 auto 0 0}.connection-editor .connection-note{margin:0;padding:8px 18px;border-bottom:1px solid #efedf5}.connection-pick{left:16px;right:auto;bottom:12px;max-width:calc(100vw - 32px);display:flex;flex-wrap:wrap;gap:10px;align-items:center;font:13px system-ui;box-shadow:0 6px 28px #25204426}.connection-pick strong{color:#6250bd}.connection-rule{font-size:12px}.connection-condition{grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;gap:6px}.connection-condition label{min-width:0}.connection-editor input,.connection-editor select{min-width:0}@media(max-width:950px){.connection-body{grid-template-columns:1fr}.connection-preview{max-height:150px;min-height:110px}.connection-editor header{flex-wrap:wrap}.connection-editor{height:76dvh}}@media(max-width:600px){.connection-columns{grid-template-columns:1fr;gap:16px}.connection-editor{left:8px;right:8px}.connection-body{padding:12px}.connection-header-actions{flex-wrap:wrap}}`;
  this.panel.className='connection-editor';this.panel.hidden=true;this.panel.setAttribute('role','dialog');this.panel.setAttribute('aria-label','Connect views');shadow.append(css,this.panel);
  this.current=session.snapshot();this.unsubscribe=session.subscribe(snapshot=>{const wasMinimized=this.current.panelMinimized;this.current=snapshot;if(!snapshot.panelMinimized&&wasMinimized&&this.visible)this.render();if(snapshot.panelMinimized)this.wire.hide();if(this.visible&&(snapshot.workflow.id!==this.workflow||snapshot.stateId!==this.from||snapshot.mode!=='edit'))this.close();});
  window.addEventListener('click',this.pick,true);window.addEventListener('keydown',this.key,true);
 }
 open(){
  const selected=this.session.findSelected(),snapshot=this.session.snapshot();if(!selected||!snapshot.selected||!this.session.isAuthoring())return;
  const target=selected.matches('button,a,[role=button],[role=link]')?selected:fieldFor(selected);if(!target)return;
  this.current=snapshot;this.source=describe(target,this.session.renderer.idFor(target));if(this.source.label==='input'&&snapshot.selected.label)this.source.label=snapshot.selected.label;this.workflow=snapshot.workflow.id;this.from=snapshot.stateId;
  const sources=this.session.renderer.sourcesFor(target),edge=snapshot.workflow.edges.find(edge=>edge.from===this.from&&sources.includes(edge.source));
  this.event=edge?.event||eventsFor(target)[0];this.to=edge?.to||snapshot.workflow.states.find(s=>s.id!==this.from)?.id||'';this.conditions=clone(edge?.conditions||(!edge&&target.matches('input[type=checkbox],input[type=radio]')?[{target:this.source.locator,test:'checked' as const}]:[]));this.otherwise=edge?.otherwise||'';this.newTitle='';this.pendingScreen=undefined;this.saved=edge?.id||'';this.visible=true;this.picking=false;this.collapsed=false;this.expanded=false;this.message='';this.error=false;this.onVisibility(true);this.render();if(this.session.externalConnections)this.session.openConnectionPanel();
 }
 anchor(ratio:number){this.wire.anchor(ratio);}
 async action(change:ConnectionAction){
  if(!this.visible||!this.session.externalConnections)throw new Error('Select a control and click Connect first.');
  if(change.action==='close'){this.close();return;}
  if(change.action==='screen'){this.error=false;this.pendingScreen=VisitedScreenSchema.parse(change.screen);this.to='';this.newTitle='';this.saved='';this.message='Screen selected. Connect it to your pinned control.';this.render();return;}
  if(change.action==='save'){await this.connect();return;}
  if(change.action==='test'){if(!this.saved)throw new Error('Save this connection first.');await this.session.dispatch({type:'replayConnection',id:this.saved});this.close();return;}
  if(change.action==='pick'){this.picking=true;this.render();return;}
  if(change.action==='cancelPick'){this.picking=false;this.render();return;}
  if(change.action==='destination'){if(!this.current.workflow.states.some(s=>s.id===change.value))throw new Error('Choose an existing view.');this.to=change.value;this.pendingScreen=undefined;this.newTitle='';}
  if(change.action==='title'){this.pendingScreen=undefined;this.newTitle=change.value.slice(0,300);}
  if(change.action==='event'){const el=this.source&&resolve(this.source.locator,this.session.root,this.session.renderer.owned);if(!el||!eventsFor(el).includes(change.value as ConnectionEvent))throw new Error('Unsupported trigger.');this.event=change.value as ConnectionEvent;}
  if(change.action==='otherwise'){if(change.value&&!this.current.workflow.states.some(s=>s.id===change.value))throw new Error('Choose an existing fallback.');this.otherwise=change.value;}
  if(change.action==='remove'){if(!Number.isInteger(change.index)||change.index<0||change.index>=this.conditions.length)throw new Error('Condition is missing.');this.conditions.splice(change.index,1);}
  if(change.action==='condition'){const condition=this.conditions[change.index];if(!condition)throw new Error('Condition is missing.');condition.test=change.test;if(change.test==='equals')condition.value=(change.value||'').slice(0,300);else delete condition.value;}
  this.saved='';this.message='';this.error=false;this.render();
 }
 private publish(){
  const el=this.source&&resolve(this.source.locator,this.session.root,this.session.renderer.owned);
  this.session.publishConnection(this.visible&&this.source?{...(this.pendingScreen?{pendingScreen:{id:this.pendingScreen.id,title:this.pendingScreen.title,route:this.pendingScreen.route,thumbnail:this.pendingScreen.thumbnail}}:{}),busy:this.busy,source:this.source,from:this.from,to:this.to,newTitle:this.newTitle,event:this.event,conditions:clone(this.conditions),otherwise:this.otherwise,saved:this.saved,picking:this.picking,fields:this.fields().map(f=>f.selection),events:el?eventsFor(el):[],message:this.message,error:this.error}:null);
 }
 private button(text:string,fn:()=>void,parent:HTMLElement){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;parent.append(b);return b;}
 private input(label:string,value:string,parent:HTMLElement,change:(value:string)=>void){const row=document.createElement('label');row.textContent=label;const input=document.createElement('input');input.setAttribute('aria-label',label);input.maxLength=300;input.value=value;input.oninput=()=>{change(input.value);this.saved='';this.summary();const connect=this.panel.querySelector<HTMLButtonElement>('.connection-primary');if(connect)connect.disabled=this.busy||(!this.to&&!this.newTitle.trim());const test=[...this.panel.querySelectorAll('button')].find(button=>button.textContent==='Test connection');if(test)test.disabled=true;if(label==='Or create a new view'){const right=this.panel.querySelector<HTMLElement>('.connection-columns>div:last-child');right?.querySelector('.connection-preview')?.remove();if(right)this.preview(this.newTitle?'':this.to,right);}};row.append(input);parent.append(row);return input;}
 private select(label:string,options:[string,string][],value:string,parent:HTMLElement,change:(value:string)=>void){const row=document.createElement('label');row.textContent=label;const select=document.createElement('select');select.setAttribute('aria-label',label);for(const [value,text]of options){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}select.value=value;select.onchange=()=>{change(select.value);this.saved='';this.render();};row.append(select);parent.append(row);return select;}
 private fields(){return [...this.session.root.querySelectorAll<HTMLElement>('input:not([type=hidden]):not([type=file]),textarea,select')].filter(el=>!el.closest('[data-dx-ignore]')&&getComputedStyle(el).display!=='none').slice(0,100).map(el=>({el,selection:describe(el,this.session.renderer.idFor(el))}));}
 private summary(){
  const node=this.panel.querySelector('[data-rule-summary]');if(!node)return;
  const destination=this.newTitle||this.current.workflow.states.find(s=>s.id===this.to)?.title||'Choose a destination';
  const requirements=this.conditions.map(condition=>{const target=resolve(condition.target,this.session.root,this.session.renderer.owned),name=target?describe(target).label:condition.target.name||'Missing field';return name+' '+({checked:'is checked',unchecked:'is unchecked',filled:'is filled',valid:'is valid',equals:'equals '+(condition.value||'…')}[condition.test]);});
  node.textContent=`${this.source?.label} · ${this.event==='click'?'when clicked':this.event==='change'?'when changed':'when Enter is pressed'}${requirements.length?' · only when '+requirements.join(' AND '):''} → ${destination}${this.otherwise?' · otherwise '+this.current.workflow.states.find(s=>s.id===this.otherwise)?.title:''}`;
 }

 private preview(stateId:string,parent:HTMLElement){
  const box=document.createElement('div');box.className='connection-preview';box.inert=true;box.setAttribute('inert','');box.setAttribute('aria-label','Preview '+(this.current.workflow.states.find(s=>s.id===stateId)?.title||'new view'));parent.append(box);
  const state=this.current.workflow.states.find(s=>s.id===stateId);const title=document.createElement('h4');title.textContent=state?.title||this.newTitle||'New view';box.append(title);
  if(!state){const note=document.createElement('p');note.textContent='An empty editable prototype view will be created.';box.append(note);return;}
  const canvas=document.createElement('div');if(state.design)applyAppearance(canvas,state.design.surface);box.append(canvas);
  const nodes=new Map<string,HTMLElement>();
  for(const op of state.operations){
   if(op.kind==='insert'){
    const node=op.node.copy?copyDOM(op.node.copy.map(node=>({...node,...(node.src&&!node.src.startsWith('data:')?{src:undefined}:{})}))):document.createElement(op.node.kind==='button'?'button':op.node.kind==='field'?'label':op.node.kind==='panel'?'section':'p');
    if(!op.node.copy)node.textContent=op.node.text;if(op.node.appearance)applyAppearance(node,op.node.appearance);
    if(op.node.kind==='field'&&!op.node.copy)configureField(node,op.node);
    // Previews cannot issue network requests or navigate through copied content.
    for(const img of node.querySelectorAll('img'))if(!img.src.startsWith('data:'))img.removeAttribute('src');if(node instanceof HTMLImageElement&&!node.src.startsWith('data:'))node.removeAttribute('src');
    const target=op.target.owned?nodes.get(op.target.owned):undefined;if(target&&op.position==='inside')target.append(node);else canvas.append(node);nodes.set(op.node.id,node);
   }else if(op.target.owned){const node=nodes.get(op.target.owned);if(node&&op.kind==='text'){const text=editableText(node,op.target.textPath);if(text)text.data=op.text;}if(node&&op.kind==='remove')node.hidden=true;if(node&&op.kind==='appearance')applyAppearance(node,op.style);}
  }
  if(state.view==='panel'&&!state.operations.some(op=>op.kind==='insert')){const note=document.createElement('p');note.textContent='Empty prototype view. Open it to add content.';canvas.append(note);}
  if(state.view==='base'){const note=document.createElement('p');note.textContent='Existing application · '+this.current.workflow.origin+this.current.workflow.route;box.append(note);}
 }
 private render(){
  this.panel.replaceChildren();this.panel.hidden=!this.visible;if(!this.visible)return;if(this.current.panelMinimized){this.panel.hidden=true;this.wire.hide();this.publish();return;}
  if(this.session.externalConnections){this.panel.hidden=true;const title=this.pendingScreen?.title||this.newTitle||this.current.workflow.states.find(s=>s.id===this.to)?.title||'Choose a screen in Wandel';this.wire.show(()=>this.source?resolve(this.source.locator,this.session.root,this.session.renderer.owned):null,title,!!this.saved);this.publish();return;}
  if(this.picking||this.collapsed){
   this.panel.className='connection-pick';this.panel.removeAttribute('role');
   const brand=document.createElement('strong');brand.textContent='Wandel';this.panel.append(brand);
   const hint=document.createElement('span');hint.textContent=this.picking?'Click a field on the page to add a condition.':`Connections · ${this.source?.label||'Selected control'}`;this.panel.append(hint);
   this.button(this.picking?'Cancel field selection':'Open connections',()=>{this.picking=false;this.collapsed=false;this.render();},this.panel);
   this.button('Back to editing',()=>this.close(),this.panel);return;
  }
  this.panel.className='connection-editor'+(this.expanded?' connection-expanded':'');this.panel.setAttribute('role','dialog');
  const header=document.createElement('header'),title=document.createElement('h2');title.textContent='Wandel / Connections';header.append(title);
  const actions=document.createElement('div');actions.className='connection-header-actions';header.append(actions);
  this.button('Collapse',()=>{this.collapsed=true;this.render();},actions).setAttribute('aria-label','Collapse connections to toolbar');
  this.button(this.expanded?'Fit workspace':'Expand',()=>{this.expanded=!this.expanded;this.render();},actions).setAttribute('aria-label',this.expanded?'Fit connection workspace':'Expand connection workspace');
  this.button('Back to editing',()=>this.close(),actions).setAttribute('aria-label','Close connection editor');this.panel.append(header);
  const note=document.createElement('p');note.className='connection-note';note.textContent='Connect in your Wandel workspace. Collapse to reach the page; your unfinished connection stays here. Previews show saved prototype content.';this.panel.append(note);
  const body=document.createElement('div');body.className='connection-body';this.panel.append(body);
  const columns=document.createElement('div');columns.className='connection-columns';body.append(columns);
  const left=document.createElement('div'),right=document.createElement('div');columns.append(left,right);
  const source=document.createElement('h3');source.textContent='FROM · '+this.current.workflow.states.find(s=>s.id===this.from)?.title;left.append(source);const control=document.createElement('p');control.textContent=this.source?.label||'';left.append(control);this.preview(this.from,left);
  const destination=document.createElement('h3');destination.textContent='TO · saved or visited view';right.append(destination);const options=document.createElement('div');options.className='connection-options';right.append(options);
  for(const state of this.current.workflow.states){const b=this.button(state.title+(this.current.visited?.includes(state.id)?' · visited':''),()=>{this.to=state.id;this.newTitle='';this.saved='';this.render();},options);b.setAttribute('aria-label','Destination '+state.title);b.setAttribute('aria-pressed',String(state.id===this.to&&!this.newTitle));}
  this.input('Or create a new view',this.newTitle,right,value=>{this.newTitle=value;});this.preview(this.newTitle?'':this.to,right);if(this.to&&!this.newTitle)this.button('Edit destination view',()=>{const id=this.to;void this.session.dispatch({type:'state',id}).then(()=>this.close()).catch(error=>this.sessionError(error));},right);
  const settings=document.createElement('div');settings.className='connection-settings';body.append(settings);
  const el=this.source?resolve(this.source.locator,this.session.root,this.session.renderer.owned):null,events=el?eventsFor(el):['click'];this.select('When',events.map(event=>[event,event==='click'?'Clicked':event==='change'?'Changed / selected':'Enter pressed']),this.event,settings,value=>{this.event=value as ConnectionEvent;});
  const heading=document.createElement('h3');heading.textContent='Only when · all conditions';settings.append(heading);
  const fields=this.fields();
  this.conditions.forEach((condition,index)=>{
   const row=document.createElement('div');row.className='connection-condition';settings.append(row);
   const fieldIndex=fields.findIndex(f=>JSON.stringify(f.selection.locator)===JSON.stringify(condition.target));
   this.select('Condition '+(index+1)+' field',[['','Select field'],...fields.map((field,i)=>[String(i),field.selection.label] as [string,string])],fieldIndex<0?'':String(fieldIndex),row,value=>{if(fields[Number(value)]&&value!==''){condition.target=fields[Number(value)].selection.locator;condition.test=fields[Number(value)].el.matches('input[type=checkbox],input[type=radio]')?'checked':'filled';delete condition.value;}});
   const field=fields[fieldIndex]?.el,toggle=field?.matches('input[type=checkbox],input[type=radio]');const tests:[string,string][]=toggle?[['checked','Is checked'],['unchecked','Is unchecked']]:[['filled','Is filled'],['valid','Is valid'],['equals','Equals']];
   if(!tests.some(([key])=>key===condition.test))tests.push([condition.test,condition.test]);
   this.select('Condition '+(index+1)+' rule',tests,condition.test,row,value=>{condition.test=value as ConnectionCondition['test'];if(value==='equals')condition.value=condition.value||'';});
   this.button('Remove',()=>{this.conditions.splice(index,1);this.saved='';this.render();},row).setAttribute('aria-label','Remove condition '+(index+1));
   if(condition.test==='equals')this.input('Condition '+(index+1)+' value',condition.value||'',row,value=>{condition.value=value;});
  });
  const add=this.button('+ Pick condition field',()=>{this.picking=true;this.render();},settings);add.disabled=this.conditions.length>=8;
  this.select('Otherwise',[['','Stay here and show feedback'],...this.current.workflow.states.map(s=>[s.id,s.title] as [string,string])],this.otherwise,settings,value=>{this.otherwise=value;});
  const summary=document.createElement('p');summary.dataset.ruleSummary='true';summary.className='connection-rule';settings.append(summary);this.summary();
  const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const footer=document.createElement('footer');this.panel.append(footer);footer.append(status);
  const test=this.button('Test connection',()=>{const id=this.saved;void this.session.dispatch({type:'replayConnection',id}).then(()=>this.close()).catch(error=>this.sessionError(error));},footer);test.disabled=!this.saved||this.busy;
  const connect=this.button('Connect views',()=>{void this.connect();},footer);connect.className='connection-primary';connect.disabled=this.busy||(!this.to&&!this.newTitle.trim());
 }
 private async connect(){if(!this.source||this.busy)return;this.busy=true;this.error=false;this.message='';this.render();try{
  const snapshot=await this.session.dispatchAt(this.source,this.workflow,this.from,{type:'connect',...(this.pendingScreen?{screen:this.pendingScreen}:this.newTitle.trim()?{newTitle:this.newTitle.trim()}:{to:this.to}),event:this.event,conditions:this.conditions,...(this.otherwise?{otherwise:this.otherwise}:{})});
  this.current=snapshot;this.saved=snapshot.workflow.edges.at(-1)!.id;this.to=snapshot.workflow.edges.at(-1)!.to;this.newTitle='';this.pendingScreen=undefined;this.busy=false;this.close();this.session.connectionSaved();
 }catch(error){this.busy=false;this.render();this.sessionError(error);if(this.session.externalConnections)throw error;}}
 private sessionError(error:unknown){this.message=error instanceof Error?error.message:'Could not connect these views.';this.error=true;if(this.session.externalConnections){this.publish();return;}const message=this.panel.querySelector('[role=status]');if(message){message.setAttribute('role','alert');message.textContent=error instanceof Error?error.message:'Could not connect these views.';}}
 private pick=(event:MouseEvent)=>{if(!this.visible||this.current.panelMinimized||!this.picking||!(event.target instanceof Element)||!this.session.root.contains(event.target)||event.target.closest('[data-dx-ignore]'))return;event.preventDefault();event.stopImmediatePropagation();const field=fieldFor(event.target.closest('label')||event.target);if(!field)return;this.conditions.push({target:describe(field,this.session.renderer.idFor(field)).locator,test:field.matches('input[type=checkbox],input[type=radio]')?'checked':'filled'});this.saved='';this.picking=false;this.render();};
 private key=(event:KeyboardEvent)=>{if(!this.visible||this.current.panelMinimized||event.key!=='Escape')return;event.preventDefault();event.stopImmediatePropagation();if(this.picking){this.picking=false;this.render();}else if(this.session.externalConnections){this.close();}else if(!this.collapsed){this.collapsed=true;this.render();}else this.close();};
 close(){this.wire.hide();const wasVisible=this.visible;this.visible=false;this.picking=false;this.pendingScreen=undefined;this.panel.hidden=true;this.panel.replaceChildren();if(wasVisible){this.onVisibility(false);if(this.session.externalConnections)this.session.publishConnection(null);}}
 destroy(){this.close();this.wire.destroy();this.unsubscribe();window.removeEventListener('click',this.pick,true);window.removeEventListener('keydown',this.key,true);this.panel.remove();}
}
