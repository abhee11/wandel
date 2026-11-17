import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {database,type DB} from '../platform/server/db';
import {createPlatform} from '../platform/server/app';
import {configuration} from '../platform/server/config';
import {MockAIProvider} from '../platform/server/providers';
import {action,response,type PageContext} from '../extension/assistant/schema';
import {normalizePlan} from '../extension/assistant/plan';
import type {AssistantProvider} from '../platform/server/assistant';
let db:DB,app:ReturnType<typeof createPlatform>,cookie:string,provider:AssistantProvider;
const config=configuration({WANDEL_AUTH_MODE:'legacy'},'assistant-test-pepper-with-32-characters');
const el=(ref:string,tag:string,text:string,parent:string|null)=>({ref,tag,role:'',name:text,text,attributes:{},classes:[],bounds:{x:0,y:0,width:80,height:20},visible:true,disabled:false,parent,children:[],style:{},interactive:false,owned:false});
const context:PageContext={token:'token',workflowId:'workflow',stateId:'base',route:'/groups/1',selected:null,hover:null,styleReference:null,elements:[el('e1','div','',null),el('e2','span','Engagement','e1')],recent:[],lastGroup:null,lastView:null,views:[{id:'base',title:'Existing application'}],limitations:[]};
async function request(body:unknown){return app.handle(new Request(config.origin+'/api/assistant/plan',{method:'POST',headers:{Origin:config.origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(body)}));}
beforeEach(async()=>{vi.spyOn(console,'info').mockImplementation(()=>{});db=database(':memory:');provider={plan:vi.fn(),transcribe:vi.fn()};app=createPlatform({db,config,assistant:provider,ai:new MockAIProvider(),mail:{reset:async()=>{}}});
 const signup=await app.handle(new Request(config.origin+'/api/auth/signup',{method:'POST',headers:{Origin:config.origin,'Content-Type':'application/json'},body:JSON.stringify({email:'repairs@example.com',password:'a-strong-test-password'})}));cookie=signup.headers.get('set-cookie')!.split(';')[0];});
afterEach(()=>{db.close();vi.restoreAllMocks();});
it('drops a style step with no style instead of failing the whole plan',()=>{
 const plan=normalizePlan(response('edit','Added',[action('create',['e1'],{element:'button',text:'Concise',position:'inside'}),action('style',['e1'],{style:{}}),action('style',['e2'],{style:null})]));
 expect(plan.actions.map(a=>a.kind)).toEqual(['create']);
 // Alone, it stays, so the plan is still reported as unsupported rather than silently empty.
 expect(normalizePlan(response('edit','Styled',[action('style',['e1'],{style:{}})])).actions).toHaveLength(1);
});
it('sends a rename aimed at a box with no words back to the AI, naming the fix',async()=>{
 vi.mocked(provider.plan).mockResolvedValueOnce(response('edit','Renamed',[action('text',['e1'],{text:'Questioning'})])).mockResolvedValueOnce(response('edit','Renamed',[action('text',['e2'],{text:'Questioning'})]));
 const result=await request({instruction:'change the name of the rubric from engagement to questioning',context,requestId:crypto.randomUUID()});
 expect(result.status).toBe(200);
 expect(provider.plan).toHaveBeenCalledTimes(2);
 expect(vi.mocked(provider.plan).mock.calls[1][0].feedback).toContain('shows no words');
 expect((await result.json()).plan.actions[0].targets).toEqual(['e2']);
});
