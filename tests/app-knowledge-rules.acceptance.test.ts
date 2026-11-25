// Opt-in, live AI: a team rule reaches a fresh request (not a follow-up) and the plan follows it.
import {it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {database} from '../platform/server/db';
import {createPlatform} from '../platform/server/app';
import {configuration} from '../platform/server/config';
import {MockAIProvider} from '../platform/server/providers';
import {OpenAIAssistant} from '../platform/server/assistant';
import type {PageContext} from '../extension/assistant/schema';
const live=process.env.WANDEL_RUN_DESIGNER_ACCEPTANCE==='1';
it.skipIf(!live)('a new button follows the team rule for the brand colour',async()=>{
 vi.spyOn(console,'info').mockImplementation(()=>{});
 const env=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).flatMap(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);return m?[[m[1],m[2].trim().replace(/^['"]|['"]$/g,'')]]:[];}));
 const provider=new OpenAIAssistant(env.OPENAI_API_KEY,env.OPENAI_MODEL),db=database(':memory:'),config=configuration({WANDEL_AUTH_MODE:'legacy'},'rules-live-pepper-with-32-characters');
 const app=createPlatform({db,config,ai:new MockAIProvider(),mail:{reset:async()=>{}},assistant:{transcribe:b=>provider.transcribe(b),plan:i=>provider.plan(i)}});
 const call=async(path:string,method:string,body:unknown,cookie='')=>{const r=await app.handle(new Request(config.origin+path,{method,headers:{Origin:config.origin,...(cookie?{Cookie:cookie}:{}),'Content-Type':'application/json'},body:JSON.stringify(body)}));return {r,data:await r.json()};};
 const cookie=(await call('/api/auth/signup','POST',{email:'rules@example.test',password:'synthetic-test-password-123'})).r.headers.get('set-cookie')!.split(';')[0];
 const team=(await call('/api/teams','POST',{name:'Brand team'},cookie)).data,origin='https://app.test';
 await call(`/api/knowledge/${team.id}/enable`,'POST',{origin},cookie);
 await call(`/api/knowledge/${team.id}/rules`,'POST',{origin,rule:{text:'Brand purple is #7B29FF: every new button uses it as its background'}},cookie);
 const el=(ref:string,tag:string,name:string,parent:string|null,extra:object={})=>({ref,tag,role:tag==='button'?'button':'',name,text:name,attributes:{},classes:[],bounds:{x:0,y:0,width:200,height:40},visible:true,disabled:false,parent,children:[],style:{},interactive:tag==='button',owned:false,...extra});
 const context:PageContext={token:'token',workflowId:'w',stateId:'s',route:'/settings',selected:null,hover:null,styleReference:null,page:'e1',elements:[el('e1','main','Settings',null),el('e2','h1','Settings','e1'),el('e3','form','Profile','e1'),el('e4','input','Name','e3',{interactive:true})],recent:[],lastGroup:null,lastView:null,views:[{id:'s',title:'Settings'}],limitations:[]};
 const plan=(await call('/api/assistant/plan','POST',{instruction:'Add a Save button at the bottom of the profile form',context,requestId:crypto.randomUUID(),steps:true,capabilities:['every','compact','copy','library'],compact:true,knowledge:{team:team.id,origin,pattern:'/settings'}},cookie)).data.plan;
 const text=JSON.stringify(plan);console.info=console.log;console.log('PLAN',text.slice(0,1200));
 expect(text.toUpperCase()).toContain('7B29FF');
 db.close();
},600000);
