import type {Operation} from '../shared/model';
import {applyAppearance} from './nativeDesign';
type Node=Extract<Operation,{kind:'insert'}>['node'];
/** Local declarative controls only: never copy host handlers or execute generated code. */
export function mountControl(host:HTMLElement,node:Node){
 const control=node.control;if(!control)return;
 host.replaceChildren();host.addEventListener('input',e=>e.stopPropagation());host.addEventListener('change',e=>e.stopPropagation());host.dataset.dxInteractive='true';
 const title=document.createElement('span');title.textContent=node.text;host.append(title);
 const row=document.createElement('div');row.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin-top:8px';host.append(row);
 const buttons:HTMLButtonElement[]=[];let selected=0,on=false;
 const body=document.createElement('div');body.style.cssText='margin-top:12px;white-space:pre-wrap';host.append(body);
 if(control.kind==='tabs'){row.setAttribute('role','tablist');row.setAttribute('aria-label',node.text);body.setAttribute('role','tabpanel');}
 if(control.kind==='menu'){const select=document.createElement('select');select.setAttribute('aria-label',node.text);applyAppearance(select,node.inputAppearance||node.appearance||{});for(const label of control.options){const option=document.createElement('option');option.textContent=label;select.append(option);}select.onchange=e=>{e.stopPropagation();selected=select.selectedIndex;body.textContent=control.contents?.[selected]||'';};select.onclick=e=>e.stopPropagation();row.append(select);body.textContent=control.contents?.[0]||'';return;}
 const paint=()=>{buttons.forEach((b,i)=>{if(control.kind==='switch'){b.setAttribute('aria-checked',String(on));b.textContent=on?'On':'Off';}else{b.setAttribute('aria-selected',String(selected===i));b.tabIndex=selected===i?0:-1;b.style.outline=selected===i?'2px solid currentColor':'';}});body.textContent=control.contents?.[selected]||'';if(control.kind==='tabs'&&buttons[selected])body.setAttribute('aria-labelledby',buttons[selected].id);};
 for(const [i,label]of (control.kind==='switch'?[node.text]:control.options).entries()){
  const b=document.createElement('button');b.type='button';b.id='wandel-'+node.id+'-'+i;b.setAttribute('role',control.kind==='switch'?'switch':'tab');b.setAttribute('aria-label',label);b.textContent=label;applyAppearance(b,node.inputAppearance||node.appearance||{});b.style.cursor='pointer';
  b.onclick=e=>{e.preventDefault();e.stopPropagation();selected=i;on=!on;paint();};
  b.onkeydown=e=>{if(control.kind==='tabs'&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();selected=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowLeft'?-1:1)+buttons.length)%buttons.length;paint();buttons[selected].focus();}};
  buttons.push(b);row.append(b);
 }
 paint();
}
