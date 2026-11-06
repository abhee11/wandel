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

// ?stub=new-page runs the real panel with no AI: the plan call answers with a button that opens a new page. window.sendToPanel(text) types and sends.
if(new URL(location.href).searchParams.get('stub')==='new-page'){
 const empty={css:null,event:null,effects:null,pageContent:null,chart:null,block:null,inputType:null,required:null,options:null,radioGroup:null,columns:null,layout:null,theme:null,href:null,element:null,text:null,description:null,labels:[],position:null,styleRef:null,style:null,destination:null,newViewTitle:null,relativeTo:null,resultRef:null,presentation:null};
 const answer=(value:unknown)=>new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}}),real=window.fetch;
 (globalThis as any).chrome={...(globalThis as any).chrome,runtime:{id:'fixture',sendMessage:async()=>({token:'fixture'})}};
 // Talk mode runs on a real audio graph: window.voice(true) is someone speaking, and window.heard is what they said.
 const voiceContext=new AudioContext(),tone=voiceContext.createOscillator(),gain=voiceContext.createGain(),line=voiceContext.createMediaStreamDestination();gain.gain.value=0;tone.frequency.value=220;tone.connect(gain);gain.connect(line);tone.start();
 navigator.mediaDevices.getUserMedia=(async()=>{await voiceContext.resume();return line.stream;}) as typeof navigator.mediaDevices.getUserMedia;
 const calls:string[]=[];Object.assign(window,{voice:(on:boolean)=>{gain.gain.value=on?.2:0;},heard:'',calls});sessionStorage.setItem('wandel:voice-sharing:v2','allowed');
 window.fetch=async(url,init)=>{if(!String(url).includes('/api/assistant/'))return real(url,init);
  if(String(url).includes('/transcribe')){calls.push('transcribe');return answer({text:(window as unknown as {heard:string}).heard});}
  if(!String(url).endsWith('/plan'))return answer({ok:true,verdict:{status:'pass',message:'Stub.'}});
  const {context,instruction}=JSON.parse(String(init?.body)),target=context.elements.find((element:{tag:string})=>element.tag==='button');calls.push('plan: '+instruction);
  if(/slow/.test(instruction))await new Promise(resolve=>setTimeout(resolve,4000));
  if(!/button/.test(instruction))return answer({plan:{reply:null,memory:null,status:'answer',scope:'page',message:'Sure. '+instruction,question:null,candidates:[],actions:[]}});
  return answer({plan:{reply:'Added Open page, which opens a new page.',memory:null,status:'edit',scope:'page',message:'Stub.',question:null,candidates:[],actions:[{...empty,kind:'create',element:'button',text:'Open page',targets:[target.ref],position:'after',resultRef:'new:open'},{...empty,kind:'connect',targets:['new:open'],newViewTitle:'Second page',presentation:'page'}]}});};
 Object.assign(window,{session,sendToPanel:async(text:string)=>{const box=document.querySelector<HTMLTextAreaElement>('#panel textarea')!;Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(box,text);box.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,200));[...document.querySelectorAll<HTMLButtonElement>('#panel button')].find(button=>button.textContent?.trim()==='Send'||button.getAttribute('aria-label')==='Send')!.click();await new Promise(resolve=>setTimeout(resolve,2500));return document.querySelector<HTMLElement>('#panel')!.innerText;}});
}
