import {useState,useRef} from 'react';
import {implementationPrompt,implementationBundle} from '../implementation/brief';
import type {Snapshot} from '../shared/model';
export function PromptExport({prepare,disabled=false}:{prepare:()=>Promise<Snapshot>;disabled?:boolean}){
 const [prompt,setPrompt]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');const preview=useRef<HTMLTextAreaElement>(null);
 async function run(action:'copy'|'preview'|'bundle'){
  setBusy(true);setMessage('');setError('');try{const {workflow}=await prepare(),text=implementationPrompt(workflow);setPrompt(text);
   if(action==='copy'){try{await navigator.clipboard.writeText(text);setMessage('Implementation prompt copied. Paste it into your coding agent with access to the application repository.');}catch{setMessage('Clipboard access is unavailable. Select the prompt below and copy it.');requestAnimationFrame(()=>preview.current?.select());}}
   if(action==='bundle'){const url=URL.createObjectURL(new Blob([JSON.stringify(implementationBundle(workflow),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=(workflow.name.replace(/[^a-z0-9 -]/gi,'').slice(0,70)||'Workflow')+'.implementation.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('Bundle downloaded with the prompt, structured changes, and available screen references. Review captured images before sharing.');}
  }catch(e){setError(e instanceof Error?e.message:'Could not export this flow.');}finally{setBusy(false);}
 }
 return <section aria-label="Implementation prompt"><h2>Build this flow</h2><p className="dx-muted">Turn this prototype into a brief for your coding agent. It includes screen changes, native styling references, connections, conditions, and acceptance checks.</p><div className="dx-row dx-button-group"><button className="dx-primary" disabled={disabled||busy} onClick={()=>void run('copy')}>Copy implementation prompt</button><button className="dx-secondary" disabled={disabled||busy} onClick={()=>void run('bundle')}>Download reference bundle</button><button className="dx-secondary" disabled={disabled||busy} onClick={()=>void run('preview')}>Review prompt</button></div>{prompt&&<details open><summary>Implementation brief</summary><textarea ref={preview} aria-label="Implementation prompt text" readOnly value={prompt} rows={10} onFocus={e=>e.currentTarget.select()}/></details>}{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}</section>;
}
