import {it,expect,vi,afterEach} from 'vitest';
import {registerAccountBridge} from '../extension/background/account';
vi.mock('@clerk/chrome-extension/client',()=>({createClerkClient:vi.fn()}));
afterEach(()=>vi.unstubAllGlobals());
it('keeps account tokens private to the side panel and restricts temporary storage keys',async()=>{
 let listener:any;const get=vi.fn(async()=>({'dx:workflow:a':{draft:'test'},clerkToken:'private'}));
 vi.stubGlobal('chrome',{runtime:{id:'ext',getURL:(path:string)=>'chrome-extension://ext/'+path,onMessage:{addListener:(fn:any)=>listener=fn}},storage:{session:{get}}});registerAccountBridge();const reply=vi.fn();
 expect(listener({type:'WANDEL_ACCOUNT_TOKEN'},{id:'ext',tab:{id:1},url:'https://example.com'},reply)).toBeUndefined();expect(reply).not.toHaveBeenCalled();
 expect(listener({type:'WANDEL_TEMP_STORAGE',action:'read',key:'clerkToken'},{id:'ext'},reply)).toBeUndefined();expect(get).not.toHaveBeenCalled();
 expect(listener({type:'WANDEL_TEMP_STORAGE',action:'keys'},{id:'ext'},reply)).toBe(true);await new Promise(resolve=>setTimeout(resolve,0));expect(reply).toHaveBeenCalledWith({value:['dx:workflow:a']});
});
