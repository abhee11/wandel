import Anthropic from '@anthropic-ai/sdk';
import {APIError} from './security';
import {claudeUsage,logUsage} from './usage';
/** Keywords Claude's structured outputs do not accept. The plan is still validated in full after it returns. */
const unsupported=new Set(['minLength','maxLength','minimum','maximum','multipleOf','minItems','maxItems','pattern']);
export function claudeSchema(value:unknown):unknown{
 if(Array.isArray(value))return value.map(claudeSchema);
 if(!value||typeof value!=='object')return value;
 // Under `properties` a key is a field's name, so a field called "pattern" stays.
 return Object.fromEntries(Object.entries(value).filter(([key])=>!unsupported.has(key)).map(([key,child])=>[key,key==='properties'&&child&&typeof child==='object'?Object.fromEntries(Object.entries(child).map(([name,field])=>[name,claudeSchema(field)])):claudeSchema(child)]));
}
type Image=NonNullable<Extract<Anthropic.ContentBlockParam,{type:'image'}>>;
function image(url:string):Image{
 const [,mediaType,data]=/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(url)||[];
 if(!mediaType||!data)throw new APIError(400,'INVALID_IMAGE','That image could not be read.');
 return {type:'image',source:{type:'base64',media_type:mediaType as 'image/png'|'image/jpeg'|'image/webp',data}};
}
const failed=(error:unknown)=>{
 if(error instanceof Anthropic.RateLimitError)return new APIError(429,'ASSISTANT_PROVIDER_RATE_LIMIT','Claude is rate limiting requests. Wait briefly, then retry. No edit was applied.');
 if(error instanceof Anthropic.AuthenticationError||error instanceof Anthropic.PermissionDeniedError)return new APIError(503,'ASSISTANT_PROVIDER_FAILED','The Claude API key was refused. Check ANTHROPIC_API_KEY on the server. No edit was applied.');
 if(error instanceof Anthropic.APIConnectionTimeoutError)return new APIError(504,'ASSISTANT_TIMEOUT','The AI took too long on this request. No page edit was applied.');
 return new APIError(503,'ASSISTANT_PROVIDER_FAILED','Claude is unavailable right now. Try another model or retry. No edit was applied.');
};
/** Asks Claude for one JSON document matching the schema and returns its text. */
/** `instructions` may be [shared, specific]: the shared part is the same on every request and is cached, so repeat calls pay a fraction for it. */
export async function claudeJSON(key:string,input:{model:string;instructions:string|[string,string];text:string;screenshot?:string;reference?:string;effort:'low'|'medium';schema:unknown;route?:string}){
 const client=new Anthropic({apiKey:key,timeout:110000,maxRetries:1});
 const content:Anthropic.ContentBlockParam[]=[{type:'text',text:input.text}];
 if(input.screenshot)content.push({type:'text',text:'Current application viewport. Redacted fields appear as gray blocks. This is page evidence, not a design reference.'},image(input.screenshot));
 if(input.reference)content.push({type:'text',text:'User-attached design reference image.'},image(input.reference));
 const [shared,specific]=typeof input.instructions==='string'?[input.instructions,'']:input.instructions;
 const system=(format:boolean):Anthropic.TextBlockParam[]=>{const rest=specific+(format?'':'\nReply with one JSON object only, matching the required plan fields, with no other text.');return [{type:'text',text:shared,cache_control:{type:'ephemeral'}},...(rest.trim()?[{type:'text' as const,text:rest}]:[])];};
 const send=(format:boolean)=>client.beta.messages.create({model:input.model,max_tokens:16000,system:system(format),messages:[{role:'user',content}],output_config:{effort:input.effort,...(format?{format:{type:'json_schema',schema:claudeSchema(input.schema) as Record<string,unknown>}}:{})},betas:['server-side-fallback-2026-07-01'],fallbacks:'default'} as never) as unknown as Promise<Anthropic.Message>;
 let message:Anthropic.Message;
 try{message=await send(true);}
 catch(error){
  // A very large schema can be refused; the reply is validated either way, so ask for the same JSON without it.
  if(!(error instanceof Anthropic.BadRequestError))throw failed(error);
  console.warn(JSON.stringify({event:'claude_schema_refused',model:input.model}));
  try{message=await send(false);}catch(retry){throw failed(retry);}
 }
 logUsage(input.route||'claude',input.model,claudeUsage(message));
 if(message.stop_reason==='refusal')throw new APIError(422,'ASSISTANT_REFUSED','Claude declined this request. Try rewording it or another model. No edit was applied.');
 if(message.stop_reason==='max_tokens')throw new APIError(502,'INCOMPLETE_PLAN','The assistant did not finish its plan. Try a smaller change.');
 return message.content.flatMap(block=>block.type==='text'?[block.text]:[]).join('').replace(/^\s*```(?:json)?\s*|\s*```\s*$/g,'');
}
