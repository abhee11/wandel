import {assistantBuild} from '../shared/build';
import {AssistantPanel} from '../assistant/AssistantPanel';
import {stateURL} from '../shared/liveNavigation';
import {MinimizeButton} from './MinimizeButton';
import {Connections} from './Connections';
import {useModeShortcuts} from './useModeShortcuts';
import {choicePlan} from '../ai/choicePlan';
import {isSettingsRequest} from '../content/settingsFeature';
import {WorkflowShare} from './WorkflowShare';
import {accountAPI,signIn,previewPlan} from './accountClient';
import {parseBatch} from '../ai/planSchema';
import { SaveFlow } from './SaveFlow';
import { Account,type AuthStatus } from './Account';
import { useEffect, useState, useRef } from 'react';
import type { Bridge } from './bridge';
import type { Command, Snapshot } from '../shared/model';
import { requestAI, checkAIConnection } from '../ai/planner';
import { lineage } from '../prototype/engine';
export function generationPrompt(prompt:string,intent:'feature'|'edit'){
  if(choicePlan(prompt))return prompt;
  const inlineSection=/\b(?:add|insert)\b[\s\S]*?\b(?:section|category|categories|dropdown|menu|tabs?|switch|toggles?|pills?|options?|choices?|field|card)\b/i.test(prompt)&&!/\b(?:workflow|journey|screens|multi.step)\b/i.test(prompt);
  return intent==='feature'&&!inlineSection?`Create a connected workflow: ${prompt}`:prompt;
}
export function App({bridge,demo=false}:{bridge:Bridge;demo?:boolean}) {
  const [intent,setIntent]=useState<'feature'|'edit'>('feature'),[auth,setAuth]=useState<AuthStatus>(demo?'guest':'checking');
  const [saving,setSaving]=useState(false),[advanced,setAdvanced]=useState(false);
  useEffect(()=>{if(demo)return;const listener=(message:any,sender:chrome.runtime.MessageSender)=>{if(message?.type!=='WANDEL_SAVE_REQUEST')return;const owner=new URL(location.href).searchParams.get('tabId');if(owner&&String(sender.tab?.id)!==owner)return;setSaving(true);};chrome.runtime.onMessage.addListener(listener);return()=>chrome.runtime.onMessage.removeListener(listener);},[demo]);
  const [s,setS]=useState<Snapshot|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const pageEpoch=useRef(0);
  const [prompt,setPrompt]=useState(''),[name,setName]=useState('');
  const [tab,setTab]=useState<'build'|'versions'>('build'),[ai,setAI]=useState(true),[token,setToken]=useState('');
  const [aiModel,setAIModel]=useState(demo?'':'Wandel account'),[connecting,setConnecting]=useState(false),[connectionError,setConnectionError]=useState('');
  async function planChange(prompt:string,selection:{tag:string;label:string}){
    const local=choicePlan(prompt);if(local)return local;
    if(aiModel==='Wandel account'){
      const result=await previewPlan(prompt,selection);
      return parseBatch(result.plan);
    }
    return requestAI(prompt,selection,token);
  }
  useEffect(()=>{
    if(demo)return;
    const listener=(m:any,sender:chrome.runtime.MessageSender,reply:(r:unknown)=>void)=>{
      if(!['WANDEL_PLAN_REQUEST','WANDEL_SIGN_IN_REQUEST'].includes(m?.type))return;
      const owner=new URL(location.href).searchParams.get('tabId');if(!owner||String(sender.tab?.id)!==owner||sender.id!==chrome.runtime.id)return;
      if(m.type==='WANDEL_SIGN_IN_REQUEST'){signIn().then(()=>reply({ok:true})).catch(e=>reply({error:e.message}));return true;}
      if(!ai){reply({plan:null});return;}
      if(!aiModel){setAdvanced(true);reply({error:'Connect AI in the Wandel panel, or choose Offline presets there.'});return;}
      planChange(m.prompt,{tag:m.selection.tag,label:m.selection.label}).then(plan=>reply({plan})).catch(e=>reply({error:e.message}));return true;
    };chrome.runtime.onMessage.addListener(listener);return()=>chrome.runtime.onMessage.removeListener(listener);
  },[demo,ai,aiModel,token]);
  async function connectAI(){setConnecting(true);setConnectionError('');setAIModel('');try{setAIModel(await checkAIConnection(token));}catch(e){setConnectionError(e instanceof Error?e.message:'Connection failed.');}finally{setConnecting(false);}}
  const [pageConnectionError,setPageConnectionError]=useState('');
  useEffect(()=>bridge.subscribe(snapshot=>{if(!snapshot){pageEpoch.current++;setError('');setNotice('');setConnectionError('');setBusy(false);}setS(snapshot);setPageConnectionError(bridge.connectionError||'');}),[bridge]);
  useEffect(()=>{setName(s?.workflow.name||'');},[s?.workflow.name]);

  useEffect(()=>{
    const escape=(e:KeyboardEvent)=>{if(e.key!=='Escape'||e.repeat||e.defaultPrevented||busy||saving||!s)return;
      const origin=e.composedPath()[0];if(origin instanceof Element&&origin.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]'))return;
      e.preventDefault();void run({type:'escape'});
    };window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);
  },[s,busy,saving]);

  async function run(c:Command,success?:string){setBusy(true);setError('');setNotice('');try{const next=await bridge.send(c);setS(next);if(success)setNotice(success);return next;}catch(e){setError(e instanceof Error?e.message:'Something went wrong.');}finally{setBusy(false);}}
  useModeShortcuts(s,busy||saving||!!s?.connectionWorkspace,run);
  const needsSignIn=!choicePlan(prompt)&&intent==='feature'&&ai&&aiModel==='Wandel account'&&auth==='guest';
  async function apply(){
    setError('');setNotice('');
    const epoch=pageEpoch.current;
    if(!s)return;
    if(isSettingsRequest(prompt)){const result=await run({type:'settingsPrompt',prompt},'Added working prototype settings inside Advanced. Try Light/Dark and Resize preview on the page. These controls run locally; no AI credit used.');if(result)setPrompt('');return;}
    if(needsSignIn){try{await signIn();setNotice('Finish signing in, then return here. Your prompt is kept.');}catch(e){setError(e instanceof Error?e.message:'Sign-in unavailable.');}return;}

    if(intent==='feature'&&!ai&&!choicePlan(prompt)){setNotice('Feature generation needs AI. Choose AI planner, or switch to Edit this page for offline edits.');return;}
    if(ai&&!aiModel&&!choicePlan(prompt)){setAdvanced(true);setNotice('Connect a planner below to generate this feature. Your prompt is kept.');return;}
    setBusy(true);setError('');setNotice('');try{
      const destination=await bridge.send({type:'selectDestination',prompt});
      if(!destination.selected)throw new Error('Select a section to continue.');
      setS(destination);
      const checked=await bridge.send({type:'validateSelection'});
      if(epoch!==pageEpoch.current)return;
      if(JSON.stringify(checked.selected?.locator)!==JSON.stringify(destination.selected.locator))throw new Error('Your selection changed. Review the highlighted section and submit again.');
      const request=generationPrompt(prompt,intent);
      const plan=choicePlan(request)||(ai?await planChange(request,{tag:destination.selected.tag,label:destination.selected.label}):undefined);
      if(epoch!==pageEpoch.current)return;
      const next=await bridge.send({type:'prompt',prompt:request,plan,context:{workflowId:s.workflow.id,stateId:s.stateId,selection:JSON.stringify(destination.selected.locator)}});
      if(epoch!==pageEpoch.current)return;
      setS(next);setPrompt('');const added=next.workflow.states.length-s.workflow.states.length;
      setNotice(next.unresolved.length?'Some changes could not be applied. See unresolved changes below.':added?`${added} connected screens ready. Click Try flow to experience your feature.`:'Changes applied. Undo reverses this request.');
    }catch(e){if(epoch===pageEpoch.current)setError(e instanceof Error?e.message:'Could not create UI.');}finally{if(epoch===pageEpoch.current)setBusy(false);}
  }
  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{if(!s||s.replay||busy||!(e.metaKey||e.ctrlKey)||e.key.toLowerCase()!=='z')return;const origin=e.composedPath()[0];if(origin instanceof Element&&origin.closest('input,textarea,select,[contenteditable="true"]'))return;e.preventDefault();void run({type:e.shiftKey?'redo':'undo'});};
    window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);
  },[s?.replay,busy,bridge]);
  const state=s?.workflow.states.find(st=>st.id===s.stateId);
  if(s?.connectionWorkspace)return <Connections snapshot={s} bridge={bridge}/>;
  return <div className="dx-app">
    <header className="dx-header"><img className="dx-logo" src={demo?'/brand/wandel-mark.svg':'brand/wandel-mark.svg'} alt=""/><strong>Wandel</strong><span className="dx-pill">WORKFLOW LAB</span><div className="dx-header-actions"><span className="dx-dot" title="Local prototype"/><MinimizeButton disabled={!s||busy} onClick={()=>void run({type:'minimizePanel'})}/></div></header>
    {!demo&&<Account bridge={bridge} snapshot={s} onAuthChange={setAuth}/>}
    {saving&&s&&!demo&&<SaveFlow snapshot={s} bridge={bridge} onClose={()=>setSaving(false)}/>}
    {!s?<main className="dx-empty"><div className="dx-empty-icon">↗</div><h1>Start with a live app.</h1><p>Open an http(s) webpage, then open Wandel. Reload the page if you just installed the extension.</p><p>{pageConnectionError||'Chrome settings, the Web Store, and other protected pages cannot be edited.'}</p>{bridge.retry&&<button className="dx-primary" onClick={()=>void bridge.retry?.()}>Retry connection</button>}</main>:<>
      <div className="dx-project"><div className="dx-eyebrow">YOUR PROTOTYPE <span>{s.dirty?'Unsaved changes':s.versions.length?'Saved this session':'New workflow'}</span></div><div className="dx-name"><input aria-label="Workflow name" value={name} maxLength={300} onChange={e=>setName(e.target.value)} onBlur={()=>{if(name.trim()&&name!==s.workflow.name)void bridge.send({type:'rename',text:name}).then(setS).catch(e=>setError(e.message));}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} disabled={s.replay||busy}/><span className="dx-version">{s.versions.length?`v${s.currentVersion}`:'DRAFT'}</span></div><div className="dx-domain"><span>◉</span> {new URL(s.workflow.origin).host}<span className="dx-route" title={stateURL(s.workflow,s.stateId)}>{new URL(stateURL(s.workflow,s.stateId)).pathname}</span></div></div>
      <div className="dx-mode"><button className={!s.replay&&s.mode!=='interact'?'active':''} onClick={()=>void run({type:'edit'})} disabled={busy}>✎ &nbsp; Edit (E)</button><button className={s.mode==='interact'?'active':''} onClick={()=>void run({type:'interact'})} disabled={busy}>Interact (I)</button><button className={s.replay?'active':''} onClick={()=>void run({type:'replay'})} disabled={busy||!s.enabled}>▷ &nbsp; Try flow</button></div>
      <div className="dx-tabs"><button className={tab==='build'?'active':''} onClick={()=>setTab('build')}>Workflow</button><button className={tab==='versions'?'active':''} onClick={()=>setTab('versions')}>Saved versions <span>{s.versions.length}</span></button><label className="dx-enable"><input aria-label="Enable prototype" type="checkbox" checked={s.enabled} onChange={e=>void run({type:'enabled',value:e.target.checked})}/> On</label></div>
      <main className="dx-main">
        {error&&<div role="alert" className="dx-alert error">{error}<button className="dx-small" aria-label="Dismiss error" onClick={()=>setError('')}>Dismiss</button></div>}{notice&&<div role="status" className="dx-alert">{notice}</div>}
        {tab==='versions'?<>
          <section><div className="dx-section-title">VERSION HISTORY <span>{s.versions.length} saved</span></div><p className="dx-muted">Each version includes every state, UI change, and interaction.</p>{s.versions.length===0?<div className="dx-placeholder">Save your first version to make this flow replayable after a reload.</div>:s.versions.slice().reverse().map(v=><div className="dx-version-row" key={v.number}><div><strong>{v.name} — v{v.number}</strong><small>{new Date(v.savedAt).toLocaleString()}</small></div><button className="dx-small" disabled={busy} onClick={()=>{if(!s.dirty||confirm('Restore this saved version and discard unsaved changes?'))void run({type:'restore',version:v.number},`Restored v${v.number}. Save to create a new version.`);}}>Restore</button></div>)}</section>
          <section><div className="dx-section-title">SAVED ON THIS PAGE</div>{s.library.map(w=><button className="dx-library" key={w.id} disabled={busy} onClick={()=>{if(!s.dirty||confirm('Open this workflow and discard unsaved changes?'))void run({type:'load',id:w.id});}}><span>◇ &nbsp;{w.name}</span><small>{w.versions} versions →</small></button>)}<div className="dx-row"><button className="dx-secondary" onClick={()=>void run({type:'duplicate'},'Duplicated. Save to keep this copy.')} disabled={busy}>Duplicate</button><button className="dx-secondary" onClick={()=>{if(!s.dirty||confirm('Start a new workflow and discard unsaved changes?'))void run({type:'new'});}} disabled={busy}>New workflow</button></div>{s.versions.length>0&&<button className="dx-danger" disabled={busy} onClick={()=>{if(confirm(`Delete “${s.workflow.name}” and all its saved versions?`))void run({type:'delete'});}}>Delete this workflow</button>}</section>
        </>:<>
          {s.mode==='interact'?<section><h2>Page interaction is on</h2><p>Saved connections work here. Unmapped controls work normally. Press E or select Edit to resume editing. Press I to interact; V toggles modes.</p>{s.canBack&&<button className="dx-secondary" onClick={()=>void run({type:'back'})}>← Back to previous screen</button>}<button className="dx-secondary" onClick={()=>void run({type:'edit'})}>Select an element</button></section>:s.replay?<section className="dx-replaying"><div className="dx-section-title"><span className="dx-live">●</span> REPLAY MODE</div><h2>{state?.title}</h2><p>Click the prototype controls on the page to move through your workflow.</p><div className="dx-row"><button className="dx-secondary" disabled={!s.canBack||busy} onClick={()=>void run({type:'back'})}>← Back</button><button className="dx-secondary" onClick={()=>void run({type:'replay'})}>↻ Restart</button></div></section>:<>
            {assistantBuild?<AssistantPanel bridge={bridge} snapshot={s} onSave={()=>setSaving(true)}/>:<section className="dx-create">
              <div className="dx-intent" aria-label="What would you like to do?"><button aria-pressed={intent==='feature'} onClick={()=>setIntent('feature')}>Imagine a feature</button><button aria-pressed={intent==='edit'} onClick={()=>setIntent('edit')}>Edit this page</button></div>
              <h2>{intent==='feature'?'What should this app do next?':'What would you like to change?'}</h2>
              <div className={`dx-selection-status ${s.selected?'selected':'empty'}`} role="status">{s.selected?<>Starting at <strong>{s.selected.label}</strong><small>{intent==='feature'?'A new feature will launch from this selection.':'The highlighted element will be changed.'}</small></>:<>Name a section in your prompt, or select one on the page.<small>Wandel can use a clearly named section or the open dialog.</small></>}</div>
              <div className="dx-prompt"><textarea aria-label="Describe new UI" value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder={intent==='feature'?'Add onboarding: profile → preferences → welcome. Include Back and Continue buttons…':'Add a field, rename a button, or change this section…'} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();if(!busy&&prompt.trim())void apply();}}} rows={3} maxLength={intent==='edit'&&auth==='guest'&&aiModel==='Wandel account'?600:1900} disabled={busy||!s.enabled}/>
                <div className="dx-prompt-footer"><span>{choicePlan(prompt)?'Match existing choices · no AI credit':intent==='feature'?'Describe screens + what clicks do':'Describe one change'}</span><button className="dx-primary" disabled={busy||!s.enabled||(!isSettingsRequest(prompt)&&!choicePlan(prompt)&&aiModel==='Wandel account'&&auth==='checking')||(!!s.selected&&!needsSignIn&&!prompt.trim())} onClick={()=>void apply()}>{busy?'Creating…':isSettingsRequest(prompt)?'Add to Advanced settings':choicePlan(prompt)?'Add matching category':needsSignIn?'Sign in to create':!s.selected?'Find section & create':ai&&!aiModel?'Connect AI':intent==='feature'?'Create feature':'Apply change'}</button></div>
              </div>
              {needsSignIn&&<p className="dx-access">Multi-step features require a Wandel sign-in. Guest previews cover single-screen edits. <button onClick={()=>setIntent('edit')}>Try a free edit</button></p>}
              {auth==='unavailable'&&aiModel==='Wandel account'&&<p className="dx-access">Account status is unavailable. Check your connection below; your prompt stays here.</p>}
              <div className="dx-chips">{(intent==='feature'?[['Onboarding','Add onboarding with profile details, preferences, and a welcome screen. Include Continue and Back actions.'],['Approval flow','Add a review dashboard, details with a note, Approve and Reject branches, and confirmations returning to the updated dashboard.']]:[['Add a field','Add a name field inside this'],['Rename','Rename this to Get started']]).map(([label,value])=><button key={label} disabled={busy} onClick={()=>setPrompt(value)}>{label}</button>)}</div>
              <p className="dx-muted">{intent==='feature'?'Describe → create connected screens → Try flow. You can edit and extend every screen.':'Double-click text to rename it. Drag to move, or use a corner to resize.'}</p>
              <details className="dx-advanced" open={advanced} onToggle={e=>setAdvanced(e.currentTarget.open)}><summary>{ai?(aiModel?'AI connection · '+(aiModel==='Wandel account'?'Wandel':aiModel):'Connect AI'):'Offline presets · change connection'}</summary><section><select aria-label="Planner mode" value={ai?'ai':'local'} onChange={e=>{setAI(e.target.value==='ai');setError('');setNotice('');}}><option value="local">Offline presets</option><option value="ai">AI planner</option></select>{ai&&<div className="dx-ai" role="status"><strong>{aiModel?aiModel==='Wandel account'?'Wandel AI':`Server connected · ${aiModel}`:'AI is not connected'}</strong>{!aiModel?<>{!demo&&<button className="dx-small" onClick={()=>setAIModel('Wandel account')}>Use Wandel account</button>}<p>Natural-language changes need an AI connection. Configure your API key and model locally, run <code>npm run ai</code>, then paste the server token here.</p><input aria-label="Local AI server token" type="password" value={token} onChange={e=>{setToken(e.target.value);setAIModel('');setConnectionError('');}} placeholder="Local server token · not your API key" autoComplete="off" onKeyDown={e=>{if(e.key==='Enter'&&!connecting)void connectAI();}} disabled={connecting}/><button className="dx-small" disabled={connecting||!token.trim()} onClick={()=>void connectAI()}>{connecting?'Connecting…':'Connect AI'}</button><small>Your OpenAI key stays on your computer. Submitted prompts and the selected label are sent to OpenAI.</small>{connectionError&&<p role="alert">{connectionError}</p>}</>:<p>Only submitted prompts and the selected label are sent. {aiModel==='Wandel account'&&<>Try two small UI changes without signing in. Guest prompts: 600 characters; one section at a time. </>}<button className="dx-small" onClick={()=>{setAIModel('');setToken('');}}>{aiModel==='Wandel account'?'Use local server':'Disconnect'}</button></p>}</div>}</section></details>
            </section>}

          </>}
          <WorkflowShare snapshot={s} bridge={bridge}/><section><div className="dx-section-title">YOUR FLOW <span>{s.workflow.states.length} / {s.workflow.maxStates} states</span></div><div className="dx-flow">{s.workflow.states.map((st,index)=>{const outgoing=s.workflow.edges.filter(e=>e.from===st.id);return <div className="dx-flow-item" key={st.id}><button className={`dx-state ${s.stateId===st.id?'current':''}`} disabled={busy||s.replay} onClick={()=>void run({type:'state',id:st.id})}><span className="dx-state-number">{String(index+1).padStart(2,'0')}</span><div><strong>{st.title}</strong><small>{st.liveURL?'Live application page':st.view==='base'?'Live application':st.screen?'Captured prototype · reconnect for live page':`${st.operations.length} UI changes · editable panel`}</small></div>{s.stateId===st.id?<span className="dx-here">YOU ARE HERE</span>:<span>↗</span>}</button>{outgoing.map(edge=>{const op=lineage(s.workflow,edge.from).flatMap(x=>x.operations).reverse().find(o=>o.kind==='insert'?o.node.id===edge.source.replace(/:input$/,''):o.kind==='trigger'?o.source===edge.source:o.kind==='text'&&o.target.owned===edge.source);const destination=s.workflow.states.find(x=>x.id===edge.to);return <div key={edge.id}><div className="dx-connector">↳ <span>{op?.kind==='insert'?op.node.text:op?.kind==='text'?op.text:op?.kind==='trigger'?op.target.name:'Control'} · {edge.event||'click'}{edge.conditions?.length?` · ${edge.conditions.length} conditions`:''} → {destination?.title}</span></div>{edge.otherwise&&<div className="dx-connector">↳ <span>Otherwise → {s.workflow.states.find(state=>state.id===edge.otherwise)?.title}</span></div>}</div>;})}</div>;})}</div><p className="dx-flow-note">Every state is a starting point for the next idea.</p></section>

          {s.unresolved.length>0&&<section className="dx-alert error"><strong>{s.unresolved.length} unresolved changes</strong>{s.unresolved.map((e,i)=><p key={i}>{e}</p>)}<small>Missing targets were not modified. Check layout warnings, resize the section, or undo and choose a clearer target.</small></section>}
        </>}
      </main><footer className="dx-footer">{s.workflow.edges.length>0&&<button className="dx-secondary" style={{width:'100%',marginBottom:8}} disabled={busy} onClick={()=>void run({type:s.replay?'edit':'replay'})}>{s.replay?'✎ Back to editing':'▷ Replay flow from start'}</button>}<div className="dx-row"><button title="Undo" aria-label="Undo" className="dx-icon-button" disabled={!s.canUndo||s.replay||busy} onClick={()=>void run({type:'undo'})}>↶</button><button title="Redo" aria-label="Redo" className="dx-icon-button" disabled={!s.canRedo||s.replay||busy} onClick={()=>void run({type:'redo'})}>↷</button><button className="dx-primary dx-save" disabled={busy} onClick={()=>{if(demo)void run({type:'save'},'Saved in this demo browser.');else setSaving(true);}}>Save {s.versions.length?'new version':'workflow'} <span>↗</span></button></div><button className="dx-restore" disabled={busy} onClick={()=>{if(confirm('Restore the original page? All states and edits in this draft will be cleared. Saved versions are kept, and Undo can recover this draft.'))void run({type:'reset'},'Original page restored. Saved versions are still available.');}}>Restore original page</button><small><span>●</span> {demo?'Demo · saved in this browser':s.liveSession?'Live app · original controls perform real actions':s.workflow.states.some(st=>st.operations.some(op=>op.kind==='mirror'))?'Mirrored controls can run live app actions':'Local prototype · no backend changes'}</small></footer>
    </>}
  </div>;
}
