// @vitest-environment jsdom
import {it,expect,afterEach,beforeEach,vi} from 'vitest';
import {Session} from '../extension/content/session';
import {Repository,BrowserStorage} from '../extension/storage/store';
import {FlowPlanSchema} from '../extension/ai/planSchema';
import {validateWorkflow,workflowDepth} from '../extension/prototype/engine';
import {riskFeature} from '../demo/fixtures/riskFeature';
let session:Session;
const root=()=>document.getElementById('app')!;
const view=()=>session.renderer.owned.get(`view:${session.stateId}`)!;
const click=(label:string)=>{const button=[...root().querySelectorAll('button')].find(b=>b.textContent===label);expect(button,`Button ${label}`).toBeTruthy();button!.click();};
beforeEach(()=>{localStorage.clear();document.body.innerHTML='<main id="app"><button id="customers">Customers</button></main>';});
afterEach(()=>session?.destroy());
async function setup(){const repo=new Repository(new BrowserStorage());session=new Session(root(),repo,new URL('https://example.com'),{requestPlan:vi.fn().mockResolvedValue({steps:[],flow:riskFeature})});await session.init();await session.dispatch({type:'edit'});click('Customers');await session.promptHere('Imagine a risk review feature with approve and reject branches','element');return repo;}
it('replays branches and data, returns to an updated dashboard, and restarts without saving typed values',async()=>{
 const repo=await setup();expect(session.workflow.states).toHaveLength(5);expect(workflowDepth(session.workflow)).toBe(3);expect(session.workflow.edges).toHaveLength(7);await session.dispatch({type:'save'});const id=session.workflow.id;
 await session.dispatch({type:'replay'});click('Risk analysis');expect(view().textContent).toContain('Payment history');expect(view().textContent).toContain('Pending');click('View details');
 const input=view().querySelector('input')!;input.value='User-entered ephemeral note';input.dispatchEvent(new Event('input',{bubbles:true}));click('Approve');expect(view().textContent).toContain('Approved · User-entered ephemeral note');
 await session.dispatch({type:'back'});expect(view().textContent).toContain('Decision: Pending');expect(view().querySelector('input')!.value).toBe('User-entered ephemeral note');click('Reject');expect(view().textContent).toContain('Rejected · User-entered ephemeral note');click('Return to dashboard');expect(view().textContent).toContain('DecisionRejected');
 await session.dispatch({type:'save'});expect(JSON.stringify(await repo.get(id))).not.toContain('User-entered ephemeral note');
 await session.dispatch({type:'replay'});click('Risk analysis');expect(view().textContent).toContain('Pending');
 session.destroy();session=new Session(root(),repo,new URL('https://example.com'));await session.init();await session.dispatch({type:'load',id});await session.dispatch({type:'replay'});click('Risk analysis');click('View details');click('Approve');click('Return to dashboard');expect(view().textContent).toContain('DecisionApproved');expect(session.unresolved).toEqual([]);
});
it('supports editing generated content and recursively adding another step without altering sibling branches',async()=>{
 await setup();const approved=session.workflow.states.find(s=>s.title==='Review approved')!;await session.dispatch({type:'state',id:approved.id});
 const heading=session.renderer.owned.get(`heading:${approved.id}`)!;heading.click();await session.promptHere('Rename this to Approved review','element');expect(view().textContent).toContain('Approved review');
 click('Return to dashboard');await session.dispatch({type:'child',text:'Follow-up review'});expect(session.workflow.states).toHaveLength(6);expect(session.workflow.states.at(-1)!.parent).toBe(approved.id);expect(session.unresolved).toEqual([]);
 await session.dispatch({type:'undo'});expect(session.workflow.states).toHaveLength(5);expect(session.workflow.edges.find(e=>e.from===approved.id)!.to).toBe(session.workflow.states[1].id);
});
it('rejects dangling, unreachable and undeclared graph data before making changes',async()=>{
 await setup();const before=JSON.stringify(session.workflow);for(const mutate of [
 (f:any)=>f.screens[1].actions[0].to='missing',
 (f:any)=>f.screens[0].actions=[],
 (f:any)=>f.screens[1].actions[0].effects[0].key='missing',
 (f:any)=>f.screens[0].body='{{missing}}',
 (f:any)=>f.screens[0].table.rows[0]=['bad'],
 ]){const f=structuredClone(riskFeature);mutate(f);expect(FlowPlanSchema.safeParse(f).success).toBe(false);await expect(session.dispatch({type:'prompt',prompt:'Build workflow',plan:{steps:[],flow:f}})).rejects.toThrow();expect(JSON.stringify(session.workflow)).toBe(before);}
 const w=structuredClone(session.workflow);w.edges[0].effects=[{key:'missing',value:'Approved'}];expect(()=>validateWorkflow(w)).toThrow('Unknown prototype');
});
