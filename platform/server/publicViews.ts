import {createHash,createHmac,randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {z} from 'zod';
import {shareRecord,SHARE_TTL_DAYS} from '../../extension/shared/workflowLink';
import {all,one,type DB} from './db';
import {APIError} from './security';
/** Published prototypes anyone with the link can open, with nothing installed. The stored page is untrusted: it is only ever served inside a sandbox that allows Wandel's player and no network access. */
type Row={id:string;user_id:string;token_hash:string;name:string;workflow:string;html:string;masked:number;created_at:string;expires_at:string};
export const MAX_PUBLIC_VIEW_BYTES=6*1024*1024,MAX_PUBLIC_VIEWS=10;
const hash=(token:string)=>createHash('sha256').update(token).digest('hex');
const Input=z.object({workflow:z.unknown(),html:z.string().min(1),masked:z.boolean()}).strict();
export function publicViews(db:DB,origin:string,pepper:string,clock:()=>Date){
 const token=(id:string)=>createHmac('sha256',pepper).update('wandel-public-view:'+id).digest('hex');
 const view=(r:Pick<Row,'id'|'name'|'masked'|'created_at'|'expires_at'>)=>({id:r.id,name:r.name,masked:!!r.masked,url:origin+'/view/'+token(r.id),createdAt:r.created_at,expiresAt:r.expires_at});
 const cleanup=()=>db.prepare('DELETE FROM public_views WHERE expires_at<=?').run(clock().toISOString());
 return {cleanup,
  list(userId:string){cleanup();return all<Row>(db,'SELECT id,name,masked,created_at,expires_at FROM public_views WHERE user_id=? ORDER BY created_at DESC',userId).map(view);},
  create(userId:string,input:unknown){
   const {workflow,html,masked}=Input.parse(input);if(Buffer.byteLength(html)>MAX_PUBLIC_VIEW_BYTES)throw new APIError(413,'BODY_TOO_LARGE','This page is too large to publish.');
   let record;try{record=shareRecord(workflow);}catch(error){throw new APIError(400,'UNSHAREABLE_WORKFLOW',(error as Error).message);}
   return db.transaction(()=>{
    cleanup();if((one<{n:number}>(db,'SELECT COUNT(*) n FROM public_views WHERE user_id=?',userId)?.n||0)>=MAX_PUBLIC_VIEWS)throw new APIError(429,'PUBLIC_VIEW_LIMIT',`Remove one of your ${MAX_PUBLIC_VIEWS} published links first.`);
    const id=randomUUID(),now=clock(),expires=new Date(now.getTime()+SHARE_TTL_DAYS*86400000).toISOString(),row={id,name:record.draft.name,masked:masked?1:0,created_at:now.toISOString(),expires_at:expires};
    db.prepare('INSERT INTO public_views (id,user_id,token_hash,name,workflow,html,masked,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?)').run(id,userId,hash(token(id)),row.name,JSON.stringify(record.draft),html,row.masked,row.created_at,expires);
    return view(row);
   }).immediate();
  },
  revoke(userId:string,id:string){if(!db.prepare('DELETE FROM public_views WHERE id=? AND user_id=?').run(id,userId).changes)throw new APIError(404,'NOT_FOUND','Published link not found.');},
  page(value:string){
   const unavailable=new Response('<!doctype html><title>Wandel</title><p>This link has expired, been removed, or is unavailable.</p>',{status:404,headers:{'Content-Type':'text/html; charset=utf-8'}});
   if(!/^[a-f0-9]{64}$/.test(value))return unavailable;
   const row=one<Row>(db,'SELECT * FROM public_views WHERE token_hash=? AND expires_at>?',hash(value),clock().toISOString());if(!row)return unavailable;
   // Data in a script block is inert; `<` is escaped so the stored text cannot end the block.
   // The player is embedded: a sandboxed page has no origin, and browsers and blockers may refuse its requests.
   const nonce=randomBytes(16).toString('base64'),player=readFileSync('dist-platform/player/player.js','utf8').replace(/<\/script/gi,'<\\/script');
   const data=`<script type="application/json" id="wandel-public">${row.workflow.replace(/</g,'\\u003c')}</script><script nonce="${nonce}">${player}</script>`;
   const page=row.html.replace(/<meta\b[^>]*http-equiv[^>]*>/gi,''),end=page.toLowerCase().lastIndexOf('</body>'),html=end<0?page+data:page.slice(0,end)+data+page.slice(end);
   return new Response(html,{status:200,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':`sandbox allow-scripts; default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline' https:; img-src https: data:; font-src https: data:; base-uri 'none'; form-action 'none'`}});
  }
 };
}
