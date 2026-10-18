import {stateURL} from '../shared/liveNavigation';
import {useEffect,useState} from 'react';
import {accountAPI,signIn,AccountError} from './accountClient';
import type {Bridge} from './bridge';
import {RecordSchema,type SavedRecord,type Snapshot} from '../shared/model';
type Item={id:string;name:string;origin:string;route:string;version:number;revision:number};
export type AuthStatus='checking'|'guest'|'signed-in'|'unavailable';
export function Account({bridge,snapshot,onAuthChange}:{bridge:Bridge;snapshot:Snapshot|null;onAuthChange?:(status:AuthStatus)=>void}){
 const [code,setCode]=useState('');
 const [legacy,setLegacy]=useState<SavedRecord[]>([]);
 useEffect(()=>{void chrome.storage.local.get(null).then(values=>setLegacy(Object.entries(values).filter(([key])=>key.startsWith('dx:workflow:')).flatMap(([,value])=>{const parsed=RecordSchema.safeParse(value);return parsed.success?[parsed.data]:[];})));},[]);
 const [open,setOpen]=useState(false),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[me,setMe]=useState<any>(null),[items,setItems]=useState<Item[]>([]),[confirm,setConfirm]=useState<(Item&{view?:boolean})|null>(null);
 const [checking,setChecking]=useState(true),[remaining,setRemaining]=useState(2);
 useEffect(()=>{
  let active=true;
  const update=async()=>{setStatus('');try{const result=await accountAPI('/me');if(active){setMe(result);onAuthChange?.('signed-in');}}catch(e){if(active){setMe(null);onAuthChange?.(e instanceof AccountError&&['AUTH_REQUIRED','AUTH_NOT_CONFIGURED'].includes(e.code)?'guest':'unavailable');}}finally{if(active)setChecking(false);}const data=await chrome.storage.local.get('wandelGuestRemaining');if(active)setRemaining(typeof data.wandelGuestRemaining==='number'?data.wandelGuestRemaining:2);};
  const accountChanged=(message:{type?:string})=>{if(message.type==='WANDEL_ACCOUNT_CHANGED')void update();};
  chrome.runtime?.onMessage?.addListener(accountChanged);
  void update();window.addEventListener('focus',update);window.addEventListener('wandel-account-refresh',update);
  return()=>{active=false;chrome.runtime?.onMessage?.removeListener(accountChanged);window.removeEventListener('focus',update);window.removeEventListener('wandel-account-refresh',update);};
 },[onAuthChange]);
 async function run(action:()=>Promise<void>){setBusy(true);setStatus('');try{await action();}catch(e){setStatus(e instanceof Error?e.message:'Please retry.');}finally{setBusy(false);}}
 async function refresh(){try{setMe(await accountAPI('/me'));onAuthChange?.('signed-in');setItems((await accountAPI('/workflows')).workflows);}catch(e){if(e instanceof AccountError&&e.code==='AUTH_REQUIRED'){setMe(null);onAuthChange?.('guest');}throw e;}}
 async function view(item:Item,discardConfirmed=false){
  if(!snapshot)throw new Error('Open Wandel on an app page first.');
  const expectedWorkflowId=snapshot.workflow.id,result=await accountAPI<{record:SavedRecord;revision:number}>('/workflows/'+encodeURIComponent(item.id));
  const reply=await chrome.runtime.sendMessage({type:'WANDEL_VIEW_WORKFLOW',record:result.record,expectedWorkflowId,expectedURL:stateURL(snapshot.workflow,snapshot.stateId),discardConfirmed});if(!reply?.ok)throw new Error(reply?.error||'Reload the updated Wandel extension and refresh this page, then retry View flow.');
  await chrome.storage.session.set({[`wandelRevision:${me.user.id}:${item.id}`]:result.revision});setConfirm(null);setOpen(false);setStatus('Saved flow selected. Playback uses its starting page.');
 }
 async function load(item:Item){const result=await accountAPI<{record:SavedRecord;revision:number}>('/workflows/'+encodeURIComponent(item.id));await bridge.send({type:'loadRecord',record:result.record});await chrome.storage.session.set({[`wandelRevision:${me.user.id}:${item.id}`]:result.revision});setConfirm(null);setStatus(`Opened ${item.name} · v${item.version}`);}
 return <div className="dx-account"><div className="dx-profile"><span className="dx-avatar" aria-hidden="true">{me?(me.user.name||me.user.email).slice(0,1).toUpperCase():'○'}</span><div role="status"><strong>{checking?'Checking account…':me?(me.user.name||me.user.email):'Guest'}</strong><small>{me?(me.entitlements.access&&me.entitlements.access.source!=='subscription'?'PRO · Beta access':me.entitlements.plan):`${remaining} free AI previews left · no account needed`}</small></div>{!me&&<button className="dx-primary" onClick={()=>void run(signIn)} disabled={busy}>Sign in</button>}</div>{status&&<p role="status" className="dx-alert">{status}</p>}<button className="dx-small" aria-expanded={open} onClick={()=>{setOpen(!open);if(!open)void run(refresh);}}>Account & saved workflows {open?'▴':'▾'}</button>{open&&<section>

 {!me?<><p>Sign in with Clerk, including Google, to save to your account.</p><button className="dx-primary" disabled={busy} onClick={()=>void run(signIn)}>Sign in / Continue with Google ↗</button><button className="dx-small" disabled={busy} onClick={()=>void run(refresh)}>I’ve signed in · Refresh</button></>:<>
 <strong>{me.user.email} · {me.entitlements.plan}</strong>{me.entitlements.access&&me.entitlements.access.source!=='subscription'&&<p className="dx-muted">Beta access · no subscription or payment{me.entitlements.access.expiresAt?` · until ${new Date(me.entitlements.access.expiresAt).toLocaleDateString()}`:' · no expiry'}. AI usage remains capped.</p>}<p className="dx-muted">Build freely. Plan limits are checked when saving to your account.</p>
 <button className="dx-small" disabled={busy} onClick={()=>void run(refresh)}>Refresh account saves</button>{me.entitlements.access?.source==='subscription'&&<button className="dx-small" disabled={busy} onClick={()=>void run(async()=>{const {url}=await accountAPI('/billing/portal','POST',{});const target=new URL(url);if(target.protocol!=='https:'||target.hostname!=='billing.stripe.com')throw new Error('Stripe portal unavailable.');await chrome.tabs.create({url});})}>Manage subscription ↗</button>}
 <form onSubmit={e=>{e.preventDefault();void run(async()=>{await accountAPI('/account/redeem','POST',{code});await refresh();window.dispatchEvent(new Event('wandel-account-refresh'));setCode('');setStatus('Beta access activated. Save your workflow again.');});}}><label className="dx-muted">Beta access code<input aria-label="Beta access code" maxLength={80} autoComplete="off" spellCheck={false} value={code} onChange={e=>setCode(e.target.value)}/></label><button className="dx-small" disabled={busy||!code.trim()}>Redeem code</button></form>
 {items.length===0&&<p>No account saves yet.</p>}{items.map(item=><div key={item.id} className="dx-version-row"><div><strong>{item.name} · v{item.version}</strong><small>{item.origin}{item.route}</small></div><button className="dx-small" disabled={busy||!snapshot} onClick={()=>{if(snapshot?.dirty)setConfirm({...item,view:true});else void run(()=>view(item));}}>View flow</button><button className="dx-small" title="Edit on the matching app page" disabled={busy||item.origin!==snapshot?.workflow.origin||item.route!==snapshot?.workflow.route} onClick={()=>{if(snapshot?.dirty)setConfirm(item);else void run(()=>load(item));}}>Edit</button></div>)}
 <p className="dx-muted">View flow opens its starting page and starts interactive playback using your app login. You may need to reopen the matching dialog. Edit is available on the matching page.</p>
 {confirm&&<p className="dx-alert">Replace the current unsaved draft with “{confirm.name}”? <button className="dx-small" onClick={()=>void run(()=>confirm.view?view(confirm,true):load(confirm))}>Replace draft</button><button className="dx-small" onClick={()=>setConfirm(null)}>Keep editing</button></p>}
 <button className="dx-small" disabled={busy} onClick={()=>void run(async()=>{const result=await chrome.runtime.sendMessage({type:'WANDEL_ACCOUNT_TOKEN',signOut:true});if(result.error)throw new Error(result.error);setMe(null);onAuthChange?.('guest');setItems([]);})}>Sign out</button></>}
 {legacy.length>0&&<details><summary>Previous local saves</summary><p className="dx-muted">These older persistent saves are still on this computer. Open one, then save to your account to sync it.</p>{legacy.map(record=><button key={record.draft.id} className="dx-library" disabled={busy||snapshot?.dirty||record.draft.origin!==snapshot?.workflow.origin||record.draft.route!==snapshot?.workflow.route} onClick={()=>void run(async()=>{await bridge.send({type:'loadRecord',record});setStatus('Opened previous local save. Use Save to my account to sync it.');})}>{record.draft.name}</button>)}</details>}
 </section>}</div>;
}
