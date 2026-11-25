import {useEffect,useState} from 'react';
import {blankCopy} from './blank';
import {addComponent,addRule,chooseTeam,chosenTeam,enableKnowledge,forgetKnowledge,knowledgeStatus,readKnowledge,removeComponent,removeRule,storeLibrary,type KnowledgeTeam} from './store';
import {copiedElement} from '../content/tabClipboard';
type Known=Awaited<ReturnType<typeof readKnowledge>>;
/** App knowledge for this app: which team learns it, what it has learned, the team's rules and component library. */
export function KnowledgeSection({origin,pattern}:{origin:string;pattern:string}){
 const [teams,setTeams]=useState<KnowledgeTeam[]|null>(null),[team,setTeam]=useState<string|null>(null),[known,setKnown]=useState<Known|null>(null);
 const [rule,setRule]=useState(''),[name,setName]=useState(''),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[signedOut,setSignedOut]=useState(false);
 const run=async(work:()=>Promise<void>)=>{setBusy(true);setStatus('');try{await work();}catch(error){setStatus(error instanceof Error?error.message:'That didn’t work. Try again.');}finally{setBusy(false);}};
 const load=async(chosen=team)=>{
  const list=(await knowledgeStatus(origin)).teams;setTeams(list);
  const current=chosen&&list.find(t=>t.id===chosen)?chosen:null;
  if(!current){setKnown(null);return;}
  const t=list.find(x=>x.id===current)!;
  if(t.enabled){const k=await readKnowledge(current,origin);setKnown(k);await storeLibrary(origin,k.components);}else setKnown(null);
 };
 useEffect(()=>{if(!/^https?:/.test(origin))return;void (async()=>{const chosen=await chosenTeam(origin);setTeam(chosen);try{await load(chosen);}catch(error){if(error instanceof Error&&/sign in/i.test(error.message))setSignedOut(true);}})();},[origin]);
 if(!/^https?:/.test(origin))return null;
 const host=new URL(origin).host,current=teams?.find(t=>t.id===team);
 return <details className="dx-project-brief dx-knowledge"><summary>App knowledge {current?.enabled?<small>· learning for {current.name}</small>:<small>· off</small>}</summary>
  <p className="dx-muted">Wandel can remember {host}’s screens, design and components for your team, so every request starts knowing the app. It stores layout, design and button labels only: no names, numbers or other content.</p>
  {status&&<p role="alert" className="dx-alert">{status}</p>}
  {signedOut?<p className="dx-muted">Sign in under Account to use App knowledge.</p>:!teams?<p className="dx-muted">Checking…</p>:!teams.length?<p className="dx-muted">Create a team under Account first, then come back here.</p>:<>
   <label className="dx-muted">Team for this app<select aria-label="Team for this app" value={team||''} disabled={busy} onChange={e=>void run(async()=>{const id=e.target.value||null;await chooseTeam(origin,id);setTeam(id);await load(id);})}>
    <option value="">None (don’t use App knowledge here)</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}{t.enabled?' · learning':''}</option>)}</select></label>
   {current&&!current.enabled&&(current.role==='owner'?<button className="dx-primary" disabled={busy} onClick={()=>void run(async()=>{await enableKnowledge(current.id,origin);await load(current.id);setStatus(`Wandel now learns ${host} for ${current.name}.`);})}>Let Wandel learn {host} for {current.name}</button>:<p className="dx-muted">Ask an owner of {current.name} to switch this on.</p>)}
   {current?.enabled&&known&&<>
    <p className="dx-muted">{known.screens.length} screen{known.screens.length===1?'':'s'} learned{known.design?', design learned':''}.</p>
    {known.screens.length>0&&<details><summary>Screens</summary><ul>{known.screens.slice(0,30).map(s=><li key={s.pattern}>{s.summary.title} <small>{s.pattern}</small></li>)}</ul></details>}
    <div className="dx-section-title">TEAM RULES</div>
    <ul>{known.rules.map(r=><li key={r.id}><span>{r.text}</span><button className="dx-small" disabled={busy} onClick={()=>void run(async()=>{await removeRule(current.id,origin,r.id);await load();})}>Remove</button></li>)}</ul>
    <form onSubmit={e=>{e.preventDefault();void run(async()=>{await addRule(current.id,origin,rule.trim());setRule('');await load();});}}><input aria-label="New team rule" placeholder="Brand purple is #7B29FF" maxLength={200} value={rule} onChange={e=>setRule(e.target.value)}/><button className="dx-small" disabled={busy||rule.trim().length<3}>Add rule</button></form>
    <div className="dx-section-title">COMPONENT LIBRARY</div>
    <ul>{known.components.map(c=><li key={c.id}><span>{c.name}</span><button className="dx-small" disabled={busy} onClick={()=>void run(async()=>{await removeComponent(current.id,origin,c.id);await load();})}>Remove</button></li>)}</ul>
    {copiedElement()?<form onSubmit={e=>{e.preventDefault();void run(async()=>{const held=copiedElement();if(!held)throw new Error('Copy something first: ＋ → Copy from page, or ask Wandel to copy it.');await addComponent(current.id,origin,name.trim(),pattern,blankCopy(held.copy));setName('');await load();setStatus('Saved to the team library. Its text is blanked except labels.');});}}>
     <input aria-label="Component name" placeholder={copiedElement()?.label.slice(0,40)||'Component name'} maxLength={48} value={name} onChange={e=>setName(e.target.value)}/><button className="dx-small" disabled={busy||!name.trim()}>Save copied element to library</button></form>:<p className="dx-muted">To add a component, copy it first (＋ → Copy from page, or ask Wandel to copy it), then save it here.</p>}
    {current.role==='owner'&&<button className="dx-small" disabled={busy} onClick={()=>void run(async()=>{if(!window.confirm(`Forget everything Wandel learned about ${host} for ${current.name}? This can’t be undone.`))return;await forgetKnowledge(current.id,origin);await storeLibrary(origin,[]);await load();setStatus(`Forgot ${host} for ${current.name}.`);})}>Forget this app</button>}
   </>}
  </>}
 </details>;
}
