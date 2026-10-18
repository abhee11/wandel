import type {DB} from './db';
import {one} from './db';
import type {Config} from './config';
import {APIError} from './security';
export interface Subscription {user_id:string;provider:string;provider_customer_id:string|null;provider_subscription_id:string|null;plan:'FREE'|'PRO';status:'free'|'active'|'trialing'|'past_due'|'canceled'|'incomplete';current_period_start:string|null;current_period_end:string|null;cancel_at_period_end:number;updated_at:string;}
export function period(now:Date){return {start:new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)).toISOString(),end:new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1)).toISOString()};}
export class Entitlements {
 constructor(private db:DB,private config:Config,private clock:()=>Date){}
 subscription(userId:string){const s=one<Subscription>(this.db,'SELECT * FROM subscriptions WHERE user_id=?',userId)!;
  if((s.cancel_at_period_end||s.provider==='mock')&&s.current_period_end&&s.current_period_end<=this.clock().toISOString()&&s.status!=='canceled'){
   this.db.prepare("UPDATE subscriptions SET status='canceled',updated_at=? WHERE user_id=?").run(this.clock().toISOString(),userId);s.status='canceled';
  }return s;
 }
 get(userId:string){const now=this.clock(),s=this.subscription(userId);const paid=s.plan==='PRO'&&['active','trialing'].includes(s.status)&&!!s.current_period_end&&s.current_period_end>now.toISOString();
  const grant=one<{source:string;expires_at:string|null}>(this.db,`SELECT g.source,g.expires_at FROM access_grants g LEFT JOIN access_codes c ON c.id=g.code_id WHERE g.user_id=? AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at>?) AND (g.code_id IS NULL OR c.revoked_at IS NULL) ORDER BY g.expires_at IS NULL DESC,g.expires_at DESC LIMIT 1`,userId,now.toISOString());
  const plan=paid||grant?'PRO':'FREE',limits=this.config.plans[plan],p=period(now);
  const count=one<{count:number}>(this.db,'SELECT count(*) count FROM prototypes WHERE user_id=?',userId)!.count;
  const usage=one<{used:number}>(this.db,"SELECT count(*) used FROM ai_actions WHERE user_id=? AND period_start=? AND (status='succeeded' OR (status='pending' AND created_at>?))",userId,p.start,new Date(now.getTime()-120000).toISOString())!.used;
  return {plan,access:paid?{source:'subscription',expiresAt:s.current_period_end}:grant?{source:grant.source,expiresAt:grant.expires_at}:null,limits,usage:{used:usage,allowance:limits.aiActionsPerMonth,remaining:Math.max(0,limits.aiActionsPerMonth-usage),periodStart:p.start,resetsAt:p.end},savedWorkflows:count,capabilities:{canUseAI:usage<limits.aiActionsPerMonth,canCreateWorkflow:limits.savedWorkflows===null||count<limits.savedWorkflows,canUseVersionHistory:limits.versionHistory,canSharePrivately:limits.privateSharing}};
 }
 canUseAI(id:string){return this.get(id).capabilities.canUseAI;}
 canCreateWorkflow(id:string){return this.get(id).capabilities.canCreateWorkflow;}
 canUseVersionHistory(id:string){return this.get(id).capabilities.canUseVersionHistory;}
 canSharePrivately(id:string){return this.get(id).capabilities.canSharePrivately;}
 getRemainingAIUsage(id:string){return this.get(id).usage.remaining;}
 requireCreate(id:string){const e=this.get(id);if(!e.capabilities.canCreateWorkflow)throw new APIError(403,'WORKFLOW_LIMIT_REACHED',`You've reached the ${e.plan==='FREE'?'Free':'Pro'} plan limit of ${e.limits.savedWorkflows} saved prototypes.`,{upgradeUrl:'/pricing'});}
 requireAI(id:string){const e=this.get(id);if(!e.capabilities.canUseAI)throw new APIError(403,'AI_LIMIT_REACHED',"You've used your AI edits for this month.",{upgradeUrl:'/pricing',resetsAt:e.usage.resetsAt});}
 requireHistory(id:string){if(!this.canUseVersionHistory(id))throw new APIError(403,'PRO_REQUIRED','Version history is available on Pro.',{upgradeUrl:'/pricing'});}
}
