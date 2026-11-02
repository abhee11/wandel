export type Color={r:number;g:number;b:number;a:number;h:number;s:number;l:number};
export function color(value:string):Color|null{
 let rgba:number[];const hex=value.match(/^#([a-f0-9]{3}|[a-f0-9]{6})$/i);
 if(hex){const h=hex[1].length===3?[...hex[1]].map(x=>x+x).join(''):hex[1];rgba=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));}
 else{const rgb=value.match(/^rgba?\(([^)]+)\)$/i);if(!rgb)return null;rgba=rgb[1].split(/[ ,/]+/).filter(Boolean).map(Number);}
 if(rgba.length<3||rgba.some(v=>!Number.isFinite(v)))return null;
 const [r,g,b]=rgba,[x,y,z]=[r,g,b].map(v=>v/255),max=Math.max(x,y,z),min=Math.min(x,y,z),d=max-min,l=(max+min)/2;
 const h=!d?0:(max===x?(y-z)/d+(y<z?6:0):max===y?(z-x)/d+2:(x-y)/d+4)*60;
 return {r,g,b,a:rgba[3]??1,h,s:d?d/(1-Math.abs(2*l-1)):0,l};
}
export function mix(a:string,b:string,amount:number){const x=color(a)!,y=color(b)!;return '#'+[x.r+(y.r-x.r)*amount,x.g+(y.g-x.g)*amount,x.b+(y.b-x.b)*amount].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');}
export const hueDistance=(a:number,b:number)=>Math.min(Math.abs(a-b),360-Math.abs(a-b));
export const statusPaint=(node:HTMLElement)=>!!node.closest('[role=alert],[aria-invalid=true],[data-status],[class*="danger" i],[class*="error" i],[class*="success" i],[class*="warning" i]');
export type Paint={node:HTMLElement;foreground:string;background:string;border:string;image:string;shadow:string;radius:number};
/** Learn the application's accent from saturated existing controls, not from button tags alone. */
export function brandHue(paints:Paint[]){
 const bins=new Map<number,number>();
 for(const p of paints){if(statusPaint(p.node))continue;const control=p.node.matches('button,a,[role=button],[role=link],input');
  for(const [value,weight] of [[p.background,control?6:1],[p.foreground,control?3:0],[p.border,control?2:0]] as [string,number][]){const c=color(value);if(!weight||!c||c.a<.2||c.s<.25||c.l<.22||c.l>.82)continue;const bin=Math.round(c.h/12)*12%360;bins.set(bin,(bins.get(bin)||0)+weight);}
 }
 return [...bins].sort((a,b)=>b[1]-a[1])[0]?.[0]??null;
}
/** Resolve translucent ancestor surfaces against the browser's white canvas. */
export function paintedBackground(node:HTMLElement){
 const layers:Color[]=[];for(let current:HTMLElement|null=node;current;current=current.parentElement){const css=getComputedStyle(current);if(css.backgroundImage&&css.backgroundImage!=='none')return null;const value=color(css.backgroundColor);if(value&&value.a>0)layers.push(value);if(value&&value.a>=1)break;}
 let rgb=[255,255,255];for(const layer of layers.reverse())rgb=[layer.r,layer.g,layer.b].map((v,i)=>Math.round(v*layer.a+rgb[i]*(1-layer.a)));return '#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('');
}
export function textPaint(node:HTMLElement){return node.matches('input,textarea,select')||[...node.childNodes].some(child=>child instanceof Text&&!!child.textContent?.trim());}
export function hexColor(value:string){const c=color(value);return c&&c.a>=.99?'#'+[c.r,c.g,c.b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join(''):null;}
