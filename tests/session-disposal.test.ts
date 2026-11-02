// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {Session} from '../extension/content/session';
import {Repository,BrowserStorage} from '../extension/storage/store';
it('does not revive page interception when initialization finishes after destruction',async()=>{
 localStorage.clear();document.body.innerHTML='<main><button>Native action</button></main>';const main=document.querySelector('main')!,adapter=new BrowserStorage();let release!:(keys:string[])=>void;vi.spyOn(adapter,'keys').mockImplementation(()=>new Promise(resolve=>{release=resolve;}));const observe=vi.spyOn(MutationObserver.prototype,'observe');const session=new Session(main,new Repository(adapter),new URL('https://example.com/page'));
 try{const ready=session.init();await Promise.resolve();session.destroy();const count=observe.mock.calls.length;release([]);await ready;expect(observe).toHaveBeenCalledTimes(count);expect(document.querySelector('[data-dx-editor]')).toBeNull();expect(document.querySelector('[data-dx-selection]')).toBeNull();await expect(session.dispatch({type:'edit'})).rejects.toThrow('Reload this page');const native=vi.fn();main.querySelector('button')!.addEventListener('click',native);main.querySelector<HTMLButtonElement>('button')!.click();expect(native).toHaveBeenCalledOnce();expect(()=>session.destroy()).not.toThrow();}finally{session.destroy();vi.restoreAllMocks();document.body.innerHTML='';}
});
