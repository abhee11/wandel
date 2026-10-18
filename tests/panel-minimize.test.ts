// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {Session} from '../extension/content/session';
import {Repository,BrowserStorage} from '../extension/storage/store';
it('minimizes to a floating control, retains the pending connection across panel disconnect and restores it',async()=>{
 localStorage.clear();document.body.innerHTML='<main><button>Profile</button></main>';const requestClose=vi.fn(async()=>{}),requestConnections=vi.fn(async()=>{});
 const session=new Session(document.querySelector('main')!,new Repository(new BrowserStorage()),new URL('https://example.com/'),{externalConnections:true,requestClose,requestConnections});
 try{await session.init();await session.dispatch({type:'edit'});document.querySelector<HTMLButtonElement>('main button')!.click();const shadow=document.querySelector('[data-dx-editor]')!.shadowRoot!;
 shadow.querySelector<HTMLButtonElement>('[aria-label="Connect to a view"]')!.click();await session.dispatch({type:'connectionAction',change:{action:'title',value:'My profile'}});
 await session.dispatch({type:'minimizePanel'});expect(requestClose).toHaveBeenCalledOnce();expect(session.snapshot().panelMinimized).toBe(true);expect(session.isAuthoring()).toBe(false);expect(shadow.querySelector('[aria-label="Open Wandel panel"]')).not.toBeNull();
 await session.dispatch({type:'pause'});expect(session.snapshot().connectionWorkspace?.newTitle).toBe('My profile');expect(session.snapshot().mode).toBe('edit');
 await session.dispatch({type:'restorePanel'});expect(requestConnections).toHaveBeenCalledTimes(2);expect(session.snapshot().panelMinimized).toBe(false);expect(session.snapshot().connectionWorkspace?.newTitle).toBe('My profile');expect(session.isAuthoring()).toBe(true);
 await session.dispatch({type:'closeEditor'});expect(session.snapshot().mode).toBe('closed');expect(session.snapshot().panelMinimized).toBe(false);
 }finally{session.destroy();}
});
it('keeps the full editor open when minimizing cannot save the draft',async()=>{
 document.body.innerHTML='<main><p>Hello</p></main>';const repository=new Repository(new BrowserStorage()),close=vi.fn();const session=new Session(document.querySelector('main')!,repository,new URL('https://example.com/'),{requestClose:close});
 try{await session.init();await session.dispatch({type:'edit'});vi.spyOn(repository,'put').mockRejectedValueOnce(new Error('Storage full'));await expect(session.dispatch({type:'minimizePanel'})).rejects.toThrow('Storage full');expect(close).not.toHaveBeenCalled();expect(session.snapshot().panelMinimized).toBe(false);}finally{session.destroy();}
});
it('reattaches the Chrome panel without resetting Interact or replay state',async()=>{
 document.body.innerHTML='<main><button>Continue</button></main>';const session=new Session(document.querySelector('main')!,new Repository(new BrowserStorage()),new URL('https://example.com/'));
 try{await session.init();await session.dispatch({type:'edit'});await session.dispatch({type:'interact'});await session.dispatch({type:'minimizePanel'});await session.dispatch({type:'restorePanel'});expect(session.panelAttached()).toBe(true);expect(session.mode()).toBe('interact');expect(session.panelAttached()).toBe(false);}finally{session.destroy();}
});
