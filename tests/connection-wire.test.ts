// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {ConnectionWire} from '../extension/content/connectionWire';
it('draws a string from the live source to the panel destination and cleans it up on cancel',()=>{
 const host=document.createElement('div'),source=document.createElement('input');document.body.append(host,source);const shadow=host.attachShadow({mode:'open'});vi.spyOn(source,'getBoundingClientRect').mockReturnValue({right:120,top:100,width:20,height:20} as DOMRect);const wire=new ConnectionWire(shadow,()=>({width:800,height:600}));try{wire.show(()=>source,'Profile',false);const path=shadow.querySelector('path')!;expect(path.getAttribute('d')).toMatch(/^M 125 110 C/);expect(path.getAttribute('d')).toContain('798 300');expect(path.getAttribute('stroke-dasharray')).toBe('7 5');wire.anchor(.75);expect(path.getAttribute('d')).toContain('798 450');wire.show(()=>source,'Profile',true);expect(path.getAttribute('stroke')).toBe('#2f9d79');wire.hide();expect(shadow.querySelector('[data-connection-wire]')!.getAttribute('hidden')).toBe('');}finally{wire.destroy();host.remove();source.remove();vi.restoreAllMocks();}
});
