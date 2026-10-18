/** Explicit controls for the temporary destination browser; no host form events. */
export class DestinationBrowserControls {
 private host:HTMLElement;
 constructor(private doc:Document=document,private finish:(action:'use'|'cancel')=>Promise<void>=async action=>{const result=await chrome.runtime.sendMessage({type:'WANDEL_BROWSER_FINISH',action});if(result?.error)throw new Error(result.error);if(!result?.ok)throw new Error('This browsing session has ended. Return to Wandel.');}){this.host=doc.createElement('div');}
 private mounted=false;
 private cleanup=()=>{};
 destroy(){this.cleanup();this.host.remove();this.mounted=false;}
 show(){
  if(this.mounted)return;this.mounted=true;this.host.dataset.dxIgnore='true';
  this.host.style.cssText='position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:2147483647;max-width:calc(100vw - 24px)';
  const shadow=this.host.attachShadow({mode:'open'}),style=this.doc.createElement('style');style.textContent=':host{all:initial}*{box-sizing:border-box}.bar{font:13px/1.4 system-ui;display:flex;align-items:center;flex-wrap:wrap;gap:10px;padding:12px 16px;background:white;color:#29273b;border:1px solid #d9d3ec;border-radius:14px;box-shadow:0 6px 32px #20153c33}strong{font-size:13px}button{font:inherit;cursor:pointer;border:1px solid #ddd6ef;border-radius:8px;padding:9px 12px;background:white;color:#554781}button.primary{background:#6952d4;color:white;border-color:#6952d4}button:disabled{opacity:.5;cursor:wait}p{flex-basis:100%;margin:0;color:#a12b49;max-width:420px}';
  const bar=this.doc.createElement('div');bar.className='bar';bar.setAttribute('role','region');bar.setAttribute('aria-label','Wandel destination browser');
  const name=this.doc.createElement('strong');name.textContent='Wandel · Choose a destination';const status=this.doc.createElement('p');status.setAttribute('role','status');status.hidden=true;
  const finish=this.doc.createElement('button');finish.type='button';finish.className='primary';finish.textContent='Use this screen & close';
  const cancel=this.doc.createElement('button');cancel.type='button';cancel.textContent='Cancel & return';
  const act=async(action:'use'|'cancel')=>{finish.disabled=cancel.disabled=true;status.hidden=false;status.textContent=action==='use'?'Capturing this screen…':'Returning…';try{await this.finish(action);}catch(error){status.textContent=error instanceof Error?error.message:'Could not finish. Please retry.';finish.disabled=cancel.disabled=false;}};
  const isolate=(event:Event)=>{const path=event.composedPath();if(!path.includes(this.host))return;event.stopImmediatePropagation();if(event.type==='click'){event.preventDefault();if(path.includes(finish)&&!finish.disabled)void act('use');else if(path.includes(cancel)&&!cancel.disabled)void act('cancel');}};
  const events=['pointerdown','pointerup','mousedown','mouseup','click','focusin','focusout'];for(const type of events)this.doc.defaultView?.addEventListener(type,isolate,true);this.cleanup=()=>{for(const type of events)this.doc.defaultView?.removeEventListener(type,isolate,true);};
  bar.append(name,finish,cancel,status);shadow.append(style,bar);this.doc.documentElement.append(this.host);
 }
}
