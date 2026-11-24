/** A request Wandel itself moved to another page or screen (to look at Activity 4, to open a menu that switches
 * activity, to follow a link). It is kept per tab before the move and continues wherever the page lands, so moving is
 * never mistaken for the user leaving. Replaces the earlier link-only "crawl" record. */
export type Carry={text:string;id:string;name:string;hops:number;at:number};
/** A request may move screens at most this many times, so it can't wander forever. */
export const MAX_HOPS=3;
const fresh=90_000;
const key=()=>{try{return 'wandel:crawl:'+(new URL(location.href).searchParams.get('tabId')||'');}catch{return 'wandel:crawl:';}};
const store=()=>{try{return typeof chrome!=='undefined'?chrome.storage?.session:undefined;}catch{return undefined;}};
/** The request as it continues on the next screen: the original text, with one note saying where Wandel went. */
export function carriedText(request:string,name:string){return request.replace(/\n\(Wandel (?:opened|switched to) [^\n]*\)$/,'')+`\n(Wandel switched to “${name}” to continue this request. Continue it on this screen.)`;}
export async function holdCarry(carry:Carry){await store()?.set({[key()]:carry}).catch(()=>{});}
/** The kept request, once: it is removed as it is read, and ignored when older than a minute and a half. */
export async function takeCarry():Promise<Carry|null>{
 const area=store();if(!area)return null;const k=key();
 const saved=(await area.get(k).catch(()=>({})) as Record<string,unknown>)[k] as Partial<Carry>|undefined;await area.remove(k).catch(()=>{});
 if(!saved?.text||typeof saved.at!=='number'||Date.now()-saved.at>fresh)return null;
 return {text:saved.text,id:saved.id||'',name:saved.name||'',hops:saved.hops||1,at:saved.at};
}
/** Whether a kept request is waiting, without taking it. */
export async function peekCarry():Promise<boolean>{const area=store();if(!area)return false;const k=key();const saved=(await area.get(k).catch(()=>({})) as Record<string,unknown>)[k] as Partial<Carry>|undefined;return !!saved?.text&&typeof saved.at==='number'&&Date.now()-saved.at<=fresh;}
export async function dropCarry(reopen?:{current:unknown}){if(reopen)reopen.current=null;await store()?.remove(key()).catch(()=>{});}
/** An error that means the page moved under the request, not that the step failed. */
export const navigated=(message:string)=>/Active tab changed|page connection closed|did not respond|screen changed|page changed|navigat/i.test(message);
