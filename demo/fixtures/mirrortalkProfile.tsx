import {createRoot} from 'react-dom/client';
import {useEffect,useState} from 'react';
import {Session} from '../../extension/content/session';
import {Repository,BrowserStorage} from '../../extension/storage/store';
import {AssistantPanel} from '../../extension/assistant/AssistantPanel';
import type {Snapshot} from '../../extension/shared/model';
import type {Bridge} from '../../extension/sidepanel/bridge';
import '../../extension/sidepanel/style.css';
// React renders the MirrorTalk heading as two adjacent text nodes.
document.getElementById('m2-heading')!.append(document.createTextNode('M2'),document.createTextNode(' +'));
// Served as a URL like MirrorTalk's static media (set here so Vite does not inline it).
document.querySelector<HTMLElement>('.logo')!.style.backgroundImage=`url(${new URL('./reflectivity-logo.svg',location.href).href})`;
const session=new Session(document.getElementById('page')!,new Repository(new BrowserStorage()),new URL(location.href),{assistantEnabled:true});
const ready=session.init().then(()=>session.dispatch({type:'edit'}));
const bridge:Bridge={send:async command=>{await ready;return session.dispatch(command);},subscribe:listener=>session.subscribe(listener)};
function Fixture(){const [snapshot,setSnapshot]=useState<Snapshot|null>(null);useEffect(()=>{const unsubscribe=session.subscribe(setSnapshot);void ready.then(()=>setSnapshot(session.snapshot()));return unsubscribe;},[]);return snapshot?<AssistantPanel bridge={bridge} snapshot={snapshot} onSave={()=>void session.dispatch({type:'saveTemporary'})}/>:<p>Connecting…</p>;}
createRoot(document.getElementById('panel')!).render(<Fixture/>);
for(const [id,type]of [['undo','undo'],['redo','redo']]as const)document.getElementById(id)!.onclick=()=>void session.dispatch({type});
/** Replays a recorded provider plan through the real context → apply → render → verify path. */
const instruction='Duplicate the M2 + card for me—same size—put it just beside the original.';
const cards=()=>[...document.querySelectorAll<HTMLElement>('ul.integrations>li')].map(card=>{const r=card.getBoundingClientRect();return {text:card.textContent?.replace(/\s+/g,' ').trim(),x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)};});
Object.assign(window,{session,cards,repro:async(action:Record<string,unknown>)=>{
 await ready;const snapshot=await session.dispatch({type:'assistantContext',instruction,chat:true});const context=snapshot.assistant!.context!;
 const target=context.elements.find(e=>e.tag==='li'&&/^M2 \+/.test(e.text||e.name||''));if(!target)return {error:'M2 card not in context',elements:context.elements.slice(0,40).map(e=>[e.ref,e.tag,e.text])};
 const plan={status:'edit',scope:'region',message:'repro',reply:'repro',question:null,candidates:[],memory:null,actions:[{kind:'duplicate',targets:[target.ref],relativeTo:null,resultRef:'new:m2-card-copy',element:null,text:null,description:null,labels:[],position:'after',styleRef:null,style:null,destination:null,newViewTitle:null,...action}]};
 const before=cards();try{await session.dispatch({type:'assistantApply',plan,token:context.token});return {ok:true,before,after:cards()};}catch(error){return {ok:false,error:error instanceof Error?error.message:String(error),stack:error instanceof Error?error.stack?.split('\n').slice(0,6):undefined,before,after:cards()};}
}});
