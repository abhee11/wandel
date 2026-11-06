/** Copies text, falling back for frames the browser won't give clipboard access. Says whether it worked. */
export async function copyText(value:string){
 try{await navigator.clipboard.writeText(value);return true;}catch{/* try the older way */}
 const box=document.createElement('textarea');box.value=value;box.style.cssText='position:fixed;opacity:0';document.body.append(box);box.select();
 try{return document.execCommand('copy');}catch{return false;}finally{box.remove();}
}
