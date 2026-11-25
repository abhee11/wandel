// @vitest-environment jsdom
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import {database,type DB} from '../platform/server/db';
import {createPlatform} from '../platform/server/app';
import {configuration} from '../platform/server/config';
import {MockAIProvider} from '../platform/server/providers';
import {action,response,type PageContext} from '../extension/assistant/schema';
import {Session} from '../extension/content/session';
import {Repository,BrowserStorage} from '../extension/storage/store';
import {setLibrary} from '../extension/knowledge/library';
import {AssistantPlanSchema as Schema048} from './fixtures/schema-0.4.7';
let db:DB,app:ReturnType<typeof createPlatform>,plan:ReturnType<typeof vi.fn>;
const config=configuration({WANDEL_AUTH_MODE:'legacy'},'knowledge-plan-pepper-32-characters-x');
const call=async(path:string,method='GET',body?:unknown,cookie='')=>{const r=await app.handle(new Request(config.origin+path,{method,headers:{Origin:config.origin,...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}));return {status:r.status,data:await r.json()};};
const person=async(email:string)=>(await app.handle(new Request(config.origin+'/api/auth/signup',{method:'POST',headers:{Origin:config.origin,'Content-Type':'application/json'},body:JSON.stringify({email,password:'a-strong-test-password'})}))).headers.get('set-cookie')!.split(';')[0];
const context:PageContext={token:'token',workflowId:'workflow',stateId:'base',route:'/',selected:null,hover:null,styleReference:null,elements:[{ref:'e1',tag:'section',role:'',name:'Cards',text:'Cards',attributes:{},classes:[],bounds:{x:0,y:0,width:50,height:20},visible:true,disabled:false,parent:null,children:[],style:{},interactive:false,owned:false}],recent:[],lastGroup:null,lastView:null,views:[{id:'base',title:'Existing application'}],limitations:[]};
beforeEach(()=>{vi.spyOn(console,'info').mockImplementation(()=>{});db=database(':memory:');plan=vi.fn().mockResolvedValue(response('answer','Ok.'));app=createPlatform({db,config,assistant:{plan,transcribe:vi.fn()},ai:new MockAIProvider(),mail:{reset:async()=>{}},shareMail:{send:async()=>{},sendInvite:async()=>{}}});});
afterEach(()=>{db.close();vi.restoreAllMocks();});
const origin='https://app.test';
async function learnedTeam(){
 const ana=await person('ana@studio.test'),eve=await person('eve@other.test');
 const team=(await call('/api/teams','POST',{name:'Studio'},ana)).data;
 await call(`/api/knowledge/${team.id}/enable`,'POST',{origin},ana);
 await call(`/api/knowledge/${team.id}/rules`,'POST',{origin,rule:{text:'Brand purple is #7B29FF'}},ana);
 for(const [pattern,title] of [['/groups/:id?activityContainerId','Activity'],['/library','Library']])await call(`/api/knowledge/${team.id}/screen`,'PUT',{origin,screen:{pattern,summary:{title,regions:['main'],headings:['My Record'],navigation:['Home'],actions:['Open'],components:[{kind:'cards',count:3}]},hash:(pattern==='/library'?'a':'b').repeat(32)}},ana);
 const card=(await call(`/api/knowledge/${team.id}/components`,'POST',{origin,component:{name:'My Record card',pattern:'/groups/:id?activityContainerId',copy:[{id:'a',parent:-1,tag:'article',text:'',style:{}},{id:'b',parent:0,tag:'h3',text:'',style:{}},{id:'c',parent:1,tag:'#text',text:'My Record',style:{}}]}},ana)).data;
 return {ana,eve,team,card};
}
const ask=(cookie:string,extra:object)=>call('/api/assistant/plan','POST',{instruction:'Add the My Record card here',context,requestId:crypto.randomUUID(),steps:true,...extra},cookie);
it('a teammate’s plan carries the team’s App knowledge; nobody else’s does',async()=>{
 const {ana,eve,team,card}=await learnedTeam();
 await ask(ana,{capabilities:['every','compact','copy','library'],knowledge:{team:team.id,origin,pattern:'/library'}});
 const brief=plan.mock.calls[0][0].appKnowledge as string;
 expect(brief).toContain('Brand purple is #7B29FF');expect(brief).toContain(`library:${card.id} “My Record card”`);
 // The current screen comes first.
 expect(brief.indexOf('/library (this screen)')).toBeLessThan(brief.indexOf('/groups/:id?activityContainerId'));
 // Someone not on the team who names it gets nothing from it.
 await ask(eve,{capabilities:['every','compact','copy','library'],knowledge:{team:team.id,origin,pattern:'/library'}});
 expect(plan.mock.calls[1][0].appKnowledge).toBeUndefined();
 // Another app of the same team has no knowledge until it's switched on.
 await ask(ana,{knowledge:{team:team.id,origin:'https://other.test',pattern:'/'}});
 expect(plan.mock.calls[2][0].appKnowledge).toBeUndefined();
});
it('a paste from the library reaches only panels that have the library',async()=>{
 const {ana,team,card}=await learnedTeam();
 plan.mockResolvedValue(response('edit','Pasted the My Record card.',[action('paste',['e1'],{position:'before',description:'library:'+card.id})]));
 const fresh=(await ask(ana,{capabilities:['every','compact','copy','library'],knowledge:{team:team.id,origin,pattern:'/'}})).data.plan;
 expect(fresh.actions[0].description).toBe('library:'+card.id);
 // A 0.4.8 panel (every, compact, copy) gets an answer it can show instead of a move it can't run.
 const older=(await ask(ana,{capabilities:['every','compact','copy'],knowledge:{team:team.id,origin,pattern:'/'}})).data.plan;
 expect(older.status).toBe('answer');expect(Schema048.safeParse(older).success).toBe(true);
});
it('the page places a library component like a copied element',async()=>{
 document.body.innerHTML='<main><section><h2>Plan and Setup</h2><button>Open</button></section></main>';localStorage.clear();
 setLibrary([{id:'11111111-1111-4111-8111-111111111111',name:'My Record card',pattern:null,copy:[{id:'a',parent:-1,tag:'article',text:'',style:{}},{id:'b',parent:0,tag:'h3',text:'',style:{}},{id:'c',parent:1,tag:'#text',text:'My Record',style:{}}]}]);
 const root=document.querySelector('main')!,s=new Session(root,new Repository(new BrowserStorage()),new URL('https://app.test/'),{assistantEnabled:true});await s.init();await s.dispatch({type:'edit'});
 const c=(await s.dispatch({type:'assistantContext',instruction:'add the my record card'})).assistant!.context!;
 const target=c.elements.find(e=>e.tag==='section')!.ref;
 await s.dispatch({type:'assistantApply',token:c.token,plan:response('edit','Pasted.',[action('paste',[target],{position:'before',description:'library:11111111-1111-4111-8111-111111111111'})])}).catch(e=>{if(!/^Preview kept/.test((e as Error).message))throw e;});
 expect(root.textContent).toContain('My Record');expect(root.querySelector('[data-dx-owned]')).toBeTruthy();
 s.destroy();
});
