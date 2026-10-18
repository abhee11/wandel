import {createHash,createHmac,randomUUID} from 'node:crypto';
import {shareRecord,MAX_WORKFLOW_LINKS,SHARE_TTL_DAYS} from '../../extension/shared/workflowLink';
import {all,one,type DB} from './db';
import {APIError} from './security';
import {z} from 'zod';
type Row={id:string;user_id:string;token_hash:string;name:string;record:string;created_at:string;expires_at:string};
const hash=(token:string)=>createHash('sha256').update(token).digest('hex');
export function workflowLinks(db:DB,origin:string,pepper:string,clock:()=>Date){
 const token=(id:string)=>createHmac('sha256',pepper).update('wandel-workflow-link:'+id).digest('hex');
 const view=(r:Row)=>({id:r.id,name:r.name,url:origin+'/flow#token='+token(r.id),createdAt:r.created_at,expiresAt:r.expires_at});
 const cleanup=()=>db.prepare('DELETE FROM workflow_links WHERE expires_at<=?').run(clock().toISOString());
 return {cleanup,list(userId:string){cleanup();return all<Row>(db,'SELECT * FROM workflow_links WHERE user_id=? ORDER BY created_at DESC',userId).map(view);},
 create(userId:string,input:unknown){const {workflow}=z.object({workflow:z.unknown()}).strict().parse(input);let record;try{record=shareRecord(workflow);}catch(e){throw new APIError(400,'UNSHAREABLE_WORKFLOW',(e as Error).message);}return db.transaction(()=>{cleanup();if(one<{n:number}>(db,'SELECT count(*) n FROM workflow_links WHERE user_id=?',userId)!.n>=MAX_WORKFLOW_LINKS)throw new APIError(403,'SHARE_LIMIT',`You can keep ${MAX_WORKFLOW_LINKS} active workflow links. Revoke an older link first.`);const id=randomUUID(),created=clock(),row:Row={id,user_id:userId,token_hash:hash(token(id)),name:record.draft.name,record:JSON.stringify(record),created_at:created.toISOString(),expires_at:new Date(created.getTime()+SHARE_TTL_DAYS*86400000).toISOString()};db.prepare('INSERT INTO workflow_links VALUES (?,?,?,?,?,?,?)').run(row.id,row.user_id,row.token_hash,row.name,row.record,row.created_at,row.expires_at);return view(row);}).immediate();},
 revoke(userId:string,id:string){if(!db.prepare('DELETE FROM workflow_links WHERE id=? AND user_id=?').run(id,userId).changes)throw new APIError(404,'NOT_FOUND','Workflow link not found.');},
 read(value:string){if(!/^[a-f0-9]{64}$/.test(value))throw new APIError(404,'SHARE_UNAVAILABLE','This workflow link is unavailable.');const r=one<Row>(db,'SELECT * FROM workflow_links WHERE token_hash=? AND expires_at>?',hash(value),clock().toISOString());if(!r)throw new APIError(404,'SHARE_UNAVAILABLE','This workflow link has expired, been revoked, or does not exist.');const record=JSON.parse(r.record);return {record:shareRecord(record.draft),name:r.name,expiresAt:r.expires_at};}
 };
}
