import {it,expect,vi,afterEach} from 'vitest';
import {ScreenCatalog} from '../extension/background/screens';
const screen=(url='https://example.com/home',title='Home')=>({id:crypto.randomUUID(),url,route:new URL(url).pathname,title,thumbnail:'data:image/png;base64,aGVsbG8=',nodes:[{id:crypto.randomUUID(),parent:-1,tag:'div',text:'',style:{}}],capturedAt:new Date().toISOString(),truncated:false});
function setup(){const tabs=new Map([[1,{id:1,windowId:4,url:'https://example.com/home'}],[2,{id:2,windowId:8,url:'https://example.com/home'}]]);const store:Record<string,any>={};let captured=screen();const send=vi.fn(async()=>({screen:captured})),update=vi.fn(async(id:number)=>tabs.get(id)),create=vi.fn(async()=>({id:8,tabs:[tabs.get(2)]}));
 vi.stubGlobal('chrome',{tabs:{get:vi.fn(async(id:number)=>{if(!tabs.has(id))throw new Error('Closed');return tabs.get(id);}),sendMessage:send,update,remove:vi.fn(async()=>{})},scripting:{executeScript:vi.fn(async()=>[])},windows:{create,update:vi.fn(async()=>{})},storage:{session:{get:vi.fn(async(key:string)=>({[key]:store[key]})),set:vi.fn(async(data:any)=>Object.assign(store,data)),remove:vi.fn(async()=>{})}},runtime:{sendMessage:vi.fn(async()=>{})}});
 return {tabs,store,send,update,create,setScreen:(s:ReturnType<typeof screen>)=>{captured=s;}};}
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
it('records visited routes, opens a companion without navigating source, and restores the session gallery',async()=>{
 const mock=setup(),catalog=new ScreenCatalog();expect((await catalog.start(1)).screens[0].route).toBe('/home');await catalog.browse(1);expect(mock.create).toHaveBeenCalledWith(expect.objectContaining({url:'https://example.com/home',type:'popup'}));expect(mock.update).not.toHaveBeenCalled();
 mock.tabs.get(2)!.url='https://example.com/settings';mock.setScreen(screen('https://example.com/settings','Settings'));const status=await catalog.refresh(1);expect(status.candidate?.route).toBe('/settings');expect(status.screens).toHaveLength(2);expect(mock.tabs.get(1)!.url).toBe('https://example.com/home');
 await catalog.returnToSource(1);expect(mock.update).toHaveBeenCalledWith(1,{active:true});expect((await new ScreenCatalog().status(1)).screens.map(s=>s.route)).toEqual(['/home','/settings']);
 await catalog.end(1);expect(chrome.tabs.remove).toHaveBeenCalledWith(2);expect((await catalog.status(1)).browsing).toBe(false);
});
it('refuses cross-app destinations and ignores untracked tabs',async()=>{
 const mock=setup(),catalog=new ScreenCatalog();await catalog.start(1);await expect(catalog.browse(1,'https://other.example/settings')).rejects.toThrow('within this application');expect(mock.create).not.toHaveBeenCalled();
 vi.useFakeTimers();mock.send.mockClear();catalog.changed(999);await vi.advanceTimersByTimeAsync(1000);expect(mock.send).not.toHaveBeenCalled();
 mock.tabs.get(2)!.url='https://other.example/';const result=await catalog.capture(1,2);expect(result.candidate).toBeNull();expect(result.error).toContain('original application');expect(result.screens).toHaveLength(1);
});
it('retains the old gallery and clears stale candidate when a capture is denied or mismatches navigation',async()=>{
 const mock=setup(),catalog=new ScreenCatalog();await catalog.start(1);mock.setScreen(screen('https://example.com/old'));const result=await catalog.capture(1,1);expect(result.error).toContain('page changed');expect(result.candidate).toBeNull();expect(result.screens).toHaveLength(1);
 mock.send.mockRejectedValueOnce(new Error('Access denied'));vi.mocked(chrome.scripting.executeScript).mockRejectedValueOnce(new Error('Click Wandel to allow site access'));expect((await catalog.capture(1,1)).error).toContain('site access');expect((await catalog.status(1)).screens).toHaveLength(1);
});
it('chooses the current destination before closing its companion and returns to the pinned source',async()=>{
 const mock=setup(),catalog=new ScreenCatalog();await catalog.start(1);await catalog.browse(1);mock.tabs.get(2)!.url='https://example.com/profile';const profile=screen('https://example.com/profile','Profile');mock.setScreen(profile);
 mock.send.mockImplementation(async(_id?:any,m?:any)=>m?.type==='DX_COMMAND'?{snapshot:{connectionWorkspace:{pendingScreen:{id:profile.id}}}} as any:{screen:profile});
 await catalog.finishBrowser(2,true);expect(mock.send).toHaveBeenCalledWith(1,expect.objectContaining({type:'DX_COMMAND',command:expect.objectContaining({type:'connectionAction',change:{action:'screen',screen:expect.objectContaining({title:'Profile'})}})}),{frameId:0});expect(chrome.tabs.remove).toHaveBeenCalledWith(2);expect((await catalog.status(1)).browsing).toBe(false);
});
it('retains the companion on a failed choice, and cancel closes without selecting a screen',async()=>{
 const mock=setup(),catalog=new ScreenCatalog();await catalog.start(1);await catalog.browse(1);mock.send.mockImplementation(async(_id?:any,m?:any)=>m?.type==='DX_COMMAND'?{error:'Reopen Connections'} as any:{screen:screen()});
 await expect(catalog.finishBrowser(2,true)).rejects.toThrow('Reopen Connections');expect(chrome.tabs.remove).not.toHaveBeenCalled();expect((await catalog.status(1)).browsing).toBe(true);
 mock.send.mockClear();await catalog.finishBrowser(2,false);expect(mock.send).not.toHaveBeenCalled();expect(chrome.tabs.remove).toHaveBeenCalledWith(2);await expect(catalog.finishBrowser(999,true)).rejects.toThrow('session has ended');
});
it('can finish a destination browsing session after the background worker restarts',async()=>{
 const mock=setup(),catalog=new ScreenCatalog();await catalog.start(1);await catalog.browse(1);const current=screen();mock.send.mockImplementation(async(_id?:any,m?:any)=>m?.type==='DX_COMMAND'?{snapshot:{connectionWorkspace:{pendingScreen:{id:current.id}}}} as any:{screen:current});
 await new ScreenCatalog().finishBrowser(2,true);expect(chrome.tabs.remove).toHaveBeenCalledWith(2);expect(chrome.storage.session.remove).toHaveBeenCalledWith('wandel:browser:2');
});
