vi.mock('../extension/background/account',()=>({registerAccountBridge:vi.fn()}));
import {it,expect,vi,afterEach} from 'vitest';
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();});
it('disables new tabs and only opens a tab-specific panel on an explicit action',async()=>{
 let clicked=(_:{id:number})=>{},created=(_:{id:number})=>{};
 const setOptions=vi.fn(async()=>{}),open=vi.fn(async()=>{}),setPanelBehavior=vi.fn(async()=>{});
 vi.stubGlobal('chrome',{runtime:{onMessage:{addListener:vi.fn()}},sidePanel:{setOptions,open,setPanelBehavior},action:{onClicked:{addListener:(fn:typeof clicked)=>{clicked=fn;}}},tabs:{onCreated:{addListener:(fn:typeof created)=>{created=fn;}},sendMessage:vi.fn(async()=>{})},webNavigation:{onHistoryStateUpdated:{addListener:vi.fn()},onReferenceFragmentUpdated:{addListener:vi.fn()}}});
 await import('../extension/background/index');
 expect(setPanelBehavior).toHaveBeenCalledWith({openPanelOnActionClick:false});expect(setOptions).toHaveBeenCalledWith({enabled:false});expect(open).not.toHaveBeenCalled();
 created({id:8});expect(setOptions).toHaveBeenLastCalledWith({tabId:8,enabled:false});expect(open).not.toHaveBeenCalled();
 setOptions.mockImplementationOnce(()=>new Promise<void>(()=>{}));
 clicked({id:8});expect(open).toHaveBeenCalledExactlyOnceWith({tabId:8});expect(setOptions).toHaveBeenLastCalledWith({tabId:8,path:'sidepanel.html?tabId=8',enabled:true});expect(open).toHaveBeenCalledExactlyOnceWith({tabId:8});
 created({id:9});expect(open).toHaveBeenCalledTimes(1);expect(setOptions).toHaveBeenLastCalledWith({tabId:9,enabled:false});
});

it('collapses only the requesting extension tab',async()=>{
 let receive:any;const setOptions=vi.fn(async()=>{});
 vi.stubGlobal('chrome',{runtime:{id:'wandel',onMessage:{addListener:(fn:any)=>{receive=fn;}}},sidePanel:{setOptions,setPanelBehavior:vi.fn(async()=>{})},action:{onClicked:{addListener:vi.fn()}},tabs:{onCreated:{addListener:vi.fn()}},webNavigation:{onHistoryStateUpdated:{addListener:vi.fn()},onReferenceFragmentUpdated:{addListener:vi.fn()}}});
 await import('../extension/background/index');setOptions.mockClear();const reply=vi.fn();
 receive({type:'WANDEL_COLLAPSE'},{id:'other',tab:{id:8},frameId:0},reply);expect(setOptions).not.toHaveBeenCalled();
 receive({type:'WANDEL_COLLAPSE'},{id:'wandel',tab:{id:8},frameId:0},reply);await Promise.resolve();expect(setOptions).toHaveBeenCalledWith({tabId:8,enabled:false});expect(reply).toHaveBeenCalledWith({ok:true});
});
