import {afterEach,expect,it,vi} from 'vitest';
import {createRuntimeChannel} from '../extension/content/runtimeChannel';
afterEach(()=>vi.unstubAllGlobals());
it.each(['sync','async'])('releases the stale editor once on %s invalidation and stops further sends',async mode=>{
 const send=vi.fn(()=>{const error=new Error('Extension context invalidated.');if(mode==='sync')throw error;return Promise.reject(error);});
 vi.stubGlobal('chrome',{runtime:{id:'wandel',sendMessage:send}});
 const release=vi.fn(),channel=createRuntimeChannel(release);
 await expect(channel.send({type:'DX_SNAPSHOT'})).rejects.toThrow('Extension context invalidated');
 expect(release).toHaveBeenCalledTimes(1);expect(channel.available()).toBe(false);
 await expect(channel.send({})).rejects.toThrow('Reload this page');expect(send).toHaveBeenCalledTimes(1);expect(release).toHaveBeenCalledTimes(1);
});
it('releases interception when Chrome removes the runtime ID after an update',()=>{
 const runtime:{id?:string}={id:'wandel'};vi.stubGlobal('chrome',{runtime});const release=vi.fn(),channel=createRuntimeChannel(release);
 expect(channel.available()).toBe(true);delete runtime.id;expect(channel.available()).toBe(false);expect(release).toHaveBeenCalledOnce();
});
it('does not destroy an editor on a temporary missing receiver',async()=>{
 const send=vi.fn().mockRejectedValueOnce(new Error('Receiving end does not exist.')).mockResolvedValueOnce({ok:true});vi.stubGlobal('chrome',{runtime:{id:'wandel',sendMessage:send}});
 const release=vi.fn(),channel=createRuntimeChannel(release);await expect(channel.send({})).rejects.toThrow('Receiving end');expect(await channel.send({})).toEqual({ok:true});expect(release).not.toHaveBeenCalled();
});
