import { z } from 'zod';
import { parseBatch, type Batch } from './planSchema';
import { OperationSchema, uid, type Locator, type Operation } from '../shared/model';
export const PlanSchema = z.object({ kind: z.enum(['insert','text']), position: z.enum(['before','after','inside','below']), element: z.enum(['button','panel','text']), text: z.string().trim().min(1).max(300) }).strict();
export type Plan = z.infer<typeof PlanSchema>;
export function localPlan(prompt: string): Plan {
  const p = prompt.trim().replace(/[.!]$/, '');
  if (!p || p.length > 2000) throw new Error('Enter a prompt under 2,000 characters.');
  if (/^(rename|change (this )?text|set (this )?text)/i.test(p)) {
    const text = p.replace(/^(rename\s+(this\s+)?(to\s+)?|(?:change|set)\s+(this\s+)?text\s+to\s+)/i,'').replace(/^["“']|["”']$/g,'');
    return PlanSchema.parse({kind:'text',position:'after',element:'text',text});
  }
  if (!/^add\s+/i.test(p)) throw new Error('Local mode supports “Add Risk Analysis beside this”, “Add View Details inside this”, or “Rename this to …”. Use AI mode for broader phrasing.');
  const element = /\bpanel\b/i.test(p) ? 'panel' : /\btext\b/i.test(p) ? 'text' : 'button';
  const position = /\b(inside|into|within)\b/i.test(p) ? 'inside' : /\b(below|underneath|under)\b/i.test(p) ? 'below' : /\bbefore\b/i.test(p) ? 'before' : 'after';
  const quoted = p.match(/["“]([^"”]+)["”]/)?.[1];
  const called = p.match(/\b(?:called|named|labeled)\s+(.+)$/i)?.[1]?.replace(/\s+(?:next to|beside|after|before|inside|into|within|below|underneath|under)\s+this$/i,'');
  const text = (quoted || called || p.replace(/^add\s+(?:an?\s+)?/i,'').replace(/\s+(?:next to|beside|after|before|inside|into|within|below|underneath|under)\b.*$/i,'').replace(/\b(button|panel|text)\b/ig,'')).trim();
  if (!text || /^(this|a|an)$/i.test(text)) throw new Error('Give the new element a label, for example “Add a button next to this called Analyze”.');
  return PlanSchema.parse({kind:'insert',position,element,text});
}
export function operationFromPlan(input: unknown, target: Locator): Operation {
  const p = PlanSchema.parse(input);
  return OperationSchema.parse(p.kind === 'text' ? {id:uid(),kind:'text',target,text:p.text} : {id:uid(),kind:'insert',target,position:p.position,node:{id:uid(),kind:p.element,text:p.text}});
}
/** Checks the configured local server without spending tokens or sending page data. */
export async function checkAIConnection(token:string):Promise<string> {
  if(!token.trim())throw new Error('Paste the token printed by npm run ai. This is the local server token, not your OpenAI API key.');
  const response=await fetch('http://127.0.0.1:4319/health',{method:'POST',headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(5000)}).catch(()=>{throw new Error('AI server is not running. Configure OPENAI_API_KEY and OPENAI_MODEL locally, then run npm run ai.');});
  const body=await response.json();
  if(!response.ok)throw new Error(body.error||'Could not connect to the AI server.');
  if(body.ready!==true||typeof body.model!=='string')throw new Error('Update and restart the local AI server, then reconnect.');
  return body.model;
}
export async function requestAI(prompt: string, selection: { tag: string; label: string }, token: string): Promise<Plan | Batch> {
  if(!token.trim())throw new Error('Connect AI first: start npm run ai with your API key and model, then paste its local server token below.');
  const response = await fetch('http://127.0.0.1:4319/plan', { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body:JSON.stringify({prompt,selection}), signal:AbortSignal.timeout(45000) }).catch(()=>{throw new Error('Cannot reach the AI planner. Start npm run ai and check that it is listening on port 4319.');});
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'AI planner failed.');
  if(body.steps) return parseBatch(body);
  return PlanSchema.parse(body);
}

/** Common editing requests work locally without requiring an AI server. */
export function localOperation(prompt:string,target:Locator):Operation {
  const p=prompt.trim().replace(/[.!]$/,'');
  if(!p||p.length>2000)throw new Error('Enter a change under 2,000 characters.');
  if(/^(?:remove|delete|hide)(?:\s+(?:this|this element|the selected element|selected element))?$/i.test(p))return OperationSchema.parse({id:uid(),kind:'remove',target});
  const colors:Record<string,string>={red:'#ff0000',blue:'#0000ff',green:'#008000',black:'#000000',white:'#ffffff',purple:'#800080',orange:'#ffa500',yellow:'#ffff00',gray:'#808080',grey:'#808080',pink:'#ffc0cb'};
  const color=p.match(/^(?:make|set|change)\s+(?:(?:this|the|its)\s+)?(?:(text|background|background color|text color|color)\s+)?(?:to\s+)?(#[a-f0-9]{6}|red|blue|green|black|white|purple|orange|yellow|gray|grey|pink)$/i);
  if(color){const key=color[1]?.toLowerCase().startsWith('background')?'backgroundColor':'color';return OperationSchema.parse({id:uid(),kind:'style',target,style:{[key]:colors[color[2].toLowerCase()]||color[2]}});}
  const size=p.match(/^(?:set|change|make)\s+(?:(?:this|the|its)\s+)?(width|height|font size)\s+(?:to\s+)?(\d+)(?:\s*px)?$/i);
  if(size)return OperationSchema.parse({id:uid(),kind:'style',target,style:{[size[1].toLowerCase()==='font size'?'fontSize':size[1].toLowerCase()]:Number(size[2])}});
  const rename=p.match(/^(?:rename\s+(?:(?:this|it|this button|this text|this label)\s+)?(?:to\s+)?|(?:change|set|edit)\s+(?:(?:this|the|its)\s+)?(?:(?:text|label|name|button text)\s+)?to\s+)(.+)$/i);
  if(rename)return operationFromPlan({kind:'text',position:'after',element:'text',text:rename[1].replace(/^["“']|["”']$/g,'')},target);
  try{return operationFromPlan(localPlan(p),target);}catch{throw new Error('This request needs connected AI. Choose AI planner in the side panel and connect it first. Offline mode only supports quick edits and the listed form preset.');}
}
