// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {DestinationBrowserControls} from '../extension/content/browserSession';
afterEach(()=>{vi.unstubAllGlobals();document.body.innerHTML='';for(const n of document.querySelectorAll('[data-dx-ignore]'))n.remove();});
it('offers Use and Cancel in the companion and retains controls after a failed capture',async()=>{
 const sendMessage=vi.fn().mockResolvedValueOnce({error:'Wait for this page to finish loading'}).mockResolvedValueOnce({ok:true});vi.stubGlobal('chrome',{runtime:{sendMessage}});
 const controls=new DestinationBrowserControls();controls.show();controls.show();expect(document.querySelectorAll('[data-dx-ignore]')).toHaveLength(1);const host=document.querySelector('[data-dx-ignore]')!,shadow=host.shadowRoot!,buttons=shadow.querySelectorAll('button');
 expect(buttons[0].textContent).toBe('Use this screen & close');buttons[0].click();expect(buttons[0].disabled).toBe(true);await vi.waitFor(()=>expect(buttons[0].disabled).toBe(false));expect(shadow.querySelector('[role=status]')?.textContent).toContain('Wait for this page');expect(sendMessage).toHaveBeenCalledWith({type:'WANDEL_BROWSER_FINISH',action:'use'});
 const outside=vi.fn();document.addEventListener('click',outside);buttons[1].click();await vi.waitFor(()=>expect(sendMessage).toHaveBeenLastCalledWith({type:'WANDEL_BROWSER_FINISH',action:'cancel'}));expect(outside).not.toHaveBeenCalled();document.removeEventListener('click',outside);controls.destroy();
});
