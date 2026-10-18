// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {pcmWav,PushToTalk} from '../extension/assistant/voice';
import {validateWav} from '../platform/server/assistant';
afterEach(()=>{vi.unstubAllGlobals();});
it('encodes real microphone PCM to a bounded interoperable mono WAV',async()=>{
 const blob=pcmWav(new Float32Array(48000).fill(.2),48000);expect(blob.type).toBe('audio/wav');expect(blob.size).toBe(32044);
 // JSDOM Blob exposes FileReader, matching the browser transport bytes.
 const data=await new Promise<ArrayBuffer>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result as ArrayBuffer);reader.onerror=reject;reader.readAsArrayBuffer(blob);});expect(()=>validateWav(new Uint8Array(data))).not.toThrow();
});
it('releases microphone permission if the user releases before the permission dialog resolves',async()=>{
 let resolve!:(v:unknown)=>void;const stop=vi.fn(),completed=vi.fn(),failed=vi.fn();Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:vi.fn().mockReturnValue(new Promise(r=>resolve=r))}});const capture=new PushToTalk(vi.fn(),completed,failed);const pending=capture.start();capture.stop();resolve({getTracks:()=>[{stop}]});await pending;expect(stop).toHaveBeenCalledOnce();expect(completed).not.toHaveBeenCalled();expect(failed).not.toHaveBeenCalled();
});
it('keeps typed editing available when microphone permission is denied',async()=>{
 Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:vi.fn().mockRejectedValue(new DOMException('Denied','NotAllowedError'))}});const failed=vi.fn();const capture=new PushToTalk(vi.fn(),vi.fn(),failed);await capture.start();expect(failed).toHaveBeenCalledWith(expect.stringContaining('Type your instruction'));capture.cancel();
});
