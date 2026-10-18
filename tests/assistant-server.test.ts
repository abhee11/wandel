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
it('rejects fabricated references and invented labels, refunds failed interpretation, and rejects excess context fields',async()=>{
 vi.mocked(provider.plan).mockResolvedValueOnce(response('edit','Bad',[action('create',['outside'],{element:'button',text:'Review'})]));expect((await request('/api/assistant/plan',payload())).status).toBe(502);
 vi.mocked(provider.plan).mockResolvedValueOnce(response('edit','Bad',[action('create',['e1'],{element:'button',text:'Invented'})]));expect((await request('/api/assistant/plan',payload())).status).toBe(502);
 expect(db.prepare("SELECT count(*) n FROM ai_actions WHERE status='succeeded'").get()).toEqual({n:0});expect((await request('/api/assistant/plan',{...payload(),context:{...context,screenshot:'private pixels',html:'<script>bad</script>'}})).status).toBe(400);
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
