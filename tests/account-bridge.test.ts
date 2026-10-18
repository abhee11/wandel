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

it('returns signed-out cleanly when the development sign-in cookie is missing',async()=>{
 const {accountConfig}=await import('../extension/shared/accountConfig');const {createClerkClient}=await import('@clerk/chrome-extension/client');
 const previous=accountConfig.publishableKey;accountConfig.publishableKey='pk_test_placeholder';
 let listener:any;vi.stubGlobal('chrome',{runtime:{id:'ext',getURL:(path:string)=>'chrome-extension://ext/'+path,onMessage:{addListener:(fn:any)=>listener=fn}},cookies:{get:vi.fn().mockResolvedValue(null)}});
 try{registerAccountBridge();const reply=vi.fn();expect(listener({type:'WANDEL_ACCOUNT_TOKEN'},{id:'ext',url:'chrome-extension://ext/sidepanel.html?tabId=1'},reply)).toBe(true);await new Promise(resolve=>setTimeout(resolve,0));expect(reply).toHaveBeenCalledWith({token:null});expect(createClerkClient).not.toHaveBeenCalled();}finally{accountConfig.publishableKey=previous;}
});

it('returns only a matching sign-in tab to its unchanged source page',async()=>{
 let external:any;const pending={tabId:12,url:'https://example.com/app',nonce:'nonce',created:Date.now()};
 const update=vi.fn().mockResolvedValue({}),remove=vi.fn().mockResolvedValue(undefined);
 vi.stubGlobal('chrome',{runtime:{onMessage:{addListener:vi.fn()},onMessageExternal:{addListener:(fn:any)=>external=fn},sendMessage:vi.fn().mockResolvedValue({})},storage:{session:{get:vi.fn().mockResolvedValue({'wandelAuthReturn:20':pending}),remove:vi.fn().mockResolvedValue(undefined)}},tabs:{get:vi.fn().mockResolvedValue({url:pending.url,windowId:1}),update,remove},windows:{update:vi.fn().mockResolvedValue({})}});
 registerAccountBridge();const reply=vi.fn();const sender={url:'http://127.0.0.1:5174/extension/sign-in',frameId:0,tab:{id:20}};
 expect(external({type:'WANDEL_AUTH_RETURN',nonce:'nonce'},{...sender,url:'https://evil.example/extension/sign-in'},reply)).toBeUndefined();
 external({type:'WANDEL_AUTH_RETURN',nonce:'wrong'},sender,reply);await new Promise(resolve=>setTimeout(resolve,0));expect(update).not.toHaveBeenCalled();expect(reply).toHaveBeenCalledWith({error:expect.stringContaining('expired')});
 external({type:'WANDEL_AUTH_RETURN',nonce:'nonce'},sender,reply);await new Promise(resolve=>setTimeout(resolve,0));expect(update).toHaveBeenCalledWith(12,{active:true});expect(remove).toHaveBeenCalledWith(20);expect(reply).toHaveBeenCalledWith({ok:true});
});
