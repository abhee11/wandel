import {ClerkProvider,SignIn,SignUp,UserButton,useUser} from '@clerk/react';
const key=process.env.WANDEL_PUBLIC_CLERK_KEY||'';
function Auth(){const {isLoaded,isSignedIn,user}=useUser();
 if(!isLoaded)return <p>Loading secure sign-in…</p>;
 if(isSignedIn)return <><div style={{display:"flex",alignItems:"center",gap:12,justifyContent:"center"}}><UserButton/><span>{user.primaryEmailAddress?.emailAddress}</span></div><h1>You’re signed in.</h1><p>Return to the app tab and reopen Wandel, then save your workflow. Your account is ready to use.</p><button className="button" onClick={()=>window.close()}>Close and return to Wandel</button></>;
 return location.pathname.includes('sign-up')?<SignUp routing="hash" signInUrl="/extension/sign-in" forceRedirectUrl="/extension/sign-in"/>:<SignIn routing="hash" signUpUrl="/extension/sign-up" forceRedirectUrl="/extension/sign-in"/>;
}
export function ExtensionAuth(){
 if(location.pathname==='/extension/return')return <main className="auth card"><h1>{new URLSearchParams(location.search).get('checkout')==='cancel'?'Checkout canceled. Your draft is safe.':'Return to Wandel.'}</h1><p>Open the original application tab and click Save to my account again. Your plan updates after Stripe confirms checkout.</p><button className="button" onClick={()=>window.close()}>Close this tab</button></main>;
 return <main className="auth card"><a href="/" className="brand">Wandel</a><p>After signing in, return to the extension to continue your flow.</p>{key?<ClerkProvider publishableKey={key}><Auth/></ClerkProvider>:<p role="alert">Clerk is not configured yet. Add the Clerk publishable and secret keys, then restart the server and rebuild the extension. Temporary local saves remain available.</p>}</main>;
}
