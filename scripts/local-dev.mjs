// One command for local work: `npm run dev:local` (Start Wandel.command runs it).
// Leave it running. It rebuilds the extension and the server whenever source changes,
// restarts the server (and again if it ever exits), and pushes new commits on main.
// Everything it does, and the server's own output, goes to .data/dev-local.log too,
// so problems can be diagnosed without looking at this window.
import {spawn,execFile} from 'node:child_process';
import {readdirSync,statSync,writeFileSync,appendFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {promisify} from 'node:util';
const run=promisify(execFile);mkdirSync('.data',{recursive:true});
const logFile='.data/dev-local.log';writeFileSync(logFile,'');
const log=(...parts)=>{const line=new Date().toLocaleTimeString()+' · '+parts.join(' ');console.log(line);appendFileSync(logFile,line+'\n');};
let server=null,building=null,again=false,stopping=false;
async function step(label,command,args){try{await run(command,args,{maxBuffer:1<<26,timeout:240000});return true;}catch(error){log(label+' failed:\n'+(error.stderr||error.stdout||error.message).toString().slice(-3000));return false;}}
function stop(){return new Promise(resolve=>{if(!server||server.exitCode!==null||server.signalCode){resolve();return;}stopping=true;const s=server;s.once('exit',()=>{stopping=false;resolve();});s.kill('SIGTERM');setTimeout(()=>{if(s.exitCode===null)s.kill('SIGKILL');},4000);});}
async function freePort(){try{const {stdout}=await run('lsof',['-ti','tcp:4320']);const pids=stdout.split(/\s+/).filter(Boolean).filter(pid=>Number(pid)!==server?.pid);for(const pid of pids){try{process.kill(Number(pid),'SIGKILL');log('Stopped an old server on port 4320 ('+pid+').');}catch{}}}catch{/* nothing is listening */}}
function start(){
 server=spawn('node',['dist-platform/server/main.js'],{stdio:['ignore','pipe','pipe']});
 for(const stream of [server.stdout,server.stderr])stream.on('data',chunk=>{process.stdout.write(chunk);appendFileSync(logFile,chunk);});
 const self=server;server.on('exit',(code,signal)=>{if(stopping||self!==server)return;log(`Server exited (${code??signal}); restarting in 2s.`);setTimeout(()=>{if(self===server)void freePort().then(start);},2000);});
 log('Server started (pid '+server.pid+').');
}
async function rebuild(reason){
 if(building){again=true;return building;}
 building=(async()=>{
  log('Building ('+reason+')…');
  const extension=await step('Extension build','node',['scripts/build.mjs']);
  if(extension)writeFileSync('dist/dev-reload.json',JSON.stringify({at:Date.now()}));
  const platform=await step('Server build','node',['scripts/platform-build.mjs']);
  // The share page validates workflows too, so it must stay in step with the extension.
  await step('Web build','npx',['vite','build','--config','platform/vite.config.ts']);
  if(platform){await stop();await freePort();start();}else log('Server kept on its previous build.');
  log('Ready.'+(extension?' The extension reloads itself.':' Extension build failed; see above.'));
 })().finally(()=>{building=null;if(again){again=false;void rebuild('more changes');}});
 return building;
}
// Polling, not file events: edits made through another machine's view of this folder don't always raise events.
const stamp=dir=>{let latest=0;const walk=path=>{for(const entry of readdirSync(path,{withFileTypes:true})){if(entry.name.startsWith('.'))continue;const full=join(path,entry.name);if(entry.isDirectory())walk(full);else latest=Math.max(latest,statSync(full).mtimeMs);}};try{walk(dir);}catch{}return latest;};
let seen=Math.max(stamp('extension'),stamp('platform'));
setInterval(()=>{const now=Math.max(stamp('extension'),stamp('platform'));if(now>seen){seen=now;setTimeout(()=>void rebuild('source changed'),800);}},1500);
setInterval(async()=>{try{const branch=(await run('git',['branch','--show-current'])).stdout.trim();if(branch!=='main')return;const ahead=Number((await run('git',['rev-list','--count','origin/main..main'])).stdout.trim());if(!ahead)return;log(`Pushing ${ahead} commit(s) to origin/main…`);await run('git',['push','origin','main']);log('Pushed.');}catch(error){log('Push failed: '+(error.stderr||error.message).toString().trim().slice(0,400));}},10000);
process.on('SIGINT',async()=>{await stop();process.exit(0);});
await freePort();void rebuild('start');
