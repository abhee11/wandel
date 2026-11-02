// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {registerShareRelay} from '../extension/content/shareRelay';
it('only relays share-page requests from this window to the selected installed build',async()=>{
 history.replaceState(null,'','/flow');const send=vi.fn(async()=>({ok:true})),post=vi.spyOn(window,'postMessage').mockImplementation(()=>{});vi.stubGlobal('chrome',{runtime:{id:'wandel',sendMessage:send}});const stop=registerShareRelay(location.origin),data={type:'WANDEL_SHARE_OPEN',extension:'wandel',token:'a'.repeat(64),requestId:'1'.repeat(36)};
 const event=(value:unknown,origin=location.origin,source:MessageEventSource|null=window)=>window.dispatchEvent(new MessageEvent('message',{data:value,origin,source}));
 event(data,'https://other.example');event(data,location.origin,null);event({...data,extension:'another'});event({...data,token:'bad'});expect(send).not.toHaveBeenCalled();
 event(data);await vi.waitFor(()=>expect(post).toHaveBeenLastCalledWith({type:'WANDEL_SHARE_RESULT',requestId:data.requestId,ok:true},location.origin));expect(send).toHaveBeenCalledExactlyOnceWith({type:'WANDEL_OPEN_SHARED',token:data.token,requestId:data.requestId});expect(post).toHaveBeenLastCalledWith({type:'WANDEL_SHARE_RESULT',requestId:data.requestId,ok:true},location.origin);stop?.();history.replaceState(null,'','/elsewhere');expect(registerShareRelay(location.origin)).toBeUndefined();history.replaceState(null,'','/');vi.unstubAllGlobals();vi.restoreAllMocks();
});

it('reports a stale extension when Chrome throws before returning a promise',async()=>{
 history.replaceState(null,'','/flow');vi.stubGlobal('chrome',{runtime:{id:'wandel',sendMessage:()=>{throw new Error('Extension context invalidated.');}}});const post=vi.spyOn(window,'postMessage').mockImplementation(()=>{}),stop=registerShareRelay(location.origin);
 window.dispatchEvent(new MessageEvent('message',{source:window,origin:location.origin,data:{type:'WANDEL_SHARE_OPEN',extension:'wandel',token:'a'.repeat(64),requestId:'1'.repeat(36)}}));
 await vi.waitFor(()=>expect(post).toHaveBeenLastCalledWith(expect.objectContaining({type:'WANDEL_SHARE_RESULT',error:expect.stringContaining('Reload')}),location.origin));stop?.();history.replaceState(null,'','/');vi.unstubAllGlobals();vi.restoreAllMocks();
});
it('stops probing an old isolated world when the runtime ID getter throws',()=>{
 history.replaceState(null,'','/flow');const runtime={get id():string{throw new Error('Extension context invalidated.');},sendMessage:vi.fn()};vi.stubGlobal('chrome',{runtime});const post=vi.spyOn(window,'postMessage').mockImplementation(()=>{});expect(()=>{const stop=registerShareRelay(location.origin);window.dispatchEvent(new MessageEvent('message',{source:window,origin:location.origin,data:{type:'WANDEL_SHARE_PROBE'}}));stop?.();}).not.toThrow();expect(post).not.toHaveBeenCalled();expect(runtime.sendMessage).not.toHaveBeenCalled();history.replaceState(null,'','/');vi.unstubAllGlobals();vi.restoreAllMocks();
});
