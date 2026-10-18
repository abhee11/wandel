import {safeText} from './locator';
export function isSettingsRequest(prompt:string){return /\badvanced\b/i.test(prompt)&&/\b(theme|dark|light|resize|screen size)\b/i.test(prompt);}
const visible=(el:HTMLElement)=>{
 if(el.closest('[hidden],[aria-hidden="true"],[data-dx-ignore],[data-dx-owned]'))return false;
 for(let node:HTMLElement|null=el;node;node=node.parentElement){const css=getComputedStyle(node);if(css.display==='none'||css.visibility==='hidden')return false;}
 return true;
};
/** Prefer a tab's explicit panel association; otherwise identify the settings content, never its navigation item. */
export function advancedTarget(root:HTMLElement):HTMLElement{
 const tabs=[...root.querySelectorAll<HTMLElement>('button,a,[role="tab"],li,span,div')].filter(el=>visible(el)&&safeText(el)==='Advanced'&&!el.querySelector('button,[role="tab"]'));
 const linked=tabs.flatMap(tab=>{const id=tab.getAttribute('aria-controls');const panel=id?document.getElementById(id):null;return panel&&visible(panel)?[panel]:[];});
 const panels=[...new Set(linked)];if(panels.length===1)return panels[0];if(panels.length>1)throw new Error('More than one Advanced panel is open. Select the intended content area.');
 const headings=[...root.querySelectorAll<HTMLElement>('h1,h2,h3,h4,label,p,span,div')].filter(el=>visible(el)&&/^(test timeout|wait before step|default run mode|default test category)$/i.test(safeText(el)));
 const candidates=new Set<HTMLElement>();
 for(const heading of headings){let node=heading.parentElement;while(node&&node!==root){if(new Set(headings.filter(h=>node!.contains(h)).map(h=>safeText(h).toLowerCase())).size>=2&&node.querySelectorAll('input').length>=2&&!tabs.some(tab=>node!.contains(tab))){candidates.add(node);break;}node=node.parentElement;}}
 const smallest=[...candidates].filter(el=>![...candidates].some(other=>other!==el&&el.contains(other)));
 if(smallest.length===1)return smallest[0];
 throw new Error('Open Settings → Advanced, then select its content area. I could not identify one unambiguous Advanced panel.');
}

/** Runtime-only effects. Every changed style is restored on Undo, reset or panel teardown. */
export function mountSettings(host:HTMLElement,target:HTMLElement,kind:'theme'|'viewport'):()=>void{
 host.addEventListener('input',e=>e.stopPropagation());host.addEventListener('change',e=>e.stopPropagation());host.addEventListener('click',e=>e.stopPropagation());host.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'&&e.target instanceof HTMLInputElement)e.preventDefault();});
 host.dataset.dxInteractive='true';host.style.cssText='display:block;font:inherit;color:inherit;margin:28px 0;';
 const heading=document.createElement('h3');heading.textContent=kind==='theme'?'Appearance':'Screen size';
 const reference=target.querySelector<HTMLElement>('h2,h3,h4');const css=getComputedStyle(reference||target);
 heading.style.cssText=`font-family:${css.fontFamily};font-size:${css.fontSize};font-weight:${css.fontWeight};color:inherit;border-bottom:1px solid #dddddd80;padding:0 0 12px;margin:0 0 16px;`;
 const note=document.createElement('p');note.textContent=kind==='theme'?'Choose the theme for this settings preview.':'Preview this section at a different size.';note.style.cssText='font:inherit;color:inherit;margin:0 0 12px;';host.append(heading,note);
 const changes=new Map<HTMLElement,Map<string,{before:string;priority:string;after:string}>>();
 const set=(el:HTMLElement,key:string,value:string)=>{let record=changes.get(el);if(!record){record=new Map();changes.set(el,record);}const old=record.get(key);record.set(key,{before:old?.before??el.style.getPropertyValue(key),priority:old?.priority??el.style.getPropertyPriority(key),after:value});el.style.setProperty(key,value,'important');};
 const restore=()=>{for(const [el,props] of changes)for(const [key,v] of props)if(el.style.getPropertyValue(key)===v.after){if(v.before)el.style.setProperty(key,v.before,v.priority);else el.style.removeProperty(key);}changes.clear();};
 const button=(label:string,parent:HTMLElement,action:()=>void)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='font:inherit;color:inherit;background:transparent;border:1px solid #9898a8;border-radius:8px;padding:8px 14px;margin:0 8px 8px 0;cursor:pointer;';b.onclick=e=>{e.stopPropagation();action();};parent.append(b);return b;};
 if(kind==='theme'){
  const apply=(dark:boolean)=>{restore();set(target,'background-color',dark?'rgb(30, 32, 40)':'rgb(255, 255, 255)');set(target,'color',dark?'rgb(240, 242, 248)':'rgb(36, 38, 48)');for(const el of target.querySelectorAll<HTMLElement>('h1,h2,h3,h4,p,label,span,input,button,select')){set(el,'color',dark?'rgb(240, 242, 248)':'rgb(36, 38, 48)');if(el.matches('input,select,button'))set(el,'background-color',dark?'rgb(43, 46, 57)':'rgb(255, 255, 255)');}light.setAttribute('aria-pressed',String(!dark));night.setAttribute('aria-pressed',String(dark));};
  const light=button('Light',host,()=>apply(false)),night=button('Dark',host,()=>apply(true));light.setAttribute('aria-pressed','true');night.setAttribute('aria-pressed','false');button('Original',host,()=>{restore();light.setAttribute('aria-pressed','false');night.setAttribute('aria-pressed','false');});
 }else{
  const panel=document.createElement('div');panel.hidden=true;panel.style.cssText='padding:16px;border:1px solid #9898a8;border-radius:8px;margin-top:8px;';
  const open=button('Resize preview',host,()=>{panel.hidden=!panel.hidden;open.setAttribute('aria-expanded',String(!panel.hidden));});open.setAttribute('aria-expanded','false');host.append(panel);
  const slider=document.createElement('input');slider.type='range';slider.min='280';slider.max='1200';slider.value='768';slider.setAttribute('aria-label','Preview width slider');slider.style.cssText='display:block;width:100%;margin:12px 0;';
  const resize=(width:number)=>{slider.value=String(width);set(target,'width',width+'px');set(target,'max-width','100%');set(target,'box-sizing','border-box');};
  slider.oninput=()=>resize(Number(slider.value));panel.append(slider);
  for(const [label,width] of [['Mobile · 375',375],['Tablet · 768',768],['Desktop · 1200',1200]] as const)button(label,panel,()=>resize(width));
  const label=document.createElement('label');label.textContent='Custom width (px) ';const input=document.createElement('input');input.type='number';input.min='280';input.max='2400';input.setAttribute('aria-label','Custom preview width');input.style.cssText='font:inherit;width:100px;padding:8px;color:inherit;background:transparent;border:1px solid #9898a8;border-radius:6px;';input.oninput=()=>{if(input.value&&input.checkValidity())resize(Number(input.value));};label.append(input);panel.append(label);button('Reset size',panel,restore);button('Close',panel,()=>{panel.hidden=true;open.setAttribute('aria-expanded','false');});
  const detail=document.createElement('small');detail.textContent='Local section preview; this does not resize your browser or emulate device media queries.';panel.append(detail);
 }
 return restore;
}
