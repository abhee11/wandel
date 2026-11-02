type Results={length:number;[index:number]:{length:number;[index:number]:{transcript:string}}};
type Recognition={continuous:boolean;interimResults:boolean;lang:string;onresult:((event:{results:Results})=>void)|null;onerror:(()=>void)|null;onend:(()=>void)|null;start():void;abort():void};
/** Optional browser dictation preview. Bounded WAV transcription remains the final instruction. */
export function liveSpeech(update:(text:string)=>void,unavailable:()=>void){
 const api=globalThis as typeof globalThis & {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
 const Constructor=api.SpeechRecognition||api.webkitSpeechRecognition;
 if(!Constructor){unavailable();return ()=>{};}
 let recognition:Recognition;
 try{
  recognition=new Constructor();recognition.continuous=true;recognition.interimResults=true;recognition.lang=navigator.language||'en-US';
  recognition.onresult=event=>{let text='';for(let i=0;i<event.results.length;i++)text+=' '+event.results[i][0].transcript;update(text.trim().slice(0,1600));};
  recognition.onerror=()=>{unavailable();};recognition.onend=()=>{};recognition.start();
 }catch{unavailable();return ()=>{};}
 return ()=>{recognition.onresult=null;recognition.onerror=null;recognition.onend=null;try{recognition.abort();}catch{/* Already stopped. */}};
}
