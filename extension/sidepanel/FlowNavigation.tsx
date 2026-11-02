import {lineage} from '../prototype/engine';
import type {Snapshot} from '../shared/model';
export function FlowNavigation({snapshot:s,busy=false,onNavigate}:{snapshot:Snapshot;busy?:boolean;onNavigate:(id:string)=>void}){
 const next=new Set(s.workflow.edges.filter(e=>e.from===s.stateId).flatMap(e=>[e.to,...(e.otherwise?[e.otherwise]:[])])),visited=new Set(s.visited||[]);
 return <section><div className="dx-section-title">YOUR FLOW <span>{s.workflow.states.length} / {s.workflow.maxStates} states</span></div><p className="dx-flow-help">Select a screen to preview it. Page controls test the actual connection rules.</p><nav className="dx-flow" aria-label="Workflow screens">{s.workflow.states.map((st,index)=>{
  const current=s.stateId===st.id,isNext=!current&&next.has(st.id),seen=!current&&visited.has(st.id),status=current?'CURRENT':isNext?seen?'NEXT · VISITED':'NEXT':seen?'VISITED':'SCREEN';
  const outgoing=s.workflow.edges.filter(e=>e.from===st.id);
  return <div className="dx-flow-item" key={st.id}><button className={`dx-state ${current?'current':isNext?'next':seen?'visited':'upcoming'}`} aria-current={current?'step':undefined} aria-label={`Open ${st.title} · ${status.toLowerCase()}`} disabled={busy||!s.enabled} onClick={()=>onNavigate(st.id)}><span className="dx-state-number">{String(index+1).padStart(2,'0')}</span><div><strong>{st.title}</strong><small>{st.virtualRoute?'Prototype page · '+st.virtualRoute:st.liveURL?'Live application page':st.view==='base'?'Live application':st.screen?'Captured prototype · reconnect for live page':`${st.operations.length} UI changes · editable panel`}</small></div><span className="dx-flow-status">{status}</span></button>{outgoing.map(edge=>{
   const op=lineage(s.workflow,edge.from).flatMap(x=>x.operations).reverse().find(o=>o.kind==='insert'?o.node.id===edge.source.replace(/:input$/,''):o.kind==='trigger'?o.source===edge.source:o.kind==='text'&&o.target.owned===edge.source),destination=s.workflow.states.find(x=>x.id===edge.to);
   return <div key={edge.id}><div className="dx-connector">↳ <span>{op?.kind==='insert'?op.node.text:op?.kind==='text'?op.text:op?.kind==='trigger'?op.target.name:'Control'} · {edge.event||'click'}{edge.conditions?.length?` · ${edge.conditions.length} conditions`:''} → {destination?.title}</span></div>{edge.otherwise&&<div className="dx-connector">↳ <span>Otherwise → {s.workflow.states.find(state=>state.id===edge.otherwise)?.title}</span></div>}</div>;
  })}</div>;
 })}</nav></section>;
}
