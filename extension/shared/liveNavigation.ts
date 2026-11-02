import {z} from 'zod';
import {lineage} from '../prototype/engine';
import type {Workflow} from './model';
export const LiveContextSchema=z.object({workflowId:z.string().min(1).max(100),stateId:z.string().min(1).max(100),visits:z.array(z.string().min(1).max(100)).max(60),mode:z.enum(['edit','interact','replay']),minimized:z.boolean(),dialogs:z.record(z.string().max(100),z.string().max(120)).default({})}).strict();
export type LiveContext=z.infer<typeof LiveContextSchema>;
/** The tab's active workflow when the current page is not one of its screens. */
export type PausedWorkflow=LiveContext&{name:string;url:string};
export interface LiveNavigation{go(url:string,context:LiveContext):Promise<void>;read():Promise<LiveContext|null>;clear():Promise<void>;remember?(context:LiveContext):Promise<void>;paused?:PausedWorkflow|null}
export function stateURL(workflow:Workflow,id:string){return lineage(workflow,id).reverse().find(s=>s.liveURL)?.liveURL||workflow.origin+workflow.route;}
/** Resolve known screens within the same workflow, including native app navigation. */
/** One application page: a different #fragment or a trailing slash is the same page. */
export function samePage(a:string,b:string){try{const x=new URL(a),y=new URL(b),path=(u:URL)=>u.pathname.replace(/\/+$/,'')||'/';return x.origin===y.origin&&path(x)===path(y)&&x.search===y.search;}catch{return a===b;}}
export function contextAtURL(w:Workflow,context:LiveContext,url:string):LiveContext|null{
 if(samePage(stateURL(w,context.stateId),url))return context;
 const prior=context.visits.reduce((found,id,i)=>samePage(stateURL(w,id),url)?i:found,-1);
 if(prior>=0)return {...context,stateId:context.visits[prior],visits:context.visits.slice(0,prior)};
 const matches=w.states.filter(s=>s.liveURL&&samePage(s.liveURL,url)||s.id===w.entry&&samePage(w.origin+w.route,url));
 if(matches.length!==1)return null;
 return {...context,stateId:matches[0].id,visits:[...context.visits,context.stateId].slice(-60)};
}
export function sameApplicationURL(value:string,origin:string){const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.origin!==origin||url.username||url.password)throw new Error('Choose a page within this application.');for(const key of url.searchParams.keys())if(/token|secret|password|auth|code|session|key/i.test(key))throw new Error('Finish signing in before connecting this page.');return url.href;}
/** Metadata only: entered form values are never included in a route handoff. */
export class ChromeLiveNavigation implements LiveNavigation{
 constructor(private send:(message:unknown)=>Promise<any>=message=>chrome.runtime.sendMessage(message)){}
 paused:PausedWorkflow|null=null;
 private async call(action:string,context?:LiveContext,url?:string){const result=await this.send({type:'WANDEL_LIVE_NAVIGATION',action,...(context?{context}:{}),...(url?{url}:{})});if(!result||result.error)throw new Error(result?.error||'Wandel could not open the connected page. Your draft is saved.');if(action==='read')this.paused=result.paused||null;return result.context||null;}
 async go(url:string,context:LiveContext){await this.call('go',context,url);}
 read():Promise<LiveContext|null>{return this.call('read');}
 async remember(context:LiveContext){await this.call('remember',context);}
 async clear(){await this.call('clear');}
}
