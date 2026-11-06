import {pcmWav} from './voice';
/** Hands-free conversation: listens for speech and hands over one finished utterance at a time. Sound is measured here on this device; nothing leaves it until someone has spoken and paused. */
const SPEECH_FLOOR=.012,START_MS=140,END_MS=1100,MIN_SPEECH_MS=450,MAX_MS=20000,PRE_ROLL_MS=350,IDLE_MS=180000;
export type GateEvent='start'|'end'|'drop'|null;
/** Decides when speech starts and ends from sound levels. Kept pure so it can be checked without a microphone. */
export class SpeechGate{
 private noise=.004;private above=0;private quiet=0;private spoken=0;speaking=false;
 reset(){this.above=0;this.quiet=0;this.spoken=0;this.speaking=false;}
 feed(level:number,ms:number):GateEvent{
  if(!this.speaking)this.noise=this.noise*.98+Math.min(level,this.noise*2.5)*.02;
  const loud=level>Math.max(SPEECH_FLOOR,this.noise*3);
  if(!this.speaking){
   this.above=loud?this.above+ms:0;
   if(this.above>=START_MS){this.speaking=true;this.spoken=this.above;this.quiet=0;this.above=0;return 'start';}
   return null;
  }
  this.spoken+=ms;this.quiet=loud?0:this.quiet+ms;
  if(this.quiet>=END_MS||this.spoken>=MAX_MS){const enough=this.spoken-this.quiet>=MIN_SPEECH_MS;this.reset();return enough?'end':'drop';}
  return null;
 }
}
export type HandsFreeState='listening'|'hearing'|'paused';
export class HandsFree{
 private stream:MediaStream|null=null;private audio:AudioContext|null=null;private processor:ScriptProcessorNode|null=null;
 private gate=new SpeechGate();private chunks:Float32Array[]=[];private held=false;private heard=0;
 constructor(private segment:(wav:Blob)=>void,private state:(value:HandsFreeState)=>void,private idle:()=>void,private failed:(message:string)=>void){}
 async start(){
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microphone capture is unavailable. You can still type.');
   const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});this.stream=stream;
   const audio=new AudioContext();this.audio=audio;await audio.resume();
   const input=audio.createMediaStreamSource(stream),processor=audio.createScriptProcessor(2048,1,1),silent=audio.createGain();silent.gain.value=0;this.processor=processor;
   this.heard=performance.now();this.state('listening');
   processor.onaudioprocess=event=>this.sound(event.inputBuffer.getChannelData(0),audio.sampleRate);
   input.connect(processor);processor.connect(silent);silent.connect(audio.destination);
  }catch(error){this.stop();this.failed(error instanceof DOMException&&error.name==='NotAllowedError'?'Microphone permission was denied. You can still type.':error instanceof Error?error.message:'Microphone unavailable.');}
 }
 private sound(input:Float32Array,rate:number){
  if(this.held)return;
  const data=input.slice(),ms=data.length/rate*1000;let sum=0;for(const value of data)sum+=value*value;
  const event=this.gate.feed(Math.sqrt(sum/data.length),ms);
  this.chunks.push(data);
  if(!this.gate.speaking&&event===null){const keep=Math.ceil(PRE_ROLL_MS/ms);if(this.chunks.length>keep)this.chunks.splice(0,this.chunks.length-keep);if(performance.now()-this.heard>IDLE_MS){this.idle();return;}}
  if(event==='start'){this.heard=performance.now();this.state('hearing');}
  if(event==='drop'){this.chunks=[];this.state('listening');}
  if(event==='end'){const length=this.chunks.reduce((total,chunk)=>total+chunk.length,0),samples=new Float32Array(length);let at=0;for(const chunk of this.chunks){samples.set(chunk,at);at+=chunk.length;}this.chunks=[];this.heard=performance.now();this.state('listening');this.segment(pcmWav(samples,rate));}
 }
 /** Stops listening while Wandel speaks, so it never hears itself. */
 pause(){this.held=true;this.chunks=[];this.gate.reset();this.state('paused');}
 resume(){if(!this.processor)return;this.held=false;this.chunks=[];this.gate.reset();this.heard=performance.now();this.state('listening');}
 stop(){if(this.processor)this.processor.onaudioprocess=null;this.processor?.disconnect();this.processor=null;void this.audio?.close().catch(()=>{});this.audio=null;this.stream?.getTracks().forEach(track=>track.stop());this.stream=null;this.chunks=[];this.gate.reset();}
}
/** Words that are thinking aloud, not an instruction. */
export const fillerSpeech=(text:string)=>/^(?:u+m+|u+h+|h+m+|ah+|oh+|ok(?:ay)?|right|so|well|yeah|yep|thanks|thank you|bye)[.,!?]*$/i.test(text.trim())||text.replace(/[^\p{L}\p{N}]/gu,'').length<2;
export const stopListening=(text:string)=>/^(?:please )?(?:stop listening|turn (?:this|it|yourself)? ?off|that'?s all|we'?re done|end conversation|stop talking)[.!]?$/i.test(text.trim());
export const stopWork=(text:string)=>/^(?:stop|cancel|wait|hold on|never ?mind|forget it)[.!]?$/i.test(text.trim());
/** The first sentence or two: enough to hear what happened without being read a paragraph. */
export function spokenReply(text:string){const plain=text.replace(/\s+/g,' ').trim(),sentences=plain.match(/[^.!?]+(?:[.!?]+|$)/g)||[plain];let out='';for(const sentence of sentences){if((out+sentence).length>170&&out)break;out+=sentence;}return out.trim().slice(0,220);}
