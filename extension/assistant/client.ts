import {withDeadline} from './deadline';
import {accountConfig} from '../shared/accountConfig';
import {accountToken} from '../sidepanel/accountClient';
import {conversationHistory,type ChatTurn} from './conversation';
import {AssistantPlanSchema,VisualVerdictSchema,type AssistantPlan,type PageContext} from './schema';
async function request(path:string,body:BodyInit,contentType:string,signal:AbortSignal){
 return withDeadline(async bounded=>{
 const token=await accountToken();if(bounded.aborted)throw new Error('Request canceled.');const result=await fetch(accountConfig.apiOrigin+'/api/assistant/'+path,{method:'POST',credentials:'omit',headers:{'Content-Type':contentType,Authorization:'Bearer '+token},body,signal:bounded});
 const data=await result.json();
 // Limit codes travel with the message so the conversation can say which limit applies and when it clears.
 if(!result.ok){const e=data.error||{},tag=['AI_LIMIT_REACHED','RATE_LIMITED','AI_RATE_LIMITED','AI_NOT_CONFIGURED','ASSISTANT_DISABLED','ASSISTANT_TIMEOUT','INCOMPLETE_PLAN'].includes(e.code)?` [${e.code}${e.resetsAt?';resets='+e.resetsAt:''}${e.retryAfter?';wait='+e.retryAfter:''}]`:'';throw new Error((e.message||'The assistant is unavailable. Your draft is unchanged.')+tag);}
 return data;
 },signal);
}
// turnId groups every call for one chat message, which counts as one AI action.
export async function planConversation(instruction:string,context:PageContext,signal:AbortSignal,history:ChatTurn[]=[],referenceImage?:string,pageScreenshot?:string,turnId?:string){const data=await request('plan',JSON.stringify({instruction,context,history:conversationHistory(history),...(referenceImage?{referenceImage}:{}),...(pageScreenshot?{pageScreenshot}:{}),requestId:crypto.randomUUID(),...(turnId?{turnId}:{})}),'application/json',signal);return AssistantPlanSchema.parse(data.plan);}
export async function transcribeInstruction(wav:Blob,signal:AbortSignal,turnId?:string){const data=await request('transcribe?requestId='+crypto.randomUUID()+(turnId?'&turnId='+turnId:''),wav,'audio/wav',signal);if(typeof data.text!=='string'||!data.text.trim())throw new Error('No instruction was recognized. Try again or type instead.');return data.text as string;}

export async function verifyConversation(instruction:string,plan:AssistantPlan,before:string,after:string,signal:AbortSignal,turnId?:string){const data=await request('verify',JSON.stringify({instruction,plan,before,after,requestId:crypto.randomUUID(),...(turnId?{turnId}:{})}),'application/json',signal);return VisualVerdictSchema.parse(data.verdict);}
