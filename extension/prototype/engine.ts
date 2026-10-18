import { WorkflowSchema, VisitedScreenSchema, clone, uid, type Workflow, type Operation } from '../shared/model';
export function defaultWorkflowName(url:URL,createdAt:string,id:string){
  const context=(url.host+(url.pathname==='/'?'':url.pathname)).slice(0,120);
  return `Flow — ${context} — ${createdAt.slice(0,19).replace('T',' ')} UTC — ${id.slice(0,6)}`;
}
export function hasDefaultWorkflowName(w:Workflow){return w.name==='Untitled workflow'||w.name===defaultWorkflowName(new URL(w.origin+w.route),w.createdAt,w.id);}
export function createWorkflow(url: URL, name?:string): Workflow {
  const entry = uid(), now = new Date().toISOString(), id=uid();
  return { schemaVersion: 1, id, name:name?.trim()||defaultWorkflowName(url,now,id), origin: url.origin, route: url.pathname + url.search + url.hash, createdAt: now, updatedAt: now, entry, maxStates: 30, states: [{ id: entry, title: 'Existing application', parent: null, view: 'base', operations: [] }], edges: [] };
}
export function lineage(workflow: Workflow, stateId: string) {
  const chain: Workflow['states'] = [], seen = new Set<string>();
  let current = workflow.states.find(s => s.id === stateId);
  if (!current) throw new Error('State not found.');
  while (current) {
    if (seen.has(current.id)) throw new Error('Cyclic state ancestry.');
    chain.unshift(current); seen.add(current.id);
    if (!current.parent) break;
    current = workflow.states.find(s => s.id === current!.parent);
    if (!current) throw new Error('Missing parent state.');
  }
  return chain;
}
export function renderLineage(w:Workflow,stateId:string){const chain=lineage(w,stateId);const boundary=chain.reduce((index,s,i)=>s.liveURL?i:index,-1);return boundary<0?chain:chain.slice(boundary);}
export function visibleNodeIds(workflow: Workflow, stateId: string) {
  return new Set(renderLineage(workflow, stateId).flatMap(s => [ ...(s.view === 'panel' ? [`view:${s.id}`, `heading:${s.id}`] : []), ...s.operations.flatMap(o => o.kind === 'insert' ? [o.node.id,...(o.node.kind==='field'?[o.node.id+':input']:[]),...(o.node.copy?.map(n=>n.id)||[]),...(o.node.choices?.options.map((_,i)=>o.node.id+':choice:'+i)||[])] : o.kind==='trigger'?[o.source]:[]) ]));
}
export function validateWorkflow(input: unknown): Workflow {
  const w = WorkflowSchema.parse(input);
  if (w.states.length > w.maxStates) throw new Error('Maximum number of states exceeded.');
  const ids = new Set(w.states.map(s => s.id));
  if (ids.size !== w.states.length || !ids.has(w.entry)) throw new Error('Invalid state IDs.');
  const entry = w.states.find(s => s.id === w.entry)!;
  if (entry.parent !== null || entry.view !== 'base') throw new Error('Invalid entry state.');
  const dataKeys=new Set((w.variables||[]).map(v=>v.key));
  if(dataKeys.size!==(w.variables||[]).length)throw new Error('Duplicate prototype data keys.');
  const nodes = new Set<string>(), ops = new Set<string>();
  for (const s of w.states) {
    if (lineage(w, s.id)[0].id !== w.entry) throw new Error('State must descend from entry.');
    if(s.liveURL){const u=new URL(s.liveURL);if(u.origin!==w.origin||!['https:','http:'].includes(u.protocol)||u.username||u.password||s.view!=='base')throw new Error('Invalid live application destination.');}
    if (s.id !== w.entry && s.view !== 'panel'&&!s.liveURL) throw new Error('Child states need a view.');
    for (const o of s.operations) {
      if (ops.has(o.id)) throw new Error('Duplicate operation.'); ops.add(o.id);
      if(o.kind==='trigger'){if(nodes.has(o.source)||/^(view|heading|wrap):/.test(o.source))throw new Error('Duplicate/reserved trigger ID.');nodes.add(o.source);}
      if (o.kind === 'insert') { if(o.node.binding&&(!dataKeys.has(o.node.binding)||o.node.kind!=='field'||o.node.copy))throw new Error('Invalid field binding.'); if (nodes.has(o.node.id) || /^(view|heading|wrap):/.test(o.node.id)) throw new Error('Duplicate/reserved node ID.'); nodes.add(o.node.id);for(const [index]of o.node.choices?.options.entries()||[]){const source=o.node.id+':choice:'+index;if(nodes.has(source))throw new Error('Duplicate option ID.');nodes.add(source);} for(const n of o.node.copy||[]){if(nodes.has(n.id)||/^(view|heading|wrap):/.test(n.id))throw new Error('Duplicate/reserved copy ID.');nodes.add(n.id);} }
    }
  }
  const triggers = new Set<string>(),edgeIds=new Set<string>();
  for (const e of w.edges) {
    if(edgeIds.has(e.id))throw new Error('Duplicate connection ID.');edgeIds.add(e.id);
    if(e.effects?.some(effect=>!dataKeys.has(effect.key)))throw new Error('Unknown prototype data key.');
    if(e.otherwise&&!ids.has(e.otherwise))throw new Error('Missing fallback view.');
    for(const condition of e.conditions||[])if(condition.target.owned&&!visibleNodeIds(w,e.from).has(condition.target.owned))throw new Error('Condition field is not present in the source view.');
    if (!ids.has(e.from) || !ids.has(e.to) || !visibleNodeIds(w,e.from).has(e.source)) throw new Error('Broken interaction.');
    const key = `${e.from}:${e.source}`;
    if (triggers.has(key)) throw new Error('Multiple interactions on one control.'); triggers.add(key);
  }
  return w;
}
export function addOperation(w: Workflow, stateId: string, operation: Operation) {
  const next = clone(w); next.states.find(s => s.id === stateId)!.operations.push(operation); return validateWorkflow(next);
}
export function addChild(w: Workflow, stateId: string, source: string, title: string) {
  if (w.states.length >= w.maxStates) throw new Error(`This workflow is limited to ${w.maxStates} states.`);
  if (!visibleNodeIds(w, stateId).has(source)) throw new Error('Select a prototype control first.');
  const next = clone(w), id = uid();
  next.states.push({ id, title: title.trim(), parent: stateId, view: 'panel', operations: [] });
  next.edges = next.edges.filter(e => e.from !== stateId || e.source !== source);
  next.edges.push({ id: uid(), from: stateId, source, to: id });
  return { workflow: validateWorkflow(next), stateId: id };
}
export function addLiveScreen(w:Workflow,from:string,input:unknown){
 const screen=VisitedScreenSchema.parse(input),url=new URL(screen.url);if(url.origin!==w.origin||!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('Choose a screen from this application.');
 const existing=w.states.find(s=>s.liveURL===url.href);if(existing)return {workflow:w,stateId:existing.id};
 if(w.states.length>=w.maxStates)throw new Error('This workflow has reached its screen limit.');
 const next=clone(w),stateId=uid();next.states.push({id:stateId,title:screen.title,parent:from,view:'base',liveURL:url.href,screen:{id:screen.id,url:url.href,title:screen.title,thumbnail:screen.thumbnail,capturedAt:screen.capturedAt},operations:[]});
 return {workflow:validateWorkflow(next),stateId};
}
export function addCapturedScreen(w:Workflow,from:string,input:unknown){
 const screen=VisitedScreenSchema.parse(input);if(new URL(screen.url).origin!==w.origin)throw new Error('Choose a screen from this application.');
 const existing=w.states.find(s=>s.screen?.id===screen.id);if(existing)return {workflow:w,stateId:existing.id};
 if(w.states.length>=w.maxStates)throw new Error('This workflow has reached its screen limit.');
 const next=clone(w),stateId=uid(),nodes=screen.nodes.map(n=>({...n,id:uid()}));
 const target={owned:'view:'+stateId,tag:'section',role:'',name:'',text:'',attrs:{},parent:{tag:'',id:'',role:'',label:''},previous:'',next:''};
 next.states.push({id:stateId,title:screen.title,parent:from,view:'panel',presentation:'screen',screen:{id:screen.id,url:screen.url,title:screen.title,thumbnail:screen.thumbnail,capturedAt:screen.capturedAt},operations:[{id:uid(),kind:'insert',target,position:'inside',node:{id:uid(),kind:'panel',text:screen.title,copy:nodes}}]});
 return {workflow:validateWorkflow(next),stateId};
}
export function transition(w: Workflow, stateId: string, source: string) { const edge=w.edges.find(e=>e.from===stateId&&e.source===source&&(e.event||'click')==='click');return edge?.conditions?.length?undefined:edge?.to; }
export class History {
  past: { workflow: Workflow; stateId: string }[] = [];
  future: { workflow: Workflow; stateId: string }[] = [];
  push(workflow: Workflow, stateId: string) { this.past.push(clone({workflow, stateId})); this.past = this.past.slice(-60); this.future = []; }
  undo(workflow: Workflow, stateId: string) { const previous = this.past.pop(); if (previous) this.future.push(clone({workflow,stateId})); return previous; }
  redo(workflow: Workflow, stateId: string) { const next = this.future.pop(); if (next) this.past.push(clone({workflow,stateId})); return next; }
}

/** Depth is the furthest screen's shortest click path; return loops do not add depth.
 * Retain visual ancestry depth for older/manual workflows and disconnected edits. */
export function workflowDepth(w:Workflow){
 const distances=new Map([[w.entry,0]]),queue=[w.entry];
 for(let i=0;i<queue.length;i++)for(const edge of w.edges.filter(e=>e.from===queue[i]))for(const to of [edge.to,...(edge.otherwise?[edge.otherwise]:[])])if(!distances.has(to)){distances.set(to,distances.get(edge.from)!+1);queue.push(to);}
 return Math.max(...w.states.map(s=>lineage(w,s.id).length-1),...distances.values());
}
