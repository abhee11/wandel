import {Session} from '../../extension/content/session';
import {Repository,BrowserStorage} from '../../extension/storage/store';
/** Loads a saved record into a Session on the current page (no extension), reporting unresolved changes. */
export async function replay(record:any){
 const rebase=(w:any)=>({...w,origin:location.origin,route:location.pathname});record={...record,draft:rebase(record.draft),versions:record.versions.map((v:any)=>({...v,workflow:rebase(v.workflow)}))};
 const session=new Session(document.body,new Repository(new BrowserStorage()),new URL(location.href),{});
 await session.init();await session.dispatch({type:'edit'});
 const snapshot=await session.dispatch({type:'loadRecord',record} as any);
 (window as any).wandelSession=session;
 return {stateId:snapshot.stateId,unresolved:snapshot.unresolved,owned:document.querySelectorAll('[data-dx-owned]').length};
}
/** Scores each saved locator against the current DOM without applying anything. */
export async function probe(record:any){
 const {resolve,nameOf,safeText}=await import('../../extension/content/locator');
 return record.draft.states[0].operations.map((op:any)=>{const el=resolve(op.target,document.body,new Map());const same=[...document.querySelectorAll(op.target.tag)].filter(e=>nameOf(e)===op.target.name);return {kind:op.kind,found:!!el,sameName:same.length,sameText:same.filter(e=>safeText(e)===op.target.text).length,names:same.slice(0,3).map(e=>safeText(e).slice(0,80))};});
}
