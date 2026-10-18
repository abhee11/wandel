import {MAX_RECORDING_BYTES,MAX_RECORDING_MS} from '../shared/recording';
/** Keeps capture alive outside the side panel. No audio or upload occurs here. */
export class WalkthroughCapture {
 private stream:MediaStream|null=null;private recorder:MediaRecorder|null=null;private timer?:ReturnType<typeof setTimeout>;private chunks:Blob[]=[];private bytes=0;private failure='';
 private starting=false;private closed=false;
 constructor(private result:(blob:Blob|null,error:string)=>void,private status:(paused:boolean)=>void=()=>{}){}
 async start(){
  if(this.starting||this.recorder)throw new Error('A recording is already active.');
  if(!navigator.mediaDevices?.getDisplayMedia||typeof MediaRecorder==='undefined')throw new Error('This browser does not support recording. Use Chrome 116 or newer.');
  const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(type=>MediaRecorder.isTypeSupported(type));
  if(!mime)throw new Error('WebM recording is unavailable in this browser.');
  this.starting=true;
  try{
   const stream=await navigator.mediaDevices.getDisplayMedia({video:{displaySurface:'browser',width:{ideal:1280},height:{ideal:720},frameRate:{ideal:15}},audio:false,selfBrowserSurface:'exclude',monitorTypeSurfaces:'exclude',surfaceSwitching:'exclude'} as DisplayMediaStreamOptions);
   this.stream=stream;
   if(this.closed){this.release();return;}
   if(stream.getVideoTracks()[0]?.getSettings().displaySurface!=='browser')throw new Error('Choose a Chrome tab, rather than a window or entire screen.');
   stream.getAudioTracks().forEach(track=>track.stop());
   this.chunks=[];this.bytes=0;this.failure='';
   const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:700000});this.recorder=recorder;
   recorder.ondataavailable=event=>{if(event.data.size){this.bytes+=event.data.size;if(this.bytes>MAX_RECORDING_BYTES){this.failure='This recording exceeded 20 MB. Record a shorter walkthrough.';this.stop();}else this.chunks.push(event.data);}};
   recorder.onerror=()=>{this.failure='Recording stopped unexpectedly. Your workflow is unchanged. Please record again.';this.stop();};
   recorder.onstop=()=>{const blob=this.failure?null:new Blob(this.chunks,{type:recorder.mimeType});const error=this.failure||(!blob?.size?'No video was recorded. Please retry.':'');this.release();this.recorder=null;this.chunks=[];if(!this.closed)this.result(error?null:blob,error);};
   stream.getVideoTracks().forEach(track=>track.addEventListener('ended',()=>this.stop(),{once:true}));
   recorder.start(1000);this.timer=setTimeout(()=>this.stop(),MAX_RECORDING_MS);this.status(false);
  }catch(error){this.release();this.recorder=null;throw error;}finally{this.starting=false;}
 }
 pause(){if(this.recorder?.state==='recording'){this.recorder.pause();this.status(true);}}
 resume(){if(this.recorder?.state==='paused'){this.recorder.resume();this.status(false);}}
 stop(){if(this.recorder&&this.recorder.state!=='inactive')this.recorder.stop();}
 private release(){clearTimeout(this.timer);this.stream?.getTracks().forEach(track=>track.stop());this.stream=null;}
 dispose(){this.closed=true;this.stop();this.release();}
}
