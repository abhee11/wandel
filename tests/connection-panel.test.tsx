// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import {Connections} from '../extension/sidepanel/Connections';
import {Session} from '../extension/content/session';
import {Repository,BrowserStorage} from '../extension/storage/store';
it('shows destination, new name and action buttons cleanly in the real panel, and preserves drafts through field picking',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 document.body.innerHTML='<main><label><input id="terms" type="checkbox">Terms</label><label>Email<input type="email" id="email"></label></main><aside></aside>';
 const session=new Session(document.querySelector('main')!,new Repository(new BrowserStorage()),new URL('https://example.com/'),{externalConnections:true});await session.init();await session.dispatch({type:'edit'});document.getElementById('terms')!.click();document.querySelector('[data-dx-editor]')!.shadowRoot!.querySelector<HTMLButtonElement>('[aria-label="Connect to a view"]')!.click();
 const el=document.querySelector('aside')!,root=createRoot(el),send=vi.fn((c:any)=>session.dispatch(c)),bridge={send,subscribe:()=>()=>{}};
 let unsubscribe=()=>{};await act(async()=>{unsubscribe=session.subscribe(s=>{root.render(s.connectionWorkspace?<Connections snapshot={s} bridge={bridge}/>:<p>Normal editor</p>);});});
 try{
  await act(async()=>{});expect(el.querySelector('[aria-label="Destination screen"]')).not.toBeNull();expect(el.querySelector('[aria-label="New screen name"]')).not.toBeNull();expect(el.textContent).toContain('Terms');expect(el.querySelector('input[type=checkbox]')).toBeNull();
  await act(async()=>{await session.dispatch({type:'connectionAction',change:{action:'title',value:'Feedback details'}});});
  await act(async()=>{[...el.querySelectorAll('button')].find(b=>b.textContent==='+ Pick a condition field')!.click();});expect(el.textContent).toContain('Click a field in the application');
  await act(async()=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));});expect(el.querySelector<HTMLInputElement>('[aria-label="New screen name"]')!.value).toBe('Feedback details');
  await act(async()=>{[...el.querySelectorAll('button')].find(b=>b.textContent==='Connect views')!.click();});expect(session.workflow.edges).toHaveLength(1);expect(session.snapshot().connectionWorkspace).toBeNull();expect(el.textContent).toBe('Normal editor');expect(document.querySelector('[data-dx-editor]')!.shadowRoot!.querySelector('[role=status]')?.textContent).toContain('Connected');
 }finally{unsubscribe();await act(async()=>root.unmount());session.destroy();}
});
