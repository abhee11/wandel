// @vitest-environment jsdom
import {act} from 'react';import {createRoot,type Root} from 'react-dom/client';import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {WorkflowLinks,listPeople} from '../extension/sidepanel/WorkflowLinks';import {accountAPI} from '../extension/sidepanel/accountClient';import {createWorkflow} from '../extension/prototype/engine';
vi.mock('../extension/sidepanel/accountClient',()=>({accountAPI:vi.fn()}));
vi.mock('../extension/sidepanel/copyText',()=>({copyText:vi.fn().mockResolvedValue(true)}));
let element:HTMLElement,root:Root,saved:any[]=[];
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;vi.clearAllMocks();saved=[];element=document.createElement('div');document.body.append(element);root=createRoot(element);});
afterEach(async()=>{await act(async()=>root.unmount());element.remove();});
const button=(match:RegExp)=>[...element.querySelectorAll('button')].find(b=>match.test(b.textContent||''))!;
const type=async(input:HTMLInputElement,value:string)=>act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});
function mount(masked:boolean,changes=1){
 const w=createWorkflow(new URL('https://example.com'));w.name='Feedforward';for(let i=0;i<changes;i++)w.states[0].operations.push({kind:'text'} as any);
 const view={id:'v1',name:'Feedforward',masked,url:'https://wandel.studio447.ai/view/'+'a'.repeat(64),expiresAt:'2026-12-15'};
 vi.mocked(accountAPI).mockImplementation(async(path:string,method?:string)=>path==='/public-views'&&method==='POST'?{view}:path.endsWith('/send')?{sent:2}:path==='/workflows'?{workflows:saved}:{views:[],links:[]});
 const bridge={send:vi.fn().mockResolvedValue({publicSnapshot:{html:'<p>copy</p>',workflow:w,masked,skippedScreens:0,bytes:10}})};
 return {w,view,bridge,prepare:vi.fn().mockResolvedValue({workflow:w})};
}
it('publishes with placeholders when ticked and emails the link in one click',async()=>{
 const {w,view,bridge,prepare}=mount(true);
 await act(async()=>root.render(<WorkflowLinks bridge={bridge as any} prepare={prepare} snapshot={{workflow:w} as any}/>));
 await act(async()=>element.querySelector<HTMLInputElement>('.dx-share-switch input')!.click());
 await type(element.querySelector<HTMLInputElement>('.dx-share-emails input')!,'bob@example.test, carol@example.test');
 await act(async()=>button(/^Share with 2 people$/).click());
 expect(accountAPI).toHaveBeenCalledWith('/public-views','POST',expect.objectContaining({masked:true}),60000);
 expect(accountAPI).toHaveBeenCalledWith('/public-views/v1/send','POST',{emails:['bob@example.test','carol@example.test']});
 expect(element.querySelector('.dx-share-sent p')?.textContent).toBe('Sent to bob@example.test and carol@example.test. The link is copied too.');
 expect(element.querySelector<HTMLInputElement>('[aria-label="Latest share link"]')!.value).toBe(view.url);
});
it('shares the real page by default, and hides it only when ticked',async()=>{
 const {w,bridge,prepare}=mount(false);
 await act(async()=>root.render(<WorkflowLinks bridge={bridge as any} prepare={prepare} snapshot={{workflow:w} as any}/>));
 expect(element.querySelector<HTMLInputElement>('.dx-share-switch input')!.checked).toBe(false);
 await type(element.querySelector<HTMLInputElement>('.dx-share-emails input')!,'bob@example.test');
 await act(async()=>button(/^Share with 1 person$/).click());
 expect(bridge.send).toHaveBeenCalledWith({type:'publicSnapshot',mask:false});
 expect(element.querySelector('iframe')).toBeNull();
 expect(accountAPI).toHaveBeenCalledWith('/public-views','POST',expect.objectContaining({masked:false}),60000);
 expect(accountAPI).toHaveBeenCalledWith('/public-views/v1/send','POST',{emails:['bob@example.test']});
});
it('says which flow it will send, and blocks an empty draft with saved flows to open instead',async()=>{
 const {w,bridge,prepare}=mount(true,0);w.name='Group Onboarding';
 saved=[{id:'f1',name:'Feedforward card',origin:'https://example.com',route:w.route,version:2},{id:'f2',name:'Elsewhere',origin:'https://example.com',route:'/other',version:1}];
 const opened=vi.fn();window.addEventListener('wandel-account-flow',opened);
 await act(async()=>root.render(<WorkflowLinks bridge={bridge as any} prepare={prepare} snapshot={{workflow:w} as any}/>));
 expect(element.querySelector('.dx-share-what')?.textContent).toBe('“Group Onboarding” has no changes yet.');
 expect(button(/^Create link$/).disabled).toBe(true);
 const list=element.querySelector<HTMLDetailsElement>('.dx-share-saved')!;expect(list.open).toBe(true);
 expect(list.textContent).toContain('Feedforward card');expect(list.textContent).toContain('On this page');expect(list.textContent).toContain('Go to that page to open it');
 await act(async()=>button(/^Open$/).click());
 expect((opened.mock.calls[0][0] as CustomEvent).detail).toMatchObject({item:{id:'f1'},mode:'edit',stay:true});
 window.removeEventListener('wandel-account-flow',opened);
});
it('shows the size of a flow with changes',async()=>{
 const {w,bridge,prepare}=mount(true,3);
 await act(async()=>root.render(<WorkflowLinks bridge={bridge as any} prepare={prepare} snapshot={{workflow:w} as any}/>));
 expect(element.querySelector('.dx-share-what')?.textContent).toBe('Sharing “Feedforward” · 1 screen, 3 changes');
 expect(element.querySelector('.dx-share-saved')).toBeNull();
});
it('names who it was sent to',()=>{
 expect(listPeople(['a@x.test'])).toBe('a@x.test');
 expect(listPeople(['a@x.test','b@x.test','c@x.test'])).toBe('a@x.test, b@x.test and c@x.test');
 expect(listPeople(['a','b','c','d','e'])).toBe('a, b and 3 others');
});
