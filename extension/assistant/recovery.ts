/** Internal check output (validation JSON, engine wording) becomes a sentence a designer can act on. */
export function plainReason(reason:string){
 if(/^\s*[\[{]/.test(reason)||/"code"\s*:/.test(reason))return 'I lost track of one of the elements I needed, often one I had just added. Try describing it by its visible text';
 if(/several independent labels/i.test(reason))return 'that part has several pieces of text and I couldn’t tell which one to change. Name the exact text you want changed';
 if(/Choose a container as the destination/i.test(reason))return 'I tried to place it inside something that can’t hold other elements';
 return reason.length>220?reason.slice(0,200).replace(/\s+\S*$/,'')+'…':reason;
}
/** Keep implementation failures out of the conversation without implying success. */
export function conversationRecovery(detail:string,applying=false){
 const limit=/\[(AI_LIMIT_REACHED|RATE_LIMITED|AI_RATE_LIMITED|AI_NOT_CONFIGURED|ASSISTANT_DISABLED|ASSISTANT_TIMEOUT|INCOMPLETE_PLAN)([^\]]*)\]/.exec(detail);
 // Once an edit is being applied its outcome is unconfirmed, so the general applying message below applies instead.
 if(limit&&!applying){const field=(name:string)=>new RegExp(';'+name+'=([^;\\]]+)').exec(limit[2])?.[1];const resets=field('resets'),wait=Number(field('wait'));
  if(limit[1]==='AI_LIMIT_REACHED')return {text:`You’ve used this month’s AI edits${resets&&!Number.isNaN(Date.parse(resets))?`; they reset on ${new Date(resets).toLocaleDateString(undefined,{month:'long',day:'numeric',timeZone:'UTC'})}`:''}. Nothing was changed. You can still edit the page directly with Visual edit.`,retryable:false};
  if(limit[1]==='RATE_LIMITED')return {text:`That was a lot of requests in a short time. Wait ${wait>0?`about ${wait} second${wait===1?'':'s'}`:'a minute'}, then press Retry. Nothing was changed.`,retryable:true};
  if(limit[1]==='ASSISTANT_TIMEOUT'||limit[1]==='INCOMPLETE_PLAN')return {text:'That was a lot to design in one go, and the AI ran out of time. Nothing was changed. Try it in steps, for example the header and summary first, then the list.',retryable:true};
  if(limit[1]==='AI_RATE_LIMITED')return {text:'The AI service is busy right now. Wait a moment, then press Retry. Nothing was changed.',retryable:true};
  return {text:'AI editing isn’t available on this Wandel server right now. You can still edit the page directly with Visual edit.',retryable:false};
 }
 if(/no credits remaining|credit_balance_exhausted/i.test(detail))return {text:'The OpenAI account behind Wandel has run out of credits, so no AI request can run. Nothing was changed. Add credits in OpenAI billing, then press Retry.',retryable:true};
 if(/429|rate limit|credits|quota|billing|spending limit/i.test(detail))return {text:'Wandel’s AI service has reached its provider usage limit (this isn’t your account’s allowance). Nothing was changed; press Retry later.',retryable:!applying};
 if(/sign.?in|account|authenticated|authorization|401|403/i.test(detail))return {text:'I need your Wandel session reconnected before I can inspect or edit this page. Your conversation and saved workflow are kept.',retryable:!applying};
 if(/rolled back: Visual review found/i.test(detail))return {text:'I restored the previous layout because the attempted change did not match your request. I haven’t completed the edit. Your request is still in this conversation, and the previous design is preserved.',retryable:true};
 if(/rolled back: Preview could not be applied/i.test(detail)){const reason=plainReason(detail.replace(/^[\s\S]*?Preview could not be applied:?\s*/i,'').trim());return {text:'I couldn’t apply that change to this page, so I restored the previous layout'+(reason?': '+reason.replace(/\.?$/,'.'):'.')+' Your request is still in this conversation.',retryable:true};}
 // Rendered checks explain the problem in plain language; element and geometry details stay in the diagnostic.
 if(/rolled back/i.test(detail)){const reason=plainReason(detail.replace(/^.*?rolled back:\s*/i,'').replace(/^Preview could not be applied:\s*/i,'').replace(/\s*\([^)]*\)/g,'').trim());return {text:`I restored the previous layout because the result failed a layout check${reason?': '+reason.replace(/\.?$/,'.'):'.'} I haven’t completed the edit. Your request is still in this conversation, and the previous design is preserved.`,retryable:true};}
 if(/window|tab|page.*connect|page.*respond|older Wandel|extension context|Refresh this page/i.test(detail))return {text:applying?'I lost confirmation from the application while the edit was running. The change may already be present. Please check the page before repeating it; your conversation is kept.':'I lost my connection to the application page. Reconnect or refresh that page, and we can continue this conversation.',retryable:!applying};
 // A plan Wandel cannot build is a capability limit, not a missing element; the rule stays in the diagnostic.
 if(/Plan not supported:/.test(detail)){const rule=detail.replace(/^[\s\S]*?Plan not supported:\s*/,'').replace(/\s*Nothing was applied\.?\s*$/,'').trim().slice(0,300);return {text:'Wandel can’t build that change in the form it was planned, so nothing on the page changed.'+(rule?' Reason: '+rule:'')+' Try describing it differently, or Retry.',retryable:true};}
 // Only a genuinely unresolved element asks which card is meant; other preparation failures give their reason.
 const unidentified=/unknown element|has not been created|changed while planning|Capture context|ambiguous/i.test(detail);
 if(/^Preview not applied:/.test(detail)&&!unidentified){const reason=plainReason(detail.replace(/^Preview not applied:\s*/,'').trim());return {text:`I couldn’t prepare that change, so nothing on the page changed${reason?': '+reason.replace(/\.?$/,'.'):'.'} Your request is still in this conversation.`,retryable:true};}
 if(unidentified||!applying&&/reference|selection|inspect/i.test(detail))return {text:'I couldn’t confidently identify the right page elements, so I haven’t applied this edit. Which visible card or section do you mean? You can tell me its name—no selection is required.',retryable:true};
 if(applying)return {text:'I couldn’t confirm whether the last change finished. Please check the page before repeating it, so I don’t duplicate a change that may already be there. Your conversation is kept.',retryable:false};
 return {text:'I couldn’t complete that request this time. Your conversation is kept and no edit was applied. You can continue describing what you want, or retry the request.',retryable:true};
}
