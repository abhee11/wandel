import {openRecorder} from '../recording/launch';
import {useState} from 'react';
import {RecordSchema,type Snapshot,type SavedRecord} from '../shared/model';
import {validateWorkflow} from '../prototype/engine';
import type {Bridge} from './bridge';
export function parseSharedWorkflow(text:string,origin:string,route:string):SavedRecord{
 if(text.length>5*1024*1024)throw new Error('Workflow files must be under 5 MB.');
 const record=RecordSchema.parse(JSON.parse(text));
 for(const workflow of [record.draft,...record.versions.map(v=>v.workflow)]){
  validateWorkflow(workflow);
  if(workflow.states.some(s=>s.operations.some(op=>op.kind==='mirror')))throw new Error('Shared previews cannot contain actions that operate the real application.');
 }
 if(record.draft.origin!==origin||record.draft.route!==route)throw new Error(`Open ${record.draft.origin}${record.draft.route} and its matching dialog before importing.`);
 return record;
}
export function WorkflowShare({snapshot:s,bridge,expanded=false,prepare,disabled=false,onPreview}:{snapshot:Snapshot;bridge:Bridge;expanded?:boolean;disabled?:boolean;prepare?:()=>Promise<Snapshot>;onPreview?:()=>void}){
 const [message,setMessage]=useState(''),[pending,setPending]=useState<SavedRecord|null>(null),[playing,setPlaying]=useState(false);
 async function exportFile(){try{
  const latest=prepare?await prepare():await bridge.send({type:'snapshot'});
  const workflow=latest.workflow;
  const record={draft:workflow,enabled:true,currentVersion:0,versions:[]};parseSharedWorkflow(JSON.stringify(record),workflow.origin,workflow.route);
  const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=(workflow.name.replace(/[^a-z0-9 -]/gi,'').slice(0,80)||'Wandel workflow')+'.wandel.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('Send this file to your tester. They need Wandel, access to this app, and the same page/dialog open.');
 }catch(e){setMessage(e instanceof Error?e.message:'Export failed.');}}
 async function load(record:SavedRecord){try{const next=await bridge.send({type:'loadRecord',record});setPending(null);setMessage(next.unresolved.length?'Imported, but targets are missing. Open the matching dialog, then reconnect Wandel.': 'Imported. Use Try flow, or interact with the local settings controls.');}catch(e){setMessage(e instanceof Error?e.message:'Import failed.');}}
 async function demo(){setPlaying(true);setMessage('Demonstrating local settings: Dark → Light → Resize → Reset.');try{await bridge.send({type:'settingsPlayback'});setMessage('Playback finished. Try the controls yourself.');}catch(e){setMessage(e instanceof Error?e.message:'Playback stopped.');}finally{setPlaying(false);}}
 const settings=s.workflow.states.some(state=>state.operations.some(op=>op.kind==='insert'&&op.node.widget));
 async function record(){setMessage('');try{const latest=prepare?await prepare():await bridge.send({type:'snapshot'});await openRecorder(latest);setMessage('Recorder opened. Choose your app tab, then click through the flow.');}catch(e){setMessage(e instanceof Error?e.message:'Recorder could not open.');}}
 async function preview(){setMessage('');try{if(prepare)await prepare();await bridge.send({type:'replay'});onPreview?.();setMessage('Preview started on the app page. Click your connected controls to follow the flow.');}catch(e){setMessage(e instanceof Error?e.message:'Preview could not start.');}}
 return <section className="dx-workflow-share"><details open={expanded||undefined}><summary>Share & playback</summary><p className="dx-muted">Share the prototype definition. The recipient uses their own access to the original app. The file includes page URLs, selectors and prototype content; review it before sharing.</p><p className="dx-muted">Interactive preview needs Wandel and access to the original application. Export includes connected screen thumbnails and URLs, generated UI, and connections. For a video anyone can watch, use Record walkthrough below.</p><div className="dx-row"><button className="dx-secondary" disabled={disabled} onClick={()=>void record()}>Record walkthrough</button><button className="dx-secondary" disabled={disabled||!s.enabled} onClick={()=>void preview()}>Try flow on app</button><button className="dx-secondary" disabled={disabled} onClick={()=>void exportFile()}>Export workflow</button><label className="dx-small">Import workflow<input disabled={disabled} aria-label="Import shared workflow" type="file" accept=".json,application/json" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;setMessage('');void (async()=>{try{if(file.size>5*1024*1024)throw new Error('Workflow files must be under 5 MB.');const record=parseSharedWorkflow(await file.text(),s.workflow.origin,s.workflow.route);setPending(record);}catch(error){setMessage(error instanceof Error?error.message:'Invalid workflow');}})();}}/></label></div>{pending&&<p>Open “{pending.draft.name}”? This replaces the current draft. <button onClick={()=>void load(pending)}>Open shared workflow</button> <button onClick={()=>setPending(null)}>Cancel</button></p>}{settings&&<button className="dx-secondary" disabled={playing} onClick={()=>void demo()}>{playing?'Playing settings demo…':'Play settings demo'}</button>}{message&&<p role="status">{message}</p>}</details></section>;
}
