// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({destroy:vi.fn(),unsubscribe:vi.fn(),subscribe:vi.fn(),init:vi.fn(async()=>{}),dispatch:vi.fn(),repository:null as any,options:null as any}));
vi.mock('../extension/content/session',()=>({Session:class{
 constructor(_root:unknown,repository:unknown,_url:unknown,options:unknown){state.repository=repository;state.options=options;}
 init=state.init;destroy=state.destroy;dispatch=state.dispatch;
 subscribe(callback:unknown){state.subscribe(callback);return state.unsubscribe;}
}}));
vi.mock('../extension/content/shareRelay',()=>({registerShareRelay:()=>undefined}));
afterEach(()=>{delete (globalThis as {__wandelContentStarted?:boolean}).__wandelContentStarted;vi.unstubAllGlobals();vi.clearAllMocks();vi.resetModules();});
it('removes stale editing controls before the next page interaction and stops snapshot sends',async()=>{
 const runtime:{id?:string;sendMessage:ReturnType<typeof vi.fn>;onMessage:unknown;onConnect:unknown}={id:'wandel',sendMessage:vi.fn(async()=>({})),onMessage:{addListener:vi.fn()},onConnect:{addListener:vi.fn()}};vi.stubGlobal('chrome',{runtime});
 await import('../extension/content/index');await Promise.resolve();
 delete runtime.id;
 const pageClick=vi.fn();window.addEventListener('pointerdown',pageClick,{once:true});window.dispatchEvent(new Event('pointerdown'));
 expect(state.destroy).toHaveBeenCalledOnce();expect(state.unsubscribe).toHaveBeenCalledOnce();expect(pageClick).toHaveBeenCalledOnce();
 const subscriber=state.subscribe.mock.calls[0][0] as (snapshot:unknown)=>void;subscriber({});await Promise.resolve();expect(runtime.sendMessage).not.toHaveBeenCalled();
});
it('catches a reply channel invalidated while an asynchronous command finishes and removes listeners',async()=>{
 let finish!:(value:unknown)=>void;state.dispatch.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 const runtime={id:'wandel',sendMessage:vi.fn(async()=>({})),onMessage:{addListener:vi.fn(),removeListener:vi.fn()},onConnect:{addListener:vi.fn(),removeListener:vi.fn()}};vi.stubGlobal('chrome',{runtime});
 await import('../extension/content/index');await Promise.resolve();
 const listener=runtime.onMessage.addListener.mock.calls[0][0],reply=vi.fn(()=>{throw new Error('Extension context invalidated.');});listener({type:'DX_COMMAND',command:{type:'snapshot'}},{},reply);await Promise.resolve();finish({workflow:{}});await new Promise(resolve=>setTimeout(resolve,0));
 expect(reply).toHaveBeenCalledOnce();expect(state.destroy).toHaveBeenCalledOnce();expect(runtime.onMessage.removeListener).toHaveBeenCalledWith(listener);expect(runtime.onConnect.removeListener).toHaveBeenCalledOnce();
 const subscriber=state.subscribe.mock.calls[0][0] as (snapshot:unknown)=>void,oldCount=runtime.sendMessage.mock.calls.length;subscriber({});await Promise.resolve();expect(runtime.sendMessage).toHaveBeenCalledTimes(oldCount);
});
it('guards storage and navigation sends through the same invalidation cleanup',async()=>{

 const runtime={id:'wandel',sendMessage:vi.fn(async()=>({})),onMessage:{addListener:vi.fn(),removeListener:vi.fn()},onConnect:{addListener:vi.fn(),removeListener:vi.fn()}};vi.stubGlobal('chrome',{runtime});await import('../extension/content/index');await Promise.resolve();runtime.sendMessage.mockRejectedValue(new Error('Extension context invalidated.'));
 await expect(state.repository.adapter.keys()).rejects.toThrow('invalidated');expect(state.destroy).toHaveBeenCalledOnce();expect(state.unsubscribe).toHaveBeenCalledOnce();const calls=runtime.sendMessage.mock.calls.length;await expect(state.options.liveNavigation.read()).rejects.toThrow('Reload this page');expect(runtime.sendMessage).toHaveBeenCalledTimes(calls);
});
