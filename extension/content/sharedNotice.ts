/** Tells someone who opened a shared link why it didn't start here and what to do, so they are never left on a half-working page. */
export const sharedLeftKey='wandel:shared-left';
/** Whether this page is part of signing in, so Wandel must not pull someone away from it. */
export const signInPage=()=>/log-?in|sign-?in|sign-?up|register|auth|sso|saml|mfa|2fa|otp|verify|password|callback/i.test(location.pathname)||!!document.querySelector('input[type=password],input[autocomplete="one-time-code"],input[autocomplete="username"]');
let host:HTMLElement|null=null;
export const clearSharedNotice=()=>{host?.remove();host=null;};
export function showSharedNotice(input:{title:string;body:string;actions:{label:string;primary?:boolean;run:()=>void}[]}){
 clearSharedNotice();
 const node=document.createElement('div');node.dataset.dxIgnore='true';host=node;
 const shadow=node.attachShadow({mode:'open'}),style=document.createElement('style');
 style.textContent=':host{all:initial!important;position:fixed!important;top:20px!important;left:50%!important;transform:translateX(-50%)!important;z-index:2147483647!important}section{box-sizing:border-box;width:min(460px,calc(100vw - 32px));padding:16px 18px;border:1px solid #f5d27a;border-radius:14px;background:#fff9e8;color:#4a3a10;font:13px/1.5 system-ui;box-shadow:0 12px 40px #211a3b33}strong{display:block;font-size:14px;margin-bottom:4px;color:#2f2508}p{margin:0 0 12px}div{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}button{font:500 12px system-ui;padding:7px 12px;border-radius:8px;border:1px solid #e3c871;background:#fff;color:#4a3a10;cursor:pointer}button.primary{background:#5b5bd6;border-color:#5b5bd6;color:#fff}';
 const panel=document.createElement('section'),title=document.createElement('strong'),body=document.createElement('p'),row=document.createElement('div');
 panel.setAttribute('role','alert');title.textContent=input.title;body.textContent=input.body;
 for(const action of input.actions){const button=document.createElement('button');button.textContent=action.label;if(action.primary)button.className='primary';button.onclick=action.run;row.append(button);}
 panel.append(title,body,row);shadow.append(style,panel);document.documentElement.append(node);
}
