// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {registerShareRelay} from '../extension/content/shareRelay';
it('only relays share-page requests from this window to the selected installed build',async()=>{
 history.replaceState(null,'','/flow');const send=vi.fn(async()=>({ok:true})),post=vi.spyOn(window,'postMessage').mockImplementation(()=>{});vi.stubGlobal('chrome',{runtime:{id:'wandel',sendMessage:send}});const stop=registerShareRelay(location.origin),data={type:'WANDEL_SHARE_OPEN',extension:'wandel',token:'a'.repeat(64),requestId:'1'.repeat(36)};
 const event=(value:unknown,origin=location.origin,source:MessageEventSource|null=window)=>window.dispatchEvent(new MessageEvent('message',{data:value,origin,source}));
 event(data,'https://other.example');event(data,location.origin,null);event({...data,extension:'another'});event({...data,token:'bad'});expect(send).not.toHaveBeenCalled();
 event(data);await Promise.resolve();expect(send).toHaveBeenCalledExactlyOnceWith({type:'WANDEL_OPEN_SHARED',token:data.token,requestId:data.requestId});expect(post).toHaveBeenLastCalledWith({type:'WANDEL_SHARE_RESULT',requestId:data.requestId,ok:true},location.origin);stop?.();history.replaceState(null,'','/elsewhere');expect(registerShareRelay(location.origin)).toBeUndefined();history.replaceState(null,'','/');vi.unstubAllGlobals();vi.restoreAllMocks();
});
