import {createRoot} from 'react-dom/client';
import {Session} from '../../extension/content/session';
import {Repository,BrowserStorage} from '../../extension/storage/store';
import {App} from '../../extension/sidepanel/App';
import {createWorkflow,addOperation,addChild} from '../../extension/prototype/engine';
import type {Locator} from '../../extension/shared/model';
import '../../extension/sidepanel/style.css';
const target:Locator={tag:'main',name:'Screen 1',text:'Screen 1',role:'main',attrs:{id:'app'},parent:{tag:'body',id:'',role:'',label:''},previous:'',next:''};
let workflow=createWorkflow(new URL(location.href),'Screen 1 → Profile → Library');workflow.states[0].title='Screen 1';
workflow=addOperation(workflow,workflow.entry,{id:'op-profile',kind:'insert',target,position:'inside',node:{id:'open-profile',kind:'button',text:'Open Profile'}});
const profile=addChild(workflow,workflow.entry,'open-profile','Profile');workflow=profile.workflow;
workflow=addOperation(workflow,profile.stateId,{id:'op-library',kind:'insert',target:{...target,owned:'view:'+profile.stateId},position:'inside',node:{id:'open-library',kind:'button',text:'Open Library'}});
workflow=addChild(workflow,profile.stateId,'open-library','Library').workflow;
const session=new Session(document.getElementById('app')!,new Repository(new BrowserStorage()),new URL(location.href));await session.init();await session.dispatch({type:'loadRecord',record:{draft:workflow,enabled:true,currentVersion:1,versions:[{number:1,savedAt:workflow.updatedAt,workflow}]}});await session.dispatch({type:'replay'});await session.dispatch({type:'state',id:profile.stateId});
// ?share shows the Share view with links already made, and no server.
if(new URL(location.href).searchParams.has('share')){
 (globalThis as any).chrome={...(globalThis as any).chrome,runtime:{id:'fixture',sendMessage:async()=>({token:'fixture'})}};
 const real=window.fetch,answer=(value:unknown)=>new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});
 window.fetch=async(url,init)=>String(url).includes('/workflow-links')?answer({links:[{id:'a',name:'Summer sale flow',url:'https://wandel.example/flow#token=a',createdAt:'2026-11-06',expiresAt:'2026-12-06'}]}):String(url).includes('/public-views')?answer({views:[{id:'b',name:'Feedback card redesign',masked:true,url:'https://wandel.example/view/b',expiresAt:'2026-12-01'}]}):real(url,init);
}
// ?issues shows the notice for edits that aren't on screen.
const withIssues=<T extends {unresolved:string[]}>(input:T):T=>{const snapshot=new URL(location.href).searchParams.has('shared')?{...input,sharedExperience:true}:input;return new URL(location.href).searchParams.has('issues')?{...snapshot,unresolved:Array.from({length:22},(_,index)=>`style “Card ${index}”: target missing or ambiguous`)}:snapshot;};
createRoot(document.getElementById('wandel-panel')!).render(<App demo demoAccount={{user:{name:'Sample Person',email:'sample@example.com'},entitlements:{plan:'FREE',access:null,usage:{used:23,allowance:200,remaining:177,resetsAt:'2026-12-01T00:00:00.000Z'}}}} bridge={{send:async command=>withIssues(await session.dispatch(command)),subscribe:listener=>session.subscribe(snapshot=>listener(snapshot&&withIssues(snapshot)))}}/>);
