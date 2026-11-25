// @vitest-environment jsdom
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import {database,type DB} from '../platform/server/db';
import {createPlatform} from '../platform/server/app';
import {configuration} from '../platform/server/config';
import {MockAIProvider} from '../platform/server/providers';
import {Session} from '../extension/content/session';
import {Repository,BrowserStorage} from '../extension/storage/store';
import {captureCopy} from '../extension/content/duplicate';
import {blankCopy,screenSummary,screenPattern,summaryHash} from '../extension/knowledge/blank';
import {ScreenSummarySchema,ComponentCopySchema} from '../extension/knowledge/schema';
// A page shaped like M2 with the kind of content that must never leave the browser: a teacher's name, an email, counts, a transcript.
const page=`<main><nav><a href="/home">Home</a><a href="/library">Library</a></nav>
<h1>Activity 4</h1><h2>Grade 5 Science, Period 3 with Mr. Anderson</h2>
<section class="grid"><article class="card"><h3>My Record</h3><p>20m 12s · 2,039 words · priya.sharma@school.edu</p><p>00:24 So today we are going to talk about photosynthesis and why leaves are green</p><button>Open</button></article>
<article class="card"><h3>Plan and Setup</h3><p>Customize your Activity and make your next class great.</p><button>Open</button></article>
<article class="card"><h3>Takeaways</h3><p>Ms. Priya Sharma asked 14 open questions</p><button>Open</button></article></section></main>`;
const secrets=['Anderson','priya','Sharma','2,039','photosynthesis','school.edu','14 open'];
it('a screen summary and a saved component keep UI labels only',async()=>{
 document.body.innerHTML=page;localStorage.clear();
 const root=document.querySelector('main')!,s=new Session(root,new Repository(new BrowserStorage()),new URL('https://app.test/groups/102949?activityContainerId=259597'),{assistantEnabled:true});await s.init();await s.dispatch({type:'edit'});
 const c=(await s.dispatch({type:'assistantContext',instruction:'look at this page'})).assistant!.context!;
 const summary=screenSummary(c,'M2');
 expect(ScreenSummarySchema.safeParse(summary).success).toBe(true);
 const text=JSON.stringify(summary);for(const secret of secrets)expect(text).not.toContain(secret);
 expect(summary.headings).toContain('My Record');expect(summary.headings).toContain('Activity 4');
 expect(screenPattern('https://app.test/groups/102949?activityContainerId=259597')).toBe('/groups/:id?activityContainerId');
 expect(await summaryHash(summary)).toMatch(/^[0-9a-f]{32}$/);
 const card=blankCopy(captureCopy(root.querySelector<HTMLElement>('article')!));
 expect(ComponentCopySchema.safeParse(card).success).toBe(true);
 const copied=JSON.stringify(card);for(const secret of secrets)expect(copied).not.toContain(secret);
 expect(card.some(n=>n.text==='My Record')).toBe(true);expect(card.some(n=>n.text==='Open')).toBe(true);
 s.destroy();
});
let db:DB,app:ReturnType<typeof createPlatform>;
const config=configuration({WANDEL_AUTH_MODE:'legacy'},'knowledge-test-pepper-32-characters-xx');
const call=async(path:string,method='GET',body?:unknown,cookie='')=>{const r=await app.handle(new Request(config.origin+path,{method,headers:{Origin:config.origin,...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}));return {status:r.status,data:await r.json()};};
const person=async(email:string)=>(await app.handle(new Request(config.origin+'/api/auth/signup',{method:'POST',headers:{Origin:config.origin,'Content-Type':'application/json'},body:JSON.stringify({email,password:'a-strong-test-password'})}))).headers.get('set-cookie')!.split(';')[0];
beforeEach(()=>{vi.spyOn(console,'info').mockImplementation(()=>{});db=database(':memory:');app=createPlatform({db,config,ai:new MockAIProvider(),mail:{reset:async()=>{}},shareMail:{send:async()=>{},sendInvite:async()=>{}}});});
afterEach(()=>{db.close();vi.restoreAllMocks();});
const summary={title:'Activity',regions:['main'],headings:['My Record','Plan and Setup'],navigation:['Home'],actions:['Open'],components:[{kind:'cards',count:3}]};
it('knowledge is off until an owner switches it on, refuses content, stays inside the team, and forgetting wipes it',async()=>{
 const ana=await person('ana@studio.test'),raj=await person('raj@studio.test'),eve=await person('eve@other.test');
 const team=(await call('/api/teams','POST',{name:'Studio'},ana)).data,origin='https://app.test';
 const token=new URL((await call(`/api/teams/${team.id}/invites`,'POST',{emails:['raj@studio.test']},ana)).data.invited[0].url).searchParams.get('token')!;await call('/api/invites/accept','POST',{token},raj);
 const screen={pattern:'/groups/:id?activityContainerId',summary,hash:'0123456789abcdef0123456789abcdef'};
 // Off: nothing can be stored, and only an owner can switch it on.
 expect((await call(`/api/knowledge/${team.id}/screen`,'PUT',{origin,screen},ana)).data.error.code).toBe('KNOWLEDGE_OFF');
 expect((await call(`/api/knowledge/${team.id}/enable`,'POST',{origin},raj)).status).toBe(403);
 expect((await call(`/api/knowledge/${team.id}/enable`,'POST',{origin},ana)).data.enabled).toBe(true);
 // A member adds to it; an unchanged screen isn't written again.
 expect((await call(`/api/knowledge/${team.id}/screen`,'PUT',{origin,screen},raj)).data.saved).toBe(true);
 expect((await call(`/api/knowledge/${team.id}/screen`,'PUT',{origin,screen},raj)).data.unchanged).toBe(true);
 // Content is refused even if an extension sends it: an email, a long sentence, an unblanked component, a phone in a rule.
 for(const bad of [{...summary,headings:['priya@school.edu']},{...summary,headings:['So today we are going to talk about leaves']}])
  expect((await call(`/api/knowledge/${team.id}/screen`,'PUT',{origin,screen:{...screen,summary:bad}},raj)).status).toBe(400);
 expect((await call(`/api/knowledge/${team.id}/components`,'POST',{origin,component:{name:'My Record',pattern:null,copy:[{id:'a',parent:-1,tag:'div',text:'',style:{}},{id:'b',parent:0,tag:'p',text:'Ms. Priya Sharma asked 14 open questions today',style:{}}]}},raj)).status).toBe(400);
 expect((await call(`/api/knowledge/${team.id}/rules`,'POST',{origin,rule:{text:'Call Priya on +1 415 555 0100'}},raj)).status).toBe(400);
 expect((await call(`/api/knowledge/${team.id}/rules`,'POST',{origin,rule:{text:'Brand purple is #7B29FF'}},raj)).data.text).toBe('Brand purple is #7B29FF');
 // Someone outside the team sees none of it.
 expect((await call(`/api/knowledge/${team.id}?origin=${encodeURIComponent(origin)}`,'GET',undefined,eve)).status).toBe(404);
 expect((await call(`/api/knowledge/${team.id}/screen`,'PUT',{origin,screen},eve)).status).toBe(404);
 expect((await call('/api/knowledge?origin='+encodeURIComponent(origin),'GET',undefined,eve)).data.teams).toEqual([]);
 const read=(await call(`/api/knowledge/${team.id}?origin=${encodeURIComponent(origin)}`,'GET',undefined,raj)).data;
 expect(read.screens).toHaveLength(1);expect(read.rules).toHaveLength(1);
 // Forgetting the app wipes everything learned for it.
 expect((await call(`/api/knowledge/${team.id}?origin=${encodeURIComponent(origin)}`,'DELETE',undefined,ana)).data.forgotten).toBe(true);
 expect((await call(`/api/knowledge/${team.id}?origin=${encodeURIComponent(origin)}`,'GET',undefined,ana)).data.error.code).toBe('KNOWLEDGE_OFF');
 expect(db.prepare('SELECT (SELECT count(*) FROM knowledge_screens)+(SELECT count(*) FROM knowledge_rules) n').get()).toEqual({n:0});
});
