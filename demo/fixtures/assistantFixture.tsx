import {createRoot} from 'react-dom/client';
import {useEffect,useState} from 'react';
import {Session} from '../../extension/content/session';
import {Repository,BrowserStorage} from '../../extension/storage/store';
import {AssistantPanel} from '../../extension/assistant/AssistantPanel';
import type {Snapshot} from '../../extension/shared/model';
import type {Bridge} from '../../extension/sidepanel/bridge';
import '../../extension/sidepanel/style.css';
const session=new Session(document.getElementById('dialog')!,new Repository(new BrowserStorage()),new URL(location.href),{assistantEnabled:true});
const ready=session.init().then(()=>session.dispatch({type:'edit'}));
const bridge:Bridge={send:async command=>{await ready;return session.dispatch(command);},subscribe:listener=>session.subscribe(listener)};
function Fixture(){const [snapshot,setSnapshot]=useState<Snapshot|null>(null);useEffect(()=>{const unsubscribe=session.subscribe(setSnapshot);void ready.then(()=>setSnapshot(session.snapshot()));return unsubscribe;},[]);return snapshot?<AssistantPanel bridge={bridge} snapshot={snapshot} onSave={()=>void session.dispatch({type:'saveTemporary'})}/>:<p>Connecting…</p>;}
createRoot(document.getElementById('panel')!).render(<Fixture/>);
for(const [id,type]of [['edit','edit'],['try','replay'],['undo','undo'],['save','saveTemporary']]as const)document.getElementById(id)!.onclick=()=>void session.dispatch({type});
document.getElementById('reload')!.onclick=()=>void session.dispatch({type:'load',id:session.workflow.id});
