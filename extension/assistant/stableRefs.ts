/**
 * The same screen should reach the AI as the same text. Element handles, the capture token and workflow ids are
 * random per capture, so they become short names in order of first appearance before sending, and the names in
 * the AI's plan are mapped back afterwards.
 */
const RANDOM_ID=/(?:e_)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
export function stableNames(json:string){
 const forward=new Map<string,string>(),back=new Map<string,string>();
 const text=json.replace(RANDOM_ID,id=>{let name=forward.get(id);if(!name){name=(id.startsWith('e_')?'e_':'id_')+(forward.size+1);forward.set(id,name);back.set(name,id);}return name;});
 const restore=(out:string)=>out.replace(/(?<![\w-])(?:e|id)_\d+(?![\w-])/g,name=>back.get(name)??name);
 return {text,restore};
}
/** A request that doesn't point back at the conversation is planned from the page alone, so it comes out the same in any chat. */
export const refersBack=(instruction:string)=>/\b(it|its|that|those|them|they|again|same|previous|last|instead|also|too|undo|redo|continue|earlier|revert|fix)\b/i.test(instruction);
/** Whether a request continues the conversation: it points back at the chat, answers what Wandel just asked,
 * is a short reply, or is a step Wandel just suggested. Only a request that does none of these is planned from the page alone. */
export function continuesChat(instruction:string,history:{role:string;text:string;status?:string}[]){
 if(refersBack(instruction))return true;
 const last=[...history].reverse().find(turn=>turn.role==='assistant'&&turn.status!=='failed');if(!last)return false;
 if(last.text.includes('?'))return true;
 const words=(text:string)=>text.toLowerCase().match(/[a-z0-9]+/g)||[];
 const asked=words(instruction);if(asked.length<=6)return true;
 const said=new Set(words(last.text)),shared=asked.filter(word=>said.has(word)).length;
 return shared/asked.length>=0.5;
}
