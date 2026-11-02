/** Renders the panel's account bar, Saved list and Save dialog with stubbed Chrome and account responses (?state=in|out). */
const signedIn=new URLSearchParams(location.search).get('state')!=='out';
const store:Record<string,unknown>={};
(globalThis as any).chrome={runtime:{id:'fixture',onMessage:{addListener(){},removeListener(){}},sendMessage:async()=>({token:signedIn?'t':null})},storage:{local:{get:async(k:any)=>typeof k==='string'?{[k]:store[k]}:store,set:async(v:any)=>{Object.assign(store,v);}},session:{get:async()=>({}),set:async()=>{}}}};
const flows=['My record demo','Feedback demo','Group Onboarding'].map((name,i)=>({id:'w'+i,name,origin:'https://mirrortalk.ai',route:'/groups/102949',version:i+1,revision:1}));
// The account copy of w1 was saved elsewhere: revision 7, so a save from revision 1 conflicts.
let serverRevision=7;const calls:string[]=[];(window as any).calls=calls;
const workflow=(id:string,name:string)=>({id,name,origin:'https://mirrortalk.ai',route:'/groups/102949',entry:'s',states:[{id:'s',title:'Start',parent:null,view:'base',operations:[]}],edges:[],maxStates:20,createdAt:'2026-11-01T00:00:00.000Z',updatedAt:'2026-11-01T00:00:00.000Z'});
const realFetch=fetch;
(globalThis as any).fetch=async(url:string,init?:RequestInit)=>{const path=new URL(url).pathname,method=init?.method||'GET',body=init?.body?JSON.parse(String(init.body)):null;calls.push(method+' '+path+(body?.revision!==undefined?' rev='+body.revision:''));const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
 if(!signedIn)return reply({error:{code:'AUTH_REQUIRED',message:'Sign in'}},401);
 if(path==='/api/me')return reply({user:{id:'u',email:'mathur.abhinav26@gmail.com',name:''},entitlements:{plan:'pro',access:{source:'beta'}}});
 if(path==='/api/workflows'&&method==='GET')return reply({workflows:flows});
 if(path==='/api/workflows'&&method==='POST'){const existing=flows.find(f=>f.id===body.workflow.id);if(existing&&body.revision!==serverRevision)return reply({error:{code:'REVISION_CONFLICT',message:'A different saved version exists.'}},409);serverRevision++;if(existing){existing.version++;existing.name=body.workflow.name;}else flows.unshift({id:body.workflow.id,name:body.workflow.name,origin:'https://mirrortalk.ai',route:'/groups/102949',version:1,revision:1});const f=flows.find(f=>f.id===body.workflow.id)!;return reply({record:{draft:body.workflow,enabled:true,currentVersion:f.version,versions:[]},revision:existing?serverRevision:1,savedRevision:existing?serverRevision:1});}
 const id=decodeURIComponent(path.split('/').pop()!);const f=flows.find(x=>x.id===id);
 if(path.startsWith('/api/workflows/')&&method==='GET')return f?reply({record:{draft:workflow(f.id,f.name),enabled:true,currentVersion:f.version,versions:[]},revision:serverRevision}):reply({error:{code:'NOT_FOUND',message:'Workflow not found.'}},404);
 if(path.startsWith('/api/workflows/')&&method==='PATCH'){f!.name=body.name;return reply({name:body.name});}
 if(path.startsWith('/api/workflows/')&&method==='DELETE'){flows.splice(flows.indexOf(f!),1);return reply({deleted:true});}
 return realFetch(url,init);};
const {createRoot}=await import('react-dom/client');const {Account,AccountSaves}=await import('../../extension/sidepanel/Account');const {SaveFlow}=await import('../../extension/sidepanel/SaveFlow');const {createElement:h,useState,useEffect}=await import('react');
// The open draft is w1 ("Feedback demo"), last known at revision 1.
let current:any={dirty:true,versions:[],workflow:workflow('w1','Feedback demo')};store['wandelRevision:u:w1']=1;
const listeners=new Set<(s:any)=>void>();const emit=()=>listeners.forEach(l=>l(current));
const bridge={send:async(c:any)=>{calls.push('bridge '+c.type);if(c.type==='rename')current={...current,workflow:{...current.workflow,name:c.text}};if(c.type==='duplicate')current={...current,workflow:{...current.workflow,id:'w-copy',name:current.workflow.name+' — copy'}};if(c.type==='acknowledgeSave')current={...current,dirty:false};emit();return current;},subscribe:(l:any)=>{listeners.add(l);return()=>listeners.delete(l);}} as any;
(window as any).bridgeState=()=>current;
function Fixture(){const [s,setS]=useState(current);useEffect(()=>bridge.subscribe(setS),[]);const [saving,setSaving]=useState(new URLSearchParams(location.search).has('save'));
 return h('div',{className:'dx-app dx-panel'},h(Account,{bridge,snapshot:s,onCount:(c:number|null)=>{document.title='count '+c;}}),saving&&h(SaveFlow,{snapshot:s,bridge,onClose:()=>setSaving(false)}),h('main',{className:'dx-main'},h(AccountSaves,{snapshot:s,bridge})));}
createRoot(document.getElementById('root')!).render(h(Fixture));
export {};
