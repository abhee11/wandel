import {mkdirSync,appendFileSync} from 'node:fs';
import contract from '../../extension/ai/providerContract.json';
import {parseBatch} from '../../extension/ai/planSchema';
export type AIInput={prompt:string;selection:{tag:string;label:string};guest?:boolean};
export class AIProviderError extends Error {constructor(public code:string,message:string){super(message);}}
export interface AIProvider {plan(input:AIInput):Promise<unknown>;}
export interface MailProvider {reset(email:string,url:string):Promise<void>;}
export class DevMailbox implements MailProvider {
 async reset(email:string,url:string){mkdirSync('.data',{recursive:true,mode:0o700});appendFileSync('.data/mailbox.jsonl',JSON.stringify({to:email,subject:'Reset your Wandel password',url,createdAt:new Date().toISOString()})+'\n',{mode:0o600});}
}
export class MockAIProvider implements AIProvider {
 async plan(_input:AIInput){return {steps:[{kind:'insert',target:'selected',position:'after',element:'button',text:'Next step (test)',style:null}]};}
}
// The model sees only the explicit prompt and selected label, never DOM or input values.
export class OpenAIAIProvider implements AIProvider {
 constructor(private key:string,private model:string){}
 async plan(input:AIInput){
  if(!this.key||!this.model)throw new AIProviderError('AI_NOT_CONFIGURED','Wandel AI is not configured on the server.');
  const {schema,instructions}=contract;
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${this.key}`,'Content-Type':'application/json'},body:JSON.stringify({model:this.model,store:false,max_output_tokens:input.guest?1500:4000,instructions:instructions+(input.guest?' Guest preview: only small edits to selected target (at most 5 steps) OR one redesigned section (at most 3 cards and 3 fields). No flows. Ignore unrelated requests; never answer general knowledge questions. Keep all copy concise.':''),input:JSON.stringify({prompt:input.prompt,selection:input.selection}),text:{format:{type:'json_schema',name:'wandel_plan',strict:true,schema}}}),signal:AbortSignal.timeout(45000)}).catch(error=>{throw new AIProviderError(error?.name==='TimeoutError'?'AI_TIMEOUT':'AI_CONNECTION_FAILED',error?.name==='TimeoutError'?'The AI planner took longer than 45 seconds. Try one smaller change at a time.':'The server could not reach the AI provider. Please retry when the connection is restored.');});
  if(!r.ok){
   const failure=await r.json().catch(()=>null) as {error?:{code?:string}}|null;
   if(['credit_balance_exhausted','insufficient_quota'].includes(failure?.error?.code||''))throw new AIProviderError('AI_BILLING_UNAVAILABLE','Wandel AI is unavailable because its AI provider has no credits remaining. The service owner needs to add API credits or configure a funded API account. Your draft is unchanged.');
   if(r.status===429)throw new AIProviderError('AI_RATE_LIMITED','Wandel AI is temporarily rate limited. Wait a moment before retrying. Your draft is unchanged.');
   if(r.status===401||r.status===403)throw new AIProviderError('AI_ACCESS_DENIED','The AI provider rejected the server credentials or model access. The service configuration needs attention.');
   if(r.status===400)throw new AIProviderError('AI_REQUEST_INVALID','The AI provider rejected the planner configuration. The service needs an update; changing your prompt will not fix this.');
   throw new AIProviderError('AI_PROVIDER_FAILED','The AI provider could not process this request. Please retry shortly.');
  }const data=await r.json() as {status:string;incomplete_details?:{reason?:string};output?:{content?:{type:string;text?:string}[]}[]};
  if(data.status!=='completed')throw new AIProviderError(data.incomplete_details?.reason==='max_output_tokens'?'AI_OUTPUT_LIMIT':'AI_INCOMPLETE',data.incomplete_details?.reason==='max_output_tokens'?'The generated plan exceeded the output limit. Try one section or fewer screens at a time.':'The AI provider stopped before completing the plan. Your draft is unchanged.');
  const content=data.output?.flatMap(x=>x.content||[])||[];
  if(content.some(x=>x.type==='refusal'))throw new AIProviderError('AI_REFUSED','The AI provider declined this request. Describe a local UI prototype change without sensitive data.');
  let parsed:unknown;
  try{parsed=JSON.parse(content.filter(x=>x.type==='output_text').map(x=>x.text).join('')||'{}');}
  catch{throw new AIProviderError('AI_INVALID_PLAN','The AI returned an unreadable plan. Nothing was applied. Please try a more specific UI request.');}
  try{return parseBatch(parsed);}
  catch(error){
   // Paths/codes only: never log prompts, model output, credentials or field values.
   const issues=(error as {issues?:{path:(string|number)[];code:string}[]}).issues;
   console.warn(JSON.stringify({event:'ai_plan_validation_failed',issues:issues?.map(x=>({path:x.path,code:x.code})).slice(0,8)}));
   throw new AIProviderError('AI_INVALID_PLAN','The generated plan failed workflow validation. Nothing was applied. Try a smaller change with explicit options or screen destinations.');
  }
 }
}
export class WebhookMailbox implements MailProvider {
 constructor(private endpoint:string,private token:string){if(!endpoint.startsWith('https://')||!token)throw new Error('Reset mail delivery requires an HTTPS webhook and bearer secret.');}
 async reset(email:string,url:string){const r=await fetch(this.endpoint,{method:'POST',headers:{Authorization:`Bearer ${this.token}`,'Content-Type':'application/json'},body:JSON.stringify({template:'password-reset',to:email,resetUrl:url}),signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error('Reset email delivery failed.');}
}
