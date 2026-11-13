import {useEffect,useRef,useState} from 'react';
import {CODEBASE_PROMPT,type AppDocs} from './docs';
import {docsKey,readDocs,removeDoc,saveDoc} from './store';
const words=(text:string)=>(text.match(/\S+/g)||[]).length;
/** Codebase context: a prompt for the user's coding AI, and the Markdown files it wrote, kept per app. */
export function AppDocsSection({origin}:{origin:string}){
 const [docs,setDocs]=useState<AppDocs|null>(null),[pasting,setPasting]=useState(false),[paste,setPaste]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const input=useRef<HTMLInputElement>(null);
 const available=typeof chrome!=='undefined'&&!!chrome.storage?.local&&!!chrome.storage.onChanged;
 useEffect(()=>{
  if(!available)return;
  let live=true;const load=()=>{void readDocs(origin).then(d=>{if(live)setDocs(d);}).catch(()=>{});};
  load();const changed=(changes:Record<string,unknown>,area:string)=>{if(area==='local'&&docsKey(origin) in changes)load();};
  chrome.storage.onChanged.addListener(changed);return ()=>{live=false;chrome.storage.onChanged.removeListener(changed);};
 },[origin,available]);
 if(!available||!docs||!/^https?:/.test(origin))return null;
 const host=new URL(origin).host,files=docs.files;
 async function add(list:{name:string;text:string}[]){
  setBusy(true);setMessage('');setError('');let removed=0,added=0;
  try{for(const item of list){const result=await saveDoc(origin,item.name,item.text);removed+=result.removed;added++;}}
  catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
  if(added)setMessage((added===1?'Added 1 file.':`Added ${added} files.`)+(removed?` Removed ${removed} thing${removed===1?'':'s'} that looked like keys, passwords or emails.`:''));
 }
 async function upload(list:FileList|null){
  if(!list?.length)return;
  const picked=[...list].filter(file=>/\.(md|markdown|mdx|txt)$/i.test(file.name));
  if(picked.length)await add(await Promise.all(picked.map(async file=>({name:file.name,text:await file.text()}))));
  if(picked.length<list.length)setError('Only Markdown or text files (.md, .txt) can be added.');
 }
 async function copyPrompt(){
  try{await navigator.clipboard.writeText(CODEBASE_PROMPT);setError('');setMessage('Prompt copied. Run it in Claude Code, Cursor or your coding AI inside your repository, then add the wandel-context.md it writes.');}
  catch{setError('Couldn’t copy. Open “See the prompt” and copy it from there.');}
 }
 return <details className="dx-app-map dx-app-docs">
  <summary>Codebase context{files.length?` · ${files.length} file${files.length===1?'':'s'}`:''}</summary>
  <p>Give Wandel your app’s routes, API, data model, components and rules, written by your own coding AI from your code. Wandel keeps them for {host} in this browser and sends only the parts related to each request.</p>
  <div className="dx-row"><button className="dx-small" onClick={()=>void copyPrompt()}>Copy prompt for your coding AI</button>
   <button className="dx-small" disabled={busy} onClick={()=>input.current?.click()}>Add files</button>
   <button className="dx-small" disabled={busy} onClick={()=>setPasting(!pasting)}>{pasting?'Cancel paste':'Paste instead'}</button></div>
  <input ref={input} type="file" hidden multiple accept=".md,.markdown,.mdx,.txt,text/markdown,text/plain" onChange={e=>{const list=e.target.files;void upload(list).finally(()=>{if(input.current)input.current.value='';});}}/>
  <details className="dx-app-docs-prompt"><summary>See the prompt</summary><pre>{CODEBASE_PROMPT}</pre></details>
  {pasting&&<div className="dx-app-map-block"><textarea rows={6} aria-label="Codebase context text" value={paste} placeholder="Paste the Markdown your coding AI wrote" onChange={e=>setPaste(e.target.value)}/>
   <div className="dx-row"><button className="dx-small" disabled={busy||!paste.trim()} onClick={()=>void add([{name:'pasted.md',text:paste}]).then(()=>{setPaste('');setPasting(false);})}>Save</button></div></div>}
  {message&&<p role="status">{message}</p>}
  {error&&<p className="dx-error" role="alert">{error}</p>}
  {files.length>0&&<ul className="dx-app-map-list">{files.map(file=><li key={file.name}>
   <strong>{file.name}</strong><small> · {words(file.text).toLocaleString()} words</small>
   <button className="dx-small" aria-label={'Remove '+file.name} onClick={()=>{if(confirm(`Remove ${file.name} from Wandel’s context for ${host}?`))void removeDoc(origin,file.name);}}>Remove</button>
  </li>)}</ul>}
 </details>;
}
