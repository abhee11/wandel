import {accountAPI} from '../sidepanel/accountClient';
import type {ComponentCopy} from './schema';
/** The panel's side of App knowledge: which team an app learns for (per app, on this computer), the server calls, and a
 * copy of the team's component library that the page reads to paste from it. */
export type KnowledgeTeam={id:string;name:string;role:'owner'|'member';enabled:boolean};
export type LibraryComponent={id:string;name:string;pattern:string|null;copy:ComponentCopy};
export const teamKey=(origin:string)=>'knowledge:team:'+origin,libraryKey=(origin:string)=>'knowledge:library:'+origin;
const local=()=>{try{return typeof chrome!=='undefined'?chrome.storage?.local:undefined;}catch{return undefined;}};
export async function chosenTeam(origin:string):Promise<string|null>{const k=teamKey(origin);const saved=(await local()?.get(k).catch(()=>({})))as Record<string,unknown>|undefined;return typeof saved?.[k]==='string'?saved[k] as string:null;}
export async function chooseTeam(origin:string,team:string|null){const area=local();if(!area)return;if(team)await area.set({[teamKey(origin)]:team});else await area.remove([teamKey(origin),libraryKey(origin)]);}
const q=(origin:string)=>'?origin='+encodeURIComponent(origin);
export const knowledgeStatus=(origin:string)=>accountAPI<{teams:KnowledgeTeam[]}>('/knowledge'+q(origin));
export const readKnowledge=(team:string,origin:string)=>accountAPI<{screens:{pattern:string;summary:{title:string;headings:string[]};updatedAt:string}[];design:Record<string,Record<string,string>>|null;components:LibraryComponent[];rules:{id:string;text:string}[]}>(`/knowledge/${team}${q(origin)}`);
export const enableKnowledge=(team:string,origin:string)=>accountAPI(`/knowledge/${team}/enable`,'POST',{origin});
export const forgetKnowledge=(team:string,origin:string)=>accountAPI(`/knowledge/${team}${q(origin)}`,'DELETE');
export const addRule=(team:string,origin:string,text:string)=>accountAPI(`/knowledge/${team}/rules`,'POST',{origin,rule:{text}});
export const removeRule=(team:string,origin:string,id:string)=>accountAPI(`/knowledge/${team}/rules/${id}${q(origin)}`,'DELETE');
export const addComponent=(team:string,origin:string,name:string,pattern:string|null,copy:ComponentCopy)=>accountAPI<{id:string}>(`/knowledge/${team}/components`,'POST',{origin,component:{name,pattern,copy}});
export const removeComponent=(team:string,origin:string,id:string)=>accountAPI(`/knowledge/${team}/components/${id}${q(origin)}`,'DELETE');
/** Keeps the page's copy of the library in step with the server. */
export async function storeLibrary(origin:string,components:LibraryComponent[]){await local()?.set({[libraryKey(origin)]:components}).catch(()=>{});}
