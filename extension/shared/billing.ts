/** Public capability hook; never includes Stripe credentials or starts a checkout. */
export type BillingCapabilities={provider:'stripe'|null;mode:'test'|'unavailable';checkoutReady:boolean;portalReady:boolean};
export function billingCapabilities(mode?:string):BillingCapabilities{
 const ready=mode==='stripe-test';return {provider:ready?'stripe':null,mode:ready?'test':'unavailable',checkoutReady:ready,portalReady:ready};
}
