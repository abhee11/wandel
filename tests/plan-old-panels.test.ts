import {it,expect,vi} from 'vitest';
import {database} from '../platform/server/db';
import {createPlatform} from '../platform/server/app';
import {configuration} from '../platform/server/config';
import {MockAIProvider} from '../platform/server/providers';
import {action,response,type PageContext} from '../extension/assistant/schema';
import {AssistantPlanSchema as Schema044} from './fixtures/schema-0.4.4';
import {AssistantPlanSchema as Schema047} from './fixtures/schema-0.4.7';
// Panels check plans strictly. Each released panel gets plans its own schema accepts: 0.4.5 added everyMatch (0.4.4 and
// earlier reject it) and 0.4.8 added copy (0.4.7 and earlier reject it).
it('every released panel gets plans its own strict schema accepts; new panels keep the newer moves',async()=>{
 vi.spyOn(console,'info').mockImplementation(()=>{});
 const db=database(':memory:'),config=configuration({WANDEL_AUTH_MODE:'legacy'},'assistant-test-pepper-with-32-characters');
 const context:PageContext={token:'token',workflowId:'workflow',stateId:'base',route:'/',selected:null,hover:null,styleReference:null,elements:[{ref:'e1',tag:'button',role:'button',name:'Add to basket',text:'Add to basket',attributes:{},classes:[],bounds:{x:0,y:0,width:50,height:20},visible:true,disabled:false,parent:null,children:[],style:{},interactive:true,owned:false}],recent:[],lastGroup:null,lastView:null,views:[{id:'base',title:'Existing application'}],limitations:[]};
 const mixed=response('edit','Toast on every button, and keep a copy.',[{...action('behavior',['e1'],{event:'click',effects:[{action:'toast',targets:[],value:'Added',seconds:3}]}),everyMatch:true},action('copy',['e1'])]);
 const copyOnly=response('edit','Copied the button.',[action('copy',['e1'])]);
 const plan=vi.fn().mockResolvedValue(mixed);
 const app=createPlatform({db,config,assistant:{plan,transcribe:vi.fn()},ai:new MockAIProvider(),mail:{reset:async()=>{}}});
 const post=(path:string,body:unknown,cookie='')=>app.handle(new Request(config.origin+path,{method:'POST',headers:{Origin:config.origin,...(cookie?{Cookie:cookie}:{}),'Content-Type':'application/json'},body:JSON.stringify(body)}));
 const cookie=(await post('/api/auth/signup',{email:'old-panel@example.com',password:'a-strong-test-password'})).headers.get('set-cookie')!.split(';')[0];
 const ask=async(extra:object,instruction='Show a toast on every Add to basket button')=>(await (await post('/api/assistant/plan',{instruction,context,requestId:crypto.randomUUID(),steps:true,...extra},cookie)).json()).plan;
 // 0.4.4 and earlier: neither everyMatch nor copy.
 const old=await ask({});
 expect(JSON.stringify(old)).not.toMatch(/everyMatch|"copy"/);expect(Schema044.safeParse(old).success).toBe(true);
 // A second ask comes from the plan cache: still shaped for this panel.
 expect(JSON.stringify(await ask({}))).not.toMatch(/everyMatch|"copy"/);
 // 0.4.5 to 0.4.7: everyMatch yes, copy no.
 const mid=await ask({every:true,compact:true,slim:true});
 expect(mid.actions[0].everyMatch).toBe(true);expect(mid.actions.some((a:any)=>a.kind==='copy')).toBe(false);expect(Schema047.safeParse(mid).success).toBe(true);
 // 0.4.8: everything.
 const fresh=await ask({capabilities:['every','compact','copy']});
 expect(fresh.actions.map((a:any)=>a.kind)).toEqual(['behavior','copy']);
 // A plan that was only a copy reaches an older panel as an answer it can show.
 plan.mockResolvedValue(copyOnly);
 const answer=await ask({every:true,compact:true},'Copy this button');
 expect(answer.status).toBe('answer');expect(answer.message).toMatch(/Copy from page/);expect(Schema047.safeParse(answer).success).toBe(true);
 db.close();
});
import {AssistantPlanSchema as Schema048} from './fixtures/schema-0.4.8';
// 0.4.9 added App knowledge and library pastes. Panels up to 0.4.8 never send a team, so they never get the knowledge
// block; and a library paste never reaches them, whatever the AI plans.
it('the 0.4.9 server keeps every released panel working, App knowledge and library pastes included',async()=>{
 vi.spyOn(console,'info').mockImplementation(()=>{});
 const db=database(':memory:'),config=configuration({WANDEL_AUTH_MODE:'legacy'},'assistant-test-pepper-with-32-characters');
 const context:PageContext={token:'token',workflowId:'workflow',stateId:'base',route:'/',selected:null,hover:null,styleReference:null,elements:[{ref:'e1',tag:'section',role:'',name:'Cards',text:'Cards',attributes:{},classes:[],bounds:{x:0,y:0,width:50,height:20},visible:true,disabled:false,parent:null,children:[],style:{},interactive:false,owned:false}],recent:[],lastGroup:null,lastView:null,views:[{id:'base',title:'Existing application'}],limitations:[]};
 const library=response('edit','Pasted the card.',[action('paste',['e1'],{position:'before',description:'library:11111111-1111-4111-8111-111111111111'}),{...action('style',['e1'],{style:{fontWeight:700}}),everyMatch:true},action('copy',['e1'])]);
 const plan=vi.fn().mockResolvedValue(library);
 const app=createPlatform({db,config,assistant:{plan,transcribe:vi.fn()},ai:new MockAIProvider(),mail:{reset:async()=>{}}});
 const post=(path:string,body:unknown,cookie='')=>app.handle(new Request(config.origin+path,{method:'POST',headers:{Origin:config.origin,...(cookie?{Cookie:cookie}:{}),'Content-Type':'application/json'},body:JSON.stringify(body)}));
 const cookie=(await post('/api/auth/signup',{email:'panels@example.com',password:'a-strong-test-password'})).headers.get('set-cookie')!.split(';')[0];
 const ask=async(extra:object)=>(await (await post('/api/assistant/plan',{instruction:'Add the card here',context,requestId:crypto.randomUUID(),steps:true,...extra},cookie)).json()).plan;
 // Each released panel, sending exactly what it sends.
 const panels:[string,object,{safeParse(v:unknown):{success:boolean}}][]=[
  ['0.4.4',{},Schema044],
  ['0.4.5–0.4.6',{every:true},Schema047],
  ['0.4.7',{every:true,compact:true,slim:true},Schema047],
  ['0.4.8',{every:true,compact:true,slim:true,capabilities:['every','compact','copy']},Schema048]];
 for(const [version,extra,schema] of panels){
  const got=await ask(extra);
  expect(schema.safeParse(got).success,version+' accepts the plan').toBe(true);
  expect(JSON.stringify(got),version+' never gets a library paste').not.toContain('library:');
  expect(plan.mock.calls.at(-1)![0].appKnowledge,version+' gets no App knowledge').toBeUndefined();
 }
 // 0.4.9 gets all of it.
 const now=await ask({every:true,compact:true,capabilities:['every','compact','copy','library']});
 expect(now.actions.map((a:any)=>a.kind)).toEqual(['paste','style','copy']);
 db.close();
});
