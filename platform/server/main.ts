import {GitHubApp} from './github';
import {OpenAIImplementation} from './implementationProvider';
import {OpenAIAssistant} from './assistant';
import {MAX_RECORDING_BYTES} from '../../extension/shared/recording';
import Stripe from 'stripe';
import {StripeBilling,UnavailableBilling} from './stripe';
import {ClerkIdentity} from './clerk';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {environment} from './environment';
import {serverAddress} from './config';
import {database} from './db';
import {createPlatform} from './app';
import {DevMailbox,WebhookMailbox,MockAIProvider,OpenAIAIProvider} from './providers';
const config=environment(),db=database(config.dbPath);
const mail=config.production&&config.authMode==='legacy'?new WebhookMailbox(process.env.WANDEL_MAIL_WEBHOOK||'',process.env.WANDEL_MAIL_TOKEN||''):new DevMailbox();
const stripeKey=process.env.STRIPE_SECRET_KEY||'';
if(stripeKey&&!stripeKey.startsWith('sk_test_'))throw new Error('Only Stripe test keys are permitted in this integration.');
const billing=stripeKey&&process.env.STRIPE_PRICE_ID&&process.env.STRIPE_WEBHOOK_SECRET?new StripeBilling(db,new Stripe(stripeKey),process.env.STRIPE_PRICE_ID,process.env.STRIPE_WEBHOOK_SECRET,config.origin):new UnavailableBilling();
const identity=new ClerkIdentity(process.env.CLERK_SECRET_KEY||'',[config.origin,...config.extensionOrigins]);
const github=process.env.GITHUB_APP_CLIENT_ID&&process.env.GITHUB_APP_CLIENT_SECRET&&process.env.GITHUB_APP_SLUG?new GitHubApp(process.env.GITHUB_APP_CLIENT_ID,process.env.GITHUB_APP_CLIENT_SECRET,process.env.GITHUB_APP_SLUG):undefined;
const implementation=process.env.WANDEL_IMPLEMENTATION_ENABLED==='true'&&process.env.OPENAI_API_KEY&&(process.env.OPENAI_IMPLEMENTATION_MODEL||process.env.OPENAI_MODEL)?new OpenAIImplementation(process.env.OPENAI_API_KEY,process.env.OPENAI_IMPLEMENTATION_MODEL||process.env.OPENAI_MODEL!):undefined;
const app=createPlatform({db,config,mail,billing,identity,github,implementation,...(process.env.WANDEL_ASSISTANT_ENABLED!=='false'?{assistant:new OpenAIAssistant(process.env.OPENAI_API_KEY||'',process.env.OPENAI_MODEL||'',process.env.OPENAI_TRANSCRIBE_MODEL||'gpt-4o-mini-transcribe',{anthropic:process.env.ANTHROPIC_API_KEY,xai:process.env.XAI_API_KEY})}:{}) ,ai:config.aiMode==='mock'?new MockAIProvider():new OpenAIAIProvider(process.env.OPENAI_API_KEY||'',process.env.OPENAI_MODEL||'')});
const webRoot=resolve('dist-platform/web');
const publicKey=process.env.VITE_CLERK_PUBLISHABLE_KEY||process.env.CLERK_PUBLISHABLE_KEY||'';
const clerkHost=publicKey?Buffer.from(publicKey.split('_').slice(2).join('_'),'base64').toString().replace(/\$$/,''):'';
if(clerkHost&&!/^[a-z0-9.-]+$/.test(clerkHost))throw new Error('Invalid Clerk publishable key.');
const clerkOrigin=clerkHost?'https://'+clerkHost:'';
const webCSP=`default-src 'self'; script-src 'self' ${clerkOrigin} https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://img.clerk.com ${clerkOrigin}; connect-src 'self' ${clerkOrigin}; frame-src ${clerkOrigin} https://challenges.cloudflare.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`;

const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url||'/',config.origin);
  if(!url.pathname.startsWith('/api/')&&!/^\/view\/[a-f0-9]{64}$/.test(url.pathname)){
   const file=resolve(webRoot,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(webRoot+'/')&&file!==webRoot){res.writeHead(404);res.end();return;}
   const asset=extname(file);const data=await readFile(asset?file:resolve(webRoot,'index.html'));
   res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'} as Record<string,string>)[asset]||'text/html','Content-Security-Policy':webCSP,...(url.pathname==='/flow'?{'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}:{}),'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});res.end(data);return;
  }
  // A plan or chat request carries a screenshot, a reference image and the page description, so it gets more room than other calls.
  const limit=url.pathname==='/api/recordings'&&req.method==='POST'?MAX_RECORDING_BYTES:url.pathname==='/api/public-views'?7340032:/^\/api\/assistant\/(plan|chat|verify)$/.test(url.pathname)?3145728:1048576;
  // An oversized body is read to the end before the answer: replying mid-upload drops the connection, and the browser then reports only "Failed to fetch".
  let size=0,tooLarge=false;const chunks:Buffer[]=[];for await(const chunk of req){size+=chunk.length;if(size>limit)tooLarge=true;else chunks.push(chunk);if(size>limit*4)break;}
  if(tooLarge){console.error(JSON.stringify({event:'body_too_large',path:url.pathname,bytes:size,limit}));res.writeHead(413,{'Content-Type':'application/json',Connection:'close'});res.end(JSON.stringify({error:{code:'BODY_TOO_LARGE',message:limit===MAX_RECORDING_BYTES?'Videos must be under 20 MB.':'This request is too large. Start a new chat or select a smaller part of the page, then try again.'}}));return;}
  const headers=new Headers();for(const [key,value]of Object.entries(req.headers))if(value)headers.set(key,Array.isArray(value)?value.join(','):value);
  const result=await app.handle(new Request(url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method||'GET')?{body:Buffer.concat(chunks)}:{})}),req.socket.remoteAddress||'unknown');
  res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
 }catch{res.writeHead(404,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{code:'NOT_FOUND',message:'Page not found. Build the web app with npm run platform:build.'}}));}
});
const recordingCleanup=setInterval(()=>{try{db.prepare('DELETE FROM recordings WHERE expires_at<=?').run(new Date().toISOString());db.prepare('DELETE FROM workflow_links WHERE expires_at<=?').run(new Date().toISOString());db.prepare('DELETE FROM public_views WHERE expires_at<=?').run(new Date().toISOString());}catch{console.error('Expired video cleanup failed.');}},60*60*1000);recordingCleanup.unref();
db.prepare('DELETE FROM recordings WHERE expires_at<=?').run(new Date().toISOString());db.prepare('DELETE FROM workflow_links WHERE expires_at<=?').run(new Date().toISOString());
const address=serverAddress(process.env);
server.listen(address.port,address.host,()=>console.log(`Wandel platform API on http://${address.host}:${address.port} · AI: ${config.aiMode} · billing: ${billing.mode}`));
const stop=()=>{clearInterval(recordingCleanup);server.close(()=>{db.close();process.exit(0);});};process.on('SIGINT',stop);process.on('SIGTERM',stop);
