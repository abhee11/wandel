/** Bound the whole request, including account-token retrieval and response parsing. */
export async function withDeadline<T>(work:(signal:AbortSignal)=>Promise<T>,parent:AbortSignal,ms=125000):Promise<T>{
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 let interrupt!:(error:Error)=>void;
 const stopped=new Promise<never>((_,reject)=>{interrupt=reject;});
 const cancel=()=>{controller.abort();interrupt(new Error('Request canceled. Your instruction is kept.'));};
 parent.addEventListener('abort',cancel,{once:true});
 try{
  if(parent.aborted){cancel();return await stopped;}
  timer=setTimeout(()=>{controller.abort();interrupt(new Error('Wandel took too long to respond. Your instruction is kept—retry or cancel to keep editing.'));},ms);
  return await Promise.race([work(controller.signal),stopped]);
 }finally{clearTimeout(timer);parent.removeEventListener('abort',cancel);}
}
