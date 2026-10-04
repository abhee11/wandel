import { describe, it, expect } from 'vitest';
import { createWorkflow,addOperation,addChild,transition,lineage,validateWorkflow } from '../extension/prototype/engine';
import { localPlan,operationFromPlan,PlanSchema } from '../extension/ai/planner';
import { Repository,type StorageAdapter } from '../extension/storage/store';
import type { Locator } from '../extension/shared/model';
const locator:Locator={tag:'button',role:'button',name:'Customers',text:'Customers',attrs:{id:'customers'},parent:{tag:'nav',id:'',role:'navigation',label:''},previous:'',next:''};
class Memory implements StorageAdapter {data=new Map<string,unknown>();async read(k:string){return structuredClone(this.data.get(k));}async write(k:string,v:unknown){this.data.set(k,structuredClone(v));}async remove(k:string){this.data.delete(k);}async keys(){return [...this.data.keys()];}}
describe('workflow graph',()=>{
 it('builds and traverses three recursive steps',()=>{
   let w=createWorkflow(new URL('https://example.com/customers'));let state=w.entry;const ids:string[]=[];
   for(const [label,title] of [['Risk Analysis','Analysis Panel'],['View Details','Detail State'],['Approve','Confirmation State']]){
     const op=operationFromPlan(localPlan(`Add ${label} beside this`),locator);if(op.kind!=='insert')throw Error();
     w=addOperation(w,state,op);const child=addChild(w,state,op.node.id,title);expect(transition(child.workflow,state,op.node.id)).toBe(child.stateId);w=child.workflow;state=child.stateId;ids.push(state);
   }
   expect(lineage(w,state).map(s=>s.title)).toEqual(['Existing application','Analysis Panel','Detail State','Confirmation State']);
   expect(validateWorkflow(JSON.parse(JSON.stringify(w))).edges).toHaveLength(3);
 });
 it('enforces complexity and rejects cycles and dangling edges',()=>{
   const w=createWorkflow(new URL('https://example.com'));w.maxStates=2;
   const op=operationFromPlan(localPlan('Add Analyze'),locator);if(op.kind!=='insert')throw Error();
   const child=addChild(addOperation(w,w.entry,op),w.entry,op.node.id,'Analysis');
   expect(()=>addChild(child.workflow,child.stateId,op.node.id,'Details')).toThrow('limited');
   child.workflow.states[1].parent=child.stateId;expect(()=>validateWorkflow(child.workflow)).toThrow('Cyclic');
 });
});
describe('planner boundary',()=>{
 it.each([['Add a button next to this called Analyze','Analyze','after'],['Add Risk Analysis beside this','Risk Analysis','after'],['Add View Details inside this','View Details','inside'],['Add an Approve button below this','Approve','below'],['Add "Run evaluation" before this','Run evaluation','before']])('parses %s',(prompt,text,position)=>{expect(localPlan(prompt)).toMatchObject({text,position});});
 it('supports renames and rejects arbitrary instructions or markup fields',()=>{
   expect(localPlan("Change this text to 'Run evaluation'")).toMatchObject({kind:'text',text:'Run evaluation'});
   expect(()=>localPlan('Run arbitrary code')).toThrow();
   expect(()=>PlanSchema.parse({kind:'insert',element:'script',position:'after',text:'bad'})).toThrow();
   expect(()=>PlanSchema.parse({...localPlan('Add Analyze'),html:'<script>'})).toThrow();
 });
});
describe('version persistence',()=>{
 it('saves complete immutable graphs and restores without overwriting history',async()=>{
   const repo=new Repository(new Memory());const w=createWorkflow(new URL('https://example.com/customers'));w.name='Risk Analysis Flow';
   await repo.save(w,true);w.name='Risk Analysis Flow revised';await repo.save(w,true);
   const restored=await repo.restore(w.id,1);expect(restored.draft.name).toBe('Risk Analysis Flow');expect(restored.versions[1].workflow.name).toBe('Risk Analysis Flow revised');
   const v3=await repo.save(restored.draft,true);expect(v3.versions.map(v=>v.number)).toEqual([1,2,3]);
   expect(await repo.list(w.origin,w.route)).toHaveLength(1);expect(await repo.list(w.origin,'/other')).toHaveLength(0);
 });
});
