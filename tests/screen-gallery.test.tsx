// @vitest-environment jsdom
import {act} from 'react';import {createRoot} from 'react-dom/client';import {it,expect,vi} from 'vitest';
import {ScreenGallery} from '../extension/sidepanel/ScreenGallery';import type {ScreenLibrary,VisitedScreen} from '../extension/shared/model';
it('shows route thumbnails and captures the fresh live screen instead of a stale preview',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 const screen=(title:string,route:string):VisitedScreen=>({id:title,url:'https://example.com'+route,route,title,thumbnail:'data:image/png;base64,aGVsbG8=',nodes:[{id:crypto.randomUUID(),parent:-1,tag:'div',text:'',style:{}}],capturedAt:new Date().toISOString(),truncated:false});
 const home=screen('Home','/home'),settings=screen('Settings','/settings');let library:ScreenLibrary={screens:[home],candidate:home,browsing:true,error:''};const onChoose=vi.fn(async()=>{}),call=vi.fn(async(action:string)=>action==='refresh'?{...library,screens:[home,settings],candidate:settings}:library),browser={call,subscribe:()=>()=>{}};
 const el=document.createElement('div');document.body.append(el);const root=createRoot(el);
 try{await act(async()=>root.render(<ScreenGallery origin="https://example.com" browser={browser} onChoose={onChoose}/>));expect(el.querySelector('img')?.alt).toContain('Home');expect(el.textContent).toContain('/home');
 await act(async()=>{[...el.querySelectorAll('button')].find(b=>b.textContent==='Use this screen & close')!.click();});expect(call).toHaveBeenCalledWith('refresh');expect(onChoose).toHaveBeenCalledWith(settings);expect(call).toHaveBeenCalledWith('end');
 onChoose.mockClear();call.mockImplementation(async()=>({...library,candidate:null,error:'Page changed during capture'}));await act(async()=>{[...el.querySelectorAll('button')].find(b=>b.textContent==='Use this screen & close')!.click();});expect(onChoose).not.toHaveBeenCalled();expect(el.querySelector('[role=alert]')?.textContent).toContain('Page changed');
 }finally{await act(async()=>root.unmount());el.remove();}
});
