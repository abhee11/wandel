import {createRoot} from 'react-dom/client';
import {Session} from '../../extension/content/session';
import {Repository,BrowserStorage} from '../../extension/storage/store';
import {App} from '../../extension/sidepanel/App';
import {FixtureLiveNavigation} from './fixtureLiveNavigation';
import '../../extension/sidepanel/style.css';
// Companion browsing remains native. Only the original, explicitly connected tab resumes.
if(!window.opener&&sessionStorage.getItem('wandel:fixture:live')){
 const panel=document.createElement('aside');panel.dataset.dxIgnore='true';panel.style.cssText='position:fixed;right:0;top:0;bottom:0;width:420px;z-index:2147483646;overflow:auto;background:white;border-left:1px solid #ddd';document.documentElement.append(panel);
 const repository=new Repository(new BrowserStorage()),session=new Session(document.body,repository,new URL(location.href),{liveNavigation:new FixtureLiveNavigation(repository),externalConnections:true,requestConnections:()=>{session.panelAttached();}});await session.init();
 const original=document.body.style.paddingRight;session.subscribe(s=>{panel.hidden=!!s.panelMinimized||s.mode==='closed';document.body.style.paddingRight=panel.hidden?original:'420px';});
 createRoot(panel).render(<App demo bridge={{send:c=>session.dispatch(c),subscribe:fn=>session.subscribe(fn)}}/>);
 window.addEventListener('pagehide',()=>session.pageLeaving());window.addEventListener('pageshow',event=>{if(event.persisted)void session.pageRestored();});
}
