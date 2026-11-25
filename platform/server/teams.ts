import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {DB} from './db';
import {one,all} from './db';
import {APIError,secret,tokenHash} from './security';
import {recipients,type ShareMailer} from './shareMail';
/** A team shares what Wandel learns about its apps. Owners invite by email; an invite is accepted by signing in with
 * that same email, so a forwarded link can't let someone else in. */
export const MAX_TEAMS_PER_USER=10,MAX_MEMBERS=50,INVITE_DAYS=14;
export type Role='owner'|'member';
type Person={id:string;email:string;name:string|null};
/** The person's role on the team, or null when they aren't on it. Everything team-scoped checks this first. */
export function teamRole(db:DB,teamId:string,userId:string):Role|null{return one<{role:Role}>(db,'SELECT role FROM team_members WHERE team_id=? AND user_id=?',teamId,userId)?.role||null;}
export function teamService(db:DB,options:{appOrigin:string;pepper:string;clock:()=>Date;mailer?:ShareMailer}){
 const now=()=>options.clock().toISOString();
 const name=z.string().trim().min(1).max(80);
 const owner=(teamId:string,userId:string)=>{const role=teamRole(db,teamId,userId);if(!role)throw new APIError(404,'TEAM_NOT_FOUND','That team doesn’t exist, or you’re not on it.');if(role!=='owner')throw new APIError(403,'TEAM_OWNER_ONLY','Only a team owner can do that.');};
 const member=(teamId:string,userId:string)=>{if(!teamRole(db,teamId,userId))throw new APIError(404,'TEAM_NOT_FOUND','That team doesn’t exist, or you’re not on it.');};
 const owners=(teamId:string)=>one<{n:number}>(db,"SELECT count(*) n FROM team_members WHERE team_id=? AND role='owner'",teamId)!.n;
 return {
  list(user:Person){return all<{id:string;name:string;role:Role;members:number}>(db,'SELECT t.id,t.name,m.role,(SELECT count(*) FROM team_members x WHERE x.team_id=t.id) members FROM teams t JOIN team_members m ON m.team_id=t.id AND m.user_id=? ORDER BY t.created_at',user.id);},
  create(user:Person,input:unknown){
   const data=z.object({name}).strict().parse(input);
   if(one<{n:number}>(db,'SELECT count(*) n FROM team_members WHERE user_id=?',user.id)!.n>=MAX_TEAMS_PER_USER)throw new APIError(403,'TEAM_LIMIT',`You can be on at most ${MAX_TEAMS_PER_USER} teams.`);
   const id=randomUUID();db.transaction(()=>{db.prepare('INSERT INTO teams VALUES (?,?,?,?)').run(id,data.name,user.id,now());db.prepare("INSERT INTO team_members VALUES (?,?,'owner',?)").run(id,user.id,now());})();
   return {id,name:data.name,role:'owner' as Role,members:1};
  },
  rename(user:Person,teamId:string,input:unknown){owner(teamId,user.id);const data=z.object({name}).strict().parse(input);db.prepare('UPDATE teams SET name=? WHERE id=?').run(data.name,teamId);return {id:teamId,name:data.name};},
  remove(user:Person,teamId:string){owner(teamId,user.id);db.prepare('DELETE FROM teams WHERE id=?').run(teamId);return {deleted:true};},
  members(user:Person,teamId:string){
   member(teamId,user.id);
   const people=all<{id:string;email:string;name:string|null;role:Role;joined_at:string}>(db,'SELECT u.id,u.email,u.name,m.role,m.joined_at FROM team_members m JOIN users u ON u.id=m.user_id WHERE m.team_id=? ORDER BY m.joined_at',teamId);
   // Only owners see who is still invited.
   const invites=teamRole(db,teamId,user.id)==='owner'?all<{email:string;expires_at:string}>(db,'SELECT email,max(expires_at) expires_at FROM team_invites WHERE team_id=? AND accepted_at IS NULL AND expires_at>? GROUP BY email ORDER BY email',teamId,now()):[];
   return {members:people.map(p=>({id:p.id,email:p.email,name:p.name,role:p.role,joinedAt:p.joined_at})),invites:invites.map(i=>({email:i.email,expiresAt:i.expires_at}))};
  },
  async invite(user:Person,teamId:string,input:unknown){
   owner(teamId,user.id);
   const data=z.object({emails:z.array(z.string()).min(1).max(20)}).strict().parse(input);
   const to=recipients(data.emails),team=one<{name:string}>(db,'SELECT name FROM teams WHERE id=?',teamId)!;
   const count=one<{n:number}>(db,'SELECT count(*) n FROM team_members WHERE team_id=?',teamId)!.n;
   if(count+to.length>MAX_MEMBERS)throw new APIError(403,'TEAM_FULL',`A team can have at most ${MAX_MEMBERS} people.`);
   const expires=new Date(options.clock().getTime()+INVITE_DAYS*864e5).toISOString(),sent:{email:string;url:string}[]=[];
   for(const email of to){
    if(one(db,'SELECT 1 FROM team_members m JOIN users u ON u.id=m.user_id WHERE m.team_id=? AND lower(u.email)=?',teamId,email))continue;
    const token=secret();db.prepare('INSERT INTO team_invites VALUES (?,?,?,?,?,?,NULL)').run(tokenHash(token,options.pepper),teamId,email,user.id,now(),expires);
    const url=new URL('/invite?token='+encodeURIComponent(token),options.appOrigin).href;sent.push({email,url});
    if(options.mailer?.sendInvite)await options.mailer.sendInvite({to:email,sender:{name:user.name,email:user.email},team:team.name,url,expiresAt:expires});
   }
   // The links come back too, so an owner can send one themselves when email isn't set up.
   return {invited:sent,emailed:!!options.mailer?.sendInvite};
  },
  cancelInvite(user:Person,teamId:string,email:string){owner(teamId,user.id);db.prepare('DELETE FROM team_invites WHERE team_id=? AND email=? AND accepted_at IS NULL').run(teamId,email.toLowerCase());return {canceled:true};},
  /** What an invite link is for, shown before signing in: the team's name and who invited. Nothing else. */
  preview(token:string){
   const invite=one<{name:string;inviter:string|null;email:string;expires_at:string;accepted_at:string|null}>(db,'SELECT t.name,u.name inviter,i.email,i.expires_at,i.accepted_at FROM team_invites i JOIN teams t ON t.id=i.team_id JOIN users u ON u.id=i.invited_by WHERE i.token_hash=?',tokenHash(token,options.pepper));
   if(!invite||invite.accepted_at||invite.expires_at<=now())throw new APIError(404,'INVITE_NOT_FOUND','This invite has expired or was already used. Ask for a new one.');
   return {team:invite.name,invitedBy:invite.inviter||'A teammate'};
  },
  accept(user:Person,input:unknown){
   const data=z.object({token:z.string().min(10).max(200)}).strict().parse(input);
   const invite=one<{team_id:string;email:string;expires_at:string;accepted_at:string|null}>(db,'SELECT team_id,email,expires_at,accepted_at FROM team_invites WHERE token_hash=?',tokenHash(data.token,options.pepper));
   if(!invite||invite.accepted_at||invite.expires_at<=now())throw new APIError(404,'INVITE_NOT_FOUND','This invite has expired or was already used. Ask for a new one.');
   if(invite.email!==user.email.toLowerCase())throw new APIError(403,'INVITE_OTHER_EMAIL',`This invite is for ${invite.email}. Sign in with that email to join.`);
   db.transaction(()=>{db.prepare("INSERT OR IGNORE INTO team_members VALUES (?,?,'member',?)").run(invite.team_id,user.id,now());db.prepare('UPDATE team_invites SET accepted_at=? WHERE team_id=? AND email=? AND accepted_at IS NULL').run(now(),invite.team_id,invite.email);})();
   const team=one<{id:string;name:string}>(db,'SELECT id,name FROM teams WHERE id=?',invite.team_id)!;return {team};
  },
  /** An owner removes someone, or anyone leaves. A team always keeps an owner. */
  removeMember(user:Person,teamId:string,memberId:string){
   if(memberId!==user.id)owner(teamId,user.id);else member(teamId,user.id);
   const role=teamRole(db,teamId,memberId);if(!role)throw new APIError(404,'MEMBER_NOT_FOUND','That person isn’t on this team.');
   if(role==='owner'&&owners(teamId)<=1)throw new APIError(409,'LAST_OWNER','A team needs an owner. Make someone else an owner first, or delete the team.');
   db.prepare('DELETE FROM team_members WHERE team_id=? AND user_id=?').run(teamId,memberId);return {removed:true};
  },
  setRole(user:Person,teamId:string,memberId:string,input:unknown){
   owner(teamId,user.id);const data=z.object({role:z.enum(['owner','member'])}).strict().parse(input);
   const role=teamRole(db,teamId,memberId);if(!role)throw new APIError(404,'MEMBER_NOT_FOUND','That person isn’t on this team.');
   if(role==='owner'&&data.role==='member'&&owners(teamId)<=1)throw new APIError(409,'LAST_OWNER','A team needs an owner.');
   db.prepare('UPDATE team_members SET role=? WHERE team_id=? AND user_id=?').run(data.role,teamId,memberId);return {role:data.role};
  },
 };
}
