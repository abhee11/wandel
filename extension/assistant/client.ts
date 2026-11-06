import {withDeadline} from './deadline';
import {accountConfig} from '../shared/accountConfig';
import {accountToken} from '../sidepanel/accountClient';
import {conversationHistory,type ChatTurn} from './conversation';
import {AssistantPlanSchema,VisualVerdictSchema,type AssistantPlan,type PageContext} from './schema';
import type {ModelChoice} from '../shared/models';
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
/** The models this server offers. An older server, or none signed in, simply shows no switcher. */
export async function availableModels(){const token=await accountToken();const result=await fetch(accountConfig.apiOrigin+'/api/assistant/models',{credentials:'omit',headers:{Authorization:'Bearer '+token}});if(!result.ok)return {models:[] as ModelChoice[],default:''};return await result.json() as {models:ModelChoice[];default:string};}
const modelKey='wandel:model';
export const chosenModel=()=>localStorage.getItem(modelKey)||undefined;
export const chooseModel=(id:string)=>localStorage.setItem(modelKey,id);
export async function planConversation(instruction:string,context:PageContext,signal:AbortSignal,history:ChatTurn[]=[],referenceImage?:string,pageScreenshot?:string,turnId?:string){const model=chosenModel();const data=await request('plan',JSON.stringify({...(model?{model}:{}),instruction,context,history:conversationHistory(history),...(referenceImage?{referenceImage}:{}),...(pageScreenshot?{pageScreenshot}:{}),requestId:crypto.randomUUID(),...(turnId?{turnId}:{})}),'application/json',signal);return AssistantPlanSchema.parse(data.plan);}
export async function transcribeInstruction(wav:Blob,signal:AbortSignal,turnId?:string){const data=await request('transcribe?requestId='+crypto.randomUUID()+(turnId?'&turnId='+turnId:''),wav,'audio/wav',signal);if(typeof data.text!=='string'||!data.text.trim())throw new Error('No instruction was recognized. Try again or type instead.');return data.text as string;}

/** A natural spoken version of a short reply, as playable audio. */
export async function speakReply(text:string,signal:AbortSignal){const data=await request('speak',JSON.stringify({text}),'application/json',signal);if(typeof data.audio!=='string'||!data.audio)throw new Error('No audio came back.');return 'data:audio/mpeg;base64,'+data.audio;}
/** Sends a failed edit's reason to the server log so it can be diagnosed without asking the user; failures to report are ignored. */
export function reportFailure(report:{detail:string;instruction?:string;plan?:string;page?:string;applied?:boolean}){void request('diagnostic',JSON.stringify(report),'application/json',new AbortController().signal).catch(()=>{});}
export async function verifyConversation(instruction:string,plan:AssistantPlan,before:string,after:string,signal:AbortSignal,turnId?:string,reference?:string){const data=await request('verify',JSON.stringify({instruction,plan,before,after,...(reference?{reference}:{}),requestId:crypto.randomUUID(),...(turnId?{turnId}:{})}),'application/json',signal);return VisualVerdictSchema.parse(data.verdict);}
