/** Logs the tokens and estimated cost of every AI call, so spending can be measured per route and model. */
// Dollars per million tokens: [input, output, cached read as a fraction of input].
// Cached rates for OpenAI and Grok are estimates; Claude's come from Anthropic's caching price list.
const prices:Record<string,[number,number,number]>={
 'gpt-6.1-sol':[2,10,.1],'gpt-6-astra':[10,50,.1],'gpt-6-luna':[.1,.5,.1],
 'claude-opus-5-5':[4,20,.05],'claude-sonnet-5-5':[2,10,.05],'claude-haiku-5-5':[.1,.5,.1],
 'grok-4.7':[2,6,.1],'grok-4.6':[2,6,.1],
};
export type Usage={input:number;cached:number;written?:number;output:number};
/** Reads the usage block of an OpenAI or Grok Responses API reply. */
export function responsesUsage(data:any):Usage|null{
 const u=data?.usage;if(!u)return null;
 const input=Number(u.input_tokens)||0,cached=Number(u.input_tokens_details?.cached_tokens)||0;
 return {input:input-cached,cached,output:Number(u.output_tokens)||0};
}
/** Reads the usage block of a Claude reply. Cache writes cost 1.25× input. */
export function claudeUsage(message:any):Usage|null{
 const u=message?.usage;if(!u)return null;
 return {input:Number(u.input_tokens)||0,cached:Number(u.cache_read_input_tokens)||0,written:Number(u.cache_creation_input_tokens)||0,output:Number(u.output_tokens)||0};
}
export function usageCost(model:string,u:Usage){
 const price=prices[model];if(!price)return null;
 const [input,output,cachedRate]=price;
 return Math.round((u.input*input+u.cached*input*cachedRate+(u.written||0)*input*1.25+u.output*output)/1e6*1e6)/1e6;
}
export function logUsage(route:string,model:string,u:Usage|null){
 if(!u)return;
 console.info(JSON.stringify({event:'ai_usage',route,model,input:u.input,cached:u.cached,...(u.written?{written:u.written}:{}),output:u.output,cost:usageCost(model,u)}));
}
