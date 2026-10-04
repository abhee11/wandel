import Stripe from 'stripe';
import {type DB,one} from './db';
import type {BillingProvider} from './billing';
import {APIError} from './security';
export class UnavailableBilling implements BillingProvider {
 mode='unavailable' as const;
 start(_id:string):never{throw new APIError(503,'BILLING_NOT_CONFIGURED','Stripe test checkout is not configured yet. Your draft is safe; save temporarily or try again later.');}
 complete(_id:string,_checkout:string):never{return this.start(_id);}
 cancelAtPeriodEnd(id:string):never{return this.start(id);}
 manage(id:string):never{return this.start(id);}
}
export class StripeBilling implements BillingProvider {
 mode='stripe-test' as const;
 private queue:Promise<void>=Promise.resolve();
 constructor(private db:DB,private stripe:Stripe,private priceId:string,private webhookSecret:string,private origin:string){}
 private subscription(userId:string){return one<{provider_customer_id:string|null;provider_subscription_id:string|null}>(this.db,'SELECT * FROM subscriptions WHERE user_id=?',userId)!;}
 async start(userId:string){
  const price=await this.stripe.prices.retrieve(this.priceId);
  if(price.livemode||!price.active||price.type!=='recurring'||price.recurring?.interval!=='month'||price.recurring.interval_count!==1||price.currency!=='usd')throw new APIError(503,'INVALID_PRICE','Configure an active monthly USD Stripe test price.');
  let customer=this.subscription(userId).provider_customer_id;
  if(!customer?.startsWith('cus_')){
   const user=one<{email:string}>(this.db,'SELECT email FROM users WHERE id=?',userId)!;
   const created=await this.stripe.customers.create({email:user.email,metadata:{wandelUserId:userId}},{idempotencyKey:`wandel-customer-${userId}`});customer=created.id;
   this.db.prepare("UPDATE subscriptions SET provider='stripe',provider_customer_id=? WHERE user_id=?").run(customer,userId);
  }
  const pending=one<{id:string}>(this.db,"SELECT id FROM checkouts WHERE user_id=? AND provider='stripe' AND status='pending' AND expires_at>? ORDER BY created_at DESC LIMIT 1",userId,new Date().toISOString());
  if(pending){const previous=await this.stripe.checkout.sessions.retrieve(pending.id);if(previous.status==='open'&&previous.url)return {id:previous.id,url:previous.url};if(previous.status==='complete')throw new APIError(409,'UPGRADE_PENDING','Stripe is confirming your upgrade. Retry saving in a moment.');}
  const session=await this.stripe.checkout.sessions.create({mode:'subscription',customer,line_items:[{price:this.priceId,quantity:1}],client_reference_id:userId,metadata:{wandelUserId:userId},subscription_data:{metadata:{wandelUserId:userId}},success_url:`${this.origin}/extension/return?checkout=success`,cancel_url:`${this.origin}/extension/return?checkout=cancel`},{idempotencyKey:`wandel-checkout-${userId}-${Math.floor(Date.now()/1800000)}`});
  if(!session.url||session.livemode)throw new APIError(503,'INVALID_CHECKOUT','Stripe test checkout could not be created.');
  this.db.prepare('INSERT OR IGNORE INTO checkouts VALUES (?,?,?,?,?,?,?,?,NULL)').run(session.id,userId,'stripe','pending',price.unit_amount||0,price.currency,new Date().toISOString(),new Date(session.expires_at*1000).toISOString());
  return {id:session.id,url:session.url};
 }
 complete():never{throw new APIError(409,'WEBHOOK_REQUIRED','Stripe confirms your upgrade securely after checkout. Return to Wandel and retry saving.');}
 async cancelAtPeriodEnd(userId:string){const id=this.subscription(userId).provider_subscription_id;if(!id?.startsWith('sub_'))throw new APIError(409,'NO_ACTIVE_SUBSCRIPTION','No Stripe subscription exists.');await this.stripe.subscriptions.update(id,{cancel_at_period_end:true});}
 async manage(userId:string){const customer=this.subscription(userId).provider_customer_id;if(!customer?.startsWith('cus_'))throw new APIError(409,'NO_ACTIVE_SUBSCRIPTION','No Stripe customer exists.');const portal=await this.stripe.billingPortal.sessions.create({customer,return_url:`${this.origin}/extension/return`});return {url:portal.url};}
 async webhook(body:string,signature:string){
  let event:Stripe.Event;try{event=this.stripe.webhooks.constructEvent(body,signature,this.webhookSecret);}catch{throw new APIError(400,'INVALID_SIGNATURE','Invalid Stripe webhook signature.');}
  if(event.livemode)throw new APIError(400,'LIVE_EVENT_REJECTED','Only Stripe test events are accepted.');
  const run=this.queue.catch(()=>{}).then(()=>this.process(event));this.queue=run;await run;
 }
 private async process(event:Stripe.Event){
  if(one(this.db,'SELECT 1 FROM stripe_events WHERE id=?',event.id))return;
  let id:string|undefined;
  if(event.type.startsWith('customer.subscription.'))id=(event.data.object as Stripe.Subscription).id;
  if(event.type==='checkout.session.completed'){const session=event.data.object as Stripe.Checkout.Session;id=typeof session.subscription==='string'?session.subscription:session.subscription?.id;}
  if(id){
   // Fetch current state so delayed events cannot resurrect expired/canceled plans.
   const subscription=await this.stripe.subscriptions.retrieve(id),customer=typeof subscription.customer==='string'?subscription.customer:subscription.customer.id;
   const userId=subscription.metadata.wandelUserId;
   const local=one<{user_id:string}>(this.db,'SELECT user_id FROM subscriptions WHERE provider_customer_id=? AND user_id=?',customer,userId);
   if(!local)throw new APIError(400,'UNKNOWN_CUSTOMER','Subscription does not belong to a Wandel checkout.');
   const current=one<{provider_subscription_id:string|null}>(this.db,'SELECT provider_subscription_id FROM subscriptions WHERE user_id=?',userId);
   if(current?.provider_subscription_id&&current.provider_subscription_id!==subscription.id){const newer=await this.stripe.subscriptions.retrieve(current.provider_subscription_id);if(['active','trialing'].includes(newer.status)){this.db.prepare('INSERT INTO stripe_events VALUES (?,?)').run(event.id,new Date().toISOString());return;}}
   const item=subscription.items.data.find(item=>item.price.id===this.priceId);
   const active=!!item&&['active','trialing'].includes(subscription.status);
   const statuses=['active','trialing','past_due','canceled','incomplete'];
   const status=statuses.includes(subscription.status)?subscription.status:'canceled';
   this.db.transaction(()=>{
    this.db.prepare("UPDATE subscriptions SET provider='stripe',provider_subscription_id=?,plan=?,status=?,current_period_start=?,current_period_end=?,cancel_at_period_end=?,updated_at=? WHERE user_id=?").run(subscription.id,active?'PRO':'FREE',status,item?new Date(item.current_period_start*1000).toISOString():null,item?new Date(item.current_period_end*1000).toISOString():null,subscription.cancel_at_period_end?1:0,new Date().toISOString(),userId);
    if(event.type==='checkout.session.completed')this.db.prepare("UPDATE checkouts SET status='completed',completed_at=? WHERE id=? AND user_id=?").run(new Date().toISOString(),event.data.object.id,userId);
    this.db.prepare('INSERT INTO stripe_events VALUES (?,?)').run(event.id,new Date().toISOString());
   }).immediate();return;
  }
  this.db.prepare('INSERT INTO stripe_events VALUES (?,?)').run(event.id,new Date().toISOString());
 }
}
