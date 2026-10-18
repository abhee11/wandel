import {accountAPI,accountToken,AccountError} from '../sidepanel/accountClient';
import {accountConfig} from '../shared/accountConfig';
import {MAX_RECORDING_BYTES,type SharedRecording} from '../shared/recording';
export async function uploadRecording(blob:Blob,name:string):Promise<SharedRecording>{
 if(!blob.size||blob.size>MAX_RECORDING_BYTES)throw new Error('Videos must be under 20 MB.');
 const token=await accountToken();let response:Response;
 try{response=await fetch(accountConfig.apiOrigin+'/api/recordings?name='+encodeURIComponent(name),{method:'POST',credentials:'omit',headers:{Authorization:'Bearer '+token,'Content-Type':'video/webm'},body:blob,signal:AbortSignal.timeout(120000)});}catch{throw new AccountError('CONNECTION_FAILED','Upload did not finish. Your local video is still available. Check My shared videos before retrying.');}
 const data=await response.json();if(!response.ok)throw new AccountError(data.error?.code||'UPLOAD_FAILED',data.error?.message||'Upload failed. Your local video is still available.');return data.recording;
}
export const sharedRecordings=()=>accountAPI<{recordings:SharedRecording[]}>('/recordings');
export const revokeRecording=(id:string)=>accountAPI('/recordings/'+encodeURIComponent(id),'DELETE');
