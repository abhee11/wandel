import {mkdirSync,appendFileSync} from 'node:fs';
import {APIError} from './security';
/** One share email: a link to a published prototype, sent on behalf of the person who shared it. */
export type ShareMessage={to:string;sender:{name:string|null;email:string};title:string;url:string;expiresAt:string;note?:string};
export interface ShareMailer{send(message:ShareMessage):Promise<void>;}
const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const day=(iso:string)=>new Date(iso).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'});
/** Subject, plain text and HTML for a share email. Everything the sender typed is escaped; the only link is the prototype's. */
export function shareEmail(message:ShareMessage){
 const who=(message.sender.name||'').trim()||message.sender.email,title=message.title.trim()||'a prototype';
 const subject=`${who} shared a prototype with you: ${title}`.slice(0,180);
 const note=message.note?.trim();
 const text=[`${who} (${message.sender.email}) shared a Wandel prototype with you: ${title}`,'',...(note?[`“${note}”`,'']:[]),`Open it: ${message.url}`,'',`It opens in your browser; nothing to install. The link works until ${day(message.expiresAt)}.`,'',`Reply to this email to answer ${who}.`].join('\n');
 const html=`<!doctype html><html><body style="margin:0;padding:24px;background:#f6f5fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#14131b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border:1px solid #e6e3ee;border-radius:16px" cellpadding="0" cellspacing="0"><tr><td style="padding:28px">
<p style="margin:0 0 6px;font-size:13px;color:#6e6c7f">${escape(who)} shared a prototype with you</p>
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${escape(title)}</h1>
${note?`<p style="margin:0 0 20px;padding:12px 14px;background:#f6f5fa;border-radius:10px;font-size:15px;line-height:1.5">${escape(note).replace(/\n/g,'<br>')}</p>`:''}
<a href="${escape(message.url)}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#6254ca;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px">Open prototype</a>
<p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#6e6c7f">Opens in your browser, nothing to install. The link works until ${escape(day(message.expiresAt))}. Reply to this email to answer ${escape(who)} (${escape(message.sender.email)}).</p>
</td></tr></table><p style="margin:16px 0 0;font-size:12px;color:#9a97a8">Sent with Wandel by Studio447</p></td></tr></table></body></html>`;
 return {subject,text,html};
}
/** Sends through Resend's API. Replies go to the person who shared. */
export class ResendMailer implements ShareMailer{
 constructor(private key:string,private from:string){}
 async send(message:ShareMessage){
  const {subject,text,html}=shareEmail(message);
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${this.key}`,'Content-Type':'application/json'},body:JSON.stringify({from:this.from,to:[message.to],reply_to:message.sender.email,subject,text,html}),signal:AbortSignal.timeout(15000)});
  if(!response.ok){const body=await response.text().catch(()=>'');console.error(JSON.stringify({event:'share_email_failed',status:response.status,detail:body.slice(0,300)}));throw new APIError(502,'EMAIL_FAILED','The email couldn’t be sent. The link was still created; copy it and send it yourself.');}
 }
}
/** Local development: emails are written to a file instead of sent. */
export class DevShareMailer implements ShareMailer{
 async send(message:ShareMessage){mkdirSync('.data',{recursive:true,mode:0o700});appendFileSync('.data/mailbox.jsonl',JSON.stringify({...shareEmail(message),to:message.to,createdAt:new Date().toISOString()})+'\n',{mode:0o600});}
}
const EMAIL=/^[^\s@<>()[\]\\,;:"]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
/** Recipients from what the person typed: commas, spaces or new lines between addresses; each checked, lowercased and listed once. */
export function recipients(value:unknown){
 const list=(Array.isArray(value)?value:[]).filter((item):item is string=>typeof item==='string').map(item=>item.trim().toLowerCase()).filter(Boolean);
 const unique=[...new Set(list)];
 if(!unique.length)throw new APIError(400,'NO_RECIPIENTS','Add at least one email address.');
 if(unique.length>10)throw new APIError(400,'TOO_MANY_RECIPIENTS','Share with up to 10 people at a time.');
 const bad=unique.find(email=>email.length>254||!EMAIL.test(email));
 if(bad)throw new APIError(400,'INVALID_EMAIL',`“${bad.slice(0,80)}” isn’t a valid email address.`);
 return unique;
}
