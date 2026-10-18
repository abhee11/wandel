import {z} from 'zod';
import {randomUUID,createHash} from 'node:crypto';
import type {DB} from './db';
import {APIError,tokenHash} from './security';
import {BatchSchema} from '../../extension/ai/planSchema';
import type {AIProvider} from './providers';
const Input=z.object({guestId:z.string().uuid(),requestId:z.string().uuid(),prompt:z.string().trim().min(3).max(600),selection:z.object({tag:z.string().max(40),label:z.string().max(160)}).strict()}).strict();
export async function guestPlan(db:DB,ai:AIProvider,pepper:string,ip:string,input:unknown,date:Date){
 const data=Input.parse(input);
 // Cheap relevance gate before any provider call. Output validation and budgets are the enforcement boundary.
 if(!/\b(add|remove|rename|change|make|resize|move|reimagine|redesign|style|edit|replace|set)\b/i.test(data.prompt)||! /\b(this|section|button|text|field|panel|card|layout|color|colour|heading|label|font|size|width|height|element|form)\b/i.test(data.prompt)||/\b(ignore|system prompt|instructions|essay|poem|recipe|translate|javascript|python|execute|fetch|https?:|base64)\b/i.test(data.prompt))throw new APIError(400,'GUEST_SCOPE','Free previews support small UI edits or a section redesign. Describe what to change in the selected element.');
 if(/\b(flow|workflow|journey|screens|multi.step)\b/i.test(data.prompt))throw new APIError(403,'GUEST_SCOPE','Sign in to generate a connected workflow. Your free previews support one section at a time.');
 const guest=tokenHash(data.guestId,pepper),ipHash=tokenHash(ip,pepper),day=date.toISOString().slice(0,10),id=randomUUID();
 const fingerprint=createHash('sha256').update(JSON.stringify({prompt:data.prompt,selection:data.selection})).digest('hex');
 let cached:any;
 db.transaction(()=>{
  const existing=db.prepare('SELECT * FROM guest_ai_actions WHERE guest_hash=? AND request_key=?').get(guest,data.requestId) as any;
  if(existing){if(existing.fingerprint!==fingerprint)throw new APIError(409,'IDEMPOTENCY_CONFLICT','Use a new request ID for a different prompt.');if(existing.status==='succeeded'){cached=JSON.parse(existing.result);return;}throw new APIError(409,'REQUEST_ALREADY_EXISTS','This preview is pending or failed.');}
  const count=(sql:string,...args:string[])=>(db.prepare(sql).get(...args) as {n:number}).n;
  if(count('SELECT count(*) n FROM guest_ai_actions WHERE guest_hash=?',guest)>=2)throw new APIError(403,'GUEST_LIMIT','Your two free AI previews are used. Sign in to continue. Manual editing and temporary saves remain free.',{remaining:0});
  if(count('SELECT count(*) n FROM guest_ai_actions WHERE ip_hash=? AND day=?',ipHash,day)>=10||count('SELECT count(*) n FROM guest_ai_actions WHERE day=?',day)>=50)throw new APIError(429,'GUEST_BUSY','Free AI previews are temporarily at capacity. Sign in or keep editing manually.');
  db.prepare('INSERT INTO guest_ai_actions VALUES (?,?,?,?,?,?,?,NULL)').run(id,guest,ipHash,data.requestId,fingerprint,day,'pending');
 }).immediate();
 const remaining=()=>Math.max(0,2-(db.prepare('SELECT count(*) n FROM guest_ai_actions WHERE guest_hash=?').get(guest) as {n:number}).n);
 if(cached)return {plan:cached,remaining:remaining(),guest:true};
 try{
  const plan=BatchSchema.parse(await ai.plan({prompt:data.prompt,selection:data.selection,guest:true}));
  if(plan.flow||plan.steps.length>5||plan.steps.some(s=>s.target!=='selected')||(plan.section&&(plan.section.cards.length>3||plan.section.fields.length>3)))throw new Error('Preview exceeds guest scope.');
  db.prepare("UPDATE guest_ai_actions SET status='succeeded',result=? WHERE id=?").run(JSON.stringify(plan),id);
  return {plan,remaining:remaining(),guest:true};
 }catch{db.prepare("UPDATE guest_ai_actions SET status='failed' WHERE id=?").run(id);throw new APIError(502,'GUEST_AI_FAILED','The preview could not complete within its limits. This attempt counts toward the two-preview allowance; you can still edit manually.',{remaining:remaining()});}
}
