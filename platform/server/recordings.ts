import {randomBytes,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {one,all,type DB} from './db';
import {APIError} from './security';
import {MAX_RECORDING_BYTES,MAX_HOSTED_RECORDINGS,RECORDING_TTL_DAYS,type SharedRecording} from '../../extension/shared/recording';
type Row={id:string;user_id:string;token:string;name:string;bytes:number;created_at:string;expires_at:string};
const columns='id,user_id,token,name,bytes,created_at,expires_at';
const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Cross-Origin-Resource-Policy':'same-origin'};
/** Beta storage: bounded WebM blobs share the existing persistent SQLite volume. */
export function recordingStore(db:DB,origin:string,clock:()=>Date){
 const cleanup=()=>db.prepare('DELETE FROM recordings WHERE expires_at<=?').run(clock().toISOString());
 const view=(row:Row):SharedRecording=>({id:row.id,name:row.name,bytes:row.bytes,createdAt:row.created_at,expiresAt:row.expires_at,url:origin+'/api/playback/'+row.token});
 function find(token:string){const row=one<Row>(db,`SELECT ${columns} FROM recordings WHERE token=? AND expires_at>?`,token,clock().toISOString());if(!row)throw new APIError(404,'VIDEO_UNAVAILABLE','This video link has expired, been revoked, or does not exist.');return row;}
 return {
  cleanup,
  list(userId:string){cleanup();return all<Row>(db,`SELECT ${columns} FROM recordings WHERE user_id=? ORDER BY created_at DESC`,userId).map(view);},
  async create(userId:string,req:Request){
   if(req.headers.get('content-type')?.split(';')[0].trim()!=='video/webm')throw new APIError(415,'VIDEO_TYPE','Upload a WebM video.');
   const name=z.string().trim().min(1).max(300).parse(new URL(req.url).searchParams.get('name'));
   const declared=Number(req.headers.get('content-length'));if(declared>MAX_RECORDING_BYTES)throw new APIError(413,'VIDEO_TOO_LARGE','Videos must be under 20 MB.');
   const reader=req.body?.getReader();if(!reader)throw new APIError(400,'EMPTY_VIDEO','The video is empty.');
   const chunks:Buffer[]=[];let bytes=0;
   try{while(true){const next=await reader.read();if(next.done)break;bytes+=next.value.byteLength;if(bytes>MAX_RECORDING_BYTES){await reader.cancel();throw new APIError(413,'VIDEO_TOO_LARGE','Videos must be under 20 MB.');}chunks.push(Buffer.from(next.value));}}finally{reader.releaseLock();}
   const data=Buffer.concat(chunks);
   if(bytes<16||!data.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]))||!data.subarray(0,128).includes(Buffer.from('webm')))throw new APIError(400,'INVALID_VIDEO','This file is not a WebM recording.');
   const row:Row={id:randomUUID(),user_id:userId,token:randomBytes(32).toString('hex'),name,bytes,created_at:clock().toISOString(),expires_at:new Date(clock().getTime()+RECORDING_TTL_DAYS*86400000).toISOString()};
   db.transaction(()=>{cleanup();const count=one<{n:number}>(db,'SELECT count(*) n FROM recordings WHERE user_id=?',userId)!.n;if(count>=MAX_HOSTED_RECORDINGS)throw new APIError(403,'VIDEO_LIMIT',`You can share up to ${MAX_HOSTED_RECORDINGS} videos. Revoke an existing link first.`);db.prepare('INSERT INTO recordings (id,user_id,token,name,data,bytes,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)').run(row.id,userId,row.token,name,data,bytes,row.created_at,row.expires_at);}).immediate();
   return view(row);
  },
  revoke(userId:string,id:string){const result=db.prepare('DELETE FROM recordings WHERE id=? AND user_id=?').run(id,userId);if(!result.changes)throw new APIError(404,'NOT_FOUND','Video not found.');},
  public(req:Request,token:string,video:boolean){
   let row:Row;try{row=find(token);}catch(error){if(video)throw error;return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Video unavailable · Wandel</title><body><h1>This video is no longer available.</h1><p>The link may have expired or been revoked. Ask its owner for a new walkthrough.</p></body></html>',{status:404,headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'"}});}
   if(!video){const name=escape(row.name);return new Response(req.method==='HEAD'?null:`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${name} · Wandel</title><style>body{margin:0;background:#14131e;color:#f4f1ff;font:16px/1.6 system-ui,sans-serif}main{max-width:1100px;margin:auto;padding:32px}h1{font-size:26px;overflow-wrap:anywhere}video{width:100%;max-height:75vh;background:#000;border-radius:12px}p{color:#bcb6d0}a{color:#c4baff}</style></head><body><main><p>Wandel · Workflow walkthrough</p><h1>${name}</h1><video controls playsinline preload="metadata" src="/api/playback/${row.token}/video"></video><p>A recorded walkthrough. This video does not change the original application.</p><a href="/api/playback/${row.token}/video" download="wandel-walkthrough.webm">Download WebM</a><p>Link expires ${escape(row.expires_at.slice(0,10))} (UTC).</p></main></body></html>`,{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; media-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}});}
   let start=0,end=row.bytes-1,status=200;const range=req.method==='HEAD'?null:req.headers.get('range');
   if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match||!match[1]&&!match[2])return new Response(null,{status:416,headers:{...headers,'Content-Range':`bytes */${row.bytes}`}});
    if(match[1]){start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}else{const suffix=Number(match[2]);start=Math.max(0,row.bytes-suffix);if(suffix<=0)start=row.bytes;}
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start> end||start>=row.bytes)return new Response(null,{status:416,headers:{...headers,'Content-Range':`bytes */${row.bytes}`}});status=206;
   }
   const content=req.method==='HEAD'?null:one<{data:Buffer}>(db,'SELECT substr(data,?,?) data FROM recordings WHERE id=?',start+1,end-start+1,row.id)!.data;
   return new Response(content as BodyInit|null,{status,headers:{...headers,'Content-Type':'video/webm','Accept-Ranges':'bytes','Content-Length':String(end-start+1),'Content-Disposition':'inline; filename="wandel-walkthrough.webm"',...(status===206?{'Content-Range':`bytes ${start}-${end}/${row.bytes}`}:{})}});
  }
 };
}
