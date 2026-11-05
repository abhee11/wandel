/** General prototype behavior: when something happens on one element, show, hide, toggle, relabel or restyle others. Every change is reversible from a snapshot. */
export type Effect={action:'show'|'hide'|'toggle'|'text'|'style'|'choose';el:HTMLElement;value?:string};
/** One copied option of a pick-one group, with the original option it was copied from. */
export interface ChoiceMember{original:HTMLElement;item:HTMLElement;carrier:HTMLElement;text:string;originalText:string;background:string;labels:HTMLElement[];container?:HTMLElement}
interface ChoiceGroup{original:HTMLElement;members:ChoiceMember[];background:string;originalText:string;labels:HTMLElement[];container?:HTMLElement}
export const choiceOption='[role=option],[role=menuitemradio],[role=tab],[role=radio],input[type=radio]';
/** The visible option label, excluding dates, checkmarks and screen-reader helpers. */
export function choiceLabel(el:HTMLElement){const walk=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);for(let node=walk.nextNode();node;node=walk.nextNode()){const text=node.textContent?.trim();if(!text||text==='✓')continue;let hidden=false;for(let p=node.parentElement;p&&el.contains(p);p=p.parentElement){const css=getComputedStyle(p);if(p.closest('[data-dx-ignore]')||css.display==='none'||css.visibility==='hidden'||css.clip!=='auto'||css.clipPath!=='none'||parseFloat(css.width)<=1&&parseFloat(css.height)<=1&&css.overflow==='hidden'){hidden=true;break;}}if(!hidden)return text;}return '';}
/** Find a popup's displayed value without depending on the host's choice of tags.
 * Prefer its explicit ARIA owner; otherwise accept only the nearest, unambiguous
 * visible label above the popup. A date or an unrelated matching heading is not an owner. */
