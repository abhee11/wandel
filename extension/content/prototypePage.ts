import type {PrototypePage,Chart} from '../shared/prototypePage';
/** Intent/data comes from the planner; this renderer owns accessible static markup. */
export function mountPrototypePage(panel:HTMLElement,state:string,page:PrototypePage,heading:HTMLElement,register:(id:string,node:HTMLElement)=>void,onClick:(source:string)=>void){
 const create=(tag:string,part:string,text:string,css:string)=>{const node=document.createElement(tag);node.dataset.dxOwned='page:'+state+':'+part;node.textContent=text;node.style.cssText=css;register(node.dataset.dxOwned,node);return node;};
 panel.style.cssText+=';background:#f6f5fa!important;color:#232237!important;font-family:system-ui,sans-serif!important;display:flex!important;flex-direction:column!important;gap:24px!important;';
 const header=create('header','header','','display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;width:100%;max-width:1100px;margin:0 auto;padding:0 0 22px;border-bottom:1px solid #dedbe9;box-sizing:border-box;');
 heading.textContent=page.heading;heading.style.cssText='font:700 clamp(24px,3vw,36px)/1.2 system-ui,sans-serif;color:#232237;margin:0;';
 const back=create('button','back','← Back','display:inline-flex;align-items:center;justify-content:center;padding:10px 18px;background:white;color:#454060;border:1px solid #d6d1e6;border-radius:12px;font:600 14px system-ui;cursor:pointer;');
 (back as HTMLButtonElement).type='button';back.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();onClick(back.dataset.dxOwned!);});
 header.append(heading,back);panel.append(header);
 const description=create('p','description',page.description,'width:100%;max-width:1100px;margin:0 auto;color:#656079;font:16px/1.6 system-ui;box-sizing:border-box;');panel.append(description);
 const chart=create('section','chart','','width:100%;max-width:1100px;margin:0 auto;background:white;border:1px solid #e4e0ed;border-radius:22px;padding:clamp(16px,3vw,32px);box-sizing:border-box;box-shadow:0 8px 32px #27203e08;');
 const chartHeading=create('h2','chart-title',page.chart.title,'font:650 20px/1.3 system-ui;color:#232237;margin:0 0 8px;');
 const subtitle=create('p','chart-description',page.chart.description+' · Mock data','font:14px/1.5 system-ui;color:#716a84;margin:0 0 20px;');chart.append(chartHeading,subtitle);
 chart.append(...drawChart(page.chart,(part,text)=>create('li',part,text,''),'system-ui'));panel.append(chart);
 const footer=create('footer','footer',page.footer+' · Illustrative mock data','width:100%;max-width:1100px;margin:auto auto 0;padding-top:24px;border-top:1px solid #dedbe9;font:13px/1.5 system-ui;color:#81798f;box-sizing:border-box;');panel.append(footer);
}
/** Accessible static bar chart: an SVG with value labels plus a readable list of the same values. */
export function drawChart(chart:Chart,item:(part:string,text:string)=>HTMLElement,font:string):HTMLElement[]{
 const figure=document.createElement('figure');figure.style.cssText='margin:0;overflow-x:auto;';
 const graph=document.createElementNS('http://www.w3.org/2000/svg','svg');graph.setAttribute('viewBox','0 0 960 320');graph.setAttribute('role','img');graph.setAttribute('aria-label',chart.title+'. Mock data. '+(chart.xLabel&&chart.yLabel?chart.yLabel+' by '+chart.xLabel+'. ':'')+chart.points.map(point=>point.label+': '+point.value+' '+chart.unit).join('; '));graph.style.cssText='display:block;width:100%;min-width:360px;height:auto;';
 const svg=(tag:string,attrs:Record<string,string>,text?:string)=>{const node=document.createElementNS(graph.namespaceURI,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);if(text!==undefined)node.textContent=text;graph.append(node);};
 // Four even gridline steps of a round size (1, 2, 2.5 or 5 × 10ⁿ), so every axis label is exact.
 const max=Math.max(1,...chart.points.map(point=>point.value)),magnitude=10**Math.floor(Math.log10(max/4)),tick=[1,2,2.5,5,10].map(m=>m*magnitude).find(size=>size*4>=max)!,ceiling=tick*4,step=860/chart.points.length;
 for(let i=0;i<=4;i++){const y=260-i*54;svg('line',{x1:'60',x2:'930',y1:String(y),y2:String(y),stroke:'#ece9f2'});svg('text',{x:'46',y:String(y+4),'text-anchor':'end',fill:'#81798f','font-size':'12','font-family':font},String(Number((tick*i).toPrecision(6))));}
 chart.points.forEach((point,i)=>{const height=point.value/ceiling*216,x=70+i*step,width=Math.min(84,step*.6);svg('rect',{x:String(x+(step-width)/2),y:String(260-height),width:String(width),height:String(height),rx:'8',fill:'#7460d6'});svg('text',{x:String(x+step/2),y:String(Math.max(18,250-height)),'text-anchor':'middle',fill:'#45405d','font-size':'14','font-weight':'600','font-family':font},String(point.value));svg('text',{x:String(x+step/2),y:'288','text-anchor':'middle',fill:'#716a84','font-size':'13','font-family':font},point.label);});
 if(chart.xLabel)svg('text',{x:'495',y:'314','text-anchor':'middle',fill:'#45405d','font-size':'13','font-weight':'600','font-family':font},chart.xLabel);
 if(chart.yLabel)svg('text',{x:'14',y:'152','text-anchor':'middle',transform:'rotate(-90 14 152)',fill:'#45405d','font-size':'13','font-weight':'600','font-family':font},chart.yLabel);
 figure.append(graph);
 const data=document.createElement('ul');data.setAttribute('aria-label','Mock chart values');data.style.cssText=`display:flex;flex-wrap:wrap;gap:8px 20px;list-style:none;padding:16px 0 0;margin:0;border-top:1px solid #eeebf4;font-size:13px;line-height:1.5;font-family:${font};color:#655e78;`;
 chart.points.forEach((point,i)=>data.append(item('point-'+i,point.label+': '+point.value+' '+chart.unit)));
 return [figure,data];
}
/** An in-page chart section: the planner supplies data only; markup is built here with textContent. */
export function mountChartSection(section:HTMLElement,chart:Chart){
 section.textContent='';section.setAttribute('aria-label',chart.title);
 const text=(tag:string,value:string,css:string)=>{const node=document.createElement(tag);node.textContent=value;node.style.cssText=css;return node;};
 section.append(text('h3',chart.title,'font-size:20px;font-weight:650;line-height:1.3;color:inherit;margin:0 0 8px;'),text('p',(chart.description?chart.description+' · ':'')+'Mock data','font-size:14px;line-height:1.5;color:#716a84;margin:0 0 16px;'),...drawChart(chart,(_part,value)=>text('li',value,''),'inherit'));
}
