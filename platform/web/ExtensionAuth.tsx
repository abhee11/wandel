import {useState} from 'react';
import {ClerkProvider,SignIn,SignUp,UserButton,useUser} from '@clerk/react';
const key=process.env.WANDEL_PUBLIC_CLERK_KEY||'';
function Auth(){const {isLoaded,isSignedIn,user}=useUser();
 const [returnError,setReturnError]=useState('');
 const query=new URLSearchParams(location.search);
 if(query.get('extension')&&query.get('state'))sessionStorage.setItem('wandelAuthReturn',JSON.stringify({extension:query.get('extension'),nonce:query.get('state')}));
 async function returnToWandel(){
  try{
   const pending=JSON.parse(sessionStorage.getItem('wandelAuthReturn')||'null');
   if(!pending||!globalThis.chrome?.runtime?.sendMessage)throw new Error('Switch to your application tab and click the purple Wandel icon. This sign-in tab was opened without an extension return link.');
   const result=await chrome.runtime.sendMessage(pending.extension,{type:'WANDEL_AUTH_RETURN',nonce:pending.nonce});
   if(!result?.ok)throw new Error(result?.error||'Could not reconnect. Return to your application tab and click the Wandel icon.');
   sessionStorage.removeItem('wandelAuthReturn');
  }catch(error){setReturnError(error instanceof Error?error.message:'Return to your application tab and click the Wandel icon.');}
 }
 if(!isLoaded)return <p>Loading secure sign-in…</p>;
 if(isSignedIn)return <><div style={{display:"flex",alignItems:"center",gap:12,justifyContent:"center"}}><UserButton/><span>{user.primaryEmailAddress?.emailAddress}</span></div><h1>You’re signed in.</h1><p>Continue in Wandel on your original application tab. If the panel is closed, click the purple Wandel icon to reopen it.</p><button className="button" onClick={()=>void returnToWandel()}>Return to Wandel</button>{returnError&&<p role="alert">{returnError}</p>}</>;
 return location.pathname.includes('sign-up')?<SignUp routing="hash" signInUrl="/extension/sign-in" forceRedirectUrl="/extension/sign-in"/>:<SignIn routing="hash" signUpUrl="/extension/sign-up" forceRedirectUrl="/extension/sign-in"/>;
}
export function ExtensionAuth(){
 if(location.pathname==='/extension/return')return <main className="auth card"><h1>{new URLSearchParams(location.search).get('checkout')==='cancel'?'Checkout canceled. Your draft is safe.':'Return to Wandel.'}</h1><p>Open the original application tab and click Save to my account again. Your plan updates after Stripe confirms checkout.</p><button className="button" onClick={()=>window.close()}>Close this tab</button></main>;
 return <main className="auth card"><a href="/" className="brand">Wandel</a><p>After signing in, return to the extension to continue your flow.</p>{key?<ClerkProvider publishableKey={key}><Auth/></ClerkProvider>:<p role="alert">Clerk is not configured yet. Add the Clerk publishable and secret keys, then restart the server and rebuild the extension. Temporary local saves remain available.</p>}</main>;
}
