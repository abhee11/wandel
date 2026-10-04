import {useRef,useState} from 'react';
import {accountAPI,AccountError,signIn,startUpgrade} from './accountClient';
import type {Bridge} from './bridge';
import type {SavedRecord,Snapshot,Workflow} from '../shared/model';
const gates=new Set(['DEPTH_LIMIT_REACHED','VERSION_LIMIT_REACHED','WORKFLOW_LIMIT_REACHED','PRO_REQUIRED']);
export function SaveFlow({snapshot,bridge,onClose}:{snapshot:Snapshot;bridge:Bridge;onClose:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[code,setCode]=useState(''),[notice,setNotice]=useState('');
 const attempt=useRef<{fingerprint:string;requestId:string;workflow:Workflow;revision:number|null}|null>(null);
 async function run(action:()=>Promise<void>){setBusy(true);setError('');setCode('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Please retry.');setCode(e instanceof AccountError?e.code:'ERROR');}finally{setBusy(false);}}
 async function save(){
  const latest=await bridge.send({type:'snapshot'}),me=await accountAPI('/me');
  const key=`wandelRevision:${me.user.id}:${latest.workflow.id}`,known=(await chrome.storage.session.get(key))[key]??null;
  const fingerprint=JSON.stringify({workflow:latest.workflow,userId:me.user.id});
  if(attempt.current?.fingerprint!==fingerprint)attempt.current={fingerprint,requestId:crypto.randomUUID(),workflow:structuredClone(latest.workflow),revision:known};
  const a=attempt.current!;
  const result=await accountAPI<{record:SavedRecord;revision:number;savedRevision:number}>('/workflows','POST',{workflow:a.workflow,revision:a.revision,requestId:a.requestId});
  // A retry response may include newer work from another device. Do not acknowledge it as this draft.
  await chrome.storage.session.set({[key]:result.savedRevision});
  if(result.revision!==result.savedRevision)throw new AccountError('REVISION_CONFLICT','Your save succeeded, but another device has since saved a newer version. Open it from Account saves.');
  await bridge.send({type:'acknowledgeSave',record:result.record,expected:a.workflow});attempt.current=null;
  setNotice(`Saved to your account as v${result.record.currentVersion}. Available wherever you sign in to the same Wandel server.`);
 }
 return <section className="dx-save-dialog" role="dialog" aria-label="Save workflow"><div className="dx-section-title">SAVE YOUR WORKFLOW <button className="dx-small" disabled={busy} onClick={onClose}>Close</button></div>
 <h2>{snapshot.workflow.name}</h2><p>Your whole flow, including every state and interaction.</p>
 {error&&<p role="alert" className="dx-alert error">{error}</p>}{notice&&<p role="status" className="dx-alert">{notice}</p>}
 <button className="dx-primary" disabled={busy} onClick={()=>void run(save)}>{busy?'Working…':'Save to my account'}</button><p className="dx-muted">Persistent, versioned, and available across browsers connected to your account.</p>
 {(code==='AUTH_REQUIRED'||code==='AUTH_NOT_CONFIGURED')&&<button className="dx-secondary" disabled={busy} onClick={()=>void run(async()=>{await signIn();setNotice('Finish signing in, return to this app tab, then click Save to my account. Your draft stays here.');})}>Sign in with Clerk / Google ↗</button>}
 {gates.has(code)&&<button className="dx-primary" disabled={busy} onClick={()=>void run(async()=>{await startUpgrade();setNotice('Stripe test checkout opened. Return to this app tab after payment, then save again. Canceled checkout leaves your draft unchanged.');})}>Upgrade with Stripe test checkout ↗</button>}
 <hr/><button className="dx-secondary" disabled={busy} onClick={()=>void run(async()=>{await bridge.send({type:'saveTemporary'});setNotice('Saved temporarily in this browser session. It is not uploaded and will be cleared when Chrome exits or the extension reloads.');})}>Save temporarily · Free</button>
 <p className="dx-muted">Local to this browser session. Cleared when Chrome exits or Wandel is reloaded. No sign-in required.</p>
 <button className="dx-small" disabled={busy} onClick={onClose}>Keep editing</button></section>;
}
