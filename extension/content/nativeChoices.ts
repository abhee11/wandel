import {uid,type Operation} from '../shared/model';
import {describe} from './locator';
const properties=['font-family','font-size','font-weight','line-height','letter-spacing','color','background-color','border','border-radius','padding','margin','display','flex-direction','gap','align-items','justify-content'] as const;
function appearance(el:HTMLElement){const css=getComputedStyle(el);return Object.fromEntries(properties.map(p=>[p,css.getPropertyValue(p)]).filter(([,v])=>v&&!/url\s*\(|expression|[<>\\]/i.test(v))) as Record<string,string>;}
/** Match a choice section to a nearby real choice section, rather than a generic panel or primary action. */
export function nativeChoices(prompt:string,ops:Operation[],target:HTMLElement):Operation[]{
 if(!/\b(section|category)\b/i.test(prompt)||! /\b(toggles?|options?|choices?|pills?)\b/i.test(prompt))return ops;
 const single=ops.length===1&&ops[0].kind==='insert'?ops[0]:null;
 if(single?.node.control?.kind==='switch'&&single.node.control.options.length>=2){
  const {control,...node}=single.node;
  const expanded:Operation[]=[{...single,node},...control.options.map(text=>({id:uid(),kind:'insert' as const,target:single.target,position:'inside' as const,node:{id:uid(),kind:'button' as const,text}}))];
  return nativeChoices(prompt,expanded,target);
 }
 const inserts=ops.filter((op):op is Extract<Operation,{kind:'insert'}>=>op.kind==='insert');
 const heading=inserts.filter(op=>op.node.kind==='panel'||op.node.kind==='text');
 const buttons=inserts.filter(op=>op.node.kind==='button');
 if(inserts.some(op=>op.node.control)||heading.length!==1||buttons.length<2||buttons.length>8||inserts.length!==ops.length)return ops;
 const references=[...target.querySelectorAll<HTMLElement>('button[aria-pressed],[role="switch"],[role="radio"]')].filter(el=>!el.closest('[data-dx-owned],[data-dx-ignore]'));
 const reference=references.at(-1);if(!reference)return ops;
 let section=reference.parentElement;
 while(section&&section!==target&&(!section.querySelector('h2,h3,h4')||section.querySelectorAll('h2,h3,h4').length!==1))section=section.parentElement;
 if(!section||section===target)return ops;
 const title=section.querySelector<HTMLElement>('h2,h3,h4')!;
 const options=buttons.map(op=>op.node.text.replace(/\s*[-–—:]\s*(?:on|off)$/i,'').trim());
 if(new Set(options).size!==options.length)return ops;
 const selected=buttons.findIndex(op=>/[-–—:]\s*on$/i.test(op.node.text));
 return [{id:uid(),kind:'insert',target:describe(section).locator,position:'after',node:{id:uid(),kind:'panel',text:heading[0].node.text,choices:{options,selected:selected<0?0:selected,headingTag:title.tagName.toLowerCase() as 'h2'|'h3'|'h4',headingStyle:appearance(title),buttonStyle:appearance(reference),sectionStyle:appearance(section)}}}];
}
export function mountChoices(host:HTMLElement,config:NonNullable<Extract<Operation,{kind:'insert'}>['node']['choices']>,text:string){
 host.replaceChildren();host.style.cssText='';Object.assign(host.dataset,{dxInteractive:'true'});
 const apply=(el:HTMLElement,styles:Record<string,string>)=>{for(const [k,v]of Object.entries(styles))el.style.setProperty(k,v);};
 apply(host,config.sectionStyle);if(host.style.display==='flex'&&!host.style.flexDirection)host.style.flexDirection='column';const heading=document.createElement(config.headingTag);heading.textContent=text;apply(heading,config.headingStyle);
 const row=document.createElement('div');row.style.cssText='display:flex;flex-wrap:wrap;gap:12px;align-items:center;';row.setAttribute('role','radiogroup');row.setAttribute('aria-label',text);
 let selected=config.selected;const controls:HTMLButtonElement[]=[];
 const paint=()=>controls.forEach((b,i)=>{const active=i===selected;b.setAttribute('aria-checked',String(active));b.textContent=config.options[i]+(active?' ✓':'');b.style.opacity=active?'1':'0.65';});
 config.options.forEach((label,i)=>{const b=document.createElement('button');b.type='button';b.setAttribute('role','radio');b.setAttribute('aria-label',label);apply(b,config.buttonStyle);b.style.cursor='pointer';b.onclick=e=>{e.preventDefault();e.stopPropagation();selected=i;paint();};b.onkeydown=e=>{if(['ArrowRight','ArrowDown','ArrowLeft','ArrowUp'].includes(e.key)){e.preventDefault();e.stopPropagation();selected=(i+(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)+controls.length)%controls.length;paint();controls[selected].focus();}};controls.push(b);row.append(b);});paint();host.append(heading,row);
}
