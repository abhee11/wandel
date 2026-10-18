import {groundPlan} from './grounding';
import {useEffect,useRef,useState} from 'react';
import type {Bridge} from '../sidepanel/bridge';
import type {Snapshot} from '../shared/model';
import {interpret} from './interpret';
import {planConversation,transcribeInstruction} from './client';
import {PushToTalk} from './voice';
import type {PageContext,AssistantPlan} from './schema';
export function AssistantPanel({bridge,snapshot,onSave}:{bridge:Bridge;snapshot:Snapshot;onSave:()=>void}){
 const [voiceTranscript,setVoiceTranscript]=useState('');
 const [instruction,setInstruction]=useState(''),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[listening,setListening]=useState(false),[message,setMessage]=useState('Select a target, then tell Wandel what to change.'),[error,setError]=useState(''),[clarification,setClarification]=useState<AssistantPlan|null>(null);
 const epoch=useRef(0),abort=useRef<AbortController|null>(null),voice=useRef<PushToTalk|null>(null),voiceContext=useRef<Promise<PageContext>|null>(null),pending=useRef(''),voiceHeld=useRef(false);
 const scope=snapshot.workflow.id+':'+snapshot.stateId+':'+snapshot.workflow.route;
 const scopeRef=useRef(scope);scopeRef.current=scope;
 async function context(){const next=await bridge.send({type:'assistantContext'});if(!next.assistant?.context)throw new Error('Refresh this page to use the assistant beta.');return next.assistant.context;}
 function cancel(){epoch.current++;abort.current?.abort();abort.current=null;voice.current?.cancel();voiceHeld.current=false;setBusy(false);setListening(false);setError('');setMessage('Canceled. Your workflow is unchanged by this request.');}
 useEffect(()=>{epoch.current++;abort.current?.abort();voice.current?.cancel();voiceHeld.current=false;setBusy(false);setListening(false);setClarification(null);pending.current='';setInstruction('');setError('');setMessage('Select a target, then tell Wandel what to change.');},[scope]);
 useEffect(()=>()=>{epoch.current++;abort.current?.abort();voice.current?.cancel();},[]);
 async function submit(text:string,prepared?:Promise<PageContext>){
  const value=text.trim();if(!value)return;const request=++epoch.current,origin=scopeRef.current;abort.current?.abort();const controller=new AbortController();abort.current=controller;setBusy(true);setError('');setClarification(null);setMessage('Understanding your selection…');
  try{const c=await (prepared||context());const combined=pending.current?pending.current+'\nLabels: '+value:value;let plan=interpret(combined,c);
   if(!plan){if(!consent)throw new Error('This phrasing needs AI interpretation. Enable scoped context sharing below, or use an explicit local instruction.');setMessage('Interpreting scoped labels and styles…');plan=await planConversation(combined,c,controller.signal);}
   if(request!==epoch.current||origin!==scopeRef.current)return;plan=groundPlan(combined,c,plan);
   if(plan.status==='clarify'||plan.status==='unsupported'){setClarification(plan);if(plan.status==='clarify')setInstruction('');if(plan.candidates.length)await bridge.send({type:'assistantCandidates',refs:plan.candidates});pending.current=plan.status==='clarify'?combined:'';setMessage(plan.message);return;}
   pending.current='';
   if(plan.status==='undo'||plan.status==='redo')await bridge.send({type:plan.status});
   else if(plan.status==='save')onSave();
   else{setMessage('Applying a reversible preview…');await bridge.send({type:'assistantApply',plan,token:c.token});}
   if(request===epoch.current){setMessage(plan.status==='edit'?plan.message+' · Undo is available.':plan.message);setInstruction('');}
  }catch(e){if(request===epoch.current){setError(e instanceof Error?e.message:'No changes were applied.');setMessage('Your instruction is kept.');}}finally{if(request===epoch.current)setBusy(false);}
 }
 async function style(){setError('');try{const c=await context();if(!c.selected)throw new Error('Select a style reference on the page first.');await bridge.send({type:'assistantStyle',ref:c.selected});setMessage('Style pinned. Select your target or continue describing the options.');}catch(e){setError((e as Error).message);}}
 function startVoice(){if(busy||listening||voiceHeld.current)return;if(!consent){setError('Enable voice/context sharing first. Typed local instructions remain available.');return;}voiceHeld.current=true;setVoiceTranscript('');setError('');voiceContext.current=context();void voiceContext.current.catch(()=>{});
  const request=++epoch.current,origin=scopeRef.current;
  voice.current=new PushToTalk(setListening,blob=>{voiceHeld.current=false;if(request!==epoch.current||origin!==scopeRef.current)return;setBusy(true);setMessage('Transcribing your instruction…');const controller=new AbortController();abort.current=controller;void transcribeInstruction(blob,controller.signal).then(text=>{if(request!==epoch.current||origin!==scopeRef.current)return;setVoiceTranscript(text);setInstruction(text);return submit(text,voiceContext.current||undefined);}).catch(e=>{if(request===epoch.current){setError(e.message);setBusy(false);}});},message=>{voiceHeld.current=false;setError(message);setBusy(false);});
  setMessage('Hold to speak. Release to send; Cancel discards audio.');void voice.current.start();
 }
 const c=snapshot.assistant?.context,selected=c?.elements.find(e=>e.ref===c.selected),pinned=c?.elements.find(e=>e.ref===c.styleReference);
 return <section className="dx-assistant" aria-label="Conversational assistant"><div className="dx-section-title">ASSISTANT BETA <span>{listening?'● Microphone on':busy?'Processing…':'Point · speak · prototype'}</span></div>
 <p className="dx-assistant-target">Target: <strong>{snapshot.selected?.label||'Select an element on the page'}</strong>{pinned&&<small>Style: {pinned.name}</small>}</p>
 <div className="dx-row"><button className="dx-small" disabled={busy||listening} onClick={()=>void style()}>Use selection as style</button><button className="dx-small" disabled={busy||listening} onClick={()=>void bridge.send({type:'assistantContext'}).catch(e=>setError(e.message))}>Refresh context</button></div>
 <label className="dx-muted"><input type="checkbox" checked={consent} disabled={busy||listening} onChange={e=>setConsent(e.target.checked)}/> Allow scoped labels/styles and recorded voice to Wandel’s server and OpenAI. No screenshots or typed field values. Voice and cloud requests use AI credits.</label>
 <textarea aria-label="Tell Wandel what to change" rows={3} maxLength={1600} value={instruction} disabled={busy||listening} onChange={e=>setInstruction(e.target.value)} placeholder="Add a Feedback length option below this." onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();if(!busy)void submit(instruction);}}}/>
 <div className="dx-row"><button className="dx-secondary" aria-pressed={listening} disabled={busy} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture?.(e.pointerId);startVoice();}} onPointerUp={()=>{voiceHeld.current=false;voice.current?.stop();}} onPointerCancel={()=>{voiceHeld.current=false;voice.current?.cancel();}} onKeyDown={e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();startVoice();}}} onKeyUp={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();voice.current?.stop();}}}>{listening?'● Release to send':'Hold to speak'}</button><button className="dx-primary" disabled={busy||listening||!instruction.trim()} onClick={()=>void submit(instruction)}>Send</button><button className="dx-small" onClick={cancel}>Cancel</button><button className="dx-small" disabled={busy||listening||!snapshot.canUndo} onClick={()=>void submit('Undo that last change')}>Undo</button></div>
 {voiceTranscript&&<p className="dx-muted" aria-label="Last voice instruction">Heard: {voiceTranscript}</p>}
 {error&&<p role="alert" className="dx-alert error">{error}</p>}<p role="status" className="dx-muted">{message}</p>
 {clarification?.candidates.map(ref=>{const element=c?.elements.find(e=>e.ref===ref);return <button key={ref} className="dx-small" onClick={()=>void bridge.send({type:'assistantCandidate',ref}).then(()=>{setClarification(null);setMessage('Target selected. Send your instruction again.');pending.current='';}).catch(e=>setError(e.message))}>{element?.name||ref}</button>;})}
 <details><summary>Context & recent edits</summary><p className="dx-muted">{c?.elements.length||0} scoped elements. Screenshots are off. Frames are not inspected.</p>{snapshot.assistant?.transactions.map(t=><p key={t.id}>{t.message}</p>)}<button className="dx-small" disabled={busy||listening} onClick={()=>{pending.current='';setVoiceTranscript('');setClarification(null);void bridge.send({type:'assistantReset'});}}>Reset conversation</button></details>
 </section>;
}
