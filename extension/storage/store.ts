import { RecordSchema, clone, type SavedRecord, type Workflow } from '../shared/model';
import { validateWorkflow } from '../prototype/engine';
export interface StorageAdapter { read(key: string): Promise<unknown>; write(key: string, value: unknown): Promise<void>; remove(key: string): Promise<void>; keys(): Promise<string[]> }
export class ChromeStorage implements StorageAdapter {
  async read(key:string) { return (await chrome.storage.local.get(key))[key]; }
  async write(key:string,value:unknown) { await chrome.storage.local.set({[key]:value}); }
  async remove(key:string) { await chrome.storage.local.remove(key); }
  async keys() { return Object.keys(await chrome.storage.local.get(null)); }
}
export class BrowserStorage implements StorageAdapter {
  async read(key:string) { return JSON.parse(localStorage.getItem(key) || 'null'); }
  async write(key:string,value:unknown) { localStorage.setItem(key,JSON.stringify(value)); }
  async remove(key:string) { localStorage.removeItem(key); }
  async keys() { return Object.keys(localStorage); }
}
export class Repository {
  constructor(public adapter:StorageAdapter) {}
  async get(id:string) {
    const value = await this.adapter.read(`dx:workflow:${id}`);
    if (!value) return null;
    const result = RecordSchema.parse(value); validateWorkflow(result.draft); result.versions.forEach(v=>validateWorkflow(v.workflow)); return result;
  }
  async list(origin:string,route:string) {
    const records:SavedRecord[]=[];
    for (const key of await this.adapter.keys()) {
      if (!key.startsWith('dx:workflow:')) continue;
      // A damaged record must not prevent other workflows from loading.
      try { const r=await this.get(key.slice(12)); if(r?.draft.origin===origin && (r.draft.route===route||r.draft.states.some(s=>s.liveURL===origin+route))) records.push(r); } catch { /* skip invalid record */ }
    }
    return records.sort((a,b)=>b.draft.updatedAt.localeCompare(a.draft.updatedAt));
  }
  async save(workflow:Workflow,enabled:boolean) {
    const w=validateWorkflow(clone(workflow)); w.updatedAt=new Date().toISOString();
    const previous=await this.get(w.id);
    const number=(previous?.versions.at(-1)?.number || 0)+1;
    const record:SavedRecord={draft:w,enabled,currentVersion:number,versions:[...(previous?.versions||[]),{number,savedAt:w.updatedAt,workflow:clone(w)}]};
    await this.put(record); return record;
  }
  async put(record:SavedRecord) { await this.adapter.write(`dx:workflow:${record.draft.id}`,RecordSchema.parse(record)); }
  async delete(id:string) { await this.adapter.remove(`dx:workflow:${id}`); }
  async restore(id:string,number:number) {
    const record=await this.get(id); const version=record?.versions.find(v=>v.number===number);
    if(!record || !version) throw new Error('Version not found.');
    record.currentVersion=number;record.draft=clone(version.workflow); record.draft.updatedAt=new Date().toISOString(); await this.put(record); return record;
  }
  async active(origin:string,route:string):Promise<string|null> { const id=await this.adapter.read(`dx:active:${origin}${route}`); return typeof id==='string'?id:null; }
  async setActive(w:Workflow) {for(const url of new Set([w.origin+w.route,...w.states.flatMap(s=>s.liveURL?[s.liveURL]:[])]))await this.adapter.write(`dx:active:${url}`,w.id); }
}

/** Browser-session storage via the background worker; never enables token access for content scripts. */
export class TemporaryChromeStorage implements StorageAdapter {
 private async call(action:string,key?:string,value?:unknown){const response=await chrome.runtime.sendMessage({type:'WANDEL_TEMP_STORAGE',action,key,value});if(response?.error)throw new Error(response.error);return response?.value;}
 read(key:string){return this.call('read',key);}
 async write(key:string,value:unknown){await this.call('write',key,value);}
 async remove(key:string){await this.call('remove',key);}
 keys():Promise<string[]>{return this.call('keys');}
}

export class PersistentChromeStorage implements StorageAdapter {
 private async call(action:string,key?:string,value?:unknown){const response=await chrome.runtime.sendMessage({type:'WANDEL_LOCAL_STORAGE',action,key,value});if(!response||response.error)throw new Error(response?.error||'Local storage is unavailable. Your draft is still open.');return response.value;}
 read(key:string){return this.call('read',key);}
 async write(key:string,value:unknown){await this.call('write',key,value);}
 async remove(key:string){await this.call('remove',key);}
 keys():Promise<string[]>{return this.call('keys');}
}
