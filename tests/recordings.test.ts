import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {database,type DB} from '../platform/server/db';
import {createPlatform} from '../platform/server/app';
import {configuration} from '../platform/server/config';
import {MockAIProvider} from '../platform/server/providers';
import {MAX_RECORDING_BYTES} from '../extension/shared/recording';
let db:DB,app:ReturnType<typeof createPlatform>,now:Date,cookie:string,other:string;
const config=configuration({WANDEL_AUTH_MODE:'legacy',WANDEL_API_ORIGIN:'https://api.wandel.example'},'recording-test-pepper-at-least-32-characters');
// Container/header bytes are sufficient for API validation; browser recording is verified separately.
const video=Buffer.concat([Buffer.from([0x1a,0x45,0xdf,0xa3]),Buffer.from('webm'),Buffer.alloc(128,5)]);
async function call(path:string,method='GET',body?:BodyInit,auth=cookie,headers:Record<string,string>={}){return app.handle(new Request('https://api.wandel.example'+path,{method,headers:{Origin:config.origin,...(auth?{Cookie:auth}:{}),...headers},...(body?{body}:{})}));}
async function signup(email:string){const r=await call('/api/auth/signup','POST',JSON.stringify({email,password:'strong-password-for-tests'}),'',{'Content-Type':'application/json'});expect(r.status).toBe(201);return r.headers.get('set-cookie')!.split(';')[0];}
async function upload(name='My workflow'){return call('/api/recordings?name='+encodeURIComponent(name),'POST',video,cookie,{'Content-Type':'video/webm'});}
beforeEach(async()=>{vi.spyOn(console,'info').mockImplementation(()=>{});db=database(':memory:');now=new Date('2026-10-18T12:00:00Z');app=createPlatform({db,config,clock:()=>now,ai:new MockAIProvider(),mail:{reset:async()=>{}}});cookie=await signup('owner@example.com');other=await signup('other@example.com');});
afterEach(()=>{db.close();vi.restoreAllMocks();});
it('hosts an uploaded recording and serves a script-free anonymous video player and ranged media',async()=>{
 const response=await upload('<img src=x onerror=alert(1)>');expect(response.status).toBe(201);const {recording}=await response.json();expect(recording.url).toMatch(/^https:\/\/api.wandel.example\/api\/playback\/[a-f0-9]{64}$/);
 const path=new URL(recording.url).pathname;const viewer=await call(path,'GET',undefined,'');const html=await viewer.text();expect(viewer.status).toBe(200);expect(html).toContain('&lt;img');expect(html).not.toContain('<img src=x');expect(html).not.toContain('<script');expect(viewer.headers.get('content-security-policy')).toContain("default-src 'none'");expect(viewer.headers.get('referrer-policy')).toBe('no-referrer');
 const media=await call(path+'/video','GET',undefined,'',{Range:'bytes=4-7'});expect(media.status).toBe(206);expect(media.headers.get('content-range')).toBe(`bytes 4-7/${video.length}`);expect(Buffer.from(await media.arrayBuffer())).toEqual(video.subarray(4,8));
 const head=await call(path+'/video','HEAD',undefined,'');expect(head.status).toBe(200);expect(head.headers.get('content-length')).toBe(String(video.length));expect(await head.text()).toBe('');
 const full=await call(path+'/video','GET',undefined,'');expect(Buffer.from(await full.arrayBuffer())).toEqual(video);
});
it('isolates ownership and revokes links immediately',async()=>{
 const {recording}=await (await upload()).json();const path=new URL(recording.url).pathname;
 expect((await (await call('/api/recordings','GET',undefined,other)).json()).recordings).toEqual([]);
 expect((await call('/api/recordings/'+recording.id,'DELETE',undefined,other)).status).toBe(404);
 const list=await (await call('/api/recordings')).json();expect(list.recordings[0].url).toBe(recording.url);expect(JSON.stringify(list)).not.toContain('data');
 expect((await call('/api/recordings/'+recording.id,'DELETE')).status).toBe(200);
 expect((await call(path,'GET',undefined,'')).status).toBe(404);expect((await call(path+'/video','GET',undefined,'')).status).toBe(404);
});
it('expires links and removes stored blobs after seven days',async()=>{
 const {recording}=await (await upload()).json();now=new Date('2026-10-25T12:00:01Z');expect((await call(new URL(recording.url).pathname,'GET',undefined,'')).status).toBe(404);expect((await (await call('/api/recordings')).json()).recordings).toEqual([]);expect(db.prepare('SELECT count(*) n FROM recordings').get()).toEqual({n:0});
});
it('requires auth and rejects invalid types, fake videos and oversized data',async()=>{
 expect((await call('/api/recordings?name=Video','POST',video,'',{'Content-Type':'video/webm'})).status).toBe(401);
 expect((await call('/api/recordings?name=Video','POST','<script>bad</script>',cookie,{'Content-Type':'text/html'})).status).toBe(415);
 expect((await call('/api/recordings?name=Video','POST','<script>bad</script>',cookie,{'Content-Type':'video/webm'})).status).toBe(400);
 expect((await call('/api/recordings?name=Video','POST',Buffer.alloc(MAX_RECORDING_BYTES+1),cookie,{'Content-Type':'video/webm'})).status).toBe(413);
 expect(db.prepare('SELECT count(*) n FROM recordings').get()).toEqual({n:0});
});
it('limits each account to five active videos without losing earlier uploads',async()=>{
 for(let i=0;i<5;i++){expect((await upload('Video '+i)).status).toBe(201);now=new Date(now.getTime()+61000);}
 const rejected=await upload('Sixth');expect(rejected.status).toBe(403);expect((await rejected.json()).error.code).toBe('VIDEO_LIMIT');expect(db.prepare('SELECT count(*) n FROM recordings').get()).toEqual({n:5});
});
it('handles suffixes, open-ended ranges and unsatisfiable ranges',async()=>{
 const {recording}=await (await upload()).json();const path=new URL(recording.url).pathname+'/video';
 for(const range of ['bytes=0-','bytes=-4']){const response=await call(path,'GET',undefined,'',{Range:range});expect(response.status).toBe(206);expect((await response.arrayBuffer()).byteLength).toBe(range==='bytes=-4'?4:video.length);}
 for(const range of ['bytes=999999-','bytes=8-4','bytes=-0','bytes=-','bytes=0-1,3-4']){const response=await call(path,'GET',undefined,'',{Range:range});expect(response.status).toBe(416);expect(response.headers.get('content-range')).toBe(`bytes */${video.length}`);}
});
it('never logs public share tokens',async()=>{
 const {recording}=await (await upload()).json();vi.mocked(console.info).mockClear();await call(new URL(recording.url).pathname,'GET',undefined,'');const logs=JSON.stringify(vi.mocked(console.info).mock.calls);expect(logs).toContain('[redacted]');expect(logs).not.toContain(new URL(recording.url).pathname.split('/').at(-1));
});
