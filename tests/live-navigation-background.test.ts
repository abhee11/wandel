import {it,expect,vi,afterEach} from 'vitest';
import {registerLiveNavigation} from '../extension/background/liveNavigation';
import {createWorkflow,addLiveScreen} from '../extension/prototype/engine';
import type {LiveContext} from '../extension/shared/liveNavigation';
afterEach(()=>vi.unstubAllGlobals());
function environment(){
 const base=createWorkflow(new URL('https://example.com/home'));const {workflow:w,stateId}=addLiveScreen(base,base.entry,{id:'profile',url:'https://example.com/profile',route:'/profile',title:'Profile',thumbnail:'data:image/png;base64,aGVsbG8=',nodes:[{id:'a',parent:-1,tag:'div',text:'',style:{}}],capturedAt:new Date().toISOString(),truncated:false});
 const store:Record<string,any>={['dx:workflow:'+w.id]:{draft:w,enabled:true,currentVersion:0,versions:[]}};let receive:any;const tab={id:7,url:'https://example.com/home'};const update=vi.fn(async(id:number,options:any)=>{expect(id).toBe(7);tab.url=options.url;});const remove=vi.fn(async(key:string)=>{delete store[key];});
 vi.stubGlobal('chrome',{runtime:{id:'wandel',onMessage:{addListener:(fn:any)=>{receive=fn;}}},tabs:{get:vi.fn(async()=>tab),update,onRemoved:{addListener:vi.fn()}},storage:{session:{get:vi.fn(async(key:string)=>({[key]:store[key]})),set:vi.fn(async(data:any)=>Object.assign(store,structuredClone(data))),remove}}});registerLiveNavigation();
 const send=(m:any,sender:any={id:'wandel',tab:{id:7},frameId:0})=>new Promise<any>(resolve=>{const result=receive({type:'WANDEL_LIVE_NAVIGATION',...m},sender,resolve);if(!result)resolve(undefined);});
 const context:LiveContext={workflowId:w.id,stateId,visits:[w.entry],mode:'interact',minimized:false,dialogs:{}};return{w,stateId,store,tab,update,remove,send,context};
}
it('binds real navigation to the requesting tab, resumes after refresh, and recognizes browser Back',async()=>{
 const e=environment();expect(await e.send({action:'go',url:'https://example.com/profile',context:e.context})).toEqual({context:e.context});expect(e.update).toHaveBeenCalledWith(7,{url:'https://example.com/profile'});expect((await e.send({action:'read'})).context.stateId).toBe(e.stateId);
 e.tab.url='https://example.com/home';expect((await e.send({action:'read'})).context).toMatchObject({stateId:e.w.entry,visits:[]});await e.send({action:'clear'});expect(e.store['wandel:live:7']).toBeUndefined();
});
it('rejects cross-origin or mismatched destinations and messages from another sender or frame',async()=>{
 const e=environment();expect(await e.send({action:'go',url:'https://evil.example/profile',context:e.context})).toHaveProperty('error');expect(await e.send({action:'go',url:'https://example.com/other',context:e.context})).toHaveProperty('error');expect(await e.send({action:'go',url:'https://example.com/profile',context:e.context},{id:'other',tab:{id:7},frameId:0})).toBeUndefined();expect(await e.send({action:'go',url:'https://example.com/profile',context:e.context},{id:'wandel',tab:{id:7},frameId:1})).toBeUndefined();expect(e.update).not.toHaveBeenCalled();
});
it('preserves saved records after failed navigation and stops restoring on unrelated routes',async()=>{
 const e=environment();e.update.mockRejectedValueOnce(new Error('Tab unavailable'));expect((await e.send({action:'go',url:'https://example.com/profile',context:e.context})).error).toContain('Tab unavailable');expect(e.store['wandel:live:7']).toBeUndefined();expect(e.store['dx:workflow:'+e.w.id]).toBeTruthy();
 e.store['wandel:live:7']=e.context;e.tab.url='https://example.com/unrelated';expect(await e.send({action:'read'})).toEqual({context:null});expect(e.store['wandel:live:7']).toBeUndefined();
});
