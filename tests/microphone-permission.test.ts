import {afterEach,expect,it,vi} from 'vitest';
import {prepareMicrophone} from '../extension/assistant/microphonePermission';
afterEach(()=>vi.unstubAllGlobals());
it.each(['prompt','denied'])('opens an auxiliary window without replacing the app tab when %s',async state=>{
 const create=vi.fn(async()=>({}));vi.stubGlobal('location',{protocol:'chrome-extension:'});vi.stubGlobal('chrome',{runtime:{id:'wandel',getURL:(path:string)=>'chrome-extension://wandel/'+path},tabs:{query:vi.fn(async()=>[{id:12,windowId:4}])},windows:{create}});vi.stubGlobal('navigator',{permissions:{query:vi.fn(async()=>({state}))}});
 expect(await prepareMicrophone()).toBe(false);expect(create).toHaveBeenCalledExactlyOnceWith({url:'chrome-extension://wandel/microphone.html?returnTab=12&returnWindow=4',type:'popup',width:560,height:520,focused:true});
});
it('starts capture in the panel when permission is already granted without reopening setup',async()=>{
 const create=vi.fn();vi.stubGlobal('location',{protocol:'chrome-extension:'});vi.stubGlobal('chrome',{runtime:{id:'wandel'},windows:{create}});vi.stubGlobal('navigator',{permissions:{query:vi.fn(async()=>({state:'granted'}))}});
 expect(await prepareMicrophone()).toBe(true);expect(create).not.toHaveBeenCalled();
});
