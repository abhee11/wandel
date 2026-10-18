import {Session} from '../../extension/content/session';
import {Repository,BrowserStorage} from '../../extension/storage/store';
const repository=new Repository(new BrowserStorage());
const session=new Session(document.querySelector('main')!,repository,new URL(location.href),{directSelection:true});
await session.init();await session.dispatch({type:'edit'});
const status=document.querySelector('output')!;
for(const [id,type] of [['edit','edit'],['interact','interact'],['save','saveTemporary'],['undo','undo']] as const)document.getElementById(id)!.onclick=()=>{void session.dispatch({type}).then(()=>{status.textContent=id==='save'?'Saved locally':type;}).catch(e=>{status.textContent=e.message;});};
document.getElementById('restore')!.onclick=async()=>{const records=await repository.list(location.origin,location.pathname);if(records[0]){await session.dispatch({type:'loadRecord',record:records[0]});status.textContent='Saved text workflow restored';}else status.textContent='Save a workflow first';};
window.addEventListener('beforeunload',()=>session.destroy());
