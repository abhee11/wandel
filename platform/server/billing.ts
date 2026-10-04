import {randomUUID} from 'node:crypto';
import type {DB} from './db';
import {one} from './db';
import type {Config} from './config';
import {APIError} from './security';
export interface Checkout {id:string;user_id:string;provider:string;status:string;price_cents:number;currency:string;created_at:string;expires_at:string;completed_at:string|null;}
// A Stripe provider will return a hosted Checkout URL and apply subscription
// changes ONLY from verified, idempotent webhooks, never the success redirect.
export interface BillingProvider {
 start(userId:string):{id:string;url:string}|Promise<{id:string;url:string}>;
 complete(userId:string,id:string):boolean|Promise<boolean>;
 cancelAtPeriodEnd(userId:string):void|Promise<void>;
 manage(userId:string):{url:string}|Promise<{url:string}>;
 webhook?(body:string,signature:string):Promise<void>;
 mode?:'stripe-test'|'unavailable';
}
export class MockBillingProvider implements BillingProvider {
 constructor(private db:DB,private config:Config,private clock:()=>Date){}
 private enabled(){if(!this.config.mockBilling||this.config.production)throw new APIError(503,'BILLING_UNAVAILABLE','Checkout is not available. Mock billing is disabled.');}
 start(userId:string){this.enabled();const id=randomUUID(),now=this.clock();this.db.prepare('INSERT INTO checkouts VALUES (?,?,?,?,?,?,?,?,NULL)').run(id,userId,'mock','pending',this.config.priceCents,this.config.currency,now.toISOString(),new Date(now.getTime()+1800000).toISOString());return {id,url:`/checkout/${id}`};}
 complete(userId:string,id:string){this.enabled();return this.db.transaction(()=>{
  const c=one<Checkout>(this.db,'SELECT * FROM checkouts WHERE id=? AND user_id=?',id,userId);if(!c)throw new APIError(404,'NOT_FOUND','Checkout not found.');if(c.status==='completed')return false;
  if(c.status!=='pending'||c.expires_at<=this.clock().toISOString())throw new APIError(409,'CHECKOUT_EXPIRED','This test checkout expired. Start a new checkout.');
  const existing=one<{status:string;current_period_end:string}>(this.db,'SELECT status,current_period_end FROM subscriptions WHERE user_id=?',userId)!;
  if(['active','trialing'].includes(existing.status)&&existing.current_period_end>this.clock().toISOString())throw new APIError(409,'ALREADY_SUBSCRIBED','You already have an active subscription.');
  const now=this.clock(),end=new Date(now);const day=end.getUTCDate();end.setUTCDate(1);end.setUTCMonth(end.getUTCMonth()+1);const last=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()+1,0)).getUTCDate();end.setUTCDate(Math.min(day,last));
  this.db.prepare("UPDATE subscriptions SET provider='mock',provider_customer_id=?,provider_subscription_id=?,plan='PRO',status='active',current_period_start=?,current_period_end=?,cancel_at_period_end=0,updated_at=? WHERE user_id=?").run(`mock_customer_${userId}`,`mock_subscription_${id}`,now.toISOString(),end.toISOString(),now.toISOString(),userId);
  this.db.prepare("UPDATE checkouts SET status='completed',completed_at=? WHERE id=?").run(now.toISOString(),id);return true;
 }).immediate();}
 cancelAtPeriodEnd(userId:string){this.enabled();const result=this.db.prepare("UPDATE subscriptions SET cancel_at_period_end=1,updated_at=? WHERE user_id=? AND status IN ('active','trialing')").run(this.clock().toISOString(),userId);if(!result.changes)throw new APIError(409,'NO_ACTIVE_SUBSCRIPTION','There is no active subscription to cancel.');}
 manage(_userId:string){this.enabled();return {url:'/account/billing?manage=1'};}
}
