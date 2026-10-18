import {RecordSchema} from '../shared/model';
import {validateWorkflow} from '../prototype/engine';
export function registerLocalStorage(){
 void chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
 chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if(m?.type!=='WANDEL_LOCAL_STORAGE'||sender.id!==chrome.runtime.id)return;
  const key:string=typeof m.key==='string'?m.key:'';
  if(key&&!key.startsWith('dx:workflow:')&&!key.startsWith('dx:active:'))return;
  (async()=>{
   if(m.action==='keys')return Object.keys(await chrome.storage.local.get(null)).filter(k=>k.startsWith('dx:'));
   if(!key)throw new Error('Missing storage key.');
   if(m.action==='read')return (await chrome.storage.local.get(key))[key];
   if(m.action==='remove'){await chrome.storage.local.remove(key);return;}
   if(m.action!=='write')throw new Error('Invalid storage action.');
   if(key.startsWith('dx:workflow:')){const r=RecordSchema.parse(m.value);validateWorkflow(r.draft);r.versions.forEach(v=>validateWorkflow(v.workflow));if([r.draft,...r.versions.map(v=>v.workflow)].some(w=>w.states.some(s=>s.operations.some(o=>o.kind==='mirror'))))throw new Error('Mirrored actions are not supported in this build.');if(key!==`dx:workflow:${r.draft.id}`)throw new Error('Workflow ID mismatch.');}
   else if(typeof m.value!=='string'||m.value.length>100)throw new Error('Invalid active workflow.');
   await chrome.storage.local.set({[key]:m.value});
  })().then(value=>reply({value})).catch(()=>reply({error:'Local save failed. Your current draft is still open. Export a backup or free extension storage, then retry.'}));return true;
 });
}
