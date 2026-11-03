/** General prototype behavior: when something happens on one element, show, hide, toggle, relabel or restyle others. Every change is reversible from a snapshot. */
export type Effect={action:'show'|'hide'|'toggle'|'text'|'style';el:HTMLElement;value?:string};
/** Declarations the assistant writes for any element, kept only when they are plain properties with safe values. */
export function safeDeclarations(css:string):[string,string][]{
 return css.split(';').map(part=>{const at=part.indexOf(':');return at<0?null:[part.slice(0,at).trim().toLowerCase(),part.slice(at+1).replace(/!important/gi,'').trim()] as [string,string];})
  .filter((pair):pair is [string,string]=>!!pair&&/^-?[a-z][a-z-]*$/.test(pair[0])&&!!pair[1]&&pair[1].length<=400&&!/[<>{}]|expression\s*\(|javascript:|@import|url\s*\((?!\s*['"]?data:image\/)/i.test(pair[1]));
}
interface Snapshot{css:string;texts:[Text,string][]}
export class Behaviors{
 private snapshots=new Map<HTMLElement,Snapshot>();private keys=new Set<string>();private styled=new Map<string,boolean>();
 readonly click=new Map<HTMLElement,{effects:Effect[];key:string}[]>();private cleanups:(()=>void)[]=[];
 /** Keeps an element's inline style and text as they were before the first behavior touched it. */
 private remember(el:HTMLElement){if(!this.snapshots.has(el)){const texts:[Text,string][]=[];const walk=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);for(let n=walk.nextNode();n;n=walk.nextNode())texts.push([n as Text,(n as Text).data]);this.snapshots.set(el,{css:el.getAttribute('style')||'',texts});}}
 private hidden(el:HTMLElement){return getComputedStyle(el).display==='none';}
 private show(el:HTMLElement){el.style.removeProperty('display');if(this.hidden(el))el.style.setProperty('display',/^(span|a|strong|em|b|i|small|label)$/i.test(el.tagName)?'inline':'block','important');}
 run(effects:Effect[],key:string){
  effects.forEach((effect,index)=>{const el=effect.el;if(!el.isConnected)return;this.remember(el);
   if(effect.action==='hide')el.style.setProperty('display','none','important');
   else if(effect.action==='show')this.show(el);
   else if(effect.action==='toggle'){if(this.hidden(el))this.show(el);else el.style.setProperty('display','none','important');}
   else if(effect.action==='text'){
    // Several labels separated by | take turns: "Show items ▾|Hide items ▴".
    const labels=(effect.value||'').split('|').map(label=>label.trim()).filter(Boolean);if(!labels.length)return;
    const walk=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let node:Text|null=null;for(let n=walk.nextNode();n;n=walk.nextNode())if((n as Text).data.trim()){node=n as Text;break;}
    const current=(node?.data||'').trim(),next=labels[(labels.indexOf(current)+1)%labels.length];if(node)node.data=node.data.replace(current,next);else el.append(document.createTextNode(next));
   }else if(effect.action==='style'){
    const id=key+':'+index,on=!this.styled.get(id),pairs=safeDeclarations(effect.value||'');this.styled.set(id,on);
    for(const [property,value] of pairs){if(on)el.style.setProperty(property,value,'important');else el.style.removeProperty(property);}
    if(!on){const before=this.snapshots.get(el)!;for(const [property] of pairs){const kept=new RegExp(`(^|;)\\s*${property}\\s*:([^;]*)`,'i').exec(before.css);if(kept)el.style.setProperty(property,kept[2].replace(/!important/i,'').trim());}}
   }
  });
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
 private restore(el:HTMLElement){const before=this.snapshots.get(el);if(!before)return;if(before.css)el.setAttribute('style',before.css);else el.removeAttribute('style');for(const [node,data] of before.texts)if(node.isConnected)node.data=data;this.snapshots.delete(el);}
 /** The click behaviors of the element a click landed in, nearest first. */
 forClick(target:Element|null){for(let el=target;el;){const found=this.click.get(el as HTMLElement);if(found)return found;const root=el.getRootNode();el=el.parentElement||(root instanceof ShadowRoot?root.host:null);}return null;}
 reset(){this.keys.clear();for(const cleanup of this.cleanups)cleanup();this.cleanups=[];for(const el of [...this.snapshots.keys()].reverse())this.restore(el);this.click.clear();this.styled.clear();}
}
