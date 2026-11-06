/** Tab-owned workspace. Its iframe keeps extension UI isolated from host styles. */
export class FloatingPanel {
 private host:HTMLElement|null=null;
 private frame:HTMLIFrameElement|null=null;
 private panel:HTMLElement|null=null;
 private pill:HTMLButtonElement|null=null;
 private pageButton:HTMLButtonElement|null=null;
 private tabId=0;
 private docked=false;private dockWidth=420;private dock:HTMLButtonElement|null=null;private edge:HTMLElement|null=null;private pageSpace:HTMLStyleElement|null=null;
 private drag:{x:number;y:number;left:number;top:number}|null=null;
 private observer:ResizeObserver|null=null;
 private abort=new AbortController();
 constructor(private close:()=>void,private restore:()=>void){}
 show(tabId:number){
  this.tabId=tabId;
  if(this.host?.isConnected){this.collapse(false);return;}
  const host=document.createElement('div');host.dataset.dxIgnore='true';host.setAttribute('aria-label','Wandel workspace');
  // App dialogs trap focus: focus that leaves them is pulled back, which froze the panel while one was open. Focus moving into or out of
  // Wandel's panel never reaches the page's listeners; window capture runs before any listener the page adds.
  // Focus that moves into the panel's frame has no related target and the page sees no pointer events inside it, so the last pointer
  // position the page saw, at the panel's edge, marks the focus as ours.
  let lastX=-1,lastY=-1;window.addEventListener('pointermove',event=>{lastX=event.clientX;lastY=event.clientY;},true);
  const overPanel=()=>{const panel=shadow.querySelector('section');if(!panel)return false;const r=panel.getBoundingClientRect();return lastX>=r.left-24&&lastX<=r.right+24&&lastY>=r.top-24&&lastY<=r.bottom+24;};
  const ours=(node:EventTarget|null)=>node instanceof Node&&(node===host||host.contains(node));
  // When the panel's frame takes focus the page window blurs with the panel as its active element: that blur is ours too.
  const keepFocus=(event:FocusEvent)=>{if(ours(event.target)||ours(event.relatedTarget)||ours(document.activeElement)&&(event.type==='focusout'||event.type==='blur')||!event.relatedTarget&&overPanel()&&(event.type==='focusout'||event.type==='blur'))event.stopImmediatePropagation();};
  for(const type of ['focusin','focusout','focus','blur'])window.addEventListener(type,keepFocus as EventListener,true);
  // A shadow root shields the panel from application CSS without changing page layout.
  const shadow=host.attachShadow({mode:'open'});
  const style=document.createElement('style');style.textContent=`:host{all:initial!important;position:fixed!important;inset:0!important;width:0!important;height:0!important;z-index:2147483647!important}*{box-sizing:border-box}section{position:fixed;right:20px;top:20px;width:440px;height: min(820px,calc(100dvh - 40px));max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px);min-width:min(340px,calc(100vw - 24px));min-height:min(360px,calc(100dvh - 24px));resize:both;overflow:hidden;display:flex;flex-direction:column;background:#fafbfe;border:1px solid #d9d5ea;border-radius:14px;box-shadow:0 16px 64px #211a3b40;font:13px system-ui;color:#29253d}header img{width:18px;height:18px;flex-shrink:0}header{display:flex;align-items:center;gap:8px;padding:10px 12px;background:white;border-bottom:1px solid #e6e3ee;cursor:move;touch-action:none;flex-shrink:0}strong{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}button{font:13px system-ui;color:#51458a;background:white;border:1px solid #e4e0ed;border-radius:7px;padding:5px 8px;cursor:pointer}iframe{display:block;width:100%;flex:1;min-height:0;border:0;background:#fafbfe}.pill{position:fixed;right:20px;bottom:96px;display:flex;align-items:center;justify-content:center;width:52px;height:52px;padding:0;background:#6254ca;color:white;border:0;border-radius:50%;box-shadow:0 6px 24px #211a3b40;cursor:pointer;touch-action:none}.pill:hover{background:#5143b8}.pill:focus-visible{outline:3px solid #b9adf5;outline-offset:2px}.pill svg{width:24px;height:24px}section.docked{top:0!important;right:0!important;left:auto!important;height:100dvh!important;max-height:none;min-height:0;max-width:none;border-width:0 0 0 1px;border-radius:0;resize:none;box-shadow:-8px 0 32px #211a3b18}section.docked header{cursor:default}.edge{position:absolute;left:0;top:0;bottom:0;width:6px;cursor:ew-resize;z-index:1;touch-action:none}.edge:hover{background:#b9adf555}[hidden]{display:none!important}`;
  const panel=document.createElement('section'),bar=document.createElement('header'),title=document.createElement('strong');title.textContent='Wandel · '+location.hostname;title.title=document.title+' · '+location.href;
  const collapse=document.createElement('button');collapse.textContent='−';collapse.setAttribute('aria-label','Collapse Wandel to an icon');collapse.title='Collapse to icon';collapse.onclick=()=>this.collapse(true);
  const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label','Close Wandel workspace');close.onclick=()=>{this.destroy();this.close();};
  const pageButton=document.createElement('button');pageButton.textContent='Page chat';pageButton.hidden=true;pageButton.onclick=()=>this.restore();this.pageButton=pageButton;
  // Docked: flush to the right edge at full height, with the page narrowed beside it.
  const dock=document.createElement('button');this.dock=dock;dock.onclick=()=>this.setDocked(!this.docked);
  const edge=document.createElement('div');edge.className='edge';edge.hidden=true;edge.setAttribute('aria-hidden','true');this.edge=edge;
  const logo=document.createElement('img');logo.src=chrome.runtime.getURL('brand/wandel-mark.svg');logo.alt='';logo.onerror=()=>logo.remove();
  bar.append(logo,title,pageButton,dock,collapse,close);
  const frame=document.createElement('iframe');frame.title='Wandel — '+location.hostname;frame.src=chrome.runtime.getURL('sidepanel.html')+'?tabId='+tabId+'&embedded=1';frame.allow='microphone';
  const pill=document.createElement('button');pill.className='pill';pill.hidden=true;pill.setAttribute('aria-label','Open Wandel · '+location.hostname);pill.title='Wandel · '+location.hostname;
  // A compact launcher: a sparkle mark, draggable away from the page's own floating controls.
  const mark=document.createElementNS('http://www.w3.org/2000/svg','svg');mark.setAttribute('viewBox','0 0 24 24');mark.setAttribute('aria-hidden','true');const path=document.createElementNS(mark.namespaceURI,'path');path.setAttribute('d','M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z');path.setAttribute('fill','currentColor');mark.append(path);pill.append(mark);
  let moved=false,start:{x:number;y:number;left:number;top:number}|null=null;
  pill.addEventListener('pointerdown',e=>{const r=pill.getBoundingClientRect();start={x:e.clientX,y:e.clientY,left:r.left,top:r.top};moved=false;try{pill.setPointerCapture(e.pointerId);}catch{/* capture is a convenience; dragging still tracks the icon */}});
  pill.addEventListener('pointermove',e=>{if(!start)return;if(Math.abs(e.clientX-start.x)+Math.abs(e.clientY-start.y)>4)moved=true;if(!moved)return;pill.style.right='auto';pill.style.bottom='auto';pill.style.left=Math.max(4,Math.min(innerWidth-56,start.left+e.clientX-start.x))+'px';pill.style.top=Math.max(4,Math.min(innerHeight-56,start.top+e.clientY-start.y))+'px';});
  pill.addEventListener('pointerup',()=>{start=null;});
  pill.onclick=()=>{if(moved){moved=false;return;}this.collapse(false);this.restore();};
  panel.append(edge,bar,frame);shadow.append(style,panel,pill);document.documentElement.append(host);
  this.host=host;this.frame=frame;this.panel=panel;this.pill=pill;
  const signal=this.abort.signal;
  bar.addEventListener('pointerdown',e=>{if(this.docked||(e.target as Element).closest('button'))return;const r=panel.getBoundingClientRect();this.drag={x:e.clientX,y:e.clientY,left:r.left,top:r.top};bar.setPointerCapture(e.pointerId);frame.style.pointerEvents='none';},{signal});
  bar.addEventListener('pointermove',e=>{if(!this.drag)return;panel.style.right='auto';panel.style.left=Math.max(0,Math.min(innerWidth-panel.offsetWidth,this.drag.left+e.clientX-this.drag.x))+'px';panel.style.top=Math.max(0,Math.min(innerHeight-40,this.drag.top+e.clientY-this.drag.y))+'px';},{signal});
  const stop=()=>{this.drag=null;frame.style.pointerEvents='';};bar.addEventListener('pointerup',stop,{signal});bar.addEventListener('lostpointercapture',stop,{signal});
  let resizing:{x:number;width:number}|null=null;
  edge.addEventListener('pointerdown',e=>{resizing={x:e.clientX,width:panel.offsetWidth};try{edge.setPointerCapture(e.pointerId);}catch{/* still resizes while the pointer stays on the edge */}frame.style.pointerEvents='none';},{signal});
  edge.addEventListener('pointermove',e=>{if(!resizing)return;this.dockWidth=Math.round(Math.max(340,Math.min(720,innerWidth-200,resizing.width+resizing.x-e.clientX)));this.applyDock();},{signal});
  const endResize=()=>{if(!resizing)return;resizing=null;frame.style.pointerEvents='';this.remember();};edge.addEventListener('pointerup',endResize,{signal});edge.addEventListener('lostpointercapture',endResize,{signal});
  const clamp=()=>{if(panel.hidden||this.docked)return;const r=panel.getBoundingClientRect();if(r.right>innerWidth||r.left<0){panel.style.right='auto';panel.style.left=Math.max(0,innerWidth-r.width-12)+'px';}if(r.bottom>innerHeight||r.top<0)panel.style.top=Math.max(0,innerHeight-r.height-12)+'px';};
  window.addEventListener('resize',clamp,{signal});this.observer=new ResizeObserver(clamp);this.observer.observe(panel);
  this.applyDock();
  try{chrome.storage?.local.get(['wandelPanelDocked','wandelDockWidth']).then(saved=>{if(typeof saved.wandelDockWidth==='number')this.dockWidth=saved.wandelDockWidth;if(saved.wandelPanelDocked===true&&this.panel)this.setDocked(true,false);}).catch(()=>{});}catch{/* storage unavailable: start floating */}
 }
 setDocked(value:boolean,save=true){this.docked=value;this.applyDock();if(save)this.remember();}
 private remember(){try{void chrome.storage?.local.set({wandelPanelDocked:this.docked,wandelDockWidth:this.dockWidth}).catch(()=>{});}catch{/* the choice still applies to this page */}}
 private applyDock(){
  const panel=this.panel;if(!panel)return;
  panel.classList.toggle('docked',this.docked);if(this.edge)this.edge.hidden=!this.docked;
  if(this.dock){this.dock.textContent=this.docked?'⧉':'⇥';this.dock.title=this.docked?'Float panel':'Dock to side';this.dock.setAttribute('aria-label',this.docked?'Float the Wandel panel':'Dock Wandel to the side of the page');}
  if(this.docked){panel.style.left='';panel.style.top='';panel.style.height='';panel.style.width=this.dockWidth+'px';}else if(panel.style.width===this.dockWidth+'px'&&!panel.style.left)panel.style.width='';
  this.reservePage();
 }
 /** The page keeps its content beside the docked panel instead of under it. */
 private reservePage(){
  const space=this.docked&&this.panel&&!this.panel.hidden?this.dockWidth:0;
  if(!space){this.pageSpace?.remove();this.pageSpace=null;return;}
  if(!this.pageSpace){this.pageSpace=document.createElement('style');this.pageSpace.dataset.dxIgnore='true';this.pageSpace.dataset.wandelDock='true';}
  // Designed prototype pages are fixed to the window, so they are inset beside the docked panel too.
  this.pageSpace.textContent=`html{margin-right:${space}px!important}[data-dx-owned^="view:"]:not([role=dialog])[style*="position: fixed"]{right:${space+16}px!important}`;if(!this.pageSpace.isConnected)document.documentElement.append(this.pageSpace);
 }
 wholePage(tabId:number){
  this.show(tabId);if(this.pageButton)this.pageButton.hidden=true;
  const title=this.host?.shadowRoot?.querySelector('strong');if(title)title.textContent='Wandel · '+location.hostname;
  if(this.frame&&new URL(this.frame.src).searchParams.has('contextual'))this.frame.src=chrome.runtime.getURL('sidepanel.html')+'?tabId='+tabId+'&embedded=1';
 }
 focusSection(rect:DOMRect,label:string){
  if(!this.panel||!this.frame||!this.host)return;
  if(this.pageButton)this.pageButton.hidden=false;
  this.collapse(false);if(this.docked){const title=this.host.shadowRoot?.querySelector('strong');if(title){title.textContent='Wandel · '+label.slice(0,65);title.setAttribute('title',label);}this.frame.src=chrome.runtime.getURL('sidepanel.html')+'?tabId='+this.tabId+'&embedded=1&contextual=1';return;}
  const width=Math.min(390,innerWidth-24),height=Math.min(500,innerHeight-24);
  this.panel.style.width=width+'px';this.panel.style.height=height+'px';this.panel.style.right='auto';
  this.panel.style.left=Math.max(12,Math.min(innerWidth-width-12,rect.right+12+width<innerWidth?rect.right+12:rect.left-width-12))+'px';
  this.panel.style.top=Math.max(12,Math.min(innerHeight-height-12,rect.top))+'px';
  const title=this.host.shadowRoot?.querySelector('strong');if(title){title.textContent='Wandel · '+label.slice(0,65);title.setAttribute('title',label);}
  this.frame.src=chrome.runtime.getURL('sidepanel.html')+'?tabId='+this.tabId+'&embedded=1&contextual=1';
 }
 captureHidden(value:boolean){if(this.host)this.host.style.setProperty('visibility',value?'hidden':'visible','important');}
 collapse(value:boolean){if(this.panel)this.panel.hidden=value;if(this.pill)this.pill.hidden=!value;this.reservePage();}
 destroy(){this.pageSpace?.remove();this.pageSpace=null;this.observer?.disconnect();this.abort.abort();this.host?.remove();this.host=null;this.frame=null;this.panel=null;this.pill=null;this.abort=new AbortController();}
}
