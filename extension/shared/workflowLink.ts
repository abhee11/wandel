import {WorkflowSchema,type Workflow,type SavedRecord} from './model';
import {validateWorkflow} from '../prototype/engine';
import {sameApplicationURL,stateURL} from './liveNavigation';
export const SHARE_TTL_DAYS=30;
export const MAX_WORKFLOW_LINKS=10;
export function shareRecord(input:unknown):SavedRecord{
 const workflow=validateWorkflow(WorkflowSchema.parse(input));sameApplicationURL(stateURL(workflow,workflow.entry),workflow.origin);
 for(const state of workflow.states){if(state.operations.some(op=>op.kind==='mirror'))throw new Error('Remove mirrored actions before sharing: they can operate the real application.');if(state.liveURL)sameApplicationURL(state.liveURL,workflow.origin);}
 const visit=(value:unknown,key='')=>{if(value&&typeof value==='object')for(const [k,v]of Object.entries(value))visit(v,k);else if(typeof value==='string'&&['src','href','url','liveURL'].includes(key)&&/^https?:/i.test(value)){const url=new URL(value);if(url.username||url.password||[...url.searchParams.keys()].some(k=>/token|secret|password|auth|code|session|key|signature/i.test(k)))throw new Error('Remove credential-bearing URLs before sharing.');}};visit(workflow);
 if(JSON.stringify(workflow).length>900000)throw new Error('Shared workflows must be under 900 KB. Remove large images or thumbnails first.');
 return {draft:structuredClone(workflow),enabled:true,currentVersion:0,versions:[]};
}
export type WorkflowLink={id:string;name:string;url:string;createdAt:string;expiresAt:string};
