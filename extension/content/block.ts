import {namedIcon,renderIcon} from './copyIcon';
import type {Block,BlockNode} from '../shared/block';
const tones:Record<string,string>={none:'#ffffff',pink:'#ffebed',peach:'#fff1e3',yellow:'#fff6dc',lime:'#f3ffe0',mint:'#e3fbf5',sky:'#e9f1ff',lilac:'#f1ebff',gray:'#f3f3f6'};
const ink='#14131b',muted='#6e6c7f',line='#eae6f1';
const icon=(name:string,size:number,color:string)=>{const box=document.createElement('span');box.style.cssText=`display:inline-flex;flex-shrink:0;width:${size}px;height:${size}px;color:${color};`;try{box.append(renderIcon(namedIcon(name)));}catch{box.style.display='none';}return box;};
const el=<K extends keyof HTMLElementTagNameMap>(tag:K,css:string,text?:string|null)=>{const node=document.createElement(tag);node.style.cssText=css;if(text)node.textContent=text;return node;};
/** Renders a composed section into its host. Interactive state lives in data attributes so the host page's own handlers never run. */
export function mountBlock(host:HTMLElement,block:Block,register:(id:string,node:HTMLElement)=>void){
 const accent=block.accent||'#7b4cf6',built:HTMLElement[]=[];
 host.textContent='';host.dataset.dxBlock='true';host.style.setProperty('--dx-accent',accent);
 // Host pages may set overflow-wrap:anywhere; block text breaks inside words only when a word cannot fit.
 host.style.setProperty('overflow-wrap','break-word');host.style.setProperty('word-break','normal');
 block.nodes.forEach((node,i)=>{
  const part=render(node,accent);built.push(part);if(node.id){part.dataset.dxOwned=node.id;register(node.id,part);}
  if(i===0)host.append(part);else (built[node.parent].querySelector<HTMLElement>(':scope > [data-dx-body]')||built[node.parent]).append(part);
 });
 refreshTemplates(host);
 // A grid keeps the column count asked for; its tiles turn compact when columns get narrow.
 if(!host.lang)host.lang=document.documentElement.lang||'en';
 for(const grid of host.querySelectorAll<HTMLElement>('[data-dx-grid]')){
  if(!grid.querySelector(':scope > [data-dx-tile]'))continue;
  // Pure CSS so it also holds in background tabs, where resize callbacks do not run.
  const columns=Number(grid.dataset.dxColumns),gap=Number(grid.dataset.dxGap),id=grid.dataset.dxGrid,tile=`[data-dx-grid="${id}"] > [data-dx-tile]`,style=document.createElement('style');
  style.textContent=`@container dxg-${id} (max-width:${150*columns+gap*(columns-1)}px){${tile}{padding:12px!important;gap:6px!important}${tile}[aria-checked="true"]{padding:11px!important}${tile} > span:first-child{width:36px!important;height:36px!important;padding:8px!important;margin-bottom:4px!important}${tile} > strong{font-size:14px!important}${tile} > strong + span{font-size:13px!important}}`;
  host.prepend(style);
 }
 // Interact mode lets page clicks through; replay mode routes them via the renderer's capture handler.
 host.addEventListener('click',event=>{if(blockInteract(event.target))event.preventDefault();});
}
function render(node:BlockNode,accent:string):HTMLElement{
 const text=node.text||'';
 switch(node.type){
  case 'card':{const card=el('div',`display:flex;flex-direction:column;gap:16px;box-sizing:border-box;min-width:0;padding:32px;border:1px solid ${line};border-radius:32px;background:${node.tone&&node.tone!=='none'?`linear-gradient(181deg, ${tones[node.tone]} 3px, #fcfbfd 120px)`:'#fff'};color:${ink};`);return card;}
  case 'stack':return el('div',`display:flex;flex-direction:column;gap:${node.level?node.level*4:12}px;min-width:0;`);
  case 'row':return el('div',`display:flex;flex-wrap:wrap;align-items:center;gap:${node.level?node.level*8:16}px 24px;min-width:0;justify-content:${({start:'flex-start',between:'space-between',end:'flex-end',center:'center'})[node.justify||'start']};`);
  case 'grid':{const gap=node.level?node.level*8:20,columns=node.columns||2,id=Math.random().toString(36).slice(2,10),grid=el('div',`display:grid;grid-template-columns:repeat(${columns},minmax(0,1fr));gap:${gap}px;min-width:0;container-type:inline-size;container-name:dxg-${id};`);grid.dataset.dxGrid=id;grid.dataset.dxColumns=String(columns);grid.dataset.dxGap=String(gap);return grid;}
  case 'heading':{const level=node.level||3,tag=(['h2','h3','h4','h5'] as const)[level-1];const sizes=[[28,1.25],[22,1.3],[18,1.4],[16,1.4]][level-1];const h=el(tag,`margin:0;font-weight:${level<4?700:600};font-size:${sizes[0]}px;line-height:${sizes[1]};font-family:inherit;color:${ink};`,text);template(h,text);return h;}
  case 'text':{const p=el('p',`margin:0;font-size:${node.level===1?17:node.level===3?14:15}px;line-height:1.6;font-family:inherit;color:${node.variant==='primary'?ink:muted};`,text);template(p,text);return p;}
  case 'eyebrow':return el('span',`font-weight:700;font-size:12px;line-height:1.4;font-family:inherit;letter-spacing:.04em;text-transform:uppercase;color:${accent};`,text);
  case 'link':{const b=el('button',`all:unset;cursor:pointer;font-weight:600;font-size:15px;line-height:1.4;font-family:inherit;color:${accent};`,text);b.type='button';return b;}
  case 'button':{
   const variant=node.variant||'primary',b=el('button',`display:inline-flex;align-items:center;justify-content:center;gap:8px;box-sizing:border-box;min-height:48px;padding:0 28px;border-radius:999px;cursor:pointer;font-weight:600;font-size:16px;line-height:1;font-family:inherit;white-space:nowrap;${variant==='primary'?`background:${accent};color:#fff;border:0;`:variant==='outline'?`background:transparent;color:${ink};border:1.5px solid ${ink};`:`background:transparent;color:${ink};border:0;padding:0 12px;`}`,text);
   b.type='button';if(node.icon)b.append(icon(node.icon,16,'currentColor'));return b;}
  case 'icon':{const wrap=icon(node.icon||'',node.level===1?44:24,ink);if(node.variant==='primary'){wrap.style.cssText+=`;width:44px;height:44px;padding:10px;box-sizing:border-box;border-radius:50%;background:${accent}14;color:${accent};`;}return wrap;}
  case 'stat':{const s=el('span',`display:inline-flex;align-items:center;gap:8px;font-weight:400;font-size:16px;line-height:1.4;font-family:inherit;color:${ink};`);if(node.icon)s.append(icon(node.icon,22,accent));s.append(el('span','',text));return s;}
  case 'tile':{
   const t=el('button',`all:unset;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;min-width:0;padding:20px;border-radius:24px;cursor:pointer;text-align:left;font-family:inherit;color:${ink};`);
   t.type='button';t.setAttribute('role','radio');t.dataset.dxTile=node.text||'';
   if(node.icon){const badge=icon(node.icon,22,ink);badge.style.cssText+=`;width:44px;height:44px;padding:11px;box-sizing:border-box;border-radius:50%;background:#f3effa;margin-bottom:8px;`;t.append(badge);}
   t.append(el('strong','hyphens:auto;font-weight:700;font-size:17px;line-height:1.3;font-family:inherit;',text));if(node.detail)t.append(el('span',`hyphens:auto;font-weight:400;font-size:14px;line-height:1.45;font-family:inherit;color:${muted};`,node.detail));
   paintTile(t,!!node.selected,accent);return t;}
  case 'field':{
   const row=el('div',`display:grid;grid-template-columns:minmax(96px,160px) minmax(0,1fr) auto;align-items:baseline;gap:16px;font-family:inherit;`);
   row.append(el('span',`font-weight:400;font-size:15px;line-height:1.5;font-family:inherit;color:${muted};`,text),el('span',`font-weight:400;font-size:16px;line-height:1.5;font-family:inherit;color:${ink};min-width:0;`,node.detail||''));
   if(node.action){const a=el('button',`all:unset;cursor:pointer;font-weight:600;font-size:15px;line-height:1.5;font-family:inherit;color:${accent};`,node.action);a.type='button';row.append(a);}else row.append(el('span',''));return row;}
  case 'choice':{
   const group=el('div','display:flex;flex-wrap:wrap;gap:12px 28px;');group.setAttribute('role','radiogroup');const chosen=node.detail&&node.options?.includes(node.detail)?node.detail:node.options![0];
   for(const option of node.options||[]){const b=el('button',`all:unset;display:inline-flex;align-items:center;gap:10px;cursor:pointer;font-weight:500;font-size:16px;line-height:1.4;font-family:inherit;color:${ink};`);b.type='button';b.setAttribute('role','radio');b.dataset.dxChoice=option;const dot=el('span','box-sizing:border-box;width:20px;height:20px;border-radius:50%;flex-shrink:0;');b.append(dot,el('span','',option));paintChoice(b,option===chosen,accent);group.append(b);}
   return group;}
  case 'list':{const list=el('ol',`margin:0;padding-left:22px;display:flex;flex-direction:column;gap:6px;font-weight:400;font-size:16px;line-height:1.6;font-family:inherit;color:${ink};`);for(const item of node.items||[])list.append(el('li','',item));return list;}
  case 'quote':{const q=el('blockquote',`margin:0;display:flex;gap:12px;font-style:italic;font-weight:500;font-size:16px;line-height:1.6;font-family:inherit;color:${ink};`);q.append(el('span',`font:700 28px/1 Georgia,serif;color:${ink};`,'“'),el('span','',text));return q;}
  case 'image':{
   if(node.src){const img=el('img','display:block;width:100%;height:180px;object-fit:cover;border-radius:16px;');img.src=node.src;img.alt=node.detail||'';img.referrerPolicy='no-referrer';return img;}
   const ph=el('div',`display:flex;align-items:center;justify-content:center;height:180px;border-radius:16px;background:linear-gradient(135deg,#e7e4ef,#f6f4fa);color:${muted};`);ph.setAttribute('role','img');ph.setAttribute('aria-label',node.detail||'Image placeholder');ph.append(icon('image',36,muted));return ph;}
  case 'disclosure':{
   const box=el('div',`display:flex;flex-direction:column;gap:16px;padding:16px 24px;border-radius:20px;background:#f6f4fa;`);box.dataset.dxDisclosure=node.selected?'open':'closed';
   const head=el('div','display:flex;flex-wrap:wrap;align-items:center;gap:12px;');const toggle=el('button',`all:unset;display:inline-flex;align-items:center;gap:12px;cursor:pointer;font-weight:600;font-size:16px;line-height:1.4;font-family:inherit;color:${ink};`);toggle.type='button';toggle.dataset.dxToggle='true';toggle.setAttribute('aria-expanded',String(!!node.selected));
   toggle.append(icon('chevron-right',18,ink),el('span','',text));head.append(toggle);if(node.detail)head.append(el('span',`font-weight:400;font-size:14px;line-height:1.4;font-family:inherit;color:${muted};`,node.detail));
   if(node.action){const a=el('button',`all:unset;margin-left:auto;cursor:pointer;font-weight:600;font-size:15px;line-height:1.4;font-family:inherit;color:${accent};`,node.action);a.type='button';head.append(a);}
   const body=el('div','display:flex;flex-direction:column;gap:12px;');body.dataset.dxBody='true';box.append(head,body);paintDisclosure(box);return box;}
  case 'divider':return el('hr',`margin:0;border:0;border-top:1px solid ${line};`);
 }
}
const template=(node:HTMLElement,text:string)=>{if(text.includes('{selection}'))node.dataset.dxTemplate=text;};
function paintTile(tile:HTMLElement,on:boolean,accent:string){tile.setAttribute('aria-checked',String(on));tile.style.border=on?`2px solid ${accent}`:`1px solid ${line}`;tile.style.padding=on?'19px':'20px';tile.style.background=on?`${accent}12`:'#fff';}
function paintChoice(choice:HTMLElement,on:boolean,accent:string){choice.setAttribute('aria-checked',String(on));const dot=choice.firstElementChild as HTMLElement;dot.style.border=on?`6px solid ${accent}`:`1.5px solid #b9b6c6`;}
function paintDisclosure(box:HTMLElement){const open=box.dataset.dxDisclosure==='open',body=box.querySelector<HTMLElement>(':scope > [data-dx-body]'),chevron=box.querySelector<HTMLElement>('[data-dx-toggle] > span');if(body)body.style.display=open&&body.childElementCount?'flex':'none';if(chevron)chevron.style.transform=open?'rotate(90deg)':'';box.querySelector('[data-dx-toggle]')?.setAttribute('aria-expanded',String(open));}
function refreshTemplates(host:HTMLElement){const selected=host.querySelector<HTMLElement>('[data-dx-tile][aria-checked="true"]')?.dataset.dxTile||'';for(const node of host.querySelectorAll<HTMLElement>('[data-dx-template]'))node.textContent=node.dataset.dxTemplate!.replace(/\{selection\}/g,selected);}
/** Local prototype state for tiles, choices and disclosures. Returns true when the click was handled. */
export function blockInteract(target:EventTarget|null){
 if(!(target instanceof Element))return false;const host=target.closest<HTMLElement>('[data-dx-block]');if(!host)return false;const accent=host.style.getPropertyValue('--dx-accent')||'#7b4cf6';
 const tile=target.closest<HTMLElement>('[data-dx-tile]');
 if(tile){for(const sibling of tile.parentElement?.querySelectorAll<HTMLElement>(':scope > [data-dx-tile]')||[])paintTile(sibling,sibling===tile,accent);refreshTemplates(host);return true;}
 const choice=target.closest<HTMLElement>('[data-dx-choice]');
 if(choice){for(const sibling of choice.parentElement?.querySelectorAll<HTMLElement>(':scope > [data-dx-choice]')||[])paintChoice(sibling,sibling===choice,accent);return true;}
 const toggle=target.closest<HTMLElement>('[data-dx-toggle]'),box=toggle?.closest<HTMLElement>('[data-dx-disclosure]');
 if(box){box.dataset.dxDisclosure=box.dataset.dxDisclosure==='open'?'closed':'open';paintDisclosure(box);return true;}
 return false;
}
