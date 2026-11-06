import {safeImage} from './customMarkup';
import {namedIcon,renderIcon} from './copyIcon';
import {sanitizeMarkup,sanitizeCss} from './customMarkup';
import type {Block,BlockNode} from '../shared/block';
const tones:Record<string,string>={none:'#ffffff',pink:'#ffebed',peach:'#fff1e3',yellow:'#fff6dc',lime:'#f3ffe0',mint:'#e3fbf5',sky:'#e9f1ff',lilac:'#f1ebff',gray:'#f3f3f6'};
const ink='#14131b',muted='#6e6c7f',line='#eae6f1';
const toneInk:Record<string,string>={pink:'#b4234a',peach:'#a8521a',yellow:'#7a5a00',lime:'#4d7a0c',mint:'#11745c',sky:'#2357b5',lilac:'#6234c9',gray:'#55536a'};
const initials=(name:string)=>name.trim().split(/\s+/).slice(0,2).map(word=>word[0]||'').join('').toUpperCase();
const personTone=(name:string)=>{const keys=Object.keys(toneInk);let hash=0;for(const c of name)hash=(hash*31+c.charCodeAt(0))>>>0;return keys[hash%keys.length];};
const icon=(name:string,size:number,color:string)=>{const box=document.createElement('span');box.style.cssText=`display:inline-flex;flex-shrink:0;width:${size}px;height:${size}px;color:${color};`;try{box.append(renderIcon(namedIcon(name)));}catch{box.style.display='none';}return box;};
const el=<K extends keyof HTMLElementTagNameMap>(tag:K,css:string,text?:string|null)=>{const node=document.createElement(tag);node.style.cssText=css;if(text)node.textContent=text;return node;};
/** Renders a composed section into its host. Interactive state lives in data attributes so the host page's own handlers never run. */
export function mountBlock(host:HTMLElement,block:Block,register:(id:string,node:HTMLElement)=>void){
 const accent=block.accent||'#7b4cf6',built:HTMLElement[]=[];
 host.textContent='';host.dataset.dxBlock='true';host.style.setProperty('--dx-accent',accent);
 // Host pages may set overflow-wrap:anywhere; block text breaks inside words only when a word cannot fit.
 host.style.setProperty('overflow-wrap','break-word');host.style.setProperty('word-break','normal');
 block.nodes.forEach((node,i)=>{
  const part=render(node,accent,i?block.nodes[node.parent].type:undefined);built.push(part);if(node.id){part.dataset.dxOwned=node.id;register(node.id,part);}
  if(node.logic){part.dataset.dxLogic=JSON.stringify(node.logic);if(node.logic.remove)part.dataset.dxRemoveItem='true';}
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
function render(node:BlockNode,accent:string,parent?:string):HTMLElement{
 // Small inline parts keep their own width in a column; in a row they centre with their neighbours.
 const text=node.text||'',hug=parent==='row'?'':'align-self:flex-start;';
 switch(node.type){
  case 'card':{const card=el('div',`display:flex;flex-direction:column;gap:16px;box-sizing:border-box;min-width:0;padding:32px;border:1px solid ${line};border-radius:32px;background:${node.tone&&node.tone!=='none'?`linear-gradient(181deg, ${tones[node.tone]} 3px, #fcfbfd 120px)`:'#fff'};color:${ink};`);return card;}
  case 'stack':return el('div',`display:flex;flex-direction:column;gap:${node.level?node.level*4:12}px;min-width:0;`);
  case 'row':return el('div',`display:flex;flex-direction:row;flex-wrap:wrap;align-items:center;gap:${node.level?node.level*8:16}px 24px;min-width:0;justify-content:${({start:'flex-start',between:'space-between',end:'flex-end',center:'center'})[node.justify||'start']};`);
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
  case 'select':{
   // A dropdown: a label above a native select drawn in the page's type and the block's accent focus.
   const wrap=el('label',`display:flex;flex-direction:column;gap:6px;font-weight:600;font-size:14px;line-height:1.4;font-family:inherit;color:${ink};`,text||null);
   const select=el('select',`appearance:auto;min-height:40px;padding:8px 12px;border:1px solid #d9d5ea;border-radius:10px;background:#fff;font-weight:400;font-size:16px;font-family:inherit;color:${ink};outline-color:${accent};`);
   const chosen=node.detail&&node.options?.includes(node.detail)?node.detail:node.options![0];for(const option of node.options||[]){const o=el('option','',option);o.value=option;o.selected=option===chosen;select.append(o);}
   wrap.append(select);return wrap;}
  case 'crumbs':{
   // A breadcrumb in small muted type; with options, its last segment is a pill that switches through a native select laid over it.
   const bar=el('nav',`display:flex;flex-direction:row;flex-wrap:wrap;align-items:center;gap:8px;min-width:0;font-weight:400;font-size:14px;line-height:1.4;font-family:inherit;color:${muted};${node.parent===-1?`box-sizing:border-box;width:100%;padding:12px 0;border-bottom:1px solid ${line};`:''}`);bar.setAttribute('aria-label','Breadcrumb');
   const items=node.items||[];items.forEach((item,i)=>{
    if(i)bar.append(el('span',`color:${muted};`,'›'));
    if(i<items.length-1||!node.options?.length){bar.append(el('span',i===items.length-1?`color:${ink};font-weight:500;`:'',item));return;}
    const chosen=node.detail&&node.options.includes(node.detail)?node.detail:node.options.includes(item)?item:node.options[0],pill=el('label',`position:relative;display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:8px;background:${accent}14;cursor:pointer;font-weight:600;color:${ink};`),label=el('span','',chosen);
    const select=el('select','position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;font:inherit;');select.setAttribute('aria-label',items.slice(0,-1).join(' › ')||'Switch');
    for(const option of node.options){const o=el('option','',option);o.value=option;o.selected=option===chosen;select.append(o);}
    select.addEventListener('change',()=>{label.textContent=select.value;});pill.append(label,icon('chevron-down',14,ink),select);bar.append(pill);
   });
   return bar;}
  case 'input':case 'textarea':{
   // A real text box people can type in while previewing; the label sits above it as for select.
   const wrap=el('label',`display:flex;flex-direction:column;gap:6px;min-width:0;font-weight:600;font-size:14px;line-height:1.4;font-family:inherit;color:${ink};`,text||null),box=el('span','position:relative;display:flex;');
   const base=`box-sizing:border-box;width:100%;padding:10px 14px;border:1px solid #d9d5ea;border-radius:12px;background:#fff;font-weight:400;font-size:16px;line-height:1.5;font-family:inherit;color:${ink};outline-color:${accent};`;
   const field=node.type==='textarea'?el('textarea',base+'resize:vertical;'):el('input',base+`min-height:44px;${node.icon?'padding-left:40px;':''}`);
   if(field instanceof HTMLTextAreaElement)field.rows=(node.level||2)*2;else field.type=node.icon==='search'?'search':'text';
   if(node.detail)field.placeholder=node.detail;if(!text)field.setAttribute('aria-label',node.detail||'Text');
   if(node.icon&&node.type==='input'){const mark=icon(node.icon,18,muted);mark.style.cssText+=';position:absolute;left:12px;top:50%;transform:translateY(-50%);pointer-events:none;';box.append(mark);}
   box.append(field);wrap.append(box);return wrap;}
  case 'tabs':{
   // Underlined tabs by default; variant outline draws a segmented control. Only the selection changes; connect a tab to show another view.
   const segmented=node.variant==='outline',bar=el('div',segmented?`display:inline-flex;flex-direction:row;${hug}gap:4px;padding:4px;border-radius:12px;background:#f3f3f6;`:`display:flex;flex-direction:row;flex-wrap:wrap;gap:24px;border-bottom:1px solid ${line};`);bar.setAttribute('role','tablist');bar.dataset.dxTabs=segmented?'segmented':'line';
   const chosen=node.detail&&node.options?.includes(node.detail)?node.detail:node.options![0];
   for(const option of node.options||[]){const b=el('button',`all:unset;cursor:pointer;font-size:15px;line-height:1.4;font-family:inherit;${segmented?'padding:8px 16px;border-radius:9px;':'padding:10px 0;margin-bottom:-1px;border-bottom:2px solid transparent;'}`,option);b.type='button';b.setAttribute('role','tab');b.dataset.dxTab=option;paintTab(b,option===chosen,accent,segmented);bar.append(b);}
   return bar;}
  case 'badge':{const tone=node.tone&&node.tone!=='none'?node.tone:'',b=el('span',`display:inline-flex;align-items:center;${hug}gap:4px;padding:2px 10px;border-radius:999px;white-space:nowrap;font-weight:600;font-size:12px;line-height:1.6;font-family:inherit;background:${tone?tones[tone]:accent+'14'};color:${tone?toneInk[tone]:accent};`);if(node.icon)b.append(icon(node.icon,12,'currentColor'));b.append(el('span','',text));return b;}
  case 'avatar':{
   const size=[48,40,32,24][(node.level||3)-1],face=(name:string,src?:string|null)=>{const tone=personTone(name),c=el('span',`display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;box-sizing:border-box;width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;font-weight:600;font-size:${Math.round(size*.38)}px;line-height:1;font-family:inherit;background:${tones[tone]};color:${toneInk[tone]};`);c.setAttribute('role','img');c.setAttribute('aria-label',name);if(src&&safeImage(src)){const img=el('img','width:100%;height:100%;object-fit:cover;');img.src=src;img.alt='';img.referrerPolicy='no-referrer';c.append(img);}else c.textContent=initials(name);return c;};
   if(!node.items?.length)return face(text,node.src);
   // A group overlaps up to four faces and counts the rest.
   const group=el('span',`display:inline-flex;align-items:center;${hug}`);group.setAttribute('aria-label',node.items.join(', '));
   node.items.slice(0,4).forEach((name,i)=>{const f=face(name);f.style.cssText+=`;border:2px solid #fff;${i?'margin-left:-8px;':''}`;group.append(f);});
   if(node.items.length>4){const more=face('+');more.textContent='+'+(node.items.length-4);more.style.cssText+=`;border:2px solid #fff;margin-left:-8px;background:#f3f3f6;color:${muted};`;more.removeAttribute('role');group.append(more);}
   return group;}
  case 'progress':{
   // A bar at value%, or one that fills over seconds and then announces it finished so a connection can move on.
   const wrap=el('div','display:flex;flex-direction:column;gap:8px;min-width:0;font-family:inherit;'),head=el('div','display:flex;flex-direction:row;align-items:baseline;justify-content:space-between;gap:12px;');
   const percent=el('span',`font-weight:500;font-size:14px;line-height:1.4;color:${muted};font-variant-numeric:tabular-nums;`),track=el('div','height:8px;border-radius:999px;background:#eceaf3;overflow:hidden;'),fill=el('div',`height:100%;width:0;border-radius:999px;background:${accent};`);
   head.append(el('span',`font-weight:600;font-size:15px;line-height:1.4;color:${ink};`,text),percent);track.append(fill);wrap.append(head,track);if(node.detail)wrap.append(el('span',`font-size:13px;line-height:1.4;color:${muted};`,node.detail));
   const show=(value:number)=>{fill.style.width=value+'%';percent.textContent=Math.round(value)+'%';};
   if(!node.seconds){show(node.value??0);return wrap;}
   wrap.dataset.dxLive='progress';show(0);const start=performance.now(),ms=node.seconds*1000;
   const tick=()=>{if(!wrap.isConnected&&performance.now()-start>200)return;const done=Math.min(1,(performance.now()-start)/ms);show(done*100);if(done<1){setTimeout(tick,50);return;}wrap.dataset.dxProgress='done';wrap.dispatchEvent(new CustomEvent('dx-progress-done',{bubbles:true,composed:true}));};
   setTimeout(tick,50);return wrap;}
  case 'stream':{
   // Mock readings that keep arriving: a random walk between min and max, redrawn every interval while the part is on the page.
   const min=node.min!,max=node.max!,unit=node.detail||'',every=(node.seconds||1)*1000,points:number[]=[];let current=min+(max-min)*.5;
   const wrap=el('div','display:flex;flex-direction:column;gap:10px;min-width:0;font-family:inherit;');wrap.dataset.dxLive='stream';
   const head=el('div','display:flex;flex-direction:row;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:8px 16px;'),reading=el('span',`font-weight:700;font-size:24px;line-height:1.2;color:${ink};font-variant-numeric:tabular-nums;`);
   const tag=el('span',`display:inline-flex;align-items:center;gap:6px;font-weight:600;font-size:12px;line-height:1.6;color:${muted};`),dot=el('span',`width:8px;height:8px;border-radius:50%;background:#1f9d6b;`);tag.append(dot,el('span','','Live · mock data'));
   const title=el('div','display:flex;flex-direction:column;gap:2px;');title.append(el('span',`font-weight:600;font-size:15px;line-height:1.4;color:${ink};`,text),reading);head.append(title,tag);
   const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),area=document.createElementNS(ns,'path'),line=document.createElementNS(ns,'path');svg.setAttribute('viewBox','0 0 300 100');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('role','img');svg.setAttribute('aria-label',`${text}, mock readings`);svg.style.cssText='display:block;width:100%;height:140px;border-radius:12px;background:#faf9fc;';
   area.setAttribute('fill',accent+'1f');line.setAttribute('fill','none');line.setAttribute('stroke',accent);line.setAttribute('stroke-width','2');line.setAttribute('vector-effect','non-scaling-stroke');svg.append(area,line);wrap.append(head,svg);
   const range=el('div',`display:flex;flex-direction:row;justify-content:space-between;font-size:12px;line-height:1.4;color:${muted};font-variant-numeric:tabular-nums;`);range.append(el('span','',`${min} ${unit}`.trim()),el('span','',`${max} ${unit}`.trim()));wrap.append(range);
   const draw=()=>{const y=(v:number)=>(96-(v-min)/(max-min)*92).toFixed(1),step=300/59,pts=points.map((v,i)=>`${(300-(points.length-1-i)*step).toFixed(1)},${y(v)}`);line.setAttribute('d','M'+pts.join(' L'));area.setAttribute('d',`M${pts[0].split(',')[0]},100 L${pts.join(' L')} L300,100 Z`);reading.textContent=`${Math.round(current)} ${unit}`.trim();dot.style.opacity=dot.style.opacity==='0.35'?'1':'0.35';};
   const next=()=>{current=Math.min(max,Math.max(min,current+(Math.random()-.45)*(max-min)*.08));points.push(current);if(points.length>60)points.shift();};
   // It opens with a minute of history, so it reads as already running.
   for(let i=0;i<60;i++)next();draw();
   const timer=setInterval(()=>{if(!wrap.isConnected){clearInterval(timer);return;}next();draw();},every);return wrap;}
  case 'toggle':{
   const row=el('button',`all:unset;box-sizing:border-box;display:flex;flex-direction:row;align-items:center;justify-content:space-between;gap:16px;min-width:0;cursor:pointer;font-family:inherit;`);row.type='button';row.setAttribute('role','switch');row.dataset.dxToggleSwitch='true';
   const words=el('span','display:flex;flex-direction:column;gap:2px;min-width:0;');words.append(el('span',`font-weight:500;font-size:16px;line-height:1.4;color:${ink};`,text));if(node.detail)words.append(el('span',`font-size:14px;line-height:1.4;color:${muted};`,node.detail));
   const track=el('span','position:relative;flex-shrink:0;width:40px;height:24px;border-radius:999px;transition:background .15s;');track.append(el('span','position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(20,19,27,.25);transition:transform .15s;'));row.append(words,track);paintSwitch(row,!!node.selected,accent);return row;}
  case 'checkbox':{
   const row=el('button',`all:unset;box-sizing:border-box;display:flex;flex-direction:row;align-items:center;gap:10px;cursor:pointer;font-weight:400;font-size:16px;line-height:1.4;font-family:inherit;color:${ink};`);row.type='button';row.setAttribute('role','checkbox');row.dataset.dxCheck='true';
   const box=el('span','display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;box-sizing:border-box;width:20px;height:20px;border-radius:6px;');box.append(icon('check',14,'#fff'));row.append(box,el('span','',text));paintCheck(row,!!node.selected,accent);return row;}
  case 'table':{
   // Rows are written as cells separated by |, matching the column headings.
   const columns=node.options||[],wrap=el('div',`min-width:0;overflow-x:auto;border:1px solid ${line};border-radius:16px;`),table=el('table',`width:100%;border-collapse:collapse;font-family:inherit;font-size:15px;line-height:1.4;color:${ink};`);
   const head=el('tr','');for(const column of columns)head.append(el('th',`padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:${muted};background:#faf9fc;border-bottom:1px solid ${line};white-space:nowrap;`,column));const thead=el('thead','');thead.append(head);
   const body=el('tbody','');(node.items||[]).forEach((item,r)=>{const tr=el('tr','');const cells=item.split('|').map(cell=>cell.trim());columns.forEach((_,c)=>tr.append(el('td',`padding:12px 16px;${r?`border-top:1px solid ${line};`:''}${c?'':'font-weight:500;'}`,cells[c]||'')));body.append(tr);});
   table.append(thead,body);wrap.append(table);return wrap;}
  case 'alert':{
   // tone sets the kind: sky information, mint success, yellow or peach warning, pink problem.
   const tone=node.tone&&node.tone!=='none'?node.tone:'sky',box=el('div',`display:flex;flex-direction:row;align-items:flex-start;gap:12px;box-sizing:border-box;min-width:0;padding:14px 16px;border-radius:14px;background:${tones[tone]};color:${ink};font-family:inherit;`);box.setAttribute('role','status');
   box.append(icon(node.icon||({mint:'check',pink:'close',yellow:'bell',peach:'bell'} as Record<string,string>)[tone]||'info',20,toneInk[tone]));const words=el('div','display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;');
   if(node.detail)words.append(el('strong',`font-weight:600;font-size:15px;line-height:1.4;`,node.detail));words.append(el('span',`font-size:15px;line-height:1.5;`,text));box.append(words);
   if(node.action){const a=el('button',`all:unset;cursor:pointer;flex-shrink:0;font-weight:600;font-size:15px;line-height:1.5;color:${toneInk[tone]};`,node.action);a.type='button';box.append(a);}return box;}
  case 'menu':{
   // A ⋮ button (or a labelled one) that opens a short list of actions over the page.
   const wrap=el('div',`position:relative;display:inline-flex;${hug}`);wrap.dataset.dxMenu='closed';
   const toggle=el('button',`all:unset;display:inline-flex;align-items:center;justify-content:center;gap:6px;box-sizing:border-box;min-width:36px;height:36px;padding:0 ${text?'12px':'0'};border-radius:10px;cursor:pointer;font-weight:600;font-size:15px;font-family:inherit;color:${ink};`,text||null);toggle.type='button';toggle.dataset.dxMenuToggle='true';toggle.setAttribute('aria-haspopup','menu');toggle.setAttribute('aria-label',text||'More actions');const glyph=icon(node.icon||(text?'chevron-down':'more'),18,ink);if(!node.icon&&!text)glyph.querySelector('path')?.setAttribute('stroke-width','3.2');toggle.style.background='#f3f3f6';toggle.append(glyph);
   const list=el('div',`position:absolute;top:calc(100% + 6px);right:0;z-index:10;display:none;flex-direction:column;min-width:180px;padding:6px;border:1px solid ${line};border-radius:12px;background:#fff;box-shadow:0 8px 24px rgba(20,19,27,.12);`);list.setAttribute('role','menu');
   for(const option of node.options||[]){const item=el('button',`all:unset;box-sizing:border-box;padding:9px 12px;border-radius:8px;cursor:pointer;font-size:15px;line-height:1.4;font-family:inherit;color:${/^(delete|remove)\b/i.test(option)?toneInk.pink:ink};`,option);item.type='button';item.setAttribute('role','menuitem');item.dataset.dxMenuItem=option;list.append(item);}
   wrap.append(toggle,list);paintMenu(wrap);return wrap;}
  case 'custom':{
   // Free-form markup for anything the other parts cannot express. It lives in its own shadow root: the page's styles cannot reach in and its styles cannot leak out.
   const host=el('div','display:block;min-width:0;');const root=host.attachShadow({mode:'open'}),style=document.createElement('style');
   style.textContent=`:host{all:initial;display:block;box-sizing:border-box;min-width:0;font-family:inherit;font-size:16px;line-height:1.5;color:${ink};--accent:${accent}}*,*::before,*::after{box-sizing:border-box}[data-option]{cursor:pointer}`+sanitizeCss(node.css||'');
   root.append(style,sanitizeMarkup(node.html||''));host.dataset.dxCustom='true';return host;}
  case 'list':{const list=el('ol',`margin:0;padding-left:22px;display:flex;flex-direction:column;gap:6px;font-weight:400;font-size:16px;line-height:1.6;font-family:inherit;color:${ink};`);for(const item of node.items||[])list.append(el('li','',item));return list;}
  case 'quote':{const q=el('blockquote',`margin:0;display:flex;gap:12px;font-style:italic;font-weight:500;font-size:16px;line-height:1.6;font-family:inherit;color:${ink};`);q.append(el('span',`font:700 28px/1 Georgia,serif;color:${ink};`,'“'),el('span','',text));return q;}
  case 'image':{
   if(node.src&&safeImage(node.src)){const img=el('img','display:block;width:100%;height:180px;object-fit:cover;border-radius:16px;');img.src=node.src;img.alt=node.detail||'';img.referrerPolicy='no-referrer';return img;}
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
function paintTab(tab:HTMLElement,on:boolean,accent:string,segmented:boolean){tab.setAttribute('aria-selected',String(on));tab.style.fontWeight=on?'600':'500';tab.style.color=on?ink:muted;if(segmented){tab.style.background=on?'#fff':'transparent';tab.style.boxShadow=on?'0 1px 2px rgba(20,19,27,.12)':'none';}else tab.style.borderBottomColor=on?accent:'transparent';}
function paintSwitch(row:HTMLElement,on:boolean,accent:string){row.setAttribute('aria-checked',String(on));const track=row.lastElementChild as HTMLElement,knob=track.firstElementChild as HTMLElement;track.style.background=on?accent:'#d4d1df';knob.style.transform=on?'translateX(16px)':'';}
function paintCheck(row:HTMLElement,on:boolean,accent:string){row.setAttribute('aria-checked',String(on));const box=row.firstElementChild as HTMLElement;box.style.background=on?accent:'#fff';box.style.border=on?`1.5px solid ${accent}`:'1.5px solid #b9b6c6';(box.firstElementChild as HTMLElement).style.visibility=on?'visible':'hidden';}
function paintMenu(wrap:HTMLElement){const open=wrap.dataset.dxMenu==='open';(wrap.lastElementChild as HTMLElement).style.display=open?'flex':'none';wrap.firstElementChild?.setAttribute('aria-expanded',String(open));}
function paintChoice(choice:HTMLElement,on:boolean,accent:string){choice.setAttribute('aria-checked',String(on));const dot=choice.firstElementChild as HTMLElement;dot.style.border=on?`6px solid ${accent}`:`1.5px solid #b9b6c6`;}
function paintDisclosure(box:HTMLElement){const open=box.dataset.dxDisclosure==='open',body=box.querySelector<HTMLElement>(':scope > [data-dx-body]'),chevron=box.querySelector<HTMLElement>('[data-dx-toggle] > span');if(body)body.style.display=open&&body.childElementCount?'flex':'none';if(chevron)chevron.style.transform=open?'rotate(90deg)':'';box.querySelector('[data-dx-toggle]')?.setAttribute('aria-expanded',String(open));}
function refreshTemplates(host:HTMLElement){const selected=host.querySelector<HTMLElement>('[data-dx-tile][aria-checked="true"]')?.dataset.dxTile||'';for(const node of host.querySelectorAll<HTMLElement>('[data-dx-template]'))node.textContent=node.dataset.dxTemplate!.replace(/\{selection\}/g,selected);}
/** Local prototype state for tiles, choices and disclosures. Returns true when the click was handled. */
export function blockInteract(target:EventTarget|null){
 if(!(target instanceof Element))return false;const host=target.closest<HTMLElement>('[data-dx-block]');if(!host)return false;const accent=host.style.getPropertyValue('--dx-accent')||'#7b4cf6';
 const tile=target.closest<HTMLElement>('[data-dx-tile]');
 if(tile){for(const sibling of tile.parentElement?.querySelectorAll<HTMLElement>(':scope > [data-dx-tile]')||[])paintTile(sibling,sibling===tile,accent);refreshTemplates(host);return true;}
 const toggleSwitch=target.closest<HTMLElement>('[data-dx-toggle-switch]');
 if(toggleSwitch){paintSwitch(toggleSwitch,toggleSwitch.getAttribute('aria-checked')!=='true',accent);return true;}
 const check=target.closest<HTMLElement>('[data-dx-check]');
 if(check){paintCheck(check,check.getAttribute('aria-checked')!=='true',accent);return true;}
 const menu=target.closest<HTMLElement>('[data-dx-menu]');
 if(menu){menu.dataset.dxMenu=target.closest('[data-dx-menu-toggle]')&&menu.dataset.dxMenu!=='open'?'open':'closed';paintMenu(menu);return true;}
 const tab=target.closest<HTMLElement>('[data-dx-tab]');
 if(tab){const segmented=tab.parentElement?.dataset.dxTabs==='segmented';for(const sibling of tab.parentElement?.querySelectorAll<HTMLElement>(':scope > [data-dx-tab]')||[])paintTab(sibling,sibling===tab,accent,segmented);return true;}
 const choice=target.closest<HTMLElement>('[data-dx-choice]');
 if(choice){for(const sibling of choice.parentElement?.querySelectorAll<HTMLElement>(':scope > [data-dx-choice]')||[])paintChoice(sibling,sibling===choice,accent);return true;}
 const toggle=target.closest<HTMLElement>('[data-dx-toggle]'),box=toggle?.closest<HTMLElement>('[data-dx-disclosure]');
 if(box){box.dataset.dxDisclosure=box.dataset.dxDisclosure==='open'?'closed':'open';paintDisclosure(box);return true;}
 return false;
}
