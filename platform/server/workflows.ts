import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {WorkflowSchema,type SavedRecord} from '../../extension/shared/model';
import {validateWorkflow,lineage} from '../../extension/prototype/engine';
import {type DB,one,all} from './db';
import type {Entitlements} from './entitlements';
import {APIError} from './security';
const Save=z.object({workflow:WorkflowSchema,revision:z.number().int().positive().nullable(),requestId:z.string().uuid()}).strict();
interface Row{id:string;workflow_id:string;revision:number;current_version:number;definition:string;updated_at:string;name:string;target_domain:string}
export function workflowStore(db:DB,entitlements:Entitlements,clock:()=>Date){
 const get=(userId:string,id:string)=>one<Row>(db,'SELECT p.*,d.definition FROM prototypes p JOIN prototype_definitions d ON p.id=d.prototype_id WHERE p.user_id=? AND p.workflow_id=?',userId,id);
 function read(userId:string,id:string){const row=get(userId,id);if(!row)throw new APIError(404,'NOT_FOUND','Workflow not found.');const history=entitlements.canUseVersionHistory(userId);
  const versions=all<{version:number;definition:string;created_at:string}>(db,`SELECT * FROM prototype_versions WHERE prototype_id=? ${history?'':'AND version='+row.current_version} ORDER BY version`,row.id);
  const record:SavedRecord={draft:JSON.parse(row.definition),enabled:true,currentVersion:row.current_version,versions:versions.map(v=>({number:v.version,savedAt:v.created_at,workflow:JSON.parse(v.definition)}))};
  return {record,revision:row.revision};
 }
 function save(userId:string,input:unknown){const data=Save.parse(input);let w;try{w=validateWorkflow(data.workflow);}catch{throw new APIError(400,'INVALID_DEFINITION','Workflow structure is invalid.');}
  if(!['https:','http:'].includes(new URL(w.origin).protocol)||new URL(w.origin).origin!==w.origin)throw new APIError(400,'INVALID_TARGET','Use an http(s) application origin.');
  const fingerprint=createHash('sha256').update(JSON.stringify({workflow:w,revision:data.revision})).digest('hex');
  return db.transaction(()=>{
   const replay=one<{fingerprint:string;revision:number}>(db,'SELECT * FROM workflow_saves WHERE user_id=? AND request_key=?',userId,data.requestId);
   if(replay){if(replay.fingerprint!==fingerprint)throw new APIError(409,'IDEMPOTENCY_CONFLICT','This save key was used for another change.');return {...read(userId,w.id),savedRevision:replay.revision};}
   const existing=get(userId,w.id),e=entitlements.get(userId),depth=Math.max(...w.states.map(s=>lineage(w,s.id).length-1));
   if(e.limits.maxDepth!==null&&depth>e.limits.maxDepth)throw new APIError(403,'DEPTH_LIMIT_REACHED',`This flow has ${depth} steps. Free account saves allow ${e.limits.maxDepth}. Upgrade or save temporarily.`,{upgradeUrl:'/extension/upgrade'});
   if(!existing)entitlements.requireCreate(userId);
   if(existing?data.revision!==existing.revision:data.revision!==null)throw new APIError(409,'REVISION_CONFLICT','A different saved version exists. Open it from Account saves before replacing it; your current draft is still here.');
   const count=existing?one<{n:number}>(db,'SELECT count(*) n FROM prototype_versions WHERE prototype_id=?',existing.id)!.n:0;
   if(e.limits.savedVersions!==null&&count>=e.limits.savedVersions)throw new APIError(403,'VERSION_LIMIT_REACHED',`Free account saves allow ${e.limits.savedVersions} versions. Upgrade or save temporarily.`,{upgradeUrl:'/extension/upgrade'});
   const id=existing?.id||randomUUID(),now=clock().toISOString(),version=(existing?.current_version||0)+1,revision=(existing?.revision||0)+1;
   if(!existing){db.prepare('INSERT INTO prototypes (id,user_id,name,description,target_domain,current_version,revision,created_at,updated_at,workflow_id) VALUES (?,?,?,?,?,?,?,?,?,?)').run(id,userId,w.name,'',w.origin,version,revision,now,now,w.id);db.prepare('INSERT INTO prototype_definitions VALUES (?,?)').run(id,JSON.stringify(w));}
   else{db.prepare('UPDATE prototypes SET name=?,current_version=?,revision=?,updated_at=? WHERE id=?').run(w.name,version,revision,now,id);db.prepare('UPDATE prototype_definitions SET definition=? WHERE prototype_id=?').run(JSON.stringify(w),id);}
   db.prepare('INSERT INTO prototype_versions VALUES (?,?,?,?)').run(id,version,JSON.stringify(w),now);
   db.prepare('INSERT INTO workflow_saves VALUES (?,?,?,?,?)').run(userId,data.requestId,fingerprint,id,revision);
   return {...read(userId,w.id),savedRevision:revision};
  }).immediate();
 }
 function list(userId:string){return all<Row>(db,'SELECT p.*,d.definition FROM prototypes p JOIN prototype_definitions d ON p.id=d.prototype_id WHERE p.user_id=? AND p.workflow_id IS NOT NULL ORDER BY p.updated_at DESC',userId).map(p=>({id:p.workflow_id,name:p.name,origin:p.target_domain,route:JSON.parse(p.definition).route,revision:p.revision,version:p.current_version,updatedAt:p.updated_at}));}
 return {read,save,list};
}
