import {it,expect} from 'vitest';
import {trimContextStyles} from '../extension/assistant/contextTrim';
const el=(ref:string,parent:string|null,style:Record<string,string>)=>({ref,tag:'div',role:'',name:'',text:'',attributes:{},classes:[],bounds:{x:0,y:0,width:0,height:0},visible:true,disabled:false,parent,children:[],style,interactive:false,owned:false});
const ctx=(elements:any[])=>({token:'t',workflowId:'w',stateId:'s',route:'/',selected:null,hover:null,styleReference:null,elements,recent:[],lastGroup:null,lastView:null,views:[],limitations:[]}) as any;
it('drops only styles that say nothing, and keeps what differs',()=>{
 const font='"Inter", sans-serif';
 const out=trimContextStyles(ctx([
  el('e_1',null,{'font-family':font,color:'rgb(0, 0, 0)',display:'flex','flex-direction':'column',gap:'8px',position:'static',top:'0px','z-index':'2',border:'0px none rgb(0, 0, 0)','flex-grow':'0'}),
  el('e_2','e_1',{'font-family':font,color:'rgb(255, 0, 0)',display:'block','flex-direction':'row','grid-template-columns':'none',padding:'16px','padding-top':'16px',position:'relative',top:'4px',border:'1px solid rgb(0, 0, 0)','flex-grow':'1','flex-shrink':'1',height:''}),
  el('e_3','e_9',{'font-family':font}),
 ])).elements.map(e=>e.style);
 // The root keeps its own text styles and its flex settings; defaults and offsets on a static element go.
 // z-index stays: it layers flex and grid items even when they aren't positioned.
 expect(out[0]).toEqual({'font-family':font,color:'rgb(0, 0, 0)',display:'flex','flex-direction':'column',gap:'8px',position:'static','z-index':'2'});
 // The child: same font as its parent goes, its own colour stays; no flex settings on a block; the padding longhand goes.
 expect(out[1]).toEqual({color:'rgb(255, 0, 0)',display:'block',padding:'16px',position:'relative',top:'4px',border:'1px solid rgb(0, 0, 0)','flex-grow':'1'});
 // A parent outside the context: nothing to compare with, so its text styles stay.
 expect(out[2]).toEqual({'font-family':font});
});
it('a slim first call keeps every element the request can act on, and slims only background structure',async()=>{
 const {trimContext}=await import('../extension/assistant/contextTrim');
 const look={display:'block','background-color':'rgb(250, 250, 250)','border-radius':'8px','font-size':'14px',padding:'12px'};
 const elements=[{...el('e_1',null,look),tag:'main'},{...el('e_2','e_1',look),name:'Pricing',text:'Pricing',classes:['plan']},{...el('e_3','e_1',look),tag:'button',interactive:true,name:'Buy',text:'Buy',classes:['btn']},{...el('e_4','e_1',look),tag:'h2',name:'Plans',text:'Plans'},{...el('e_5','e_1',look),name:'Footer note',text:'Footer note',classes:['foot']},{...el('e_6','e_1',look),attributes:{'wandel-card':'true'}},{...el('e_7','e_1',look),name:'Selected',text:'Selected'}];
 (elements[0] as any).children=['e_2','e_3'];
 const c={...ctx(elements),selected:'e_7'};
 const slim=trimContext(c,'Add a badge to the Pricing section').elements;
 // font-size matches the parent's, so the lossless trim already leaves it out.
 const full=(i:number)=>expect(slim[i].style).toEqual({display:'block','background-color':'rgb(250, 250, 250)','border-radius':'8px',padding:'12px'});
 full(1);full(2);full(3);full(5);full(6); // named, control, heading, card, selected
 expect(slim[4].style).toEqual({display:'block','background-color':'rgb(250, 250, 250)','border-radius':'8px'});expect(slim[4].classes).toEqual([]);
 expect(slim[0].children).toEqual([]);expect(slim[2].text).toBe('');expect(slim[2].name).toBe('Buy');expect(slim[2].classes).toEqual(['btn']);
 // Whole: after an inspection or for panels that didn't opt in, every element keeps its look and classes.
 const whole=trimContext(c,'Add a badge',true).elements;expect(whole[4].style.padding).toBe('12px');expect(whole[4].classes).toEqual(['foot']);
});
it('the compact table keeps every field, one line per element',async()=>{
 const {compactElements,ELEMENT_COLUMNS}=await import('../extension/assistant/contextTrim');
 const out=compactElements(ctx([{...el('e_1',null,{display:'flex'}),tag:'button',name:'Buy | now',text:'Buy | now',interactive:true,bounds:{x:10.4,y:20.6,width:96.03,height:32},attributes:{type:'button','aria-label':'Buy; now'},classes:['btn','primary']},{...el('e_2','e_1',{}),name:'Price',text:'£9',owned:true,visible:false}]));
 expect(out.elementColumns).toBe(ELEMENT_COLUMNS);
 expect(out.elements.split('\n')).toEqual(['e_1|button||Buy now|||10,21,96,32|vi|type=button;aria-label=Buy, now|btn primary|display:flex','e_2|div||Price|£9|e_1|0,0,0,0|o|||']);
});
