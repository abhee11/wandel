import {it,expect} from 'vitest';
import {database,one} from '../platform/server/db';
import {provisionIdentity} from '../platform/server/clerk';
const now='2026-11-07T00:00:00.000Z';
const fresh=()=>database(':memory:');
it('reconnects a Clerk account to its work when the Clerk instance changes',()=>{
 const db=fresh();const id=provisionIdentity(db,{subject:'user_dev',email:'a@example.com',name:'A'},now);
 expect(provisionIdentity(db,{subject:'user_prod',email:'a@example.com',name:'A'},now)).toBe(id);
 expect(provisionIdentity(db,{subject:'user_prod',email:'a@example.com',name:'A'},now)).toBe(id);
 expect(one<{clerk_id:string}>(db,'SELECT clerk_id FROM users WHERE id=?',id)!.clerk_id).toBe('user_prod');
 expect(one<{count:number}>(db,'SELECT count(*) count FROM users')!.count).toBe(1);
});
it('never links an old password account by email',()=>{
 const db=fresh();db.prepare('INSERT INTO users (id,email,name,password_hash,created_at,updated_at) VALUES (?,?,?,?,?,?)').run('old','b@example.com',null,'scrypt:hash',now,now);
 expect(()=>provisionIdentity(db,{subject:'user_prod',email:'b@example.com',name:null},now)).toThrow(/older account/);
});
it('still creates a new account for a new email',()=>{
 const db=fresh();expect(provisionIdentity(db,{subject:'user_c',email:'c@example.com',name:null},now)).toBeTruthy();
});
