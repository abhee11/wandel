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
