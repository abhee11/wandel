// One command for local work: `npm run dev:local` (replaces `npm run platform:server`).
// Leave it running. Whenever source changes it rebuilds the extension and the server
// and restarts the server; the open Wandel side panel then reloads the extension and
// its page by itself. New commits on main are pushed to origin automatically.
import {spawn,execFile} from 'node:child_process';
import {watch,writeFileSync} from 'node:fs';
import {promisify} from 'node:util';
const run=promisify(execFile),log=(...parts)=>console.log(new Date().toLocaleTimeString(),'·',...parts);
let server=null,building=null,again=false,timer;
async function step(label,command,args){try{await run(command,args,{maxBuffer:1<<26});return true;}catch(error){log(label+' failed:\n'+(error.stderr||error.stdout||error.message).toString().slice(-2000));return false;}}
function stop(){return new Promise(resolve=>{if(!server||server.exitCode!==null){resolve();return;}server.once('exit',()=>resolve());server.kill('SIGTERM');setTimeout(()=>server?.kill('SIGKILL'),4000);});}
async function rebuild(reason){
 if(building){again=true;return building;}
 building=(async()=>{
  log('Building ('+reason+')…');
  const extension=await step('Extension build','node',['scripts/build.mjs']);
  // The side panel watches this stamp and reloads the extension and its page when it changes.
  if(extension)writeFileSync('dist/dev-reload.json',JSON.stringify({at:Date.now()}));
  const platform=await step('Server build','node',['scripts/platform-build.mjs']);
  if(platform){await stop();server=spawn('node',['dist-platform/server/main.js'],{stdio:'inherit'});log('Server restarted.'+(extension?' Extension rebuilt; the side panel reloads it.':''));}
  else log('Server kept on its previous build.');
 })().finally(()=>{building=null;if(again){again=false;void rebuild('more changes');}});
 return building;
}
for(const dir of ['extension','platform'])watch(dir,{recursive:true},(_event,file)=>{if(!file||/(^|\/)\.|~$/.test(file))return;clearTimeout(timer);timer=setTimeout(()=>void rebuild(dir+'/'+file),1200);});
// Push commits made on main (by you or by Claude) as soon as they exist.
setInterval(async()=>{try{const branch=(await run('git',['branch','--show-current'])).stdout.trim();if(branch!=='main')return;const ahead=Number((await run('git',['rev-list','--count','origin/main..main'])).stdout.trim());if(!ahead)return;log(`Pushing ${ahead} commit(s) to origin/main…`);await run('git',['push','origin','main']);log('Pushed.');}catch(error){log('Push failed: '+(error.stderr||error.message).toString().trim().slice(0,400));}},10000);
process.on('SIGINT',async()=>{await stop();process.exit(0);});
void rebuild('start');
