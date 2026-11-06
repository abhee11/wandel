import {Session} from '../../extension/content/session';
import {Repository,BrowserStorage} from '../../extension/storage/store';
import {createWorkflow,addOperation} from '../../extension/prototype/engine';
import {describe} from '../../extension/content/locator';
// A shared flow built on a button only the owner's account has. ?mine=1 is the owner's account; without it the button is missing.
const main=document.getElementById('app')!,mine=new URL(location.href).searchParams.has('mine');
const button=document.createElement('button');button.textContent='My report';button.id='only-mine';main.append(button);
let workflow=createWorkflow(new URL(location.href),'Shared check');
workflow=addOperation(workflow,workflow.entry,{id:'op-style',kind:'style',target:describe(button).locator,style:{backgroundColor:'#ffd9a0'}});
// ?known=1: the owner's own page was already missing this when they shared, so it must not stop the link.
if(new URL(location.href).searchParams.has('known'))workflow={...workflow,shareBaseline:['style “My report”: target missing or ambiguous']};
if(!mine)button.remove();
localStorage.clear();
const repository=new Repository(new BrowserStorage());await repository.save(workflow,true);
// ?wait=1: the link landed on another page. ?password=1 makes it a sign-in page.
const params=new URL(location.href).searchParams,waiting=params.has('wait');
if(params.has('password'))main.append(Object.assign(document.createElement('input'),{type:'password'}));
const session=new Session(main,repository,new URL(location.href),{liveNavigation:{sharedWait:waiting?{name:'Shared check',url:location.pathname+'?mine=1',sameSite:true}:null,read:async()=>waiting?null:({workflowId:workflow.id,stateId:workflow.entry,visits:[],mode:'replay',minimized:false,dialogs:{},shared:true}),go:async()=>{},clear:async()=>{}}} as never);
await session.init();Object.assign(window,{session});
