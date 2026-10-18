import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {database,type DB} from '../platform/server/db';
import {createAccessCode,grantOwner,redeemAccessCode} from '../platform/server/access';
import {Entitlements} from '../platform/server/entitlements';
import {configuration} from '../platform/server/config';
import {createPlatform} from '../platform/server/app';
import {MockAIProvider} from '../platform/server/providers';
let db:DB,now:Date;const config=()=>configuration({WANDEL_AUTH_MODE:'legacy',WANDEL_AI_MODE:'mock'},'test-pepper-with-at-least-32-characters');
function user(id:string){db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?,NULL)').run(id,id+'@example.com',id,'unused',now.toISOString(),now.toISOString());db.prepare("INSERT INTO subscriptions VALUES (?,'none',NULL,NULL,'FREE','free',NULL,NULL,0,?)").run(id,now.toISOString());}
beforeEach(()=>{db=database(':memory:');now=new Date('2026-10-18T12:00:00Z');user('alice');user('bob');vi.spyOn(console,'info').mockImplementation(()=>{});});afterEach(()=>{db.close();vi.restoreAllMocks();});
it('redeems a hashed bounded code once per account and rejects exhausted or invalid codes',()=>{
 const c=createAccessCode(db,'Beta',1,90,now);expect(JSON.stringify(db.prepare('SELECT * FROM access_codes').get())).not.toContain(c.code);const grant=redeemAccessCode(db,'alice',c.code.toLowerCase(),now);expect(grant.alreadyRedeemed).toBe(false);expect(redeemAccessCode(db,'alice',c.code,now)).toEqual({...grant,alreadyRedeemed:true});expect(()=>redeemAccessCode(db,'bob',c.code,now)).toThrow('fully redeemed');expect(()=>redeemAccessCode(db,'bob','bad',now)).toThrow('invalid');expect((db.prepare('SELECT count(*) n FROM access_grants').get() as any).n).toBe(1);
});
it('unlocks saves/depth/history while retaining finite AI quota and restoring Free on expiry',()=>{
 const e=new Entitlements(db,config(),()=>now);expect(e.get('alice').plan).toBe('FREE');const c=createAccessCode(db,'Beta',2,2,now);redeemAccessCode(db,'alice',c.code,now);const access=e.get('alice');expect(access.plan).toBe('PRO');expect(access.limits.savedWorkflows).toBeNull();expect(access.limits.maxDepth).toBeNull();expect(access.limits.savedVersions).toBeNull();expect(access.usage.allowance).toBe(500);expect(access.access?.source).toBe('beta_code');now=new Date('2026-10-21');expect(e.get('alice').plan).toBe('FREE');expect(()=>redeemAccessCode(db,'alice',c.code,now)).toThrow();
});
it('expires or revokes codes without altering a paid subscription',()=>{
 const c=createAccessCode(db,'Beta',2,90,now);redeemAccessCode(db,'alice',c.code,now);db.prepare('UPDATE access_codes SET revoked_at=?').run(now.toISOString());const e=new Entitlements(db,config(),()=>now);expect(e.get('alice').plan).toBe('FREE');expect(()=>redeemAccessCode(db,'bob',c.code,now)).toThrow();db.prepare("UPDATE subscriptions SET plan='PRO',provider='stripe',status='active',current_period_end='2027-01-01' WHERE user_id='alice'").run();expect(e.get('alice').access?.source).toBe('subscription');
 const expired=createAccessCode(db,'Old',1,90,new Date('2025-01-01'));expect(()=>redeemAccessCode(db,'bob',expired.code,now)).toThrow();
});
it('grants owner access idempotently without faking Stripe state',()=>{grantOwner(db,'ALICE@example.com',now);grantOwner(db,'alice@example.com',now);expect((db.prepare('SELECT count(*) n FROM access_grants').get() as any).n).toBe(1);const e=new Entitlements(db,config(),()=>now);expect(e.get('alice').access).toEqual({source:'admin',expiresAt:null});expect(e.subscription('alice').plan).toBe('FREE');expect(()=>grantOwner(db,'unknown@example.com')).toThrow('not found');});
it('requires authentication, ignores caller-provided entitlement fields and rate limits guesses',async()=>{
 const cfg=config(),app=createPlatform({db,config:cfg,clock:()=>now,ai:new MockAIProvider(),mail:{reset:async()=>{}}});const req=(body:unknown,cookie?:string)=>app.handle(new Request('http://localhost/api/account/redeem',{method:'POST',headers:{Origin:cfg.origin,...cookie?{Cookie:cookie}:{}},body:JSON.stringify(body)}));expect((await req({code:'x'})).status).toBe(401);
 const r=await app.handle(new Request('http://localhost/api/auth/signup',{method:'POST',headers:{Origin:cfg.origin},body:JSON.stringify({email:'tester@example.com',password:'correct horse battery'})}));const cookie=r.headers.get('set-cookie')!.split(';')[0],c=createAccessCode(db,'Test',1,90,now);expect((await req({code:c.code,plan:'PRO'},cookie)).status).toBe(400);const redeemed=await req({code:c.code},cookie);expect(redeemed.status).toBe(200);expect((await redeemed.json()).entitlements.plan).toBe('PRO');for(let i=0;i<3;i++)await req({code:'wrong'},cookie);expect((await req({code:'wrong'},cookie)).status).toBe(429);
});
