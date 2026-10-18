import {groundPlan} from '../../extension/assistant/grounding';
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {AssistantPlanSchema,PageContextSchema,type AssistantPlan,type PageContext} from '../../extension/assistant/schema';
import {assistantOutputSchema,assistantInstructions} from '../../extension/assistant/providerSchema';
import {cleanText} from '../../extension/assistant/privacy';
import {APIError,rateLimit} from './security';
import {one,type DB} from './db';
import type {Entitlements} from './entitlements';
export type AssistantInput={instruction:string;context:PageContext};
export interface AssistantProvider{plan(input:AssistantInput):Promise<AssistantPlan>;transcribe(wav:Uint8Array):Promise<string>;}
export class OpenAIAssistant implements AssistantProvider{
 constructor(private key:string,private model:string,private transcriptionModel='gpt-4o-mini-transcribe'){}
 private async request(path:string,body:BodyInit,headers:Record<string,string>={}){
  if(!this.key)throw new APIError(503,'ASSISTANT_UNAVAILABLE','Configure the assistant API on the server. Text editing still works locally.');
  let result:Response;try{result=await fetch('https://api.openai.com/v1/'+path,{method:'POST',headers:{Authorization:'Bearer '+this.key,...headers},body,signal:AbortSignal.timeout(45000)});}catch{throw new APIError(503,'ASSISTANT_UNAVAILABLE','The assistant could not reach its provider. No page edit was applied.');}
  if(!result.ok)throw new APIError(result.status===429?429:503,'ASSISTANT_PROVIDER_FAILED','The assistant provider is unavailable. Check its credits, model access, or retry later.');return result.json();
 }
 async plan(input:AssistantInput){
  if(!this.model)throw new APIError(503,'ASSISTANT_UNAVAILABLE','Configure OPENAI_MODEL before using cloud interpretation.');
  const data=await this.request('responses',JSON.stringify({model:this.model,store:false,max_output_tokens:2400,instructions:assistantInstructions,input:JSON.stringify(input),text:{format:{type:'json_schema',name:'wandel_assistant',strict:true,schema:assistantOutputSchema}}}),{'Content-Type':'application/json'});
  if(data.status!=='completed')throw new APIError(502,'INCOMPLETE_PLAN','The assistant did not finish its plan. Try a smaller change.');
  let plan:unknown;try{plan=JSON.parse(data.output?.flatMap((o:any)=>o.content||[]).filter((c:any)=>c.type==='output_text').map((c:any)=>c.text).join('')||'{}');}catch{throw new APIError(502,'INVALID_PLAN','The assistant returned an unreadable plan. Nothing was applied.');}
  if(plan&&typeof plan==='object'&&'actions' in plan&&Array.isArray(plan.actions))for(const a of plan.actions)if(a.style)a.style=Object.fromEntries(Object.entries(a.style).filter(([,value])=>value!==null));
  return AssistantPlanSchema.parse(plan);
 }
 async transcribe(wav:Uint8Array){const form=new FormData();form.set('file',new Blob([wav as BlobPart],{type:'audio/wav'}),'instruction.wav');form.set('model',this.transcriptionModel);form.set('response_format','json');const data=await this.request('audio/transcriptions',form);return z.string().trim().min(1).max(1600).parse(data.text);}
}
export function validateWav(bytes:Uint8Array){
 if(bytes.byteLength<44||bytes.byteLength>640044)throw new APIError(413,'AUDIO_LIMIT','Voice instructions are limited to 20 seconds.');
 const b=Buffer.from(bytes),v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WAVE'||b.toString('ascii',12,16)!=='fmt '||v.getUint32(16,true)!==16||v.getUint16(20,true)!==1||v.getUint16(22,true)!==1||v.getUint32(24,true)!==16000||v.getUint32(28,true)!==32000||v.getUint16(32,true)!==2||v.getUint16(34,true)!==16||b.toString('ascii',36,40)!=='data'||v.getUint32(40,true)!==bytes.length-44||v.getUint32(4,true)!==bytes.length-8||(bytes.length-44)%2)throw new APIError(400,'INVALID_AUDIO','Use a mono 16 kHz PCM instruction recorded by Wandel.');
 if(bytes.length===44)throw new APIError(400,'EMPTY_AUDIO','No audio was recorded.');
}
export function assistantService(db:DB,entitlements:Entitlements,provider:AssistantProvider|undefined,clock:()=>Date){
 async function metered(userId:string,requestId:string,fingerprint:string,work:()=>Promise<unknown>){
  const id=randomUUID(),now=clock().toISOString(),key='assistant:'+requestId;let cached:unknown;
  db.transaction(()=>{const previous=one<{status:string;result:string;fingerprint:string}>(db,'SELECT status,result,fingerprint FROM ai_actions WHERE user_id=? AND request_key=?',userId,key);if(previous){if(previous.fingerprint!==fingerprint)throw new APIError(409,'IDEMPOTENCY_CONFLICT','Use a new request ID for another instruction.');if(previous.status!=='succeeded')throw new APIError(409,'ASSISTANT_PENDING','This request is pending or failed. Retry with a new request.');cached=JSON.parse(previous.result);return;}entitlements.requireAI(userId);const usage=entitlements.get(userId).usage;db.prepare("INSERT INTO ai_actions VALUES (?,?,?,?,?,?,'pending',NULL,?,?)").run(id,userId,key,fingerprint,usage.periodStart,usage.resetsAt,now,now);}).immediate();
  if(cached)return cached;
  try{const result=await work();db.prepare("UPDATE ai_actions SET status='succeeded',result=?,updated_at=? WHERE id=?").run(JSON.stringify(result),clock().toISOString(),id);return result;}catch(error){db.prepare("UPDATE ai_actions SET status='failed',updated_at=? WHERE id=?").run(clock().toISOString(),id);throw error;}
 }
 return {async handle(userId:string,req:Request){
  if(!provider)throw new APIError(503,'ASSISTANT_DISABLED','Enable the separate assistant beta service to use cloud interpretation or voice.');
  rateLimit(db,'assistant:'+userId,10,clock().getTime(),60000);
  const path=new URL(req.url).pathname;
  if(path.endsWith('/transcribe')){
   if(req.headers.get('content-type')!=='audio/wav')throw new APIError(415,'INVALID_AUDIO','Use WAV audio from Wandel.');
   const requestId=z.string().uuid().parse(new URL(req.url).searchParams.get('requestId'));const bytes=new Uint8Array(await req.arrayBuffer());validateWav(bytes);
   return metered(userId,requestId,createHash('sha256').update(bytes).digest('hex'),async()=>({text:cleanText(await provider.transcribe(bytes),1600)}));
  }
  const raw=await req.text();if(Buffer.byteLength(raw)>40000)throw new APIError(413,'CONTEXT_LIMIT','Select a smaller section before asking for a change.');
  let decoded:unknown;try{decoded=JSON.parse(raw);}catch{throw new APIError(400,'INVALID_JSON','Invalid assistant request.');}
  const input=z.object({instruction:z.string().trim().min(1).max(1600),context:PageContextSchema,requestId:z.string().uuid()}).strict().parse(decoded);
  // Sanitize again at the trust boundary; no free-form transcript or page markup is retained.
  const context=PageContextSchema.parse(JSON.parse(JSON.stringify(input.context,(_key,value)=>typeof value==='string'?cleanText(value,2048):value)));
  return metered(userId,input.requestId,createHash('sha256').update(JSON.stringify({instruction:input.instruction,context})).digest('hex'),async()=>{
   const plan=AssistantPlanSchema.parse(await provider.plan({instruction:input.instruction,context}));const allowed=new Set(context.elements.map(e=>e.ref));
   const explicit=input.instruction.toLowerCase().replace(/\s+/g,' ');if(plan.actions.some(a=>[...a.labels,...a.kind==='create'&&a.text?[a.text]:[]].some(label=>!explicit.includes(label.toLowerCase().trim()))))throw new APIError(502,'MISSING_LABELS','Please specify the labels for the new controls. Nothing was applied.');
   if(plan.actions.some(a=>[...a.targets,...a.styleRef?[a.styleRef]:[]].some(ref=>!allowed.has(ref))))throw new APIError(502,'INVALID_REFERENCES','The plan referenced an unknown element. Nothing was applied.');
   return {plan:groundPlan(input.instruction,context,plan)};
  });
 }};
}
