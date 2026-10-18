import {useEffect,useRef,useState,type ReactNode} from 'react';
import {WalkthroughCapture} from './capture';
export type SharingProps={blob:Blob|null;name:string;recording:boolean;onBusy:(busy:boolean)=>void};
export function Recorder({sharing}:{sharing?:(props:SharingProps)=>ReactNode}){
 const [name,setName]=useState(new URLSearchParams(location.search).get('name')?.slice(0,300)||'Wandel walkthrough');
 const [phase,setPhase]=useState<'idle'|'choosing'|'recording'|'ready'>('idle'),[paused,setPaused]=useState(false),[elapsed,setElapsed]=useState(0);
 const [blob,setBlob]=useState<Blob|null>(null),[url,setURL]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const capture=useRef<WalkthroughCapture|null>(null);
 useEffect(()=>{const active=new WalkthroughCapture((video,error)=>{setBlob(video);setError(error);setPhase(video?'ready':'idle');setPaused(false);},setPaused);capture.current=active;return()=>active.dispose();},[]);
 useEffect(()=>{if(!blob){setURL('');return;}const url=URL.createObjectURL(blob);setURL(url);return()=>URL.revokeObjectURL(url);},[blob]);
 useEffect(()=>{if(phase!=='recording')return;const started=Date.now();setElapsed(0);const timer=setInterval(()=>setElapsed(Math.floor((Date.now()-started)/1000)),1000);return()=>clearInterval(timer);},[phase]);
 useEffect(()=>{const guard=(e:BeforeUnloadEvent)=>{if(['recording','choosing'].includes(phase)||busy||blob){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[phase,busy,blob]);
 async function start(){setError('');setPhase('choosing');try{await capture.current!.start();setBlob(null);setPhase('recording');}catch(e){setPhase(blob?'ready':'idle');setError(e instanceof DOMException&&e.name==='NotAllowedError'?'Capture was canceled. Choose your app tab when ready.':e instanceof Error?e.message:'Recording could not start.');}}
 async function returnToApp(){const tabId=Number(new URLSearchParams(location.search).get('tabId'));if(tabId>0){try{const tab=await chrome.tabs.update(tabId,{active:true});await chrome.windows.update(tab.windowId,{focused:true});return;}catch{}}setError('Return to your app tab manually. Keep this recorder tab open.');}
 const active=phase==='recording',selecting=phase==='choosing';
 return <main><header><img src="brand/wandel-mark.svg" alt=""/><strong>Wandel</strong><span>Walkthrough studio</span></header><h1>Show the journey.</h1><p>Record your app as you click through a flow. Keep this tab open while recording, then preview and download your video.</p>
 <label className="name">Video name<input aria-label="Video name" value={name} maxLength={300} disabled={active||selecting||busy} onChange={e=>setName(e.target.value)}/></label>
 {error&&<p className="error" role="alert">{error}</p>}
 <section className="studio">{active?<><div className="recording"><span/>{paused?'Paused':'Recording'} · {Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,'0')}</div><p>Click through your flow on the app tab. Return here to stop, or use Chrome’s Stop sharing control.</p><div className="actions"><button onClick={()=>paused?capture.current?.resume():capture.current?.pause()}>{paused?'Resume':'Pause'}</button><button className="primary" onClick={()=>capture.current?.stop()}>Stop recording</button><button onClick={()=>void returnToApp()}>Return to app</button></div></>:<><p>Choose the application’s Chrome tab in the browser picker. Video only · no microphone or tab audio · up to 3 minutes / 20 MB.</p><button className="primary" disabled={selecting||busy||!name.trim()} onClick={()=>{if(!blob||confirm('Replace this local recording? Download it first if you want to keep it.'))void start();}}>{selecting?'Choose your app tab…':blob?'Record again':'Record walkthrough'}</button></>}
 {url&&<><video aria-label="Walkthrough preview" src={url} controls playsInline/><div className="actions"><a className="button" href={url} download={(name.replace(/[^a-z0-9 -]/gi,'').slice(0,100)||'Wandel walkthrough')+'.webm'}>Download WebM</a><button disabled={busy||selecting||active} onClick={()=>{if(confirm('Discard the local video?')){setBlob(null);setPhase('idle');}}}>Discard local video</button></div></>}
 </section>
 {sharing?.({blob,name,recording:active||selecting,onBusy:setBusy})}
 <footer>The video records the path you demonstrate. Export your workflow separately to share its editable branches. Download your video before closing this tab; local recordings are not retained after closing it.</footer></main>;
}
