import {VisitedScreenSchema,type ScreenLibrary,type VisitedScreen} from '../shared/model';
type Catalog={origin:string;screens:VisitedScreen[];candidate:VisitedScreen|null;browserTab?:number;browserWindow?:number;error:string};
/** Only explicitly activated source tabs and their companion browser are tracked. */
export class ScreenCatalog{
 private catalogs=new Map<number,Catalog>();private loading=new Map<number,Promise<Catalog>>();private timers=new Map<number,ReturnType<typeof setTimeout>>();
 private get(source:number):Promise<Catalog>{if(this.catalogs.has(source))return Promise.resolve(this.catalogs.get(source)!);const pending=this.loading.get(source);if(pending)return pending;const work=this.load(source).finally(()=>this.loading.delete(source));this.loading.set(source,work);return work;}
 private async load(source:number){if(this.catalogs.has(source))return this.catalogs.get(source)!;const tab=await chrome.tabs.get(source);if(!tab.url||!/^https?:/.test(tab.url))throw new Error('Open an application page first.');const origin=new URL(tab.url).origin;const stored=(await chrome.storage.session.get('wandel:screens:'+source))['wandel:screens:'+source];const screens=Array.isArray(stored?.screens)?stored.screens.flatMap((s:unknown)=>{const parsed=VisitedScreenSchema.safeParse(s);return parsed.success&&new URL(parsed.data.url).origin===origin?[parsed.data]:[];}).slice(-8):[];const catalog:Catalog={origin,screens,candidate:null,error:''};this.catalogs.set(source,catalog);return catalog;}
 private view(c:Catalog):ScreenLibrary{return {screens:c.screens,candidate:c.candidate,browsing:c.browserTab!==undefined,error:c.error};}
 private publish(source:number,c:Catalog){void chrome.runtime.sendMessage({type:'WANDEL_SCREENS_CHANGED',source,status:this.view(c)}).catch(()=>{});}
 async capture(source:number,tabId:number){const c=await this.get(source);try{
  const tab=await chrome.tabs.get(tabId);if(!tab.url||new URL(tab.url).origin!==c.origin)throw new Error('Return to the original application to choose a screen.');
  let result;try{result=await chrome.tabs.sendMessage(tabId,{type:'WANDEL_CAPTURE_SCREEN'},{frameId:0});}catch{await chrome.scripting.executeScript({target:{tabId,frameIds:[0]},files:['content.js']});result=await chrome.tabs.sendMessage(tabId,{type:'WANDEL_CAPTURE_SCREEN'},{frameId:0});}
  if(result?.error)throw new Error(result.error);const screen=VisitedScreenSchema.parse(result?.screen);
  const after=await chrome.tabs.get(tabId);if(after.url!==tab.url||screen.url!==tab.url)throw new Error('The page changed during capture. Wait for it to finish, then refresh.');
  if(new URL(screen.url).origin!==c.origin||JSON.stringify(screen).length>900000)throw new Error('This screen is too large or belongs to another application.');
  // A refresh of the same route/title updates its tile while preserving the existing tile identity.
  const prior=c.screens.find(s=>s.url===screen.url&&s.title===screen.title);if(prior)screen.id=prior.id;
  const next=[...c.screens.filter(s=>s.id!==screen.id),screen].slice(-8);while(next.length>1&&JSON.stringify(next).length>3000000)next.shift();
  await chrome.storage.session.set({['wandel:screens:'+source]:{screens:next}});c.screens=next;c.candidate=screen;c.error='';
 }catch(e){c.candidate=null;c.error=e instanceof Error?e.message:'Screen capture failed. Click the Wandel icon in the live browser to allow page access, then refresh.';}
 if(c.browserTab===tabId)void chrome.tabs.sendMessage(tabId,{type:'WANDEL_BROWSER_SESSION'},{frameId:0}).catch(()=>{});
 this.publish(source,c);return this.view(c);}
 async start(source:number){const c=await this.get(source);await this.capture(source,source);return this.view(c);}
 async status(source:number){return this.view(await this.get(source));}
 async browse(source:number,url?:string){const c=await this.get(source),tab=await chrome.tabs.get(source);const target=new URL(url||tab.url||'');if(target.origin!==c.origin||!['http:','https:'].includes(target.protocol))throw new Error('Browse a route within this application.');
  if(c.browserWindow!==undefined){try{if(url&&c.browserTab!==undefined)await chrome.tabs.update(c.browserTab,{url:target.href});await chrome.windows.update(c.browserWindow,{focused:true});return this.view(c);}catch{c.browserTab=undefined;c.browserWindow=undefined;}}
  const window=await chrome.windows.create({url:target.href,type:'popup',width:980,height:780,focused:true});c.browserTab=window.tabs?.[0]?.id;c.browserWindow=window.id;if(c.browserTab!==undefined)await chrome.storage.session.set({['wandel:browser:'+c.browserTab]:{source}});c.candidate=null;c.error='';this.publish(source,c);return this.view(c);
 }
 async refresh(source:number){const c=await this.get(source);return this.capture(source,c.browserTab??source);}
 async returnToSource(source:number){const tab=await chrome.tabs.get(source);if(!tab.active)await chrome.tabs.update(source,{active:true});await chrome.windows.update(tab.windowId,{focused:true});return this.status(source);}
 async end(source:number){const c=await this.get(source);if(c.browserTab!==undefined){const id=c.browserTab;clearTimeout(this.timers.get(id));this.timers.delete(id);await chrome.tabs.remove(id);await chrome.storage.session.remove('wandel:browser:'+id);c.browserTab=undefined;c.browserWindow=undefined;c.candidate=null;}this.publish(source,c);return this.returnToSource(source);}
 async finishBrowser(tabId:number,use:boolean){
  await this.restoreBrowser(tabId);
  const owner=[...this.catalogs].find(([,c])=>c.browserTab===tabId);if(!owner)throw new Error('This browsing session has ended. Return to Wandel.');
  const [source]=owner;
  if(use){const status=await this.capture(source,tabId);if(status.error||!status.candidate)throw new Error(status.error||'Wait for the destination to load, then retry.');
   const result=await chrome.tabs.sendMessage(source,{type:'DX_COMMAND',command:{type:'connectionAction',change:{action:'screen',screen:status.candidate}}},{frameId:0});
   if(result?.error)throw new Error(result.error);if(!result?.snapshot?.connectionWorkspace?.pendingScreen)throw new Error('Reopen Connections in the original Wandel panel before choosing a destination.');
  }
  return this.end(source);
 }
 private async restoreBrowser(tabId:number){
  if([...this.catalogs.values()].some(c=>c.browserTab===tabId))return;
  const stored=(await chrome.storage.session.get('wandel:browser:'+tabId))['wandel:browser:'+tabId];if(!Number.isSafeInteger(stored?.source))return;
  const c=await this.get(stored.source),tab=await chrome.tabs.get(tabId);c.browserTab=tabId;c.browserWindow=tab.windowId;
 }
 changed(tabId:number){void this.restoreBrowser(tabId).then(()=>this.captureChanged(tabId)).catch(()=>{});}
 private captureChanged(tabId:number){for(const [source,c]of this.catalogs)if(source===tabId||c.browserTab===tabId){clearTimeout(this.timers.get(tabId));this.timers.set(tabId,setTimeout(()=>{this.timers.delete(tabId);void this.capture(source,tabId);},600));}}
 removed(tabId:number){void chrome.storage.session.remove('wandel:browser:'+tabId);clearTimeout(this.timers.get(tabId));this.timers.delete(tabId);for(const [source,c]of this.catalogs){if(source===tabId){if(c.browserTab!==undefined){clearTimeout(this.timers.get(c.browserTab));this.timers.delete(c.browserTab);void chrome.tabs.remove(c.browserTab).catch(()=>{});void chrome.storage.session.remove('wandel:browser:'+c.browserTab);}this.catalogs.delete(source);void chrome.storage.session.remove('wandel:screens:'+source);}
 else if(c.browserTab===tabId){c.browserTab=undefined;c.browserWindow=undefined;c.candidate=null;this.publish(source,c);}}}
}
export function registerScreenCatalog(){
 const catalog=new ScreenCatalog();
 chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if(m?.type==='WANDEL_BROWSER_FINISH'){
  if(sender.id!==chrome.runtime.id||sender.frameId!==0||sender.tab?.id===undefined||!['use','cancel'].includes(m.action))return;
  catalog.finishBrowser(sender.tab.id,m.action==='use').then(()=>reply({ok:true})).catch(e=>reply({error:e.message}));return true;
 }
 if(m?.type!=='WANDEL_SCREENS'||sender.id!==chrome.runtime.id||sender.tab||!sender.url?.startsWith(chrome.runtime.getURL('sidepanel.html')))return;
  const owner=new URL(sender.url).searchParams.get('tabId');if(!owner||String(m.source)!==owner||!Number.isSafeInteger(m.source))return;
  const call=m.action==='start'?catalog.start(m.source):m.action==='status'?catalog.status(m.source):m.action==='browse'?catalog.browse(m.source,m.url):m.action==='refresh'?catalog.refresh(m.source):m.action==='return'?catalog.returnToSource(m.source):m.action==='end'?catalog.end(m.source):Promise.reject(new Error('Unknown screen action.'));
  call.then(status=>reply({status})).catch(e=>reply({error:e.message}));return true;
 });
 chrome.tabs.onUpdated.addListener((id,change)=>{if(change.status==='complete')catalog.changed(id);});
 chrome.tabs.onRemoved.addListener(id=>catalog.removed(id));
 chrome.webNavigation.onHistoryStateUpdated.addListener(details=>{if(details.frameId===0)catalog.changed(details.tabId);});
 chrome.webNavigation.onReferenceFragmentUpdated.addListener(details=>{if(details.frameId===0)catalog.changed(details.tabId);});
 // Register tracking only for a tab explicitly opened with the extension action.
 chrome.action.onClicked.addListener(tab=>{if(tab.id!==undefined)void catalog.start(tab.id).catch(()=>{});});
}
