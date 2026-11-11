import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {database,type DB} from '../platform/server/db';
import {createPlatform} from '../platform/server/app';
import {configuration} from '../platform/server/config';
import {MockAIProvider} from '../platform/server/providers';
import {action,response,type PageContext} from '../extension/assistant/schema';
import {validateWav,type AssistantProvider} from '../platform/server/assistant';
let db:DB,app:ReturnType<typeof createPlatform>,cookie:string,provider:AssistantProvider;
const config=configuration({WANDEL_AUTH_MODE:'legacy'},'assistant-test-pepper-with-32-characters');
const context:PageContext={token:'token',workflowId:'workflow',stateId:'base',route:'/settings',selected:'e1',hover:null,styleReference:null,elements:[{ref:'e1',tag:'h3',role:'heading',name:'Metrics',text:'Metrics',attributes:{},classes:[],bounds:{x:0,y:0,width:50,height:20},visible:true,disabled:false,parent:null,children:[],style:{},interactive:false,owned:false}],recent:[],lastGroup:null,lastView:null,views:[{id:'base',title:'Existing application'}],limitations:[]};
const plan=response('edit','Added a button.',[action('create',['e1'],{element:'button',text:'Review',position:'after'})]);
async function request(path:string,body:unknown,auth=cookie){return app.handle(new Request(config.origin+path,{method:'POST',headers:{Origin:config.origin,...(auth?{Cookie:auth}:{}),'Content-Type':'application/json'},body:JSON.stringify(body)}));}
const payload=()=>({instruction:'Add a Review button below this.',context,requestId:crypto.randomUUID()});
beforeEach(async()=>{vi.spyOn(console,'info').mockImplementation(()=>{});db=database(':memory:');provider={plan:vi.fn().mockResolvedValue(plan),transcribe:vi.fn().mockResolvedValue('Make it green')};app=createPlatform({db,config,assistant:provider,ai:new MockAIProvider(),mail:{reset:async()=>{}}});const signup=await request('/api/auth/signup',{email:'assistant@example.com',password:'a-strong-test-password'},'');cookie=signup.headers.get('set-cookie')!.split(';')[0];});
afterEach(()=>{db.close();vi.restoreAllMocks();});
it('interprets bounded context behind account auth, caches retries, and counts a successful provider request once',async()=>{
 const input=payload();expect((await request('/api/assistant/plan',input,'')).status).toBe(401);const first=await request('/api/assistant/plan',input);expect(first.status).toBe(200);expect((await first.json()).plan).toEqual(plan);expect((await request('/api/assistant/plan',input)).status).toBe(200);expect(provider.plan).toHaveBeenCalledOnce();expect(db.prepare("SELECT count(*) n FROM ai_actions WHERE status='succeeded'").get()).toEqual({n:1});
});
it('rejects fabricated references, permits generated UI copy, and rejects excess context fields',async()=>{
 vi.mocked(provider.plan).mockResolvedValueOnce(response('edit','Bad',[action('create',['outside'],{element:'button',text:'Review'})])).mockResolvedValueOnce(response('edit','Bad',[action('create',['outside'],{element:'button',text:'Review'})]));expect((await request('/api/assistant/plan',payload())).status).toBe(502);
 vi.mocked(provider.plan).mockResolvedValueOnce(response('edit','Bad',[action('create',['e1'],{element:'button',text:'Invented'})]));expect((await request('/api/assistant/plan',payload())).status).toBe(200);
 expect(db.prepare("SELECT count(*) n FROM ai_actions WHERE status='succeeded'").get()).toEqual({n:1});expect((await request('/api/assistant/plan',{...payload(),context:{...context,screenshot:'private pixels',html:'<script>bad</script>'}})).status).toBe(400);
});
it('does not activate the assistant provider in the default platform',async()=>{
 app=createPlatform({db,config,ai:new MockAIProvider(),mail:{reset:async()=>{}}});expect((await request('/api/assistant/plan',payload())).status).toBe(503);expect(provider.plan).not.toHaveBeenCalled();
});
it('sanitizes credentials and private identifiers again before sending page context',async()=>{
 const input=payload();input.context={...context,elements:[{...context.elements[0],name:'Person me@example.com',text:'token=SUPERSECRET123456789'}]};const result=await request('/api/assistant/plan',input);expect(result.status).toBe(200);const sent=JSON.stringify(vi.mocked(provider.plan).mock.calls[0]);expect(sent).not.toContain('me@example.com');expect(sent).not.toContain('SUPERSECRET');
});
it('validates audio duration and PCM format before calling transcription',()=>{
 expect(()=>validateWav(new Uint8Array(700000))).toThrow('20 seconds');expect(()=>validateWav(new Uint8Array(100))).toThrow('mono');expect(provider.transcribe).not.toHaveBeenCalled();
});

it('returns design advice without requiring a selected target',async()=>{
 vi.mocked(provider.plan).mockResolvedValue(response('answer','Keep the heading dominant and give the primary action more space.'));
 const result=await request('/api/assistant/plan',{...payload(),instruction:'What do you think of this layout?',context:{...context,selected:null}});
 expect(result.status).toBe(200);expect((await result.json()).plan.status).toBe('answer');
});
it('does not turn a critique question into executable edits even if the provider does',async()=>{
 const result=await request('/api/assistant/plan',{...payload(),instruction:'What would you change about the layout?'});expect(result.status).toBe(200);const resultPlan=(await result.json()).plan;expect(resultPlan.status).toBe('answer');expect(resultPlan.actions).toEqual([]);
});

