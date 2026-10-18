// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {WalkthroughCapture} from '../extension/recording/capture';
import {MAX_RECORDING_BYTES,MAX_RECORDING_MS} from '../extension/shared/recording';
let capture:WalkthroughCapture,getDisplayMedia:ReturnType<typeof vi.fn>,track:EventTarget&{stop:ReturnType<typeof vi.fn>;getSettings:()=>{displaySurface:string}},result:ReturnType<typeof vi.fn>;
class FakeRecorder {
 static instance:FakeRecorder;static isTypeSupported=()=>true;state='inactive';mimeType='video/webm';ondataavailable?:({data}:{data:Blob})=>void;onstop?:()=>void;onerror?:()=>void;
 constructor(){FakeRecorder.instance=this;}
 start(){this.state='recording';}
 stop(){this.state='inactive';this.onstop?.();}
 pause(){this.state='paused';}resume(){this.state='recording';}
 data(size=8){this.ondataavailable?.({data:new Blob([new Uint8Array(size)],{type:'video/webm'})});}
}
beforeEach(()=>{vi.useFakeTimers();track=Object.assign(new EventTarget(),{stop:vi.fn(),getSettings:()=>({displaySurface:'browser'})});getDisplayMedia=vi.fn().mockResolvedValue({getVideoTracks:()=>[track],getAudioTracks:()=>[],getTracks:()=>[track]});vi.stubGlobal('MediaRecorder',FakeRecorder);Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getDisplayMedia}});result=vi.fn();capture=new WalkthroughCapture(result);});
afterEach(()=>{capture.dispose();vi.useRealTimers();vi.unstubAllGlobals();});
it('captures only a selected tab without audio, assembles frames and releases capture on Stop',async()=>{
 await capture.start();expect(getDisplayMedia).toHaveBeenCalledWith(expect.objectContaining({audio:false,monitorTypeSurfaces:'exclude'}));FakeRecorder.instance.data();capture.pause();expect(FakeRecorder.instance.state).toBe('paused');capture.resume();FakeRecorder.instance.data();capture.stop();expect(result).toHaveBeenCalledOnce();expect(result.mock.calls[0][0].size).toBe(16);expect(result.mock.calls[0][1]).toBe('');expect(track.stop).toHaveBeenCalledOnce();
});
it('rejects entire-screen capture and immediately releases all tracks',async()=>{
 track.getSettings=()=>({displaySurface:'monitor'});await expect(capture.start()).rejects.toThrow('Choose a Chrome tab');expect(track.stop).toHaveBeenCalledOnce();expect(result).not.toHaveBeenCalled();
});
it('cleans up cancellation without blocking a later recording',async()=>{
 getDisplayMedia.mockRejectedValueOnce(new DOMException('Canceled','NotAllowedError'));await expect(capture.start()).rejects.toThrow('Canceled');await capture.start();FakeRecorder.instance.data();capture.stop();expect(result).toHaveBeenCalledOnce();
});
it('stops on browser Stop sharing, timeout, and file size limit',async()=>{
 await capture.start();FakeRecorder.instance.data();track.dispatchEvent(new Event('ended'));expect(result).toHaveBeenCalledOnce();
 await capture.start();FakeRecorder.instance.data();await vi.advanceTimersByTimeAsync(MAX_RECORDING_MS);expect(result).toHaveBeenCalledTimes(2);
 await capture.start();FakeRecorder.instance.data(MAX_RECORDING_BYTES+1);expect(result).toHaveBeenLastCalledWith(null,expect.stringContaining('20 MB'));expect(track.stop).toHaveBeenCalledTimes(3);
});
it('releases a capture that resolves after the recorder page was closed',async()=>{
 let resolve!:(value:unknown)=>void;getDisplayMedia.mockReturnValue(new Promise(r=>resolve=r));const pending=capture.start();capture.dispose();resolve({getVideoTracks:()=>[track],getTracks:()=>[track]});await pending;expect(track.stop).toHaveBeenCalledOnce();expect(result).not.toHaveBeenCalled();
});
it('does not publish a partial video when disposed while recording',async()=>{
 await capture.start();FakeRecorder.instance.data();capture.dispose();expect(result).not.toHaveBeenCalled();expect(track.stop).toHaveBeenCalledOnce();
});