export function choiceLabels(root:HTMLElement,container:HTMLElement,texts:string[]):HTMLElement[]{
 const names=new Set(texts.filter(Boolean)),box=container.getBoundingClientRect();
 const candidates=[...root.querySelectorAll<HTMLElement>('*')].filter(node=>!container.contains(node)&&!node.closest('[data-dx-ignore],[data-dx-owned]')&&[...node.childNodes].some(child=>child.nodeType===Node.TEXT_NODE&&names.has((child.textContent||'').trim()))&&node.getBoundingClientRect().height>0&&getComputedStyle(node).visibility!=='hidden');
 const owners=container.id?[...root.querySelectorAll<HTMLElement>('[aria-controls],[aria-owns]')].filter(node=>[node.getAttribute('aria-controls'),node.getAttribute('aria-owns')].join(' ').split(/\s+/).includes(container.id)):[];
 const explicit=candidates.filter(node=>owners.some(owner=>owner===node||owner.contains(node)));if(explicit.length)return explicit;
 if(!box.height)return [];
 const nearby=candidates.map(node=>({node,rect:node.getBoundingClientRect()})).filter(({rect})=>rect.bottom<=box.top+8&&box.top-rect.bottom<180&&rect.right>=box.left&&rect.left<=box.right).sort((a,b)=>(box.top-a.rect.bottom)-(box.top-b.rect.bottom));
 if(!nearby.length||nearby[1]&&Math.abs(nearby[0].rect.bottom-nearby[1].rect.bottom)<8)return [];
 return [nearby[0].node];
}
/** Identify selection marks, never all SVGs (rows can contain ordinary icons). */
export function choiceChecks(root:Element):SVGElement[]{return [...root.querySelectorAll<SVGElement>('svg')].filter(svg=>/check|tick/i.test([svg.getAttribute('data-icon'),svg.getAttribute('aria-label'),svg.getAttribute('class')].join(' '))||[...svg.querySelectorAll('path,polyline')].some(p=>/^M\s*5[ ,]+12\s*l\s*4[ ,]+4\s*L\s*19[ ,]+6$/i.test(p.getAttribute('d')||'')||/^20[ ,]+6[ ,]+9[ ,]+17[ ,]+4[ ,]+12$/.test(p.getAttribute('points')||'')));}
/** Declarations the assistant writes for any element, kept only when they are plain properties with safe values. */
export function safeDeclarations(css:string):[string,string][]{
 return css.split(';').map(part=>{const at=part.indexOf(':');return at<0?null:[part.slice(0,at).trim().toLowerCase(),part.slice(at+1).replace(/!important/gi,'').trim()] as [string,string];})
  .filter((pair):pair is [string,string]=>!!pair&&/^-?[a-z][a-z-]*$/.test(pair[0])&&!!pair[1]&&pair[1].length<=400&&!/[<>{}]|expression\s*\(|javascript:|@import|url\s*\((?!\s*['"]?data:image\/)/i.test(pair[1]));
}
interface Snapshot{css:string;texts:[Text,string][];attrs:[string,string|null][]}
export class Behaviors{
 private snapshots=new Map<HTMLElement,Snapshot>();private keys=new Set<string>();private styled=new Map<string,boolean>();
 private choices=new Map<string,ChoiceGroup>();
 /** The option chosen in each group; it outlives a re-render, so a menu reopened later still shows the choice. */
 private chosen=new Map<string,string>();private workflow='';private copiedChoices=new Map<string,Set<string>>();private choiceTimers=new Set<ReturnType<typeof setTimeout>>();private addedChecks=new Map<HTMLElement,HTMLElement>();
 syncChoices(workflow:string,groups:Map<string,Set<string>>){
  if(this.workflow!==workflow){this.chosen.clear();this.copiedChoices.clear();this.workflow=workflow;}
  for(const [key,value] of this.chosen)if(!groups.has(key)||this.copiedChoices.get(key)?.has(value)&&!groups.get(key)?.has(value))this.chosen.delete(key);
  this.copiedChoices=groups;
 }
 setChoice(group:string,text:string){this.chosen.set(group,text);this.showChoice(group);}
 choiceOriginal(group:string){const node=this.choices.get(group)?.original;return node?.isConnected?node:undefined;}
 choiceTitle(group:string,labels:HTMLElement[]){const value=this.chosen.get(group);if(!value)return;for(const label of labels){if(!label.isConnected)continue;const node=[...label.childNodes].find((n):n is Text=>n instanceof Text&&!!n.data.trim());if(node&&node.data.trim()!==value){this.remember(label);node.data=node.data.replace(node.data.trim(),value);}}}
 readonly click=new Map<HTMLElement,{effects:Effect[];key:string}[]>();private cleanups:(()=>void)[]=[];
 /** Keeps an element's inline style and text as they were before the first behavior touched it. */
 private remember(el:HTMLElement){if(!this.snapshots.has(el)){const texts:[Text,string][]=[];const walk=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);for(let n=walk.nextNode();n;n=walk.nextNode())texts.push([n as Text,(n as Text).data]);this.snapshots.set(el,{css:el.getAttribute('style')||'',texts,attrs:['aria-selected','aria-checked','aria-label','role'].map(key=>[key,el.getAttribute(key)])});}}
 private hidden(el:HTMLElement){return getComputedStyle(el).display==='none';}
 private show(el:HTMLElement){el.style.removeProperty('display');if(this.hidden(el))el.style.setProperty('display',/^(span|a|strong|em|b|i|small|label)$/i.test(el.tagName)?'inline':'block','important');}
 /** Receives the elements a behavior just brought on screen, so they are checked once visible. */
 onReveal?:(revealed:HTMLElement[])=>void;
 run(effects:Effect[],key:string){
  const revealed:HTMLElement[]=[];
  effects.forEach((effect,index)=>{const el=effect.el;if(!el.isConnected)return;this.remember(el);const wasHidden=(effect.action==='show'||effect.action==='toggle')&&this.hidden(el);
   if(effect.action==='hide')el.style.setProperty('display','none','important');
   else if(effect.action==='show')this.show(el);
   else if(effect.action==='toggle'){if(this.hidden(el))this.show(el);else el.style.setProperty('display','none','important');}
   else if(effect.action==='text'){
    // Several labels separated by | take turns: "Show items ▾|Hide items ▴".
    const labels=(effect.value||'').split('|').map(label=>label.trim()).filter(Boolean);if(!labels.length)return;
    const walk=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let node:Text|null=null;for(let n=walk.nextNode();n;n=walk.nextNode())if((n as Text).data.trim()){node=n as Text;break;}
    const current=(node?.data||'').trim(),next=labels[(labels.indexOf(current)+1)%labels.length];if(node)node.data=node.data.replace(current,next);else el.append(document.createTextNode(next));
   }else if(effect.action==='choose'){this.choose(effect.value||'',el);
   }else if(effect.action==='style'){
    const id=key+':'+index,on=!this.styled.get(id),pairs=safeDeclarations(effect.value||'');this.styled.set(id,on);
    for(const [property,value] of pairs){if(on)el.style.setProperty(property,value,'important');else el.style.removeProperty(property);}
    if(!on){const before=this.snapshots.get(el)!;for(const [property] of pairs){const kept=new RegExp(`(^|;)\\s*${property}\\s*:([^;]*)`,'i').exec(before.css);if(kept)el.style.setProperty(property,kept[2].replace(/!important/i,'').trim());}}
   }
   if(wasHidden&&!this.hidden(el))revealed.push(el);
  });
  if(revealed.length)this.onReveal?.(revealed);
 }
 /** Registers a behavior; load effects run at once, hover effects undo themselves when the pointer leaves. */
 add(source:HTMLElement,event:'click'|'hover'|'load',effects:Effect[],key:string){
  // A page re-render applies operations again; a behavior registers once until the next reset, so a list the user expanded stays expanded.
  if(this.keys.has(key))return;this.keys.add(key);
  if(event==='load'){this.run(effects,key);return;}
  if(event==='click'){const list=this.click.get(source)||[];list.push({effects,key});this.click.set(source,list);this.remember(source);source.style.setProperty('cursor','pointer');return;}
  const enter=()=>this.run(effects.map(e=>e.action==='toggle'?{...e,action:'show' as const}:e),key),leave=()=>{for(const e of effects)this.restore(e.el);this.styled.delete(key+':0');};
  source.addEventListener('pointerenter',enter);source.addEventListener('pointerleave',leave);this.cleanups.push(()=>{source.removeEventListener('pointerenter',enter);source.removeEventListener('pointerleave',leave);});
 }
 /** Registers a copied option; its original joins the group too, so the user can pick it again. */
 addChoice(group:string,member:ChoiceMember){
  let entry=this.choices.get(group);
  if(!entry||entry.original!==member.original||!entry.original.isConnected){entry={original:member.original,members:[],background:member.background,originalText:member.originalText,labels:member.labels,container:member.container};this.choices.set(group,entry);}
  entry.members=entry.members.filter(m=>m.item.isConnected&&m.item!==member.item).concat(member);if(member.labels.length)entry.labels=member.labels;
  for(const native of this.nativeOptions(entry))this.onClick(native,group);
  this.onClick(member.item,group);this.showChoice(group);
 }
 /** The pick-one group an element belongs to, as an original option or a copied one. */
 groupFor(el:Element){for(const [key,entry] of this.choices)if(this.nativeOptions(entry).some(node=>node===el||node.contains(el))||entry.members.some(member=>member.item===el||member.item.contains(el)))return key;return undefined;}
 private nativeOptions(entry:ChoiceGroup){return entry.container?[...entry.container.querySelectorAll<HTMLElement>(choiceOption)].filter(el=>!el.closest('[data-dx-owned]')):[entry.original];}
 private onClick(el:HTMLElement,group:string){const list=(this.click.get(el)||[]).filter(entry=>entry.key!=='choice:'+group);list.push({effects:[{action:'choose',el,value:group}],key:'choice:'+group});this.click.set(el,list);}
 private choose(group:string,el:HTMLElement){
  const entry=this.choices.get(group);if(!entry)return;
  const member=entry.members.find(m=>m.item===el||m.item.contains(el));this.chosen.set(group,member?member.text:choiceLabel(el)||entry.originalText);this.showChoice(group);
  // Tabs and radio groups stay open. Only dismiss a popup, and only click its backdrop.
  const menu=entry.container||entry.original.closest<HTMLElement>('[role=listbox],[role=menu]');if(!menu?.matches('[role=listbox],[role=menu]'))return;
  const key={key:'Escape',code:'Escape',bubbles:true,cancelable:true};(document.activeElement||document.body).dispatchEvent(new KeyboardEvent('keydown',key));
  const dismiss=()=>{if(!menu.isConnected||!menu.getBoundingClientRect().height)return;
   let overlay=menu.parentElement;while(overlay&&getComputedStyle(overlay).position!=='fixed')overlay=overlay.parentElement;
   if(!overlay)return;const r=overlay.getBoundingClientRect();
   for(const [x,y] of [[r.left+2,r.top+2],[r.right-2,r.top+2],[r.left+2,r.bottom-2],[r.right-2,r.bottom-2]]){if(x<0||y<0||x>=innerWidth||y>=innerHeight)continue;const hit=document.elementFromPoint(x,y);if(hit!==overlay)continue;
    for(const type of ['pointerdown','mousedown','pointerup','mouseup','click'])hit.dispatchEvent(new (type.startsWith('pointer')?PointerEvent:MouseEvent)(type,{bubbles:true,cancelable:true,view:window,clientX:x,clientY:y}));break;}
  };dismiss();
  // A menu that ignores both closes through its own button.
  const timer=setTimeout(()=>{this.choiceTimers.delete(timer);if(menu.isConnected&&menu.getBoundingClientRect().height)entry.labels.find(label=>label.isConnected&&label.matches('button,[role=button],[role=combobox]'))?.click();},80);this.choiceTimers.add(timer);
 }
 private showChoice(group:string){
  const entry=this.choices.get(group);if(!entry)return;const chosen=this.chosen.get(group)||entry.originalText;
  const paint=(item:HTMLElement,carrier:HTMLElement,text:string)=>{
   const on=text===chosen;this.remember(carrier);const color=on?entry.background:'transparent';if(carrier.style.backgroundColor!==color)carrier.style.setProperty('background-color',color,'important');
   const role=entry.container?.getAttribute('role')==='menu'?'menuitemradio':entry.container?.getAttribute('role')==='tablist'?'tab':entry.container?.getAttribute('role')==='radiogroup'?'radio':'option';
   if(carrier.getAttribute('role')!==role)carrier.setAttribute('role',role);const attr=['radio','menuitemradio'].includes(role)?'aria-checked':'aria-selected';if(carrier.getAttribute(attr)!==String(on))carrier.setAttribute(attr,String(on));
   const label=carrier.getAttribute('aria-label');if(label&&/[, ]+selected\b/i.test(label))carrier.setAttribute('aria-label',label.replace(/,?\s*selected\b/ig,'').trim());
   const checks=choiceChecks(item);for(const check of checks){const wrapper=check.parentElement?.matches('[data-dx-owned]')&&check.parentElement.childElementCount===1?check.parentElement:check as unknown as HTMLElement;this.remember(wrapper);const display=on?'inline-flex':'none';if(wrapper.style.display!==display)wrapper.style.setProperty('display',display,'important');}
   // Unselected source rows may have no checkmark to copy.
   if(!checks.length){let check=this.addedChecks.get(carrier);if(!check){check=document.createElement('span');check.dataset.dxIgnore='true';check.setAttribute('aria-hidden','true');check.textContent='✓';check.style.cssText='margin-inline-start:auto;flex:none';carrier.append(check);this.addedChecks.set(carrier,check);}check.hidden=!on;}
  };
  for(const native of this.nativeOptions(entry))paint(native,native,choiceLabel(native));
  for(const member of entry.members)paint(member.item,member.carrier,member.text);
  this.choiceTitle(group,entry.labels);
 }
 private restore(el:HTMLElement){const before=this.snapshots.get(el);if(!before)return;if(before.css)el.setAttribute('style',before.css);else el.removeAttribute('style');for(const [node,data] of before.texts)if(node.isConnected)node.data=data;for(const [key,value] of before.attrs){if(value===null)el.removeAttribute(key);else el.setAttribute(key,value);}this.snapshots.delete(el);}
 /** The click behaviors of the element a click landed in, nearest first. */
 forClick(target:Element|null){for(let el=target;el;){const found=this.click.get(el as HTMLElement);if(found)return found;const root=el.getRootNode();el=el.parentElement||(root instanceof ShadowRoot?root.host:null);}return null;}
 reset(){for(const timer of this.choiceTimers)clearTimeout(timer);this.choiceTimers.clear();for(const check of this.addedChecks.values())check.remove();this.addedChecks.clear();this.keys.clear();for(const cleanup of this.cleanups)cleanup();this.cleanups=[];for(const el of [...this.snapshots.keys()].reverse())this.restore(el);this.click.clear();this.styled.clear();this.choices.clear();}
}
