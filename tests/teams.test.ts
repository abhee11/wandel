import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import {database,type DB} from '../platform/server/db';
import {createPlatform} from '../platform/server/app';
import {configuration} from '../platform/server/config';
import {MockAIProvider} from '../platform/server/providers';
let db:DB,app:ReturnType<typeof createPlatform>,sent:any[];
const config=configuration({WANDEL_AUTH_MODE:'legacy'},'teams-test-pepper-with-32-characters-x');
const call=async(path:string,method='GET',body?:unknown,cookie='')=>{const r=await app.handle(new Request(config.origin+path,{method,headers:{Origin:config.origin,...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}));return {status:r.status,data:await r.json()};};
const person=async(email:string)=>(await app.handle(new Request(config.origin+'/api/auth/signup',{method:'POST',headers:{Origin:config.origin,'Content-Type':'application/json'},body:JSON.stringify({email,password:'a-strong-test-password'})}))).headers.get('set-cookie')!.split(';')[0];
beforeEach(()=>{vi.spyOn(console,'info').mockImplementation(()=>{});db=database(':memory:');sent=[];app=createPlatform({db,config,ai:new MockAIProvider(),mail:{reset:async()=>{}},shareMail:{send:async()=>{},sendInvite:async m=>{sent.push(m);}}});});
afterEach(()=>{db.close();vi.restoreAllMocks();});
it('an owner invites by email; only that email can join, and joining shows the team to the new member',async()=>{
 const ana=await person('ana@studio.test'),raj=await person('raj@studio.test'),eve=await person('eve@other.test');
 const team=(await call('/api/teams','POST',{name:'Studio'},ana)).data;expect(team.role).toBe('owner');
 const invite=await call(`/api/teams/${team.id}/invites`,'POST',{emails:['Raj@Studio.test']},ana);
 expect(invite.status).toBe(200);expect(sent).toHaveLength(1);expect(sent[0].to).toBe('raj@studio.test');expect(sent[0].team).toBe('Studio');
 const token=new URL(invite.data.invited[0].url).searchParams.get('token')!;
 // The invite page can show what it is for before anyone signs in; nothing else.
 expect((await call('/api/invites/'+token)).data).toEqual({team:'Studio',invitedBy:'A teammate'});
 // A forwarded link doesn't let someone else in.
 const wrong=await call('/api/invites/accept','POST',{token},eve);expect(wrong.status).toBe(403);expect(wrong.data.error.code).toBe('INVITE_OTHER_EMAIL');
 expect((await call('/api/invites/accept','POST',{token},raj)).data.team.name).toBe('Studio');
 expect((await call('/api/invites/accept','POST',{token},raj)).status).toBe(404);
 expect((await call('/api/teams','GET',undefined,raj)).data.teams).toEqual([{id:team.id,name:'Studio',role:'member',members:2}]);
 // Someone not on the team sees nothing of it.
 expect((await call(`/api/teams/${team.id}/members`,'GET',undefined,eve)).status).toBe(404);
 expect((await call('/api/teams','GET',undefined,eve)).data.teams).toEqual([]);
});
it('owner-only actions are refused to members, and a team always keeps an owner',async()=>{
 const ana=await person('ana@studio.test'),raj=await person('raj@studio.test');
 const team=(await call('/api/teams','POST',{name:'Studio'},ana)).data;
 const token=new URL((await call(`/api/teams/${team.id}/invites`,'POST',{emails:['raj@studio.test']},ana)).data.invited[0].url).searchParams.get('token')!;
 await call('/api/invites/accept','POST',{token},raj);
 const members=(await call(`/api/teams/${team.id}/members`,'GET',undefined,ana)).data.members;const rajId=members.find((m:any)=>m.email==='raj@studio.test').id,anaId=members.find((m:any)=>m.email==='ana@studio.test').id;
 for(const [path,method,body] of [[`/api/teams/${team.id}`,'PATCH',{name:'Mine'}],[`/api/teams/${team.id}`,'DELETE'],[`/api/teams/${team.id}/invites`,'POST',{emails:['x@studio.test']}],[`/api/teams/${team.id}/members/${anaId}`,'DELETE']] as const)
  expect((await call(path,method,body,raj)).status).toBe(403);
 // The only owner can't leave or step down; a member can leave.
 expect((await call(`/api/teams/${team.id}/members/${anaId}`,'DELETE',undefined,ana)).data.error.code).toBe('LAST_OWNER');
 expect((await call(`/api/teams/${team.id}/members/${anaId}`,'PATCH',{role:'member'},ana)).data.error.code).toBe('LAST_OWNER');
 expect((await call(`/api/teams/${team.id}/members/${rajId}`,'DELETE',undefined,raj)).data.removed).toBe(true);
 expect((await call('/api/teams','GET',undefined,raj)).data.teams).toEqual([]);
 // Deleting the team removes it for everyone.
 expect((await call(`/api/teams/${team.id}`,'DELETE',undefined,ana)).data.deleted).toBe(true);
 expect((await call('/api/teams','GET',undefined,ana)).data.teams).toEqual([]);
});
