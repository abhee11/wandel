import {scrypt,randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
import type {DB} from './db';
export class APIError extends Error {constructor(public status:number,public code:string,message:string,public details:Record<string,unknown>={}){super(message);}}
export const secret=()=>randomBytes(32).toString('base64url');
export const tokenHash=(token:string,pepper:string)=>createHmac('sha256',pepper).update(token).digest('hex');
const derive=(password:string,salt:string)=>new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024},(error,key)=>error?reject(error):resolve(key)));
export async function hashPassword(password:string){const salt=randomBytes(16).toString('hex');return `scrypt$${salt}$${(await derive(password,salt)).toString('hex')}`;}
export async function checkPassword(password:string,hash:string){const [,salt,value]=hash.split('$');const key=await derive(password,salt);const expected=Buffer.from(value,'hex');return expected.length===key.length&&timingSafeEqual(expected,key);}
export function rateLimit(db:DB,key:string,max:number,now:number,windowMs=900000){
 db.transaction(()=>{const row=db.prepare('SELECT * FROM rate_limits WHERE key=?').get(key) as {window_start:number;count:number}|undefined;
 if(!row||now-row.window_start>=windowMs){db.prepare('INSERT OR REPLACE INTO rate_limits VALUES (?,?,1)').run(key,now);return;}
 if(row.count>=max)throw new APIError(429,'RATE_LIMITED','Too many attempts. Please try again later.',{retryAfter:Math.ceil((windowMs-(now-row.window_start))/1000)});
 db.prepare('UPDATE rate_limits SET count=count+1 WHERE key=?').run(key);
 }).immediate();
}
