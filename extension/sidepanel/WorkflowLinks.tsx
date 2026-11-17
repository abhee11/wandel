import {useEffect,useState} from 'react';
import {accountAPI} from './accountClient';
import {copyText} from './copyText';
import {shareRecord,type WorkflowLink} from '../shared/workflowLink';
import type {Snapshot} from '../shared/model';
import type {Bridge} from './bridge';
type PublicView={id:string;name:string;masked:boolean;url:string;expiresAt:string};
type SavedFlow={id:string;name:string;origin:string;route:string;version:number};
type Row={key:string;name:string;kind:string;url:string;expiresAt:string;remove:()=>Promise<void>};
/** "a, b and c" — or "a, b and 3 others" past three. */
export const listPeople=(names:string[])=>names.length<=1?names.join(''):names.length<=3?names.slice(0,-1).join(', ')+' and '+names[names.length-1]:names.slice(0,2).join(', ')+` and ${names.length-2} others`;
/** Screens and edits in a flow; a flow with no edits is just the page. */
export const flowSize=(workflow:Snapshot['workflow'])=>({screens:workflow.states.length,changes:workflow.states.reduce((sum,state)=>sum+state.operations.length,0)});
const EMPTY='This flow has no changes yet, so the link would show the plain page. Open a saved flow below, or make a change first.';
const when=(date:string)=>new Date(date).toLocaleDateString(undefined,{month:'short',day:'numeric'});
/** The two ways to share and every link made so far, in one place. */
export function WorkflowLinks({bridge,prepare,snapshot,disabled=false}:{bridge?:Bridge;prepare:()=>Promise<Snapshot>;snapshot?:Snapshot;disabled?:boolean}){
 const [mask,setMask]=useState(false);
 const [views,setViews]=useState<PublicView[]>([]),[links,setLinks]=useState<WorkflowLink[]>([]);
 const [latest,setLatest]=useState(''),[copied,setCopied]=useState(''),[busy,setBusy]=useState(''),[error,setError]=useState(''),[sent,setSent]=useState('');
 const [emails,setEmails]=useState(''),[note,setNote]=useState(''),[noting,setNoting]=useState(false);
 const [saved,setSaved]=useState<SavedFlow[]>([]);
 const flow=snapshot?.workflow,size=flow?flowSize(flow):null,empty=!!size&&size.changes===0;
 const people=emails.split(/[\s,;]+/).map(item=>item.trim()).filter(Boolean);
 useEffect(()=>{let active=true;
  void accountAPI<{links:WorkflowLink[]}>('/workflow-links').then(value=>{if(active)setLinks(value.links||[]);}).catch(()=>{/* signed out: nothing to list */});
  if(bridge){void accountAPI<{views:PublicView[]}>('/public-views').then(value=>{if(active)setViews(value.views||[]);}).catch(()=>{});
   void accountAPI<{workflows:SavedFlow[]}>('/workflows').then(value=>{if(active)setSaved(value.workflows||[]);}).catch(()=>{});}
  return()=>{active=false;};},[bridge]);
 async function run(name:string,task:()=>Promise<void>){setBusy(name);setError('');setSent('');try{await task();}catch(e){setError((e as Error).message);}finally{setBusy('');}}
 async function copy(url:string){const done=await copyText(url);if(done){setCopied(url);setTimeout(()=>setCopied(value=>value===url?'':value),1800);}else setError('Your browser blocked copying. Select the link and copy it.');}
 const made=(url:string)=>{setLatest(url);void copy(url);};
 async function share(){const latest=await prepare();if(latest?.workflow&&flowSize(latest.workflow).changes===0)throw new Error(EMPTY);const next=await bridge!.send({type:'publicSnapshot',mask});if(!next.publicSnapshot)throw new Error('This page could not be copied. Reload Wandel and try again.');await publish(next.publicSnapshot);}
 async function publish(copy:NonNullable<Snapshot['publicSnapshot']>){const {view}=await accountAPI<{view:PublicView}>('/public-views','POST',{workflow:copy.workflow,html:copy.html,masked:copy.masked},60000);setViews(items=>[view,...items.filter(item=>item.id!==view.id)]);made(view.url);
  if(people.length){const {sent:count}=await accountAPI<{sent:number}>('/public-views/'+encodeURIComponent(view.id)+'/send','POST',{emails:people,...(note.trim()?{note:note.trim()}:{})});const names=[...new Set(people.map(item=>item.toLowerCase()))];setSent(`Sent to ${count===names.length?listPeople(names):count+' people'}. The link is copied too.`);setEmails('');setNote('');setNoting(false);}}
 async function create(){const snapshot=await prepare(),record=shareRecord({...snapshot.workflow,...(snapshot.unresolved?.length?{shareBaseline:snapshot.unresolved.slice(0,300).map(issue=>issue.slice(0,400))}:{})});const result=await accountAPI<{link:WorkflowLink}>('/workflow-links','POST',{workflow:record.draft});setLinks(values=>[result.link,...values.filter(v=>v.id!==result.link.id)]);made(result.link.url);}
 const rows:Row[]=[
  ...views.map(view=>({key:'view:'+view.id,name:view.name,kind:view.masked?'Anyone · placeholders':'Anyone · real content',url:view.url,expiresAt:view.expiresAt,remove:async()=>{await accountAPI('/public-views/'+encodeURIComponent(view.id),'DELETE');setViews(items=>items.filter(item=>item.id!==view.id));}})),
  ...links.map(link=>({key:'link:'+link.id,name:link.name,kind:'Live app',url:link.url,expiresAt:link.expiresAt,remove:async()=>{await accountAPI('/workflow-links/'+encodeURIComponent(link.id),'DELETE');setLinks(items=>items.filter(item=>item.id!==link.id));}}))];
 return <div className="dx-share">
  {error&&<p role="alert" className="dx-alert error">{error}</p>}
  {bridge&&<section className="dx-share-card" aria-label="Share this prototype">
   <header><strong>Share this prototype</strong><span>No install</span></header>
   <p>They get a link to a copy of this page with your prototype on top. It opens in any browser and works for 30 days.</p>
   {flow&&size&&<p className={`dx-share-what${empty?' empty':''}`}>{empty?<>“{flow.name}” has <strong>no changes yet</strong>.</>:<>Sharing <strong>“{flow.name}”</strong> · {size.screens} screen{size.screens===1?'':'s'}, {size.changes} change{size.changes===1?'':'s'}</>}</p>}
    <label className="dx-share-emails"><span>Send to</span><input type="text" inputMode="email" autoComplete="off" placeholder="name@company.com, another@company.com" value={emails} disabled={!!busy} onChange={event=>setEmails(event.target.value)}/></label>
    {noting?<label className="dx-share-emails"><span>Note</span><textarea rows={2} maxLength={500} placeholder="What should they look at?" value={note} disabled={!!busy} onChange={event=>setNote(event.target.value)}/></label>
     :people.length>0&&<button className="dx-link-button" onClick={()=>setNoting(true)}>Add a note</button>}
    <label className="dx-share-switch"><input type="checkbox" checked={mask} disabled={!!busy} onChange={event=>setMask(event.target.checked)}/><span>Hide real text and images</span></label>
    <p className="dx-share-hint">{mask?'The page’s own words and images become placeholders. Your prototype’s changes stay as they are.':'They see the page as it is, with any names or data on it. Tick the box to hide them.'}</p>
    <button className="dx-primary" disabled={disabled||!!busy||empty} title={empty?EMPTY:undefined} onClick={()=>void run('share',share)}>{busy==='share'?(people.length?'Sending…':'Creating…'):people.length?`Share with ${people.length===1?'1 person':people.length+' people'}`:'Create link'}</button>
   {sent&&<div role="status" className="dx-share-sent"><span aria-hidden="true">✓</span><p>{sent}</p><button className="dx-small" onClick={()=>setSent('')}>Done</button></div>}
  </section>}
  {bridge&&flow&&(()=>{const others=saved.filter(item=>item.id!==flow.id);if(!others.length)return null;
   const here=(item:SavedFlow)=>item.origin===flow.origin&&item.route===flow.route;
   const sorted=[...others.filter(here),...others.filter(item=>!here(item))];
   const open=(item:SavedFlow)=>window.dispatchEvent(new CustomEvent('wandel-account-flow',{detail:{item,mode:'edit',stay:true}}));
   return <details className="dx-share-saved" open={empty}><summary>Open a saved flow to share</summary><ul>{sorted.map(item=><li key={item.id}><div><strong>{item.name}</strong><small>{here(item)?'On this page':'On '+new URL(item.origin).host+item.route}</small></div>{here(item)?<button className="dx-small" disabled={!!busy} onClick={()=>open(item)}>Open</button>:<small className="dx-share-go">Go to that page to open it</small>}</li>)}</ul></details>;})()}
  <details className="dx-share-more">
   <summary>On their own live app instead</summary>
   <section className="dx-share-card" aria-label="Link for the live app">
    <header><strong>On the live app</strong><span>Needs Wandel</span></header>
    <p>Your changes play on their own copy of the app, signed in as them, so they need Wandel and the same access as you.</p>
    <button className="dx-secondary" disabled={disabled||!!busy} onClick={()=>void run('create',create)}>{busy==='create'?'Creating…':'Create live-app link'}</button>
   </section>
  </details>
  {latest&&<div className="dx-share-latest"><input aria-label="Latest share link" readOnly value={latest} onFocus={event=>event.currentTarget.select()}/><button className="dx-primary" onClick={()=>void copy(latest)}>{copied===latest?'Copied':'Copy'}</button></div>}
  {rows.length>0&&<section aria-label="Your links"><h3 className="dx-share-title">Your links</h3>{rows.map(row=><div className="dx-share-row" key={row.key}><div><strong>{row.name}</strong><small>{row.kind} · until {when(row.expiresAt)}</small></div><button className="dx-small" onClick={()=>void copy(row.url)}>{copied===row.url?'Copied':'Copy'}</button><button className="dx-share-remove" aria-label={'Revoke '+row.name} title="Revoke" disabled={!!busy} onClick={()=>void run('remove',async()=>{await row.remove();setLatest(value=>value===row.url?'':value);})}>×</button></div>)}</section>}
 </div>;
}
