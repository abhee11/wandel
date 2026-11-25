import type {PageContext} from '../assistant/schema';
import {accountAPI} from '../sidepanel/accountClient';
import {copyStyles} from '../shared/model';
import {screenPattern,screenSummary,summaryHash} from './blank';
import {chosenTeam} from './store';
/** Learning while Wandel is used: after a request builds its page description, the screen's summary (labels only) and,
 * once a day, the app's design go to the team's App knowledge. Only for an app a team learns, never waiting on it. */
const sent=new Map<string,{hash:string;at:number}>(),SCREEN_EVERY=10*60_000,DESIGN_EVERY=24*3600_000;
const designKey=(team:string,origin:string)=>'knowledge:design-at:'+team+':'+origin;
const styleOf=(style:Record<string,string>|undefined)=>Object.fromEntries(Object.entries(style||{}).filter(([k,v])=>(copyStyles as readonly string[]).includes(k)&&typeof v==='string'&&v.length<=300&&!/url\s*\(|expression|[<>\\]/i.test(v)));
/** The app's look, taken from the page description: its surface, headings, body text, buttons, fields and cards. */
export function designFromContext(context:PageContext){
 const els=context.elements.filter(e=>e.visible&&!e.owned);const first=(test:(e:PageContext['elements'][number])=>boolean)=>styleOf(els.find(test)?.style);
 const cardRef=context.groups?.[0]?.members[0];
 return {surface:first(e=>e.tag==='main'||e.ref===context.page),heading:first(e=>/^h[1-3]$/.test(e.tag)),text:first(e=>e.tag==='p'),button:first(e=>e.tag==='button'||e.role==='button'),field:first(e=>/^(input|select|textarea)$/.test(e.tag)),card:cardRef?styleOf(els.find(e=>e.ref===cardRef)?.style):first(e=>e.attributes['wandel-card']==='true')};
}
export async function learnFrom(context:PageContext,href:string,origin:string,now=Date.now()){
 try{
  const team=await chosenTeam(origin);if(!team||!/^https?:/.test(href))return;
  const pattern=screenPattern(href),summary=screenSummary(context),hash=await summaryHash(summary),key=team+' '+pattern,prior=sent.get(key);
  if(!prior||prior.hash!==hash||now-prior.at>SCREEN_EVERY){sent.set(key,{hash,at:now});await accountAPI(`/knowledge/${team}/screen`,'PUT',{origin,screen:{pattern,summary,hash}});}
  const area=chrome.storage?.local,dk=designKey(team,origin),last=Number(((await area?.get(dk))||{})[dk]||0);
  if(now-last>DESIGN_EVERY){await accountAPI(`/knowledge/${team}/design`,'PUT',{origin,design:designFromContext(context)});await area?.set({[dk]:now});}
 }catch{/* learning never gets in the way of a request; an app that isn't on simply refuses */}
}
