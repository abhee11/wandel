import type {Snapshot} from '../shared/model';
export async function openRecorder(snapshot:Snapshot){
 if(typeof chrome==='undefined'||!chrome.runtime?.id||!chrome.tabs?.create)throw new Error('Open Wandel’s installed Chrome extension to record a walkthrough.');
 const response=await chrome.runtime.sendMessage({type:'WANDEL_RECORD_WALKTHROUGH',workflowId:snapshot.workflow.id});
 if(response?.error)throw new Error(response.error);
}
