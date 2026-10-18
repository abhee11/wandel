import {captureDesign} from './nativeDesign';
import {captureCopy} from './duplicate';
import {copyDOM} from './copyDOM';
import {CopySchema,clone,type CopyNode} from '../shared/model';
export const layoutNames=['Split','Stacked','Editorial','Cards','Spotlight'];
export function layoutCopies(source:HTMLElement):CopyNode[][]{
 if(source.matches('body,html,input,textarea,iframe,canvas'))throw new Error('Select a section inside the page. Embedded frames and canvas content cannot be rearranged.');
 if(source.querySelector('iframe,canvas,video'))throw new Error('This section includes embedded content that cannot be copied yet. Select a smaller section.');
 const original=captureCopy(source),design=captureDesign(source);
 // Unwrap single structural wrappers so different compositions rearrange meaningful blocks.
 let rootIndex=0;
 while(true){const children=original.map((n,i)=>({n,i})).filter(({n})=>n.parent===rootIndex&&n.tag!=='#text');const directText=original.some(n=>n.parent===rootIndex&&n.tag==='#text'&&n.text.trim());if(children.length!==1||directText||!['div','section','article','main'].includes(children[0].n.tag))break;rootIndex=children[0].i;}
 const descendants=new Set([rootIndex]);original.forEach((n,i)=>{if(descendants.has(n.parent))descendants.add(i);});const indexes=[...descendants].sort((a,b)=>a-b),map=new Map(indexes.map((old,i)=>[old,i]));
 const base=indexes.map(old=>({...original[old],parent:old===rootIndex?-1:map.get(original[old].parent)!}));
 if(base.filter(n=>n.parent===0&&(n.tag!=='#text'||n.text.trim())).length<2)throw new Error('Select a larger section with at least two content blocks.');
 return layoutNames.map((_,variant)=>{
  const nodes=clone(base);nodes[0].tag='section';
  for(const n of nodes){if(n.tag==='#text')continue;delete n.style.height;delete n.style.width;delete n.style['min-width'];n.style['max-width']='100%';n.style['box-sizing']='border-box';if(n.tag==='img'){n.style.width='100%';n.style.height='auto';}if(n.tag==='button'){Object.assign(n.style,{width:'fit-content','max-width':'100%'});}if(['input','textarea','select'].includes(n.tag)){Object.assign(n.style,{width:'100%','min-width':'0'});}}
  nodes[0].style={...nodes[0].style,...design.surface,display:'grid','grid-template-columns':variant===1?'1fr':variant===2?'minmax(0, 2fr) minmax(0, 1fr)':'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',gap:variant===3?'16px':'32px',padding:nodes[0].style.padding||'24px',width:'100%','max-width':'100%','box-sizing':'border-box'};
  for(const [i,n] of nodes.entries())if(n.parent===0&&n.tag!=='#text'){
   n.style.margin='0';if(variant===3){n.style.padding='24px';Object.assign(n.style,design.card);}
   if(variant===4){n.style['text-align']='center';n.style.padding='20px';}
  }
  if(variant===4)nodes[0].style['grid-template-columns']='1fr';
  return CopySchema.parse(nodes);
 });
}
export function chooseLayout(source:HTMLElement,count:number,onChoose:(copy:CopyNode[],name:string)=>void,onClose:()=>void=()=>{}):()=>void{
 const copies=layoutCopies(source),host=document.createElement('div');host.dataset.dxIgnore='true';host.setAttribute('popover','manual');host.style.cssText='position:fixed;inset:16px;margin:0;width:auto;height:auto;border:0;padding:0;background:#f6f5fa;z-index:2147483647;overflow:auto;';
 const shadow=host.attachShadow({mode:'open'});const style=document.createElement('style');style.textContent=':host{font:14px/1.5 system-ui;color:#252436}*{box-sizing:border-box}header{position:sticky;top:0;z-index:2;background:#f6f5fa;padding:18px 24px;display:flex;gap:16px;align-items:center}header div{flex:1}h2,p{margin:0}p{color:#686478}button{font:inherit;border:1px solid #d9d6e7;border-radius:8px;padding:9px 14px;background:white;color:#403678;cursor:pointer}button:focus-visible{outline:3px solid #8174e9}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:20px;padding:0 24px 24px}.card{min-width:0;background:white;border:1px solid #dedbe7;border-radius:14px;overflow:hidden}.frame{height:270px;overflow:auto;pointer-events:none}.sample{width:760px;transform:scale(.42);transform-origin:top left}@media(max-width:600px){header{flex-wrap:wrap;padding:16px}header div{flex-basis:100%}h2{font-size:20px}.grid{padding:0 12px 16px;gap:12px}.frame{height:230px}.sample{transform:scale(.34)}}.footer{display:flex;justify-content:space-between;padding:14px;border-top:1px solid #e6e3ec}';shadow.append(style);
 const header=document.createElement('header'),intro=document.createElement('div');const title=document.createElement('h2');title.textContent='A new layout. Your content.';const note=document.createElement('p');note.textContent='Local layout alternatives · existing images kept · no AI credits used';intro.append(title,note);header.append(intro);
 const close=()=>{onClose();host.remove();document.removeEventListener('keydown',escape,true);};const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}};document.addEventListener('keydown',escape,true);
 const cancel=document.createElement('button');cancel.textContent='Cancel';cancel.onclick=close;header.append(cancel);shadow.append(header);
 const grid=document.createElement('div');grid.className='grid';shadow.append(grid);
 const show=(from:number,to:number)=>{for(let i=from;i<to;i++){const card=document.createElement('div');card.className='card';const frame=document.createElement('div');frame.className='frame';const sample=copyDOM(copies[i]);sample.classList.add('sample');sample.style.setProperty('width','760px','important');sample.style.setProperty('max-width','none','important');frame.append(sample);const footer=document.createElement('div');footer.className='footer';const label=document.createElement('strong');label.textContent=layoutNames[i];const use=document.createElement('button');use.textContent='Use this layout';use.setAttribute('aria-label',`Use ${layoutNames[i]} layout`);use.onclick=()=>{close();onChoose(copies[i],layoutNames[i]);};footer.append(label,use);card.append(frame,footer);grid.append(card);}};
 show(0,Math.min(count,5));if(count<5){const more=document.createElement('button');more.textContent='Show two more';more.onclick=()=>{show(3,5);more.remove();};header.insertBefore(more,cancel);}
 document.documentElement.append(host);host.showPopover?.();cancel.focus();return close;
}
