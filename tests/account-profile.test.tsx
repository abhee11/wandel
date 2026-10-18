// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import {Account} from '../extension/sidepanel/Account';
import {accountAPI,signIn} from '../extension/sidepanel/accountClient';
vi.mock('../extension/sidepanel/accountClient',()=>({accountAPI:vi.fn(),signIn:vi.fn(),AccountError:class extends Error {code='AUTH_REQUIRED';}}));
it('shows guest sign-in without opening a menu and updates profile after returning from login',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;vi.stubGlobal('chrome',{storage:{local:{get:vi.fn().mockResolvedValue({wandelGuestRemaining:1})}}});
 vi.mocked(accountAPI).mockRejectedValue(new Error('Signed out'));
 const element=document.createElement('div'),root=createRoot(element);document.body.append(element);
 try{
  await act(async()=>root.render(<Account bridge={{send:vi.fn(),subscribe:()=>()=>{}}} snapshot={null}/>));
  expect(element.textContent).toContain('Guest');expect(element.textContent).toContain('1 free AI previews left');
  const button=[...element.querySelectorAll('button')].find(b=>b.textContent==='Sign in')!;expect(button).toBeTruthy();await act(async()=>button.click());expect(signIn).toHaveBeenCalled();
  vi.mocked(accountAPI).mockResolvedValue({user:{name:'Alex',email:'alex@example.com'},entitlements:{plan:'FREE'}});
  await act(async()=>window.dispatchEvent(new Event('focus')));expect(element.textContent).toContain('Alex');expect(element.textContent).not.toContain('Guest');
 }finally{await act(async()=>root.unmount());element.remove();vi.unstubAllGlobals();}
});
it('redeems beta access in the extension and shows its source without a subscription portal',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;vi.stubGlobal('chrome',{storage:{local:{get:vi.fn().mockResolvedValue({})}}});let redeemed=false;vi.mocked(accountAPI).mockImplementation(async(path,method,body)=>{if(path==='/account/redeem'){expect(method).toBe('POST');expect(body).toEqual({code:'WANDEL-TEST'});redeemed=true;return {grant:{expiresAt:'2027-01-01'}};}if(path==='/workflows')return {workflows:[]};return {user:{name:'Tester',email:'tester@example.com'},entitlements:{plan:redeemed?'PRO':'FREE',access:redeemed?{source:'beta_code',expiresAt:'2027-01-01'}:null}};});
 const element=document.createElement('div'),root=createRoot(element);document.body.append(element);
 try{
  await act(async()=>root.render(<Account bridge={{send:vi.fn(),subscribe:()=>()=>{}}} snapshot={null}/>));await act(async()=>[...element.querySelectorAll('button')].find(b=>b.textContent?.startsWith('Account &'))!.click());const input=element.querySelector<HTMLInputElement>('[aria-label="Beta access code"]')!;
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'WANDEL-TEST');input.dispatchEvent(new Event('input',{bubbles:true}));});await act(async()=>element.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(redeemed).toBe(true);expect(element.textContent).toContain('PRO · Beta access');expect(element.textContent).toContain('Beta access activated');expect(element.textContent).not.toContain('Manage subscription');expect(input.value).toBe('');
 }finally{await act(async()=>root.unmount());element.remove();vi.unstubAllGlobals();}
});
it('offers View flow for saved workflows even on another route',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;const runtimeSend=vi.fn().mockResolvedValue({ok:true,navigated:true}),set=vi.fn();vi.stubGlobal('chrome',{runtime:{sendMessage:runtimeSend},storage:{local:{get:vi.fn().mockResolvedValue({})},session:{set}}});const {createWorkflow}=await import('../extension/prototype/engine');const workflow=createWorkflow(new URL('https://example.com/elsewhere')),target=createWorkflow(new URL('https://example.com/profile'));const snapshot={workflow,stateId:workflow.entry,dirty:false} as any;const item={id:'saved',name:'Profile flow',origin:target.origin,route:target.route,version:1};const record={draft:target,enabled:true,currentVersion:1,versions:[]};
 vi.mocked(accountAPI).mockImplementation(async path=>path==='/workflows'?{workflows:[item]}:path==='/workflows/saved'?{record,revision:3}:{user:{id:'u',name:'Tester',email:'tester@example.com'},entitlements:{plan:'PRO'}});
 const element=document.createElement('div'),root=createRoot(element);document.body.append(element);
 try{await act(async()=>root.render(<Account bridge={{send:vi.fn(),subscribe:()=>()=>{}}} snapshot={snapshot}/>));await act(async()=>[...element.querySelectorAll('button')].find(b=>b.textContent?.startsWith('Account &'))!.click());const view=[...element.querySelectorAll('button')].find(b=>b.textContent==='View flow')!;expect(view.disabled).toBe(false);expect([...element.querySelectorAll('button')].find(b=>b.textContent==='Edit')!.disabled).toBe(true);await act(async()=>view.click());expect(runtimeSend).toHaveBeenCalledWith({type:'WANDEL_VIEW_WORKFLOW',record,expectedWorkflowId:workflow.id,expectedURL:'https://example.com/elsewhere',discardConfirmed:false});expect(element.textContent).toContain('Saved flow selected');}finally{await act(async()=>root.unmount());element.remove();vi.unstubAllGlobals();}
});
