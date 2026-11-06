import {defaultWorkflowName} from '../prototype/engine';
import {useRef,useState} from 'react';
import {accountAPI,AccountError,signIn,startUpgrade} from './accountClient';
import type {Bridge} from './bridge';
import type {SavedRecord,Snapshot,Workflow} from '../shared/model';
const gates=new Set(['DEPTH_LIMIT_REACHED','VERSION_LIMIT_REACHED','WORKFLOW_LIMIT_REACHED','PRO_REQUIRED']);
export function SaveFlow({snapshot,bridge,onClose}:{snapshot:Snapshot;bridge:Bridge;onClose:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[code,setCode]=useState(''),[notice,setNotice]=useState('');
 const [name,setName]=useState(snapshot.workflow.name==='Untitled workflow'?defaultWorkflowName(new URL(snapshot.workflow.origin+snapshot.workflow.route),snapshot.workflow.createdAt,snapshot.workflow.id):snapshot.workflow.name);
 const [conflict,setConflict]=useState(false);
 const attempt=useRef<{fingerprint:string;requestId:string;workflow:Workflow;revision:number|null}|null>(null);
 async function run(action:()=>Promise<void>){setBusy(true);setError('');setCode('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Please retry.');setCode(e instanceof AccountError?e.code:'ERROR');}finally{setBusy(false);}}
 async function namedSnapshot(){
  const text=name.trim();if(!text)throw new Error('Give your flow a name before saving or sharing.');
  const latest=await bridge.send({type:'snapshot'});
  if(latest.workflow.id!==snapshot.workflow.id)throw new Error('The active workflow changed. Close this dialog and save the current flow.');
  return latest.workflow.name===text?latest:bridge.send({type:'rename',text});
 }
 async function save(copy=false){
  // A conflict copy has a new id and its own name; it is saved as it is.
  const latest=copy?await bridge.send({type:'snapshot'}):await namedSnapshot(),me=await accountAPI('/me');
  const key=`wandelRevision:${me.user.id}:${latest.workflow.id}`,known=(await chrome.storage.local.get(key))[key]??null;
  const fingerprint=JSON.stringify({workflow:latest.workflow,userId:me.user.id});
  if(attempt.current?.fingerprint!==fingerprint)attempt.current={fingerprint,requestId:crypto.randomUUID(),workflow:structuredClone(latest.workflow),revision:known};
  const a=attempt.current!;
  let result;try{result=await accountAPI<{record:SavedRecord;revision:number;savedRevision:number}>('/workflows','POST',{workflow:a.workflow,revision:a.revision,requestId:a.requestId});}
  catch(e){if(e instanceof AccountError&&e.code==='REVISION_CONFLICT'){attempt.current=null;setConflict(true);throw new AccountError('REVISION_CONFLICT','Your account has a different version of this flow, saved from another device or session. Choose which to keep.');}throw e;}
  // A retry response may include newer work from another device. Do not acknowledge it as this draft.
  await chrome.storage.local.set({[key]:result.savedRevision});
  if(result.revision!==result.savedRevision)throw new AccountError('REVISION_CONFLICT','Your save succeeded, but another device has since saved a newer version. Open it from Account saves.');
  await bridge.send({type:'acknowledgeSave',record:result.record,expected:a.workflow});attempt.current=null;
  window.dispatchEvent(new Event('wandel-account-refresh'));
  setNotice(`Saved to your account as v${result.record.currentVersion}. Available wherever you sign in to the same Wandel server.`);
 }
 // Conflict choices: this draft replaces the account copy, becomes a new flow, or gives way to the account copy.
 async function replaceAccountCopy(){const latest=await namedSnapshot(),me=await accountAPI('/me'),server=await accountAPI<{revision:number}>('/workflows/'+encodeURIComponent(latest.workflow.id));await chrome.storage.local.set({[`wandelRevision:${me.user.id}:${latest.workflow.id}`]:server.revision});setConflict(false);await save();}
 async function saveAsNew(){const copy=await bridge.send({type:'duplicate'});setConflict(false);setName(copy.workflow.name);await save(true);}
 function openAccountCopy(){setConflict(false);onClose();window.dispatchEvent(new Event('wandel-account-open'));}
 return <section className="dx-save-dialog" role="dialog" aria-label="Save workflow"><div className="dx-section-title">SAVE YOUR WORKFLOW <button className="dx-small" disabled={busy} onClick={onClose}>Close</button></div>
 <label className="dx-save-name">Flow name<input aria-label="Save workflow name" autoFocus value={name} maxLength={300} disabled={busy} onChange={e=>{setName(e.target.value);setNotice('');}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/></label><p>{snapshot.workflow.states.length} screens / states · {snapshot.workflow.edges.length} connections. Name saved with your workflow.</p>
 {error&&<p role="alert" className="dx-alert error">{error}</p>}{conflict&&<div className="dx-conflict" role="group" aria-label="Resolve save conflict"><button className="dx-primary" disabled={busy} onClick={()=>void run(replaceAccountCopy)}>Replace account copy with this one</button><button className="dx-secondary" disabled={busy} onClick={()=>void run(saveAsNew)}>Save this as a new flow</button><button className="dx-secondary" disabled={busy} onClick={openAccountCopy}>Open the account copy instead</button></div>}{notice&&<p role="status" className="dx-alert">{notice}</p>}
 <button className="dx-primary" disabled={busy} onClick={()=>void run(save)}>{busy?'Working…':'Save to my account'}</button><p className="dx-muted">Persistent, versioned, and available across browsers connected to your account.</p>
 {(code==='AUTH_REQUIRED'||code==='AUTH_NOT_CONFIGURED')&&<button className="dx-secondary" disabled={busy} onClick={()=>void run(async()=>{await signIn();setNotice('Finish signing in, return to this app tab, then click Save to my account. Your draft stays here.');})}>Sign in with Clerk / Google ↗</button>}
 {gates.has(code)&&<button className="dx-primary" disabled={busy} onClick={()=>void run(async()=>{await startUpgrade();setNotice('Stripe test checkout opened. Return to this app tab after payment, then save again. Canceled checkout leaves your draft unchanged.');})}>Upgrade with Stripe test checkout ↗</button>}
 <hr/><button className="dx-secondary" disabled={busy} onClick={()=>void run(async()=>{await namedSnapshot();await bridge.send({type:'saveTemporary'});setNotice('Saved on this computer as a version. It stays after Chrome restarts, but is not in your account or on other devices.');})}>Save on this computer · Free</button>
 <p className="dx-muted">Kept in this Chrome profile, including after restarts. Not synced to your account. No sign-in required.</p>
 <button className="dx-small" disabled={busy} onClick={onClose}>Keep editing</button></section>;
}
