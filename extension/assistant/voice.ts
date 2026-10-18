export function pcmWav(samples:Float32Array,rate:number){
 const count=Math.floor(samples.length*16000/rate),buffer=new ArrayBuffer(44+count*2),view=new DataView(buffer);const put=(at:number,s:string)=>[...s].forEach((c,i)=>view.setUint8(at+i,c.charCodeAt(0)));
 put(0,'RIFF');view.setUint32(4,buffer.byteLength-8,true);put(8,'WAVE');put(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);put(36,'data');view.setUint32(40,count*2,true);
 for(let i=0;i<count;i++){const from=Math.floor(i*rate/16000),to=Math.min(samples.length,Math.max(from+1,Math.floor((i+1)*rate/16000)));let sum=0;for(let n=from;n<to;n++)sum+=samples[n];const value=Math.max(-1,Math.min(1,sum/(to-from)));view.setInt16(44+i*2,value*(value<0?32768:32767),true);}return new Blob([buffer],{type:'audio/wav'});
}
/** Explicit push-to-talk only. Audio never leaves this object until stop returns its bounded WAV. */
export class PushToTalk{
 private stream:MediaStream|null=null;private audio:AudioContext|null=null;private processor:ScriptProcessorNode|null=null;private chunks:Float32Array[]=[];private length=0;private canceled=false;private started=false;private timer?:ReturnType<typeof setTimeout>;
 constructor(private active:(value:boolean)=>void,private completed:(blob:Blob)=>void,private failed:(message:string)=>void){}
 async start(){
  if(this.started)return;this.started=true;this.canceled=false;
  try{if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microphone capture is unavailable. You can still type your instruction.');
   const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});this.stream=stream;
   if(this.canceled){this.release();return;}
   const audio=new AudioContext();this.audio=audio;await audio.resume();if(this.canceled){this.release();return;}
   const input=audio.createMediaStreamSource(stream),processor=audio.createScriptProcessor(4096,1,1),silent=audio.createGain();silent.gain.value=0;this.processor=processor;this.chunks=[];this.length=0;
   processor.onaudioprocess=event=>{const remaining=Math.floor(audio.sampleRate*20)-this.length;if(remaining<=0){this.stop();return;}const data=event.inputBuffer.getChannelData(0).slice(0,remaining);this.chunks.push(data);this.length+=data.length;};input.connect(processor);processor.connect(silent);silent.connect(audio.destination);this.active(true);this.timer=setTimeout(()=>this.stop(),20000);
  }catch(error){this.release();if(!this.canceled)this.failed(error instanceof DOMException&&error.name==='NotAllowedError'?'Microphone permission was denied. Type your instruction or enable it in Chrome.':error instanceof Error?error.message:'Microphone unavailable. Type instead.');}
 }
 stop(){if(!this.started)return;this.canceled=true;const rate=this.audio?.sampleRate||16000,data=new Float32Array(this.length);let at=0;for(const c of this.chunks){data.set(c,at);at+=c.length;}this.release();if(data.length/rate>=.2)this.completed(pcmWav(data,rate));}
 cancel(){this.canceled=true;this.release();}
 private release(){clearTimeout(this.timer);if(this.processor)this.processor.onaudioprocess=null;this.processor?.disconnect();this.processor=null;void this.audio?.close().catch(()=>{});this.audio=null;this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.started=false;this.chunks=[];this.length=0;this.active(false);}
}
