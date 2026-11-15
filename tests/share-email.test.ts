import {afterEach,expect,it} from 'vitest';
import {database} from '../platform/server/db';
import {createPlatform} from '../platform/server/app';
import {configuration} from '../platform/server/config';
import {MockAIProvider} from '../platform/server/providers';
import {shareEmail,recipients,type ShareMessage} from '../platform/server/shareMail';
const now=new Date().toISOString();
const workflow={schemaVersion:1,id:'w1',name:'Feedforward <b>card</b>',origin:'https://app.example.test',route:'/',createdAt:now,updatedAt:now,entry:'s1',maxStates:10,states:[{id:'s1',title:'Existing application',parent:null,view:'base',operations:[]}],edges:[]};
let close=()=>{};
afterEach(()=>close());
async function setup(mailer=true){
 const db=database(':memory:'),config=configuration({WANDEL_AUTH_MODE:'legacy'},'verification-only-test-pepper-32-characters'),sent:ShareMessage[]=[];
 close=()=>db.close();
 const app=createPlatform({db,config,ai:new MockAIProvider(),mail:{reset:async()=>{}},...(mailer?{shareMail:{send:async(message:ShareMessage)=>{sent.push(message);}}}:{})});
 const call=async(path:string,method='GET',body?:unknown,cookie='')=>{const r=await app.handle(new Request(config.origin+path,{method,headers:{Origin:config.origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})}));return {status:r.status,body:await r.json().catch(()=>null),headers:r.headers};};
 const signup=async(email:string)=>(await call('/api/auth/signup','POST',{email,password:'synthetic-test-password-123'})).headers.get('set-cookie')!.split(';')[0];
 const alice=await signup('alice@example.test');
 const view=(await call('/api/public-views','POST',{workflow,html:'<!doctype html><html><body><main>Copy</main></body></html>',masked:true},alice)).body.view;
 return {call,signup,alice,view,sent};
}
it('emails a published link to each person, on the sharer’s behalf',async()=>{
 const {call,alice,view,sent}=await setup();
 const result=await call(`/api/public-views/${view.id}/send`,'POST',{emails:['Bob@Example.test','bob@example.test','carol@example.test'],note:'Look at the chart'},alice);
 expect(result.status).toBe(200);expect(result.body).toEqual({sent:2});
 expect(sent.map(m=>m.to)).toEqual(['bob@example.test','carol@example.test']);
 expect(sent[0]).toMatchObject({url:view.url,title:'Feedforward <b>card</b>',note:'Look at the chart',sender:{email:'alice@example.test'}});
});
it('refuses bad addresses, too many people, and someone else’s link',async()=>{
 const {call,signup,alice,view,sent}=await setup();
 expect((await call(`/api/public-views/${view.id}/send`,'POST',{emails:['not-an-email']},alice)).body.error.code).toBe('INVALID_EMAIL');
 expect((await call(`/api/public-views/${view.id}/send`,'POST',{emails:Array.from({length:11},(_,i)=>`p${i}@example.test`)},alice)).body.error.code).toBe('TOO_MANY_RECIPIENTS');
 const mallory=await signup('mallory@example.test');
 expect((await call(`/api/public-views/${view.id}/send`,'POST',{emails:['bob@example.test']},mallory)).status).toBe(404);
 expect(sent).toEqual([]);
});
it('says so when email isn’t set up, and limits how much one person can send',async()=>{
 const off=await setup(false);
 const r=await off.call(`/api/public-views/${off.view.id}/send`,'POST',{emails:['bob@example.test']},off.alice);
 expect(r.status).toBe(503);expect(r.body.error.code).toBe('EMAIL_NOT_CONFIGURED');
 close();
 const on=await setup();
 for(let i=0;i<10;i++)expect((await on.call(`/api/public-views/${on.view.id}/send`,'POST',{emails:[`p${i}@example.test`]},on.alice)).status).toBe(200);
 expect((await on.call(`/api/public-views/${on.view.id}/send`,'POST',{emails:['late@example.test']},on.alice)).status).toBe(429);
});
it('escapes everything the sender typed and links only to the prototype',()=>{
 const {subject,html,text}=shareEmail({to:'bob@example.test',sender:{name:'Alice <script>',email:'alice@example.test'},title:'Plan "A" & <b>B</b>',url:'https://wandel.studio447.ai/view/abc',expiresAt:'2026-12-15T00:00:00Z',note:'<a href="https://evil.test">click</a>'});
 expect(html).not.toContain('<script>');expect(html).not.toContain('<b>B</b>');expect(html).not.toContain('href="https://evil.test"');
 expect(html.match(/href="/g)).toHaveLength(1);
 expect(html).toContain('href="https://wandel.studio447.ai/view/abc"');
 expect(subject).toBe('Alice <script> shared a prototype with you: Plan "A" & <b>B</b>');
 expect(text).toContain('Open it: https://wandel.studio447.ai/view/abc');
 expect(text).toContain('December 15, 2026');
});
it('reads addresses typed with commas, spaces or new lines',()=>{
 expect(recipients(['a@x.test','B@X.test ',' a@x.test'])).toEqual(['a@x.test','b@x.test']);
 expect(()=>recipients([])).toThrow(/at least one/);
});
