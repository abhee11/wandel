import {readFileSync} from 'node:fs';
import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { loadEnvFile } from 'node:process';
try { loadEnvFile(new URL('../.env', import.meta.url)); } catch(error) { if(error.code!=='ENOENT')throw error; }
const key=process.env.OPENAI_API_KEY;
const model=process.env.OPENAI_MODEL;
if(!key || !model){console.error('Set OPENAI_API_KEY and OPENAI_MODEL in your shell, then run npm run ai. No key is stored in the extension.');process.exit(1);}
const token=process.env.DESIGNX_PLANNER_TOKEN || randomBytes(24).toString('hex');
const {schema,instructions}=JSON.parse(readFileSync(new URL('../extension/ai/providerContract.json',import.meta.url),'utf8'));
function authorized(value){const received=Buffer.from(value||'');const expected=Buffer.from(`Bearer ${token}`);return received.length===expected.length&&timingSafeEqual(received,expected);}
const server=http.createServer(async(req,res)=>{
  const origin=req.headers.origin||'';
  const allowed=/^chrome-extension:\/\/[a-p]{32}$/.test(origin)||/^http:\/\/(127\.0\.0\.1|localhost):5173$/.test(origin);
  if(allowed){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');}
  const json=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
  if(req.method==='OPTIONS'){res.writeHead(allowed?204:403);res.end();return;}
  if(!allowed || !authorized(req.headers.authorization))return json(403,{error:'Planner access denied. Check the local server token.'});
  if(req.url==='/health'&&req.method==='POST')return json(200,{ready:true,model});
  if(req.url!=='/plan'||req.method!=='POST')return json(404,{error:'Not found.'});
  try{
    let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>12000)return json(413,{error:'Request too large.'});}
    const data=JSON.parse(raw);
    if(typeof data.prompt!=='string'||!data.prompt.trim()||data.prompt.length>2000||typeof data.selection?.label!=='string'||data.selection.label.length>300||typeof data.selection?.tag!=='string'||data.selection.tag.length>40)return json(400,{error:'Invalid planning request.'});
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,store:false,max_output_tokens:4000,instructions,input:JSON.stringify({prompt:data.prompt,selection:{label:data.selection.label,tag:data.selection.tag}}),text:{format:{type:'json_schema',name:'ui_plan',strict:true,schema}}}),signal:AbortSignal.timeout(40000)});
    if(!response.ok)return json(502,{error:`AI provider returned ${response.status}. Check your server credentials, model access, and quota.`});
    const body=await response.json();
    const output=body.output?.flatMap(item=>item.content||[]).filter(item=>item.type==='output_text').map(item=>item.text).join('');
    if(body.status!=='completed'||!output)return json(502,{error:'The model did not return a complete plan. Try a simpler prompt.'});
    const plan=JSON.parse(output);
    if(!Array.isArray(plan.steps)||(!plan.steps.length&&!plan.flow&&!plan.section)||plan.steps.length>20)return json(502,{error:'The model returned an invalid plan.'});
    json(200,plan);
  }catch(error){json(502,{error:error?.name==='TimeoutError'?'AI planner timed out.':'Planning failed. Check the server and try again.'});}
});
server.listen(4319,'127.0.0.1',()=>console.log(`Wandel planner: http://127.0.0.1:4319\nLocal token (paste into the side panel): ${token}\nOnly explicitly submitted prompts and selected labels are sent to OpenAI.`));
