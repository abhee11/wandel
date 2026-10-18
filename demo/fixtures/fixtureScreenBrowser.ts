import {DestinationBrowserControls} from '../../extension/content/browserSession';
import type {VisitedScreen} from '../../extension/shared/model';
import {captureScreen} from '../../extension/content/screenCapture';
import type {ScreenBrowser,ScreenBrowserAction} from '../../extension/sidepanel/screenBrowser';
import type {ScreenLibrary} from '../../extension/shared/model';
/** Uses real same-origin fixture pages in a companion browser, with the production capture path. */
export class FixtureScreenBrowser implements ScreenBrowser{
 constructor(private choose?:(screen:VisitedScreen)=>Promise<void>){}
 private listeners=new Set<(s:ScreenLibrary)=>void>();private popup:Window|null=null;private timer:ReturnType<typeof setInterval>|undefined;
 private state:ScreenLibrary={screens:[],candidate:null,browsing:false,error:''};private last='';
 subscribe(fn:(s:ScreenLibrary)=>void){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
 private capture(doc:Document){const screen=captureScreen(doc);const prior=this.state.screens.find(s=>s.url===screen.url&&s.title===screen.title);if(prior)screen.id=prior.id;if(doc!==document&&!doc.querySelector('[data-wandel-browser]')){new DestinationBrowserControls(doc,async action=>{if(action==='use'){this.capture(doc);if(!this.state.candidate)throw new Error('Wait for this page to load.');await this.choose?.(this.state.candidate);}await this.call('end');}).show();doc.querySelector('[data-dx-ignore]')?.setAttribute('data-wandel-browser','true');}this.state={...this.state,screens:[...this.state.screens.filter(s=>s.id!==screen.id),screen].slice(-8),candidate:screen,error:''};this.listeners.forEach(fn=>fn(this.state));}
 async call(action:ScreenBrowserAction,url?:string){
  if(action==='start'&&!this.state.screens.length)this.capture(document);
  if(action==='browse'){
   const target=url||new URL('/demo/fixtures/app-home.html',location.href).href;if(new URL(target).origin!==location.origin)throw new Error('Use a route in this application.');
   this.popup=window.open(target,'wandel-destination-browser','popup,width=960,height=740');if(!this.popup)throw new Error('Allow the companion browser window for this local test.');this.state.browsing=true;this.state.candidate=null;this.last='';this.popup.focus();
   clearInterval(this.timer);this.timer=setInterval(()=>{try{if(!this.popup||this.popup.closed){clearInterval(this.timer);this.state.browsing=false;this.listeners.forEach(fn=>fn(this.state));return;}const doc=this.popup.document,signature=doc.location.href+'|'+doc.title;if(doc.readyState==='complete'&&signature!==this.last&&doc.location.origin===location.origin){this.last=signature;this.capture(doc);}}catch{this.state.candidate=null;this.state.error='Return to the local fixture application.';}},500);
  }
  if(action==='refresh')this.capture(this.popup&&!this.popup.closed?this.popup.document:document);
  if(action==='return')window.focus();
  if(action==='end'){this.popup?.close();this.popup=null;clearInterval(this.timer);this.state.browsing=false;this.state.candidate=null;window.focus();}
  this.listeners.forEach(fn=>fn(this.state));return this.state;
 }
}
