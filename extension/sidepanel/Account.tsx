import {useEffect,useState} from 'react';
import {accountAPI,signIn,AccountError} from './accountClient';
import type {Bridge} from './bridge';
import {RecordSchema,type SavedRecord,type Snapshot} from '../shared/model';
type Item={id:string;name:string;origin:string;route:string;version:number;revision:number};
export function Account({bridge,snapshot}:{bridge:Bridge;snapshot:Snapshot|null}){
 const [legacy,setLegacy]=useState<SavedRecord[]>([]);
 useEffect(()=>{void chrome.storage.local.get(null).then(values=>setLegacy(Object.entries(values).filter(([key])=>key.startsWith('dx:workflow:')).flatMap(([,value])=>{const parsed=RecordSchema.safeParse(value);return parsed.success?[parsed.data]:[];})));},[]);
 const [open,setOpen]=useState(false),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[me,setMe]=useState<any>(null),[items,setItems]=useState<Item[]>([]),[confirm,setConfirm]=useState<Item|null>(null);
 async function run(action:()=>Promise<void>){setBusy(true);setStatus('');try{await action();}catch(e){setStatus(e instanceof Error?e.message:'Please retry.');}finally{setBusy(false);}}
 async function refresh(){try{setMe(await accountAPI('/me'));setItems((await accountAPI('/workflows')).workflows);}catch(e){if(e instanceof AccountError&&e.code==='AUTH_REQUIRED')setMe(null);throw e;}}
 async function load(item:Item){const result=await accountAPI<{record:SavedRecord;revision:number}>('/workflows/'+encodeURIComponent(item.id));await bridge.send({type:'loadRecord',record:result.record});await chrome.storage.session.set({[`wandelRevision:${me.user.id}:${item.id}`]:result.revision});setConfirm(null);setStatus(`Opened ${item.name} · v${item.version}`);}
 return <div className="dx-account"><button className="dx-small" aria-expanded={open} onClick={()=>{setOpen(!open);if(!open)void run(refresh);}}>Account & saved workflows {open?'▴':'▾'}</button>{open&&<section>
 {status&&<p role="status" className="dx-alert">{status}</p>}
 {!me?<><p>Sign in with Clerk, including Google, to save to your account.</p><button className="dx-primary" disabled={busy} onClick={()=>void run(signIn)}>Sign in / Continue with Google ↗</button><button className="dx-small" disabled={busy} onClick={()=>void run(refresh)}>I’ve signed in · Refresh</button></>:<>
 <strong>{me.user.email} · {me.entitlements.plan}</strong><p className="dx-muted">Build freely. Plan limits are checked when saving to your account.</p>
 <button className="dx-small" disabled={busy} onClick={()=>void run(refresh)}>Refresh account saves</button>{me.entitlements.plan==='PRO'&&<button className="dx-small" disabled={busy} onClick={()=>void run(async()=>{const {url}=await accountAPI('/billing/portal','POST',{});const target=new URL(url);if(target.protocol!=='https:'||target.hostname!=='billing.stripe.com')throw new Error('Stripe portal unavailable.');await chrome.tabs.create({url});})}>Manage subscription ↗</button>}
 {items.length===0&&<p>No account saves yet.</p>}{items.map(item=><div key={item.id} className="dx-version-row"><div><strong>{item.name} · v{item.version}</strong><small>{item.origin}{item.route}</small></div><button className="dx-small" disabled={busy||item.origin!==snapshot?.workflow.origin||item.route!==snapshot?.workflow.route} onClick={()=>{if(snapshot?.dirty)setConfirm(item);else void run(()=>load(item));}}>Open</button></div>)}
 <p className="dx-muted">Open the matching app page to replay its saved workflow.</p>
 {confirm&&<p className="dx-alert">Replace the current unsaved draft with “{confirm.name}”? <button className="dx-small" onClick={()=>void run(()=>load(confirm))}>Replace draft</button><button className="dx-small" onClick={()=>setConfirm(null)}>Keep editing</button></p>}
 <button className="dx-small" disabled={busy} onClick={()=>void run(async()=>{const result=await chrome.runtime.sendMessage({type:'WANDEL_ACCOUNT_TOKEN',signOut:true});if(result.error)throw new Error(result.error);setMe(null);setItems([]);})}>Sign out</button></>}
 {legacy.length>0&&<details><summary>Previous local saves</summary><p className="dx-muted">These older persistent saves are still on this computer. Open one, then save to your account to sync it.</p>{legacy.map(record=><button key={record.draft.id} className="dx-library" disabled={busy||snapshot?.dirty||record.draft.origin!==snapshot?.workflow.origin||record.draft.route!==snapshot?.workflow.route} onClick={()=>void run(async()=>{await bridge.send({type:'loadRecord',record});setStatus('Opened previous local save. Use Save to my account to sync it.');})}>{record.draft.name}</button>)}</details>}
 </section>}</div>;
}
