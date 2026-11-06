import {Session} from '../content/session';
import {Repository,type StorageAdapter} from '../storage/store';
import {RecordSchema,type Workflow} from '../shared/model';
/** Runs a published prototype on its frozen page, with no extension and no account. Storage lives in memory: the page's sandbox has none, and nothing here is saved. */
class MemoryStorage implements StorageAdapter{
 private values=new Map<string,unknown>();
 async read(key:string){return this.values.get(key);}
 async write(key:string,value:unknown){this.values.set(key,value);}
 async remove(key:string){this.values.delete(key);}
 async keys(){return [...this.values.keys()];}
}
function bar(session:Session,workflow:Workflow){
 const host=document.createElement('div');host.dataset.dxIgnore='true';host.style.cssText='position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483646;';
 const shadow=host.attachShadow({mode:'open'}),box=document.createElement('nav');box.setAttribute('aria-label','Prototype screens');
 box.style.cssText='display:flex;align-items:center;gap:6px;max-width:calc(100vw - 32px);overflow-x:auto;padding:6px 8px;border-radius:12px;background:#1e1b2e;color:#fff;font:13px/1.3 system-ui,sans-serif;box-shadow:0 6px 24px #0005;white-space:nowrap;';
 const label=document.createElement('span');label.textContent='Prototype preview';label.style.cssText='padding:0 8px;font-weight:600;';box.append(label);
 const screens=workflow.states.filter(state=>!state.liveURL||state.id===workflow.entry);
 const paint=()=>{const current=session.snapshot().stateId;for(const button of box.querySelectorAll('button'))button.style.background=button.dataset.id===current?'#6d5ae6':'transparent';};
 if(screens.length>1)for(const state of screens){const button=document.createElement('button');button.type='button';button.dataset.id=state.id;button.textContent=state.id===workflow.entry?'Original':state.title;button.style.cssText='padding:6px 10px;border:0;border-radius:8px;color:#fff;font:inherit;cursor:pointer;';button.onclick=()=>{void session.dispatch({type:'state',id:state.id}).catch(()=>{/* A screen that cannot open keeps the current one. */});};box.append(button);}
 shadow.append(box);document.documentElement.append(host);session.subscribe(paint);paint();
}
async function start(){
 const source=document.getElementById('wandel-public');if(!source)return;
 const record=RecordSchema.parse({draft:JSON.parse(source.textContent||'null'),enabled:true,currentVersion:0,versions:[]});source.remove();
 const workflow=record.draft,session=new Session(document.body,new Repository(new MemoryStorage()),new URL(workflow.origin+workflow.route),{viewer:true});
 await session.init();await session.dispatch({type:'loadRecord',record});await session.dispatch({type:'replay'});
 bar(session,workflow);
}
void start();
