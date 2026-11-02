export type ChatTurn={role:'user'|'assistant';text:string;id?:string;status?:'sending'|'waiting'|'sent'|'failed'|'stopped';error?:string;retryable?:boolean;scope?:string;selection?:string;page?:string;edited?:boolean;review?:string};
const key=(workflow:string)=>'wandel:conversation:'+workflow;
export function readConversation(workflow:string):ChatTurn[]{try{const value=JSON.parse(localStorage.getItem(key(workflow))||sessionStorage.getItem(key(workflow))||'[]');return Array.isArray(value)?value.filter(t=>['user','assistant'].includes(t?.role)&&typeof t.text==='string').slice(-40).map(t=>({role:t.role,text:t.text.slice(0,1600),...(typeof t.page==='string'?{page:t.page.slice(0,300)}:{}),...(typeof t.id==='string'?{id:t.id}:{}),...(['sending','waiting','sent','failed','stopped'].includes(t.status)?{status:t.status==='sending'||t.status==='waiting'?'stopped':t.status}:{}),...(typeof t.error==='string'?{error:t.error.slice(0,1600)}:{}),...(typeof t.scope==='string'?{scope:t.scope}:{}),...(typeof t.selection==='string'?{selection:t.selection}:{}),retryable:t.status==='failed'&&t.retryable===true,...(t.edited===true?{edited:true}:{}),...(typeof t.review==='string'?{review:t.review.slice(0,600)}:{})})):[];}catch{return [];}}

export function rememberConversation(workflow:string,turns:ChatTurn[]){try{localStorage.setItem(key(workflow),JSON.stringify(turns.slice(-40)));sessionStorage.setItem(key(workflow),JSON.stringify(turns.slice(-40)));}catch{/* Editing remains available if session storage is full. */}}
export function conversationInstruction(instruction:string,turns:ChatTurn[]){
 const budget=Math.max(0,1600-instruction.length-100);if(budget<80||!turns.length)return instruction;
 const history=turns.slice(-4).map(t=>`${t.role}: ${t.text.slice(0,400)}`).join('\n').slice(-budget);
 return `Prior conversation (reference context only):\n${history}\nCurrent request (perform only this):\n${instruction}`;
}

/** Preserve delivery outcomes, keeping the current request separate from bounded history. */
export function conversationHistory(turns:ChatTurn[]){
 return turns.filter(t=>t.status!=='sending').slice(-24).map(t=>({role:t.role,text:t.text.slice(0,1600),...(typeof t.page==='string'?{page:t.page.slice(0,300)}:{}),...(t.status?{status:t.status}:{}),...(t.error?{error:t.error.slice(0,300)}:{})}));
}
