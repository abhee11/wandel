import {useEffect,useState} from 'react';
import {signIn} from '../sidepanel/accountClient';
import {uploadRecording,sharedRecordings,revokeRecording} from './client';
import type {SharedRecording} from '../shared/recording';
import type {SharingProps} from './Recorder';
export function HostedSharing({blob,name,recording,onBusy}:SharingProps){
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[confirmed,setConfirmed]=useState(false);
 const [shares,setShares]=useState<SharedRecording[]>([]),[listed,setListed]=useState(false);
 useEffect(()=>setConfirmed(false),[blob]);
 async function run(action:()=>Promise<void>){setBusy(true);onBusy(true);setError('');setNotice('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Please retry.');}finally{setBusy(false);onBusy(false);}}
 async function refresh(){const data=await sharedRecordings();setShares(data.recordings);setListed(true);}
 async function copy(url:string){try{await navigator.clipboard.writeText(url);setNotice('Video link copied.');}catch{setNotice('Select and copy the link below.');}}
 return <section><h2>Share a viewing link</h2><p>Sign in to Wandel in this Chrome profile to upload. Anyone with the link can watch without Wandel or app access. Links expire after 7 days; up to 5 shared videos per account.</p>
 {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
 {blob&&<><label className="consent"><input type="checkbox" checked={confirmed} disabled={busy||recording} onChange={e=>setConfirmed(e.target.checked)}/>I reviewed the video and want to upload its visible content for anyone with the link.</label><button className="primary" disabled={busy||recording||!confirmed||!name.trim()} onClick={()=>void run(async()=>{const video=await uploadRecording(blob,name.trim());setShares(previous=>[video,...previous.filter(v=>v.id!==video.id)]);setNotice('Uploaded. Copy the link below to share.');setConfirmed(false);})}>{busy?'Working…':'Upload & create link'}</button></>}
 <div className="actions"><button disabled={busy||recording} onClick={()=>void run(async()=>{await signIn();setNotice('Finish signing in, return here, then upload. Your video stays in this tab.');})}>Sign in to Wandel</button><button disabled={busy||recording} onClick={()=>void run(refresh)}>My shared videos</button></div>
 {listed&&!shares.length&&<p>No active shared videos.</p>}{shares.map(video=><article key={video.id}><strong>{video.name}</strong><small>Expires {new Date(video.expiresAt).toLocaleString()}</small><input aria-label={'Share link for '+video.name} readOnly value={video.url} onFocus={e=>e.currentTarget.select()}/><div className="actions"><button onClick={()=>void copy(video.url)}>Copy link</button><a href={video.url} target="_blank" rel="noreferrer">Open playback</a><button disabled={busy||recording} onClick={()=>{if(confirm('Revoke this link? It will stop working for everyone.'))void run(async()=>{await revokeRecording(video.id);setShares(items=>items.filter(item=>item.id!==video.id));setNotice('Link revoked.');});}}>Revoke link</button></div></article>)}
 </section>;
}
