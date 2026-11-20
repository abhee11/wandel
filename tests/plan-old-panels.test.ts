import {it,expect,vi} from 'vitest';
import {database} from '../platform/server/db';
import {createPlatform} from '../platform/server/app';
import {configuration} from '../platform/server/config';
import {MockAIProvider} from '../platform/server/providers';
import {action,response,type PageContext} from '../extension/assistant/schema';
import {AssistantPlanSchema as Schema044} from './fixtures/schema-0.4.4';
// 0.4.5 added everyMatch to plans; every panel before it rejects unknown fields, so the server must leave it out for them.
it('older panels get plans their own strict schema accepts; new panels keep everyMatch',async()=>{
 vi.spyOn(console,'info').mockImplementation(()=>{});
 const db=database(':memory:'),config=configuration({WANDEL_AUTH_MODE:'legacy'},'assistant-test-pepper-with-32-characters');
 const context:PageContext={token:'token',workflowId:'workflow',stateId:'base',route:'/',selected:null,hover:null,styleReference:null,elements:[{ref:'e1',tag:'button',role:'button',name:'Add to basket',text:'Add to basket',attributes:{},classes:[],bounds:{x:0,y:0,width:50,height:20},visible:true,disabled:false,parent:null,children:[],style:{},interactive:true,owned:false}],recent:[],lastGroup:null,lastView:null,views:[{id:'base',title:'Existing application'}],limitations:[]};
 const planned=response('edit','Toast on every button.',[{...action('behavior',['e1'],{event:'click',effects:[{action:'toast',targets:[],value:'Added',seconds:3}]}),everyMatch:true},action('style',['e1'],{style:{fontWeight:700}})]);
 const app=createPlatform({db,config,assistant:{plan:vi.fn().mockResolvedValue(planned),transcribe:vi.fn()},ai:new MockAIProvider(),mail:{reset:async()=>{}}});
 const post=(path:string,body:unknown,cookie='')=>app.handle(new Request(config.origin+path,{method:'POST',headers:{Origin:config.origin,...(cookie?{Cookie:cookie}:{}),'Content-Type':'application/json'},body:JSON.stringify(body)}));
 const cookie=(await post('/api/auth/signup',{email:'old-panel@example.com',password:'a-strong-test-password'})).headers.get('set-cookie')!.split(';')[0];
 const ask=async(extra:object)=>(await (await post('/api/assistant/plan',{instruction:'Show a toast on every Add to basket button',context,requestId:crypto.randomUUID(),steps:true,...extra},cookie)).json()).plan;
 const old=await ask({});
 expect(JSON.stringify(old)).not.toContain('everyMatch');
 expect(Schema044.safeParse(old).success).toBe(true);
 // A second ask is served from the plan cache: still without the field.
 expect(JSON.stringify(await ask({}))).not.toContain('everyMatch');
 const fresh=await ask({every:true});
 expect(fresh.actions[0].everyMatch).toBe(true);
 db.close();
});
