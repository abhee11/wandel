// @vitest-environment jsdom
import {act} from 'react';import {createRoot,type Root} from 'react-dom/client';import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {WorkflowLinks} from '../extension/sidepanel/WorkflowLinks';import {accountAPI} from '../extension/sidepanel/accountClient';import {createWorkflow} from '../extension/prototype/engine';
vi.mock('../extension/sidepanel/accountClient',()=>({accountAPI:vi.fn()}));
vi.mock('../extension/sidepanel/copyText',()=>({copyText:vi.fn().mockResolvedValue(true)}));
let element:HTMLElement,root:Root;
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;vi.clearAllMocks();element=document.createElement('div');document.body.append(element);root=createRoot(element);});
afterEach(async()=>{await act(async()=>root.unmount());element.remove();});
const button=(match:RegExp)=>[...element.querySelectorAll('button')].find(b=>match.test(b.textContent||''))!;
const type=async(input:HTMLInputElement,value:string)=>act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});
function mount(masked:boolean){
 const w=createWorkflow(new URL('https://example.com'));w.name='Feedforward';
 const view={id:'v1',name:'Feedforward',masked,url:'https://wandel.studio447.ai/view/'+'a'.repeat(64),expiresAt:'2026-12-15'};
 vi.mocked(accountAPI).mockImplementation(async(path:string,method?:string)=>path==='/public-views'&&method==='POST'?{view}:path.endsWith('/send')?{sent:2}:{views:[],links:[]});
 const bridge={send:vi.fn().mockResolvedValue({publicSnapshot:{html:'<p>copy</p>',workflow:w,masked,skippedScreens:0,bytes:10}})};
 return {w,view,bridge,prepare:vi.fn().mockResolvedValue({workflow:w})};
}
it('publishes with placeholders and emails the link in one click',async()=>{
 const {view,bridge,prepare}=mount(true);
 await act(async()=>root.render(<WorkflowLinks bridge={bridge as any} prepare={prepare}/>));
 await type(element.querySelector<HTMLInputElement>('.dx-share-emails input')!,'bob@example.test, carol@example.test');
 await act(async()=>button(/^Share with 2 people$/).click());
 expect(accountAPI).toHaveBeenCalledWith('/public-views','POST',expect.objectContaining({masked:true}),60000);
 expect(accountAPI).toHaveBeenCalledWith('/public-views/v1/send','POST',{emails:['bob@example.test','carol@example.test']});
 expect(element.querySelector('[role=status]')?.textContent).toBe('Sent to 2 people. The link is copied too.');
 expect(element.querySelector<HTMLInputElement>('[aria-label="Latest share link"]')!.value).toBe(view.url);
});
it('shows a copy with real content for review before sending',async()=>{
 const {bridge,prepare}=mount(false);
 await act(async()=>root.render(<WorkflowLinks bridge={bridge as any} prepare={prepare}/>));
 await act(async()=>element.querySelector<HTMLInputElement>('.dx-share-switch input')!.click());
 await type(element.querySelector<HTMLInputElement>('.dx-share-emails input')!,'bob@example.test');
 await act(async()=>button(/^Share with 1 person$/).click());
 expect(element.querySelector('iframe[title="Page copy to review"]')).not.toBeNull();
 expect(accountAPI).not.toHaveBeenCalledWith('/public-views','POST',expect.anything(),60000);
 await act(async()=>button(/^Looks right, send$/).click());
 expect(accountAPI).toHaveBeenCalledWith('/public-views/v1/send','POST',{emails:['bob@example.test']});
});