it('rejects a generic generated replacement for an explicit duplication request',async()=>{
 const result=await request('/api/assistant/plan',{...payload(),instruction:'Duplicate selected and add heading Review'});expect(result.status).toBe(502);expect((await result.json()).error.code).toBe('INVALID_DUPLICATE');
});

it('does not demand control labels for a layout follow-up and forwards structured delivery outcomes',async()=>{
 vi.mocked(provider.plan).mockResolvedValue(response('edit','Aligned',[action('style',['e1'],{style:{alignItems:'center',justifyContent:'center'},labels:['irrelevant'],text:'not new content'})]));
 const result=await request('/api/assistant/plan',{...payload(),instruction:'could you align the newly created vertically',history:[{role:'user',text:'Duplicate selected',status:'sent'},{role:'assistant',text:'Duplicated the card.'},{role:'user',text:'Add billing',status:'failed',error:'Nothing was applied'}]});
 expect(result.status).toBe(200);const plan=(await result.json()).plan;expect(plan.actions[0].labels).toEqual([]);expect(plan.actions[0].text).toBeNull();expect(vi.mocked(provider.plan).mock.calls[0][0].history?.at(-1)?.status).toBe('failed');
});
it('accepts ordered references to created results but rejects unknown rearrangement destinations',async()=>{
 vi.mocked(provider.plan).mockResolvedValue(response('edit','Copied and styled',[action('duplicate',['e1'],{resultRef:'new:copy'}),action('style',['new:copy'],{style:{color:'#ffffff'}})]));
 const result=await request('/api/assistant/plan',{...payload(),instruction:'Duplicate selected and make its text white'});expect(result.status).toBe(200);
 vi.mocked(provider.plan).mockResolvedValue(response('edit','Bad',[action('reorder',['e1'],{relativeTo:'outside',position:'before'})]));expect((await request('/api/assistant/plan',{...payload(),instruction:'Move it above the other card'})).status).toBe(502);
});
it('repairs one invalid plan internally before execution and meters the successful request once',async()=>{
 vi.mocked(provider.plan).mockResolvedValueOnce(response('edit','Bad ref',[action('style',['missing'],{style:{alignItems:'center'}})])).mockResolvedValueOnce(response('edit','Aligned',[action('style',['e1'],{style:{alignItems:'center'}})]));
 const result=await request('/api/assistant/plan',{...payload(),instruction:'Align this vertically'});expect(result.status).toBe(200);expect(provider.plan).toHaveBeenCalledTimes(2);expect(vi.mocked(provider.plan).mock.calls[1][0].feedback).toContain('unknown element');expect(db.prepare("SELECT count(*) n FROM ai_actions WHERE status='succeeded'").get()).toEqual({n:1});
});
it('sends step plans only to panels that run steps, and keeps older panels within 8 targets per action',async()=>{
 // Panels before 0.3.5 (including a build under store review) parse plans strictly: an unknown next field or 9+ targets would fail every edit.
 const elements=Array.from({length:12},(_,i)=>({...context.elements[0],ref:'e'+(i+1),name:'Engagement',text:'Engagement'}));
 const stepPlan={...response('edit','Renamed every card.',[action('text',elements.map(e=>e.ref),{text:'Achieving expectations'})]),next:'Set the level on every card to 1 (Developing).'};
 vi.mocked(provider.plan).mockResolvedValue(stepPlan);
 const older=await request('/api/assistant/plan',{...payload(),instruction:'Rename Engagement on all cards',context:{...context,elements}});
 expect(older.status).toBe(200);const old=(await older.json()).plan;
 expect('next' in old).toBe(false);expect(old.actions.map((a:{targets:string[]})=>a.targets.length)).toEqual([8,4]);
 const newer=await request('/api/assistant/plan',{...payload(),instruction:'Rename Engagement on all cards',context:{...context,elements},steps:true});
 expect(newer.status).toBe(200);const current=(await newer.json()).plan;
 expect(current.next).toBe('Set the level on every card to 1 (Developing).');expect(current.actions[0].targets).toHaveLength(12);
});
it('returns the saved plan for the same request on the same screen, and asks again on retry or after a failure report',async()=>{
 const same={instruction:'Add a Review button below this.',context};
 const first=await request('/api/assistant/plan',{...same,requestId:crypto.randomUUID(),steps:true});expect(first.status).toBe(200);
 const again=await request('/api/assistant/plan',{...same,requestId:crypto.randomUUID(),steps:true});
 expect(again.status).toBe(200);expect((await again.json()).plan).toEqual((await first.json()).plan);expect(provider.plan).toHaveBeenCalledTimes(1);
 // A different screen is a different request.
 await request('/api/assistant/plan',{...same,context:{...context,route:'/billing'},requestId:crypto.randomUUID(),steps:true});expect(provider.plan).toHaveBeenCalledTimes(2);
 // "Try again" skips the saved answer.
 await request('/api/assistant/plan',{...same,requestId:crypto.randomUUID(),steps:true,retry:true});expect(provider.plan).toHaveBeenCalledTimes(3);
 // A failed edit clears it, so the next attempt is fresh.
 expect((await request('/api/assistant/diagnostic',{detail:'undone after review: overlap',instruction:same.instruction})).status).toBe(200);
 await request('/api/assistant/plan',{...same,requestId:crypto.randomUUID(),steps:true});expect(provider.plan).toHaveBeenCalledTimes(4);
});
