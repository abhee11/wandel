import {useEffect,useState} from 'react';
import {accountAPI} from './accountClient';
type Team={id:string;name:string;role:'owner'|'member';members:number};
type Member={id:string;email:string;name:string|null;role:'owner'|'member'};
type Invited={email:string;url:string};
/** Teams share what Wandel learns about their apps. Create one, invite people by email, see who's on it, or leave. */
export function Teams({me}:{me:{id:string;email:string}}){
 const [teams,setTeams]=useState<Team[]|null>(null),[open,setOpen]=useState<string|null>(null),[detail,setDetail]=useState<{members:Member[];invites:{email:string;expiresAt:string}[]}|null>(null);
 const [name,setName]=useState(''),[emails,setEmails]=useState(''),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[links,setLinks]=useState<Invited[]>([]);
 const run=async(work:()=>Promise<void>)=>{setBusy(true);setStatus('');try{await work();}catch(error){setStatus(error instanceof Error?error.message:'That didn’t work. Try again.');}finally{setBusy(false);}};
 const load=async()=>{setTeams((await accountAPI<{teams:Team[]}>('/teams')).teams);};
 const show=async(id:string)=>{setOpen(id);setLinks([]);setDetail(await accountAPI('/teams/'+id+'/members'));};
 useEffect(()=>{void run(load);},[]);
 const team=teams?.find(t=>t.id===open);
 return <section className="dx-teams" aria-label="Teams">
  <div className="dx-section-title">TEAMS {teams&&<span>{teams.length}</span>}</div>
  <p className="dx-muted">People on a team share what Wandel learns about your apps: their layout and design, never their content.</p>
  {status&&<p role="alert" className="dx-alert">{status}</p>}
  {teams?.map(t=><div key={t.id} className="dx-team">
   <button className="dx-library" aria-expanded={open===t.id} onClick={()=>void run(()=>open===t.id?(setOpen(null),Promise.resolve()):show(t.id))}>{t.name} <small>{t.role==='owner'?'Owner':'Member'} · {t.members} {t.members===1?'person':'people'}</small></button>
   {open===t.id&&detail&&<div className="dx-team-detail">
    <ul>{detail.members.map(m=><li key={m.id}><span>{m.name||m.email}{m.id===me.id?' (you)':''} <small>{m.role==='owner'?'Owner':'Member'}</small></span>
     {team?.role==='owner'&&m.id!==me.id&&<button className="dx-small" disabled={busy} onClick={()=>void run(async()=>{await accountAPI(`/teams/${t.id}/members/${encodeURIComponent(m.id)}`,'DELETE');await show(t.id);await load();})}>Remove</button>}</li>)}
     {detail.invites.map(i=><li key={i.email}><span>{i.email} <small>Invited</small></span>{team?.role==='owner'&&<button className="dx-small" disabled={busy} onClick={()=>void run(async()=>{await accountAPI(`/teams/${t.id}/invites/${encodeURIComponent(i.email)}`,'DELETE');await show(t.id);})}>Cancel</button>}</li>)}</ul>
    {team?.role==='owner'&&<form onSubmit={e=>{e.preventDefault();void run(async()=>{const result=await accountAPI<{invited:Invited[];emailed:boolean}>(`/teams/${t.id}/invites`,'POST',{emails:emails.split(/[\s,;]+/).filter(Boolean)});setEmails('');setStatus(result.invited.length?(result.emailed?`Invite sent to ${result.invited.map(i=>i.email).join(', ')}.`:'Invite made. Email isn’t set up, so send the link below yourself.'):'They’re already on the team.');if(!result.emailed)setLinks(result.invited);await show(t.id);});}}>
     <label className="dx-muted">Invite by email<input aria-label="Emails to invite" placeholder="name@company.com" value={emails} onChange={e=>setEmails(e.target.value)}/></label>
     <button className="dx-small" disabled={busy||!emails.trim()}>Invite</button></form>}
    {links.map(l=><p key={l.email} className="dx-muted">{l.email}: <input readOnly aria-label={'Invite link for '+l.email} value={l.url} onFocus={e=>e.currentTarget.select()}/></p>)}
    <button className="dx-small" disabled={busy} onClick={()=>void run(async()=>{await accountAPI(`/teams/${t.id}/members/${encodeURIComponent(me.id)}`,'DELETE');setOpen(null);await load();setStatus(`You left ${t.name}.`);})}>Leave team</button>
    {team?.role==='owner'&&<button className="dx-small" disabled={busy} onClick={()=>void run(async()=>{if(!window.confirm(`Delete ${t.name}? Everyone loses access to what Wandel learned for this team.`))return;await accountAPI(`/teams/${t.id}`,'DELETE');setOpen(null);await load();setStatus(`${t.name} was deleted.`);})}>Delete team</button>}
   </div>}
  </div>)}
  <form onSubmit={e=>{e.preventDefault();void run(async()=>{const created=await accountAPI<Team>('/teams','POST',{name:name.trim()});setName('');await load();await show(created.id);setStatus(`${created.name} is ready. Invite your teammates.`);});}}>
   <label className="dx-muted">New team<input aria-label="New team name" placeholder="Team name" maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label>
   <button className="dx-small" disabled={busy||!name.trim()}>Create team</button></form>
 </section>;
}
