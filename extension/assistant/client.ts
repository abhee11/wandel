import {accountConfig} from '../shared/accountConfig';
import {accountToken} from '../sidepanel/accountClient';
import {AssistantPlanSchema,type PageContext} from './schema';
async function request(path:string,body:BodyInit,contentType:string,signal:AbortSignal){
 const token=await accountToken();const result=await fetch(accountConfig.apiOrigin+'/api/assistant/'+path,{method:'POST',credentials:'omit',headers:{'Content-Type':contentType,Authorization:'Bearer '+token},body,signal});
 const data=await result.json();if(!result.ok)throw new Error(data.error?.message||'The assistant is unavailable. Your draft is unchanged.');return data;
}
export async function planConversation(instruction:string,context:PageContext,signal:AbortSignal){const data=await request('plan',JSON.stringify({instruction,context,requestId:crypto.randomUUID()}),'application/json',signal);return AssistantPlanSchema.parse(data.plan);}
export async function transcribeInstruction(wav:Blob,signal:AbortSignal){const data=await request('transcribe?requestId='+crypto.randomUUID(),wav,'audio/wav',signal);if(typeof data.text!=='string'||!data.text.trim())throw new Error('No instruction was recognized. Try again or type instead.');return data.text as string;}
