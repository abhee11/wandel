import { WorkflowSchema, clone, uid, type Workflow, type Operation } from '../shared/model';
export function createWorkflow(url: URL, name = 'Untitled workflow'): Workflow {
  const entry = uid(), now = new Date().toISOString();
  return { schemaVersion: 1, id: uid(), name, origin: url.origin, route: url.pathname + url.search + url.hash, createdAt: now, updatedAt: now, entry, maxStates: 30, states: [{ id: entry, title: 'Existing application', parent: null, view: 'base', operations: [] }], edges: [] };
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
export function visibleNodeIds(workflow: Workflow, stateId: string) {
  return new Set(lineage(workflow, stateId).flatMap(s => [ ...(s.view === 'panel' ? [`view:${s.id}`, `heading:${s.id}`] : []), ...s.operations.flatMap(o => o.kind === 'insert' ? [o.node.id,...(o.node.copy?.map(n=>n.id)||[])] : o.kind==='trigger'?[o.source]:[]) ]));
}
export function validateWorkflow(input: unknown): Workflow {
  const w = WorkflowSchema.parse(input);
  if (w.states.length > w.maxStates) throw new Error('Maximum number of states exceeded.');
  const ids = new Set(w.states.map(s => s.id));
  if (ids.size !== w.states.length || !ids.has(w.entry)) throw new Error('Invalid state IDs.');
  const entry = w.states.find(s => s.id === w.entry)!;
  if (entry.parent !== null || entry.view !== 'base') throw new Error('Invalid entry state.');
  const nodes = new Set<string>(), ops = new Set<string>();
  for (const s of w.states) {
    if (lineage(w, s.id)[0].id !== w.entry) throw new Error('State must descend from entry.');
    if (s.id !== w.entry && s.view !== 'panel') throw new Error('Child states need a view.');
    for (const o of s.operations) {
      if (ops.has(o.id)) throw new Error('Duplicate operation.'); ops.add(o.id);
      if(o.kind==='trigger'){if(nodes.has(o.source)||/^(view|heading|wrap):/.test(o.source))throw new Error('Duplicate/reserved trigger ID.');nodes.add(o.source);}
      if (o.kind === 'insert') { if (nodes.has(o.node.id) || /^(view|heading|wrap):/.test(o.node.id)) throw new Error('Duplicate/reserved node ID.'); nodes.add(o.node.id); for(const n of o.node.copy||[]){if(nodes.has(n.id)||/^(view|heading|wrap):/.test(n.id))throw new Error('Duplicate/reserved copy ID.');nodes.add(n.id);} }
    }
  }
  const triggers = new Set<string>();
  for (const e of w.edges) {
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
export function transition(w: Workflow, stateId: string, source: string) { return w.edges.find(e => e.from === stateId && e.source === source)?.to; }
export class History {
  past: { workflow: Workflow; stateId: string }[] = [];
  future: { workflow: Workflow; stateId: string }[] = [];
  push(workflow: Workflow, stateId: string) { this.past.push(clone({workflow, stateId})); this.past = this.past.slice(-60); this.future = []; }
  undo(workflow: Workflow, stateId: string) { const previous = this.past.pop(); if (previous) this.future.push(clone({workflow,stateId})); return previous; }
  redo(workflow: Workflow, stateId: string) { const next = this.future.pop(); if (next) this.past.push(clone({workflow,stateId})); return next; }
}
