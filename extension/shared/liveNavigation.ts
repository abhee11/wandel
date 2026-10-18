import {z} from 'zod';
import {lineage} from '../prototype/engine';
import type {Workflow} from './model';
export const LiveContextSchema=z.object({workflowId:z.string().min(1).max(100),stateId:z.string().min(1).max(100),visits:z.array(z.string().min(1).max(100)).max(60),mode:z.enum(['edit','interact','replay']),minimized:z.boolean(),dialogs:z.record(z.string().max(100),z.string().max(120)).default({})}).strict();
export type LiveContext=z.infer<typeof LiveContextSchema>;
export interface LiveNavigation{go(url:string,context:LiveContext):Promise<void>;read():Promise<LiveContext|null>;clear():Promise<void>;remember?(context:LiveContext):Promise<void>}
export function stateURL(workflow:Workflow,id:string){return lineage(workflow,id).reverse().find(s=>s.liveURL)?.liveURL||workflow.origin+workflow.route;}
export function sameApplicationURL(value:string,origin:string){const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.origin!==origin||url.username||url.password)throw new Error('Choose a page within this application.');for(const key of url.searchParams.keys())if(/token|secret|password|auth|code|session|key/i.test(key))throw new Error('Finish signing in before connecting this page.');return url.href;}
/** Metadata only: entered form values are never included in a route handoff. */
export class ChromeLiveNavigation implements LiveNavigation{
 private async call(action:string,context?:LiveContext,url?:string){const result=await chrome.runtime.sendMessage({type:'WANDEL_LIVE_NAVIGATION',action,...(context?{context}:{}),...(url?{url}:{})});if(!result||result.error)throw new Error(result?.error||'Wandel could not open the connected page. Your draft is saved.');return result.context||null;}
 async go(url:string,context:LiveContext){await this.call('go',context,url);}
 read():Promise<LiveContext|null>{return this.call('read');}
 async remember(context:LiveContext){await this.call('remember',context);}
 async clear(){await this.call('clear');}
}
