import {withDeadline} from './deadline';
import {accountConfig} from '../shared/accountConfig';
import {accountToken} from '../sidepanel/accountClient';
import {conversationHistory,type ChatTurn} from './conversation';
import {AssistantPlanSchema,VisualVerdictSchema,type AssistantPlan,type PageContext} from './schema';
async function request(path:string,body:BodyInit,contentType:string,signal:AbortSignal){
 return withDeadline(async bounded=>{
 const token=await accountToken();if(bounded.aborted)throw new Error('Request canceled.');const result=await fetch(accountConfig.apiOrigin+'/api/assistant/'+path,{method:'POST',credentials:'omit',headers:{'Content-Type':contentType,Authorization:'Bearer '+token},body,signal:bounded});
 const data=await result.json();if(!result.ok)throw new Error(data.error?.message||'The assistant is unavailable. Your draft is unchanged.');return data;
 },signal);
}
export async function planConversation(instruction:string,context:PageContext,signal:AbortSignal,history:ChatTurn[]=[],referenceImage?:string,pageScreenshot?:string){const data=await request('plan',JSON.stringify({instruction,context,history:conversationHistory(history),...(referenceImage?{referenceImage}:{}),...(pageScreenshot?{pageScreenshot}:{}),requestId:crypto.randomUUID()}),'application/json',signal);return AssistantPlanSchema.parse(data.plan);}
export async function transcribeInstruction(wav:Blob,signal:AbortSignal){const data=await request('transcribe?requestId='+crypto.randomUUID(),wav,'audio/wav',signal);if(typeof data.text!=='string'||!data.text.trim())throw new Error('No instruction was recognized. Try again or type instead.');return data.text as string;}

export async function verifyConversation(instruction:string,plan:AssistantPlan,before:string,after:string,signal:AbortSignal){const data=await request('verify',JSON.stringify({instruction,plan,before,after,requestId:crypto.randomUUID()}),'application/json',signal);return VisualVerdictSchema.parse(data.verdict);}
