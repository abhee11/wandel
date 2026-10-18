import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {one,type DB} from './db';
import {APIError} from './security';
export function codeHash(code:string){return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');}
export function createAccessCode(db:DB,label:string,maxRedemptions:number,grantDays:number,now=new Date()){
 if(!Number.isInteger(maxRedemptions)||maxRedemptions<1||maxRedemptions>10000||!Number.isInteger(grantDays)||grantDays<1||grantDays>365)throw new Error('Use 1–10000 redemptions and 1–365 grant days.');
 const code='WANDEL-'+randomBytes(12).toString('hex').toUpperCase(),id=randomUUID(),expiresAt=new Date(now.getTime()+90*86400000).toISOString();
 db.prepare('INSERT INTO access_codes VALUES (?,?,?,?,?,?,NULL,?)').run(id,codeHash(code),label.slice(0,100),maxRedemptions,grantDays,expiresAt,now.toISOString());
 return {id,code,maxRedemptions,grantDays,redeemBefore:expiresAt};
}
export function grantOwner(db:DB,email:string,now=new Date()){
 const user=one<{id:string}>(db,'SELECT id FROM users WHERE lower(email)=?',email.toLowerCase());if(!user)throw new Error('Account not found in this database. Sign in to this service first.');
 const existing=one<{id:string}>(db,"SELECT id FROM access_grants WHERE user_id=? AND source='admin' AND revoked_at IS NULL AND expires_at IS NULL",user.id);if(!existing)db.prepare("INSERT INTO access_grants VALUES (?,?,NULL,'admin',NULL,NULL,?)").run(randomUUID(),user.id,now.toISOString());return {userId:user.id,source:'admin',expiresAt:null};
}
export function redeemAccessCode(db:DB,userId:string,code:string,now:Date){
 return db.transaction(()=>{
  const c=one<{id:string;grant_days:number;max_redemptions:number;expires_at:string;revoked_at:string|null}>(db,'SELECT * FROM access_codes WHERE code_hash=?',codeHash(code));
  const invalid=()=>new APIError(400,'INVALID_ACCESS_CODE','This code is invalid, expired, revoked or fully redeemed.');
  if(!c||c.revoked_at||c.expires_at<=now.toISOString())throw invalid();
  const previous=one<{expires_at:string;revoked_at:string|null}>(db,'SELECT expires_at,revoked_at FROM access_grants WHERE user_id=? AND code_id=?',userId,c.id);
  if(previous){if(previous.revoked_at||previous.expires_at<=now.toISOString())throw invalid();return {expiresAt:previous.expires_at,alreadyRedeemed:true};}
  const count=one<{n:number}>(db,'SELECT count(*) n FROM access_grants WHERE code_id=?',c.id)!.n;if(count>=c.max_redemptions)throw invalid();
  const expiresAt=new Date(now.getTime()+c.grant_days*86400000).toISOString();db.prepare("INSERT INTO access_grants VALUES (?,?,?,'beta_code',?,NULL,?)").run(randomUUID(),userId,c.id,expiresAt,now.toISOString());return {expiresAt,alreadyRedeemed:false};
 }).immediate();
}
