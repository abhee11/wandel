import {useEffect,useState} from 'react';
import {ClerkProvider,SignIn,useAuth,useUser} from '@clerk/react';
const key=process.env.WANDEL_PUBLIC_CLERK_KEY||'';
const token=new URLSearchParams(location.search).get('token')||'';
type Preview={team:string;invitedBy:string};
/** Joining a team from an invite email: see which team it is, sign in with the invited email, join. */
function Join({preview}:{preview:Preview}){
 const {isLoaded,isSignedIn,user}=useUser(),{getToken}=useAuth();
 const [state,setState]=useState<'idle'|'joining'|'joined'>('idle'),[error,setError]=useState('');
 async function join(){
  setState('joining');setError('');
  try{
   const session=await getToken();
   const response=await fetch('/api/invites/accept',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session},body:JSON.stringify({token})});
   const value=await response.json();if(!response.ok)throw new Error(value.error?.message||'Joining didn’t work. Try again.');
   setState('joined');
  }catch(e){setState('idle');setError(e instanceof Error?e.message:'Joining didn’t work. Try again.');}
 }
 // Signed in: join straight away; the button stays for a retry.
 useEffect(()=>{if(isLoaded&&isSignedIn&&state==='idle'&&!error)void join();},[isLoaded,isSignedIn]);
 if(!isLoaded)return <p>Loading secure sign-in…</p>;
 if(!isSignedIn)return <><p>Sign in with the email address the invite was sent to.</p><SignIn routing="hash" forceRedirectUrl={location.href} signUpForceRedirectUrl={location.href}/></>;
 if(state==='joined')return <><h1>You’ve joined {preview.team}.</h1><p>Wandel now shares what it learns about your team’s apps with you. You can close this tab.</p></>;
 return <><p>Signed in as {user?.primaryEmailAddress?.emailAddress}.</p>{error&&<p role="alert">{error}</p>}<button className="button" disabled={state==='joining'} onClick={()=>void join()}>{state==='joining'?'Joining…':'Join '+preview.team}</button></>;
}
export function Invite(){
 const [preview,setPreview]=useState<Preview|null>(null),[error,setError]=useState('');
 useEffect(()=>{if(!token){setError('This invite link is incomplete. Open the link from the email again.');return;}
  void fetch('/api/invites/'+encodeURIComponent(token)).then(async r=>{const v=await r.json();if(!r.ok)throw new Error(v.error?.message||'This invite can’t be opened.');setPreview(v);}).catch(e=>setError(e.message));},[]);
 return <main className="auth card"><a href="/" className="brand">Wandel</a>
  {error?<><h1>This invite can’t be used</h1><p role="alert">{error}</p></>:!preview?<p>Opening the invite…</p>:<>
   <h1>Join {preview.team} on Wandel</h1>
   <p>{preview.invitedBy} invited you. Teammates share what Wandel learns about your apps: their layout and design, never their content.</p>
   {key?<ClerkProvider publishableKey={key}><Join preview={preview}/></ClerkProvider>:<p role="alert">Sign-in isn’t configured on this server.</p>}
  </>}
 </main>;
}
