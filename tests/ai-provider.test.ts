import {it,expect,vi,afterEach} from 'vitest';
import {OpenAIAIProvider} from '../platform/server/providers';
afterEach(()=>vi.unstubAllGlobals());
it.each(['credit_balance_exhausted','insufficient_quota'])('explains exhausted provider credits (%s) without exposing provider response text',async code=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{code,message:'private provider details'}}),{status:429})));
 await expect(new OpenAIAIProvider('test-key','test-model').plan({prompt:'Add onboarding',selection:{tag:'button',label:'Sign in'}})).rejects.toMatchObject({code:'AI_BILLING_UNAVAILABLE',message:expect.stringContaining('no credits remaining')});
});
it('distinguishes temporary rate limits from an empty credit balance',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{code:'rate_limit_exceeded'}}),{status:429})));
 await expect(new OpenAIAIProvider('test-key','test-model').plan({prompt:'Add onboarding',selection:{tag:'button',label:'Sign in'}})).rejects.toMatchObject({code:'AI_RATE_LIMITED'});
});
it.each([
 [{status:'incomplete',incomplete_details:{reason:'max_output_tokens'}},'AI_OUTPUT_LIMIT'],
 [{status:'incomplete',incomplete_details:{reason:'other'}},'AI_INCOMPLETE'],
 [{status:'completed',output:[{content:[{type:'refusal'}]}]},'AI_REFUSED'],
 [{status:'completed',output:[{content:[{type:'output_text',text:'not json'}]}]},'AI_INVALID_PLAN'],
 [{status:'completed',output:[{content:[{type:'output_text',text:'{"steps":[]}'}]}]},'AI_INVALID_PLAN'],
])('classifies incomplete or invalid plans without applying them',async(body,code)=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify(body),{status:200})));
 await expect(new OpenAIAIProvider('test-key','test-model').plan({prompt:'Add choices',selection:{tag:'div',label:'Advanced'}})).rejects.toMatchObject({code});
});
it('distinguishes a provider timeout from invalid output',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new DOMException('secret details','TimeoutError')));
 await expect(new OpenAIAIProvider('test-key','test-model').plan({prompt:'Add choices',selection:{tag:'div',label:'Advanced'}})).rejects.toMatchObject({code:'AI_TIMEOUT'});
});
it('accepts a valid bounded component plan',async()=>{
 const plan={steps:[{kind:'insert',target:'selected',position:'inside',element:'panel',text:'Summary',style:null,control:{kind:'menu',options:['Brief','Detailed'],contents:[]},required:null,inputType:null}],flow:null,section:null};
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(plan)}]}]}),{status:200})));
 await expect(new OpenAIAIProvider('test-key','test-model').plan({prompt:'Add choices',selection:{tag:'div',label:'Advanced'}})).resolves.toEqual(plan);
});
