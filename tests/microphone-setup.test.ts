// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
afterEach(()=>{vi.restoreAllMocks();vi.resetModules();});
it('requests access only on click and immediately releases the stream without recording',async()=>{
 document.body.innerHTML='<button id="allow"></button><p id="status"></p>';const stop=vi.fn(),getUserMedia=vi.fn(async()=>({getTracks:()=>[{stop}]}));Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia}});
 await import('../extension/assistant/microphone');expect(getUserMedia).not.toHaveBeenCalled();document.querySelector<HTMLButtonElement>('button')!.click();await vi.waitFor(()=>expect(stop).toHaveBeenCalledOnce());expect(getUserMedia).toHaveBeenCalledWith({audio:true,video:false});expect(document.body.textContent).toContain('No audio was saved or sent');
});
it('shows actionable blocked-permission feedback and allows retry',async()=>{
 document.body.innerHTML='<button id="allow"></button><p id="status"></p>';Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:vi.fn().mockRejectedValue(new DOMException('Dismissed','NotAllowedError'))}});
 await import('../extension/assistant/microphone');const button=document.querySelector<HTMLButtonElement>('button')!;button.click();await vi.waitFor(()=>expect(document.body.textContent).toContain('Access was blocked or dismissed'));expect(button.disabled).toBe(false);
});

it('returns to the exact app tab and window after permission setup succeeds',async()=>{
 history.replaceState(null,'','/?returnTab=12&returnWindow=4');document.body.innerHTML='<button id="allow"></button><p id="status"></p><button id="return" hidden></button>';
 Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:vi.fn(async()=>({getTracks:()=>[{stop:vi.fn()}]}))}});
 const focus=vi.fn(async()=>({})),activate=vi.fn(async()=>({})),close=vi.spyOn(window,'close').mockImplementation(()=>{});vi.stubGlobal('chrome',{windows:{update:focus},tabs:{update:activate}});
 await import('../extension/assistant/microphone');document.querySelector<HTMLButtonElement>('#allow')!.click();await vi.waitFor(()=>expect(document.querySelector<HTMLButtonElement>('#return')!.hidden).toBe(false));
 document.querySelector<HTMLButtonElement>('#return')!.click();await vi.waitFor(()=>expect(close).toHaveBeenCalledOnce());expect(focus).toHaveBeenCalledWith(4,{focused:true});expect(activate).toHaveBeenCalledWith(12,{active:true});history.replaceState(null,'','/');vi.unstubAllGlobals();
});
