import {PanelWindowControl} from './PanelWindowControl';
import {groupIssues,issueHeadline} from '../shared/diagnostics';
import {PageTools} from './PageTools';
import {shortcutKey} from '../shared/keyboard';
import {FlowNavigation} from './FlowNavigation';
import {duplicateIntent,isDuplicateRequest} from '../ai/duplicateIntent';
import {BuildWorkflow} from './BuildWorkflow';
import {AssistantPanel} from '../assistant/AssistantPanel';
import {rememberConversation} from '../assistant/conversation';
import {MinimizeButton} from './MinimizeButton';
import {Connections} from './Connections';
import {useModeShortcuts} from './useModeShortcuts';
import {choicePlan} from '../ai/choicePlan';
import {isSettingsRequest} from '../content/settingsFeature';
import {WorkflowShare} from './WorkflowShare';
import {accountAPI,signIn,previewPlan} from './accountClient';
import {parseBatch} from '../ai/planSchema';
import { SaveFlow } from './SaveFlow';
import { Account,AccountSaves,Usage,type AccountInfo,type AuthStatus } from './Account';
import { useEffect, useState, useRef } from 'react';
import type { Bridge } from './bridge';
import type { Command, Snapshot } from '../shared/model';
import { requestAI, checkAIConnection } from '../ai/planner';
export function generationPrompt(prompt:string,intent:'feature'|'edit'){
  if(choicePlan(prompt)||isDuplicateRequest(prompt))return prompt;
  const inlineSection=/\b(?:add|insert)\b[\s\S]*?\b(?:section|category|categories|dropdown|menu|tabs?|switch|toggles?|pills?|options?|choices?|field|card)\b/i.test(prompt)&&!/\b(?:workflow|journey|screens|multi.step)\b/i.test(prompt);
  return intent==='feature'&&!inlineSection?`Create a connected workflow: ${prompt}`:prompt;
}
/** One quiet line by the chat box. The detail opens as its own view, so it never takes space from the conversation. */
function UnresolvedLine({issues,onOpen,onHide}:{issues:string[];onOpen:()=>void;onHide:()=>void}){
  return <div className="dx-unresolved-line" role="status"><i aria-hidden="true"/><span>{issueHeadline(issues)}</span><button onClick={onOpen}>Why?</button><button className="dx-unresolved-hide" aria-label="Hide this message" title="Hide" onClick={onHide}>×</button></div>;
}
function UnresolvedDetail({issues,busy,onUndo}:{issues:string[];busy:boolean;onUndo:()=>void}){
  const groups=groupIssues(issues);
  if(!groups.length)return <p className="dx-muted">Every edit is showing on this page.</p>;
  return <section className="dx-issues">{groups.map(group=><div key={group.kind}><h3>{group.title}</h3><p className="dx-muted">{group.hint}</p><details><summary>Show the list</summary><ul>{group.items.map((item,index)=><li key={index}>{item}</li>)}</ul></details></div>)}<button className="dx-small" disabled={busy} onClick={onUndo}>Undo last change</button></section>;
}
export function App({bridge,demo=false,demoAccount=null}:{bridge:Bridge;demo?:boolean;demoAccount?:AccountInfo|null}) {
  const [intent,setIntent]=useState<'feature'|'edit'>('feature'),[auth,setAuth]=useState<AuthStatus>(demo?'guest':'checking');
  const [saving,setSaving]=useState(false),[advanced,setAdvanced]=useState(false),[assistantOpen,setAssistantOpen]=useState(true);
  useEffect(()=>{if(demo)return;const listener=(message:any,sender:chrome.runtime.MessageSender)=>{if(message?.type!=='WANDEL_SAVE_REQUEST')return;const owner=new URL(location.href).searchParams.get('tabId');if(owner&&String(sender.tab?.id)!==owner)return;setSaving(true);};chrome.runtime.onMessage.addListener(listener);return()=>chrome.runtime.onMessage.removeListener(listener);},[demo]);
  const [assistantBusy,setAssistantBusy]=useState(false),[menuOpen,setMenuOpen]=useState(false),[discarding,setDiscarding]=useState(false),[me,setMe]=useState<AccountInfo|null>(demoAccount);
  const embedded=new URL(location.href).searchParams.get('embedded')==='1';
  useEffect(()=>{if(menuOpen)window.dispatchEvent(new Event('wandel-account-refresh'));},[menuOpen]);
  useEffect(()=>{if(!discarding)return;const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();setDiscarding(false);}};window.addEventListener('keydown',escape,true);return()=>window.removeEventListener('keydown',escape,true);},[discarding]);
  useEffect(()=>{const opened=()=>{setTab('build');setAssistantOpen(true);};window.addEventListener('wandel-flow-opened',opened);return()=>window.removeEventListener('wandel-flow-opened',opened);},[]);
  const menu=useRef<HTMLDivElement|null>(null);
  useEffect(()=>{if(!menuOpen)return;const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!menu.current?.contains(event.target))setMenuOpen(false);};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();setMenuOpen(false);}};document.addEventListener('pointerdown',outside,true);window.addEventListener('keydown',escape,true);return()=>{document.removeEventListener('pointerdown',outside,true);window.removeEventListener('keydown',escape,true);};},[menuOpen]);
  // Unresolved changes the user hid stay hidden until the set changes.
  const [hiddenIssues,setHiddenIssues]=useState<string[]>([]);
  const [s,setS]=useState<Snapshot|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const pageEpoch=useRef(0);
  const [prompt,setPrompt]=useState(''),[name,setName]=useState('');
  const [accountCount,setAccountCount]=useState<number|null>(null);
  const [tab,setTab]=useState<'build'|'versions'|'share'|'implement'|'flow'|'tools'|'issues'>('build'),[ai,setAI]=useState(true),[token,setToken]=useState('');
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

  async function run(c:Command,success?:string){if(c.type==='edit'){setAssistantOpen(false);setIntent('edit');}setBusy(true);setError('');setNotice('');try{const next=await bridge.send(c);setS(next);if(success)setNotice(success);return next;}catch(e){setError(e instanceof Error?e.message:'Something went wrong.');}finally{setBusy(false);}}
  // Enter normal page interaction when the chat opens or a page first connects.
  // Mode changes alone must not re-run this: Edit remains an explicit choice.
  const pageConnected=!!s;
  useEffect(()=>{
    if(assistantOpen&&s&&!s.replay&&!s.connectionWorkspace&&s.mode==='edit')void run({type:'interact'});
  },[assistantOpen,pageConnected,bridge]);
  useModeShortcuts(s,busy||saving||!!s?.connectionWorkspace,run);
  const copying=duplicateIntent(prompt);
  const needsSignIn=!isDuplicateRequest(prompt)&&!choicePlan(prompt)&&intent==='feature'&&ai&&aiModel==='Wandel account'&&auth==='guest';
  async function apply(){
    setError('');setNotice('');
    const epoch=pageEpoch.current;
    if(!s)return;
    if(duplicateIntent(prompt)){
      if(!s.selected){setError('Select the card or element you want to copy first. Your prompt is kept.');return;}
      const result=await run({type:'copyPrompt',prompt,context:{workflowId:s.workflow.id,stateId:s.stateId,selection:JSON.stringify(s.selected.locator)}},'Copied the selection with its original styles. Undo reverses this request.');if(result)setPrompt('');return;
    }
    if(isDuplicateRequest(prompt)){setError('This is a copy request, not a new feature. Use Chat to describe the copied heading and details. Nothing was changed.');return;}
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
      setNotice(next.unresolved.length?issueHeadline(next.unresolved)+'.':added?`${added} connected screens ready. Open Flow and press Play to try them.`:'Changes applied. Undo reverses this request.');
    }catch(e){if(epoch===pageEpoch.current)setError(e instanceof Error?e.message:'Could not create UI.');}finally{if(epoch===pageEpoch.current)setBusy(false);}
  }
  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{const key=shortcutKey(e);if(!key||!s||s.replay||busy||!(e.metaKey||e.ctrlKey)||key!=='z')return;const origin=e.composedPath()[0];if(origin instanceof Element&&origin.closest('input,textarea,select,[contenteditable="true"]'))return;e.preventDefault();void run({type:e.shiftKey?'redo':'undo'});};
    window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);
  },[s?.replay,busy,bridge]);
  const state=s?.workflow.states.find(st=>st.id===s.stateId);
  // Chat is home. Replay always shows the flow map; every other view returns here with one click, and leaving replay leaves it for good.
  const shown=s?.replay&&tab==='build'?'flow':tab;
  const toChat=()=>{setTab('build');setAssistantOpen(true);if(s?.replay)void run({type:'edit'}).then(()=>setAssistantOpen(true));};
  const viewTitles={versions:'Saved',share:'Share',implement:'Build & GitHub',flow:'Flow',tools:'Page tools',issues:'Edits not showing'};
  // Another page of the same app while a workflow is active: a banner offers to add it; the panel stays usable.
  if(s?.navigationError)return <div className="dx-app"><main className="dx-empty"><h1>Resume your workflow</h1><p role="alert">{s.navigationError}</p><p>Your earlier draft is preserved. Return to a connected application screen, then retry.</p><button className="dx-primary" disabled={busy} onClick={()=>void run({type:'resumeWorkflow'})}>Retry workflow</button><button className="dx-secondary" disabled={busy} onClick={()=>{if(confirm('Start a separate workflow on this page? Your earlier saved draft is kept.'))void run({type:'new'});}}>Start a separate workflow</button></main></div>;
  if(s&&new URL(location.href).searchParams.get('contextual')==='1')return <div className="dx-app dx-chat-layout dx-panel dx-panel-chat dx-context-chat">{saving&&!demo&&<SaveFlow snapshot={s} bridge={bridge} onClose={()=>setSaving(false)}/>}<main className="dx-main"><AssistantPanel bridge={bridge} snapshot={s} onBusyChange={setAssistantBusy} onSave={()=>setSaving(true)}/></main></div>;
  if(s?.connectionWorkspace)return <Connections snapshot={s} bridge={bridge}/>;
  return <div className={`dx-app dx-chat-layout dx-panel ${assistantOpen&&shown==='build'?'dx-panel-chat':''} ${auth==='signed-in'?'dx-account-tucked':''}`}>

    {!demo&&<PanelWindowControl/>}
    {!demo&&<Account bridge={bridge} snapshot={s} onAuthChange={setAuth} onCount={setAccountCount} onMe={setMe}/>}
    {s?.staleTab&&<div className="dx-resume-banner" role="alert"><p>This prototype changed in another tab. Reload this tab to continue. Changes made here since then were not saved.</p><div><button className="dx-primary" disabled={busy} onClick={()=>void run({type:'reloadTab'})}>Reload this tab</button></div></div>}
    {s?.resumeChoice&&!s.navigationError&&<div className="dx-resume-banner" role="status"><p>This page isn’t part of <strong>{s.resumeChoice.name}</strong> yet.</p><div><button className="dx-primary" disabled={busy} onClick={()=>void run({type:'continueWorkflowHere'})}>Add this page</button><button className="dx-secondary" disabled={busy} onClick={()=>void run({type:'dismissResumeChoice'})}>Keep separate</button></div></div>}
    {saving&&s&&!demo&&<SaveFlow snapshot={s} bridge={bridge} onClose={()=>setSaving(false)}/>}
    {!s?<main className="dx-empty"><div className="dx-empty-icon">↗</div><h1>Start with a live app.</h1><p>Open an http(s) webpage, then open Wandel. Reload the page if you just installed the extension.</p><p>{pageConnectionError||'Chrome settings, the Web Store, and other protected pages cannot be edited.'}</p>{bridge.retry&&<button className="dx-primary" onClick={()=>void bridge.retry?.()}>Retry connection</button>}</main>:<>
      <div className="dx-project"><div className="dx-name">{!embedded&&<img className="dx-logo" src="brand/wandel-mark.svg" alt="" onError={e=>e.currentTarget.remove()}/>}<input aria-label="Workflow name" value={name} maxLength={300} onChange={e=>setName(e.target.value)} onBlur={()=>{if(name.trim()&&name!==s.workflow.name)void bridge.send({type:'rename',text:name}).then(setS).catch(e=>setError(e.message));}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} disabled={s.replay||busy}/>{s.dirty&&<span className="dx-unsaved-dot" title="Unsaved changes" aria-label="Unsaved changes"/>}<div className="dx-header-actions"><button type="button" className="dx-minimize" aria-label="Start a new session" title="Start a new session" disabled={busy||assistantBusy} onClick={()=>setDiscarding(true)}>＋</button><div className="dx-more" ref={menu}><button type="button" className="dx-minimize" aria-label="More" aria-haspopup="menu" aria-expanded={menuOpen} onClick={()=>setMenuOpen(!menuOpen)}>⋮</button>{menuOpen&&<div className="dx-more-menu" role="menu" aria-label="More">{me?<div className="dx-menu-account"><strong title={me.user.email}>{me.user.name||me.user.email}</strong><small>{me.user.name?me.user.email+' · ':''}{me.entitlements.plan==='PRO'?'Pro':'Free'}</small><Usage usage={me.entitlements.usage}/></div>:null}<button role="menuitem" onClick={()=>{setMenuOpen(false);window.dispatchEvent(new Event('wandel-account-open'));}}>{me?'Account & billing':'Sign in'}</button><button role="menuitem" onClick={()=>{setMenuOpen(false);setTab('versions');}}>Saved <span>{accountCount??s.versions.length}</span></button><button role="menuitem" onClick={()=>{setMenuOpen(false);setTab('tools');}}>Page tools</button><button role="menuitem" onClick={()=>{setMenuOpen(false);toChat();window.dispatchEvent(new Event('wandel-chat-options'));}}>Chat settings</button><button role="menuitem" className="dx-menu-danger" disabled={busy||assistantBusy} onClick={()=>{setMenuOpen(false);setDiscarding(true);}}>Discard and start new</button></div>}</div>{!embedded&&<MinimizeButton disabled={busy} onClick={()=>{if(new URL(location.href).searchParams.get('floating')==='1')void chrome.windows.getCurrent().then(window=>{if(window.id!==undefined)void chrome.windows.update(window.id,{state:'minimized'});});else void run({type:'minimizePanel'});}}/>}</div></div></div>
      {discarding&&<div className="dx-discard" role="alertdialog" aria-label="Start a new session"><strong>Start a new session?</strong><p>{s.versions.length?<>This discards the unsaved edits in “{s.workflow.name}”</>:<>This discards “{s.workflow.name}” and its chat</>}, and the page goes back to how it was. Flows and versions you already saved are kept.</p><div className="dx-row"><button className="dx-secondary" autoFocus onClick={()=>setDiscarding(false)}>Keep working</button><button className="dx-primary dx-danger-fill" disabled={busy||assistantBusy} onClick={()=>{setDiscarding(false);setTab('build');setAssistantOpen(true);if(!s.versions.length)rememberConversation(s.workflow.id,[]);void run({type:'new',discard:true},'New session started. The page is back to how it was.');}}>Discard and start new</button></div></div>}
      <main className="dx-main">
        {error&&<div role="alert" className="dx-alert error">{error}<button className="dx-small" aria-label="Dismiss error" onClick={()=>setError('')}>Dismiss</button></div>}{notice&&<div role="status" className="dx-alert">{notice}</div>}
        {(shown!=='build'||!assistantOpen)&&<div className="dx-view-head"><button className="dx-small" onClick={toChat}>← Chat</button><strong>{shown==='build'?(intent==='edit'?'Visual edit':'New flow'):viewTitles[shown]}</strong></div>}
        {shown==='implement'?<BuildWorkflow key={s.workflow.id} snapshot={s} bridge={bridge} demo={demo}/>:shown==='share'?<WorkflowShare snapshot={s} bridge={bridge} expanded onPreview={()=>setTab('build')}/>:shown==='versions'?<>
          {!demo&&<AccountSaves snapshot={s} bridge={bridge} onCount={setAccountCount}/>}<section><div className="dx-section-title">ON THIS COMPUTER <span>{s.versions.length} versions</span></div><p className="dx-muted">Versions saved on this computer. They stay after Chrome restarts but aren’t in your account.</p>{s.versions.length===0?<div className="dx-placeholder">Save your first version to make this flow replayable after a reload.</div>:s.versions.slice().reverse().map(v=><div className="dx-version-row" key={v.number}><div><strong>{v.name} — v{v.number}</strong><small>{new Date(v.savedAt).toLocaleString()}</small></div><button className="dx-small" disabled={busy} onClick={()=>{if(!s.dirty||confirm('Restore this saved version and discard unsaved changes?'))void run({type:'restore',version:v.number},`Restored v${v.number}. Save to create a new version.`);}}>Restore</button></div>)}</section>
          <section><div className="dx-section-title">SAVED ON THIS PAGE</div>{s.library.map(w=><button className="dx-library" key={w.id} disabled={busy} onClick={()=>{if(!s.dirty||confirm('Open this workflow and discard unsaved changes?'))void run({type:'load',id:w.id});}}><span>◇ &nbsp;{w.name}</span><small>{w.versions} versions →</small></button>)}<div className="dx-row"><button className="dx-secondary" onClick={()=>void run({type:'duplicate'},'Duplicated. Save to keep this copy.')} disabled={busy}>Duplicate</button><button className="dx-secondary" onClick={()=>{if(!s.dirty||confirm('Start a new workflow and discard unsaved changes?'))void run({type:'new'});}} disabled={busy}>New workflow</button></div>{s.versions.length>0&&<button className="dx-danger" disabled={busy} onClick={()=>{if(confirm(`Delete “${s.workflow.name}” and all its saved versions?`))void run({type:'delete'});}}>Delete this workflow</button>}</section>
        </>:shown==='flow'?<section className="dx-flow-view">{s.replay?<section className="dx-replaying"><div className="dx-section-title"><span className="dx-live">●</span> REPLAY MODE</div><h2>{state?.title}</h2><p>Click the prototype controls on the page to move through your workflow.</p><div className="dx-row"><button className="dx-secondary" disabled={!s.canBack||busy} onClick={()=>void run({type:'back'})}>← Back</button><button className="dx-secondary" onClick={()=>void run({type:'replay'})}>↻ Restart</button></div></section>:<button className="dx-primary" disabled={busy||!s.enabled} onClick={()=>void run({type:'replay'})}>▶ Play from the start</button>}<FlowNavigation snapshot={s} busy={busy} onNavigate={id=>void run({type:'state',id})}/></section>:shown==='issues'?<UnresolvedDetail issues={s.unresolved} busy={busy} onUndo={()=>void run({type:'undo'},'Undid the last change.')}/>:shown==='tools'?<section className="dx-tools-view"><PageTools snapshot={s} busy={busy||assistantBusy} onRun={run}/><div className="dx-tools-group"><label className="dx-enable"><input aria-label="Enable prototype" type="checkbox" checked={s.enabled} onChange={e=>void run({type:'enabled',value:e.target.checked})}/> On</label><button className="dx-small" title="Undo last change" disabled={!s.canUndo||s.replay||busy} onClick={()=>void run({type:'undo'})}>Undo</button><button className="dx-small" title="Redo last change" disabled={!s.canRedo||s.replay||busy} onClick={()=>void run({type:'redo'})}>Redo</button></div><button className="dx-secondary" disabled={busy} onClick={()=>{setTab('build');setAssistantOpen(false);setIntent('feature');}}>Create a connected flow</button><button className="dx-restore" disabled={busy} onClick={()=>{if(confirm('Restore the original page? All states and edits in this draft will be cleared. Saved versions are kept, and Undo can recover this draft.'))void run({type:'reset'},'Original page restored. Saved versions are still available.');}}>Restore original page</button></section>:null}
        {/* Chat stays mounted behind other views, so a request in progress and the conversation survive a look at Flow or Share. */}
        <div style={{display:shown==='build'?'contents':'none'}}>
            <section className="dx-create">
              {s.previewOriginal?<div className="dx-visual-help"><h2>Viewing the original</h2><p>Your changes are preserved. Use Return to changes to keep editing.</p></div>:assistantOpen?<AssistantPanel bridge={bridge} snapshot={s} onBusyChange={setAssistantBusy} onSave={()=>setSaving(true)} onVisualEdit={()=>void run({type:'edit'})} notice={s.unresolved.length>0&&!s.resumeChoice&&s.unresolved.some(issue=>!hiddenIssues.includes(issue))?<UnresolvedLine issues={s.unresolved} onOpen={()=>setTab('issues')} onHide={()=>setHiddenIssues(items=>[...new Set([...items,...s.unresolved])])}/>:undefined}/>:intent==='edit'?<div className="dx-visual-help"><h2>Edit directly on the page</h2><p>Select an element to see its tools. Double-click text to rename it, or drag to move and resize.</p>{s.selected&&<div className="dx-selected"><strong title={s.selected.label}>{s.selected.label}</strong></div>}</div>:<>
              <h2>{intent==='feature'?'Create a connected flow':'Visual editing'}</h2>
              <div className={`dx-selection-status ${s.selected?'selected':'empty'}`} role="status">{s.selected?<>Starting at <strong>{s.selected.label}</strong><small>{copying?'A matching copy will be added on this page; the original stays unchanged.':intent==='feature'?'A new feature will launch from this selection.':'The highlighted element will be changed.'}</small></>:<>Name a section in your prompt, or select one on the page.<small>Wandel can use a clearly named section or the open dialog.</small></>}</div>
              <div className="dx-prompt"><textarea aria-label="Describe new UI" value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder={intent==='feature'?'Add onboarding: profile → preferences → welcome. Include Back and Continue buttons…':'Add a field, rename a button, or change this section…'} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();if(!busy&&prompt.trim())void apply();}}} rows={3} maxLength={1900} disabled={busy||!s.enabled}/>
                <div className="dx-prompt-footer"><span>{copying?'Native copy · no AI credit':choicePlan(prompt)?'Match existing choices · no AI credit':intent==='feature'?'Describe screens + what clicks do':'Describe one change'}</span><button className="dx-primary" disabled={busy||!s.enabled||(!copying&&!isSettingsRequest(prompt)&&!choicePlan(prompt)&&aiModel==='Wandel account'&&auth==='checking')||(!!s.selected&&!needsSignIn&&!prompt.trim())} onClick={()=>void apply()}>{busy?'Creating…':copying?'Duplicate selection':isSettingsRequest(prompt)?'Add to Advanced settings':choicePlan(prompt)?'Add matching category':needsSignIn?'Sign in to create':!s.selected?'Find section & create':ai&&!aiModel?'Connect AI':intent==='feature'?'Create feature':'Apply change'}</button></div>
              </div>
              {needsSignIn&&<p className="dx-access">Multi-step features require a Wandel sign-in. Guest previews cover single-screen edits. <button onClick={()=>setIntent('edit')}>Try a free edit</button></p>}
              {auth==='unavailable'&&aiModel==='Wandel account'&&<p className="dx-access">Account status is unavailable. Check your connection below; your prompt stays here.</p>}
              <div className="dx-chips">{(intent==='feature'?[['Onboarding','Add onboarding with profile details, preferences, and a welcome screen. Include Continue and Back actions.'],['Approval flow','Add a review dashboard, details with a note, Approve and Reject branches, and confirmations returning to the updated dashboard.']]:[['Add a field','Add a name field inside this'],['Rename','Rename this to Get started']]).map(([label,value])=><button key={label} disabled={busy} onClick={()=>setPrompt(value)}>{label}</button>)}</div>
              <p className="dx-muted">{intent==='feature'?'Describe → create connected screens → open Flow to play them. You can edit and extend every screen.':'Double-click text to rename it. Drag to move, or use a corner to resize.'}</p>
              <details className="dx-advanced" open={advanced} onToggle={e=>setAdvanced(e.currentTarget.open)}><summary>{ai?(aiModel?'AI connection · '+(aiModel==='Wandel account'?'Wandel':aiModel):'Connect AI'):'Offline presets · change connection'}</summary><section><select aria-label="Planner mode" value={ai?'ai':'local'} onChange={e=>{setAI(e.target.value==='ai');setError('');setNotice('');}}><option value="local">Offline presets</option><option value="ai">AI planner</option></select>{ai&&<div className="dx-ai" role="status"><strong>{aiModel?aiModel==='Wandel account'?'Wandel AI':`Server connected · ${aiModel}`:'AI is not connected'}</strong>{!aiModel?<>{!demo&&<button className="dx-small" onClick={()=>setAIModel('Wandel account')}>Use Wandel account</button>}<p>Natural-language changes need an AI connection. Configure your API key and model locally, run <code>npm run ai</code>, then paste the server token here.</p><input aria-label="Local AI server token" type="password" value={token} onChange={e=>{setToken(e.target.value);setAIModel('');setConnectionError('');}} placeholder="Local server token · not your API key" autoComplete="off" onKeyDown={e=>{if(e.key==='Enter'&&!connecting)void connectAI();}} disabled={connecting}/><button className="dx-small" disabled={connecting||!token.trim()} onClick={()=>void connectAI()}>{connecting?'Connecting…':'Connect AI'}</button><small>Your OpenAI key stays on your computer. Submitted prompts and the selected label are sent to OpenAI.</small>{connectionError&&<p role="alert">{connectionError}</p>}</>:<p>Only submitted prompts and the selected label are sent. {aiModel==='Wandel account'&&<>Try two small UI changes without signing in. Guest prompts: 600 characters; one section at a time. </>}<button className="dx-small" onClick={()=>{setAIModel('');setToken('');}}>{aiModel==='Wandel account'?'Use local server':'Disconnect'}</button></p>}</div>}</section></details>
              </>}
            </section>
        </div>
              </main><footer className="dx-footer dx-action-row"><button className={s.dirty?'dx-primary':'dx-secondary'} disabled={busy} onClick={()=>{if(demo)void run({type:'save'},'Saved in this demo browser.');else setSaving(true);}}>{s.versions.length?'Save version':'Save'}</button><button className="dx-secondary" aria-pressed={shown==='implement'} disabled={busy} onClick={()=>shown==='implement'?toChat():setTab('implement')}>Build &amp; GitHub</button><button className="dx-secondary" aria-pressed={shown==='flow'} disabled={busy||!s.replay&&s.workflow.states.length<2} title={s.workflow.states.length<2?'Add a second screen to see and play a flow':'See your screens and play them'} onClick={()=>shown==='flow'?toChat():setTab('flow')}>Flow</button><button className="dx-secondary" aria-pressed={shown==='share'} disabled={busy} onClick={()=>shown==='share'?toChat():setTab('share')}>Share</button>{(s.liveSession||s.workflow.states.some(st=>st.operations.some(op=>op.kind==='mirror')))&&<small><span>●</span> {s.liveSession?'Live app · original controls perform real actions':'Mirrored controls can run live app actions'}</small>}</footer>
    </>}
  </div>;
}
