import {createClerkClient,verifyToken} from '@clerk/backend';
import {randomUUID} from 'node:crypto';
import {type DB,one} from './db';
import {APIError} from './security';
export interface AccountIdentity {subject:string;email:string;name:string|null}
export interface IdentityProvider {verify(token:string,requestOrigin?:string|null):Promise<AccountIdentity>}
export class ClerkIdentity implements IdentityProvider {
 private client;
 constructor(private secretKey:string,private authorizedParties:string[]){this.client=createClerkClient({secretKey});}
 async verify(token:string,requestOrigin?:string|null):Promise<AccountIdentity>{
  if(!this.secretKey)throw new APIError(503,'AUTH_NOT_CONFIGURED','Clerk is not configured yet. Temporary local saves are still available.');
  try{
   // Verify the signature, expiry and session claims before inspecting azp.
   // Clerk worker tokens can omit azp when Chrome omits the Origin header.
   // This API accepts explicit Bearer credentials only, never ambient cookies.
   // Origin-less worker/native requests still require a fully verified token.
   const claims=await verifyToken(token,{secretKey:this.secretKey});
   const trustedExtension=Boolean(requestOrigin?.startsWith('chrome-extension://')&&this.authorizedParties.includes(requestOrigin));
   if(claims.azp ? !this.authorizedParties.includes(claims.azp) : Boolean(requestOrigin)&&!trustedExtension)throw new APIError(401,'AUTH_ORIGIN_MISMATCH','Wandel’s sign-in origin is not configured on the server.');
   const user=await this.client.users.getUser(claims.sub);
   const email=user.emailAddresses.find(e=>e.id===user.primaryEmailAddressId&&e.verification?.status==='verified');
   if(!email)throw new Error('Verified email required');
   return {subject:user.id,email:email.emailAddress.toLowerCase(),name:[user.firstName,user.lastName].filter(Boolean).join(' ')||null};
  }catch(error){
   // Log only SDK error classification, never credentials or user records.
   const reason=error&&typeof error==='object'&&'reason' in error?String(error.reason):error instanceof Error?error.name:'unknown';
   console.warn('Clerk account verification failed:',reason);
   if(error instanceof APIError)throw error;
   throw new APIError(401,'AUTH_REQUIRED','Please sign in with Clerk again.');
  }
 }
}
export function provisionIdentity(db:DB,identity:AccountIdentity,now:string){
 return db.transaction(()=>{
  let user=one<{id:string}>(db,'SELECT id FROM users WHERE clerk_id=?',identity.subject);
  if(user)return user.id;
  // Do not silently link a legacy password account by email alone.
  if(one(db,'SELECT 1 FROM users WHERE email=?',identity.email))throw new APIError(409,'ACCOUNT_LINK_REQUIRED','An older account uses this email. Migrate that account before using Clerk. Your saved work has not been changed.');
  const id=randomUUID();
  db.prepare('INSERT INTO users (id,email,name,password_hash,created_at,updated_at,clerk_id) VALUES (?,?,?,?,?,?,?)').run(id,identity.email,identity.name,'clerk-managed',now,now,identity.subject);
  db.prepare("INSERT INTO subscriptions VALUES (?,'none',NULL,NULL,'FREE','free',NULL,NULL,0,?)").run(id,now);
  return id;
 }).immediate();
}
