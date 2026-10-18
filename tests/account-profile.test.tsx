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
