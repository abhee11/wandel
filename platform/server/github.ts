import {createHash} from 'node:crypto';
import {APIError} from './security';
import type {RepositoryChoice,ProposedFile,ImplementationJob} from '../../extension/implementation/model';
export interface RepositoryContext{repository:RepositoryChoice;baseBranch:string;baseSha:string;treeSha:string;paths:string[];files:{path:string;content:string}[];limited:boolean;}
export interface GitHubProvider{
 authorize(state:string,challenge:string,callback:string):string;installURL:string;
 exchange(code:string,verifier:string,callback:string):Promise<{token:string;login:string;expiresIn:number}>;
 repositories(token:string):Promise<RepositoryChoice[]>;
 context(token:string,repository:RepositoryChoice,baseBranch:string,projectPath:string):Promise<RepositoryContext>;
 publish(token:string,context:RepositoryContext,files:ProposedFile[],branch:string,title:string,body:string):Promise<{url:string;number:number;sha:string}>;
 checks(token:string,repository:string,sha:string):Promise<ImplementationJob['checks']>;
}
export function safeProjectPath(path:string){return path===''||/^(?![./])(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(path);}
export function allowedSource(path:string){
 return path.length<240&&!path.includes('..')&&!path.includes('\\')&&!path.startsWith('/')&&!/(^|\/)(?:\.[^/]+|node_modules|vendor|dist|build|coverage|secrets?|credentials)(\/|$)/i.test(path)&&!/(?:^|\/)(?:secrets?|credentials|service[-_]account)(?:[._-]|$)/i.test(path)&&!/(?:^|\/)(?:Dockerfile|docker-compose|railway|vercel|netlify|wrangler|terraform)(?:[./-]|$)/i.test(path)&&!/(?:\.env|\.pem|\.key|\.p12|\.pfx|\.sqlite|\.db|lock\.json|\.lock)$/i.test(path)&&/\.(?:tsx?|jsx?|css|scss|html|vue|svelte|json|md|py|rb|go|rs|java|kt|swift|yml|yaml)$/.test(path);
}
export function validateFiles(files:ProposedFile[],context:RepositoryContext){
 if(!files.length||files.length>12||new Set(files.map(f=>f.path)).size!==files.length)throw new APIError(422,'INVALID_PATCH','Generate one to twelve distinct source files.');
 if(files.reduce((n,f)=>n+Buffer.byteLength(f.content),0)>200000)throw new APIError(422,'PATCH_TOO_LARGE','The proposed change is too large. Split the workflow into a smaller change.');
 const read=new Set(context.files.map(f=>f.path));
 for(const file of files){if(!allowedSource(file.path)||file.content.length>100000||file.content.includes('\0')||/-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,})/.test(file.content))throw new APIError(422,'UNSAFE_PATCH','The proposal contains a protected path, credential, or oversized file. Nothing was published.');if(context.paths.includes(file.path)&&!read.has(file.path))throw new APIError(422,'UNREAD_SOURCE','The proposal changes a file that was not read. Use a smaller project path or regenerate.');}
 if(files.every(f=>context.files.find(old=>old.path===f.path)?.content===f.content))throw new APIError(422,'EMPTY_PATCH','The generated files do not change the application.');
}
export function reviewDiff(path:string,before:string|undefined,after:string){
 const old=before?.split('\n')||[],next=after.split('\n');let start=0,end=0;
 while(start<old.length&&start<next.length&&old[start]===next[start])start++;
 while(end<old.length-start&&end<next.length-start&&old[old.length-1-end]===next[next.length-1-end])end++;
 const first=Math.max(0,start-3),oldEnd=Math.min(old.length,old.length-end+3),newEnd=Math.min(next.length,next.length-end+3);
 return `--- ${before===undefined?'/dev/null':'a/'+path}\n+++ b/${path}\n@@ -${first+1},${oldEnd-first} +${first+1},${newEnd-first} @@\n`+old.slice(first,start).map(l=>' '+l).concat(old.slice(start,old.length-end).map(l=>'-'+l),next.slice(start,next.length-end).map(l=>'+'+l),next.slice(next.length-end,newEnd).map(l=>' '+l)).join('\n');
}
export class GitHubApp implements GitHubProvider{
 readonly installURL:string;
 constructor(private clientId:string,private clientSecret:string,slug:string,private http:typeof fetch=fetch){this.installURL='https://github.com/apps/'+encodeURIComponent(slug)+'/installations/new';}
 authorize(state:string,challenge:string,callback:string){const u=new URL('https://github.com/login/oauth/authorize');u.search=new URLSearchParams({client_id:this.clientId,redirect_uri:callback,state,code_challenge:challenge,code_challenge_method:'S256'}).toString();return u.href;}
 private async api(token:string,path:string,method='GET',body?:unknown,allowMissing=false){
  const response=await this.http('https://api.github.com'+path,{method,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2026-03-10','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
  if(allowMissing&&response.status===404)return null;
  if(!response.ok)throw new APIError(response.status===401?401:502,response.status===401?'GITHUB_RECONNECT':'GITHUB_REQUEST_FAILED',response.status===401?'Reconnect GitHub to continue.':'GitHub could not complete this request. Check repository access, app permissions, and branch policies.');
  const raw=await response.text();if(raw.length>8000000)throw new APIError(413,'REPOSITORY_TOO_LARGE','This repository response is too large.');return raw?JSON.parse(raw):{};
 }
 async exchange(code:string,verifier:string,callback:string){
  const response=await this.http('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({client_id:this.clientId,client_secret:this.clientSecret,code,code_verifier:verifier,redirect_uri:callback}),signal:AbortSignal.timeout(20000)});
  const value=await response.json();if(!response.ok||typeof value.access_token!=='string'||value.error)throw new APIError(400,'GITHUB_AUTH_FAILED','GitHub authorization expired or was declined. Connect again.');
  const user=await this.api(value.access_token,'/user');return {token:value.access_token,login:String(user.login),expiresIn:Math.min(Number(value.expires_in)||28800,28800)};
 }
 async repositories(token:string){
  const output:RepositoryChoice[]=[];
  const installations=await this.api(token,'/user/installations?per_page=20');
  if(installations.total_count>20)throw new APIError(422,'TOO_MANY_INSTALLATIONS','Use an account with at most twenty GitHub App installations for this beta.');
  for(const install of installations.installations||[]){
   const result=await this.api(token,`/user/installations/${Number(install.id)}/repositories?per_page=100`);
   if(result.total_count>100)throw new APIError(422,'TOO_MANY_REPOSITORIES','Limit this App installation to at most one hundred selected repositories.');
   for(const repo of result.repositories||[])if(!repo.archived&&!repo.disabled&&repo.permissions?.push!==false)output.push({id:repo.id,installationId:install.id,name:repo.full_name,defaultBranch:repo.default_branch||'main'});
  }return output;
 }

 async context(token:string,repository:RepositoryChoice,baseBranch:string,projectPath:string){
  const prefix='/repos/'+repository.name,ref=await this.api(token,prefix+'/git/ref/heads/'+encodeURIComponent(baseBranch)),commit=await this.api(token,prefix+'/git/commits/'+ref.object.sha),tree=await this.api(token,prefix+'/git/trees/'+commit.tree.sha+'?recursive=1');
  if(tree.truncated)throw new APIError(422,'REPOSITORY_TOO_LARGE','Repository listing is truncated. Use a smaller repository for this beta.');
  const all=(tree.tree||[]).filter((n:any)=>n.type==='blob'&&n.mode==='100644'&&allowedSource(n.path)&&(projectPath?n.path.startsWith(projectPath+'/'):true));
  const score=(path:string)=>/(?:^|\/)(?:package.json|README.md|AGENTS.md)$/.test(path)?0:/\b(?:app|page|route|layout|index)\b/i.test(path)?1:/\.(tsx|jsx|vue|svelte|css)$/.test(path)?2:3;
  all.sort((a:any,b:any)=>score(a.path)-score(b.path)||a.path.localeCompare(b.path));const files:{path:string;content:string}[]=[];let bytes=0,attempts=0;
  for(const file of all){if(files.length>=16)break;if(file.size>40000||bytes+file.size>160000)continue;if(++attempts>32)break;const blob=await this.api(token,prefix+'/git/blobs/'+file.sha);if(blob.encoding!=='base64')continue;const content=Buffer.from(blob.content,'base64').toString('utf8');if(/-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,})/.test(content))continue;files.push({path:file.path,content});bytes+=Buffer.byteLength(content);}
  if(!files.length)throw new APIError(422,'NO_SOURCE','No supported source files were found in this project path.');
  return {repository,baseBranch,baseSha:ref.object.sha,treeSha:commit.tree.sha,paths:(tree.tree||[]).map((f:any)=>f.path),files,limited:files.length<all.length};
 }
 async publish(token:string,context:RepositoryContext,files:ProposedFile[],branch:string,title:string,body:string){
  validateFiles(files,context);files=files.filter(f=>context.files.find(old=>old.path===f.path)?.content!==f.content);const prefix='/repos/'+context.repository.name;
  const existing=await this.api(token,prefix+'/pulls?state=all&head='+encodeURIComponent(context.repository.name.split('/')[0]+':'+branch));if(existing.length){const pr=existing[0];if(pr.state!=='open'||!pr.draft)throw new APIError(409,'PR_CHANGED','The existing pull request was closed or changed outside Wandel. Review it on GitHub.');return {url:pr.html_url,number:pr.number,sha:pr.head.sha};}
  const current=await this.api(token,prefix+'/git/ref/heads/'+encodeURIComponent(context.baseBranch));if(current.object.sha!==context.baseSha)throw new APIError(409,'BASE_CHANGED','The base branch changed after generation. Regenerate before publishing.');
  let commit=await this.api(token,prefix+'/git/ref/heads/'+encodeURIComponent(branch),'GET',undefined,true);
  if(commit){
   const saved=await this.api(token,prefix+'/commits/'+commit.object.sha);
   const hashes=new Map(files.map(f=>[f.path,createHash('sha1').update('blob '+Buffer.byteLength(f.content)+'\0'+f.content).digest('hex')]));
   if(saved.parents?.length!==1||saved.parents[0].sha!==context.baseSha||saved.files?.length!==files.length||saved.files.some((f:any)=>hashes.get(f.filename)!==f.sha))throw new APIError(409,'BRANCH_CHANGED','The proposal branch was changed outside Wandel. Regenerate before publishing.');
   commit={sha:commit.object.sha};
  }else{
   const tree=await this.api(token,prefix+'/git/trees','POST',{base_tree:context.treeSha,tree:files.map(f=>({path:f.path,mode:'100644',type:'blob',content:f.content}))});
   commit=await this.api(token,prefix+'/git/commits','POST',{message:title,tree:tree.sha,parents:[context.baseSha]});
   await this.api(token,prefix+'/git/refs','POST',{ref:'refs/heads/'+branch,sha:commit.sha});
  }
  const pr=await this.api(token,prefix+'/pulls','POST',{title,head:branch,base:context.baseBranch,body,draft:true});
  return {url:pr.html_url,number:pr.number,sha:commit.sha};
 }
 async checks(token:string,repository:string,sha:string):Promise<ImplementationJob['checks']>{
  const prefix='/repos/'+repository+'/commits/'+sha;
  try{const [runs,status]=await Promise.all([this.api(token,prefix+'/check-runs?per_page=100'),this.api(token,prefix+'/status?per_page=100')]);const items=[...(runs.check_runs||[]).map((r:any)=>({name:r.name,state:r.status==='completed'?r.conclusion||'unknown':'pending',url:r.html_url})),...(status.statuses||[]).map((r:any)=>({name:r.context,state:r.state,url:r.target_url}))];
   const failed=items.some(i=>['failure','error','cancelled','timed_out','action_required','startup_failure','stale'].includes(i.state)),pending=items.some(i=>!['success','neutral','skipped'].includes(i.state));return {state:!items.length?'not_run':failed?'failed':pending?'pending':items.every(i=>i.state==='success')?'passed':'unavailable',items};
  }catch{return {state:'unavailable',items:[]};}
 }
}
