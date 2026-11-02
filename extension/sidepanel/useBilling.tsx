import {useCallback,useEffect,useState} from 'react';
import type {BillingCapabilities} from '../shared/billing';
import {accountAPI,startUpgrade} from './accountClient';
const unavailable:BillingCapabilities={provider:null,mode:'unavailable',checkoutReady:false,portalReady:false};
/** Mount only inside account settings. Payments are initiated only by an explicit click. */
export function useBilling(){
 const [capabilities,setCapabilities]=useState(unavailable),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;void accountAPI<{billing?:BillingCapabilities}>('/billing').then(value=>{if(active)setCapabilities(value.billing||unavailable);}).catch(()=>{if(active)setError('Payment status is unavailable. Your workflow is unchanged.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
 const checkout=useCallback(async()=>{if(busy||!capabilities.checkoutReady)return;setBusy(true);setError('');try{await startUpgrade();}catch(e){setError(e instanceof Error?e.message:'Checkout could not open.');}finally{setBusy(false);}},[busy,capabilities.checkoutReady]);
 return {capabilities,loading,busy,error,checkout};
}
export function BillingSettings({plan}:{plan:string}){
 const billing=useBilling();return <details className="dx-billing-settings"><summary>Plan & payments</summary>{billing.loading?<p className="dx-muted">Checking payment availability…</p>:!billing.capabilities.checkoutReady?<p className="dx-muted">Payments are not enabled yet. Your current access is unchanged.</p>:plan==='PRO'?<p className="dx-muted">Pro access is active.</p>:<><p className="dx-muted">Stripe test checkout is available. No live payments are enabled.</p><button className="dx-small" disabled={billing.busy} onClick={()=>void billing.checkout()}>{billing.busy?'Opening checkout…':'Open test checkout'}</button></>}{billing.error&&<p role="alert" className="dx-muted">{billing.error}</p>}</details>;
}
