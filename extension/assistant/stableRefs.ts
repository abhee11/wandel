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
