/** Wandel's privacy policy. Keep it in step with what the extension and server really do, and with the Chrome Web Store disclosures. */
const contact='host@studio447.ai';
export function Privacy(){
 return <main className="legal">
  <a className="brand" href="/"><img src="/brand/wandel-mark.svg" alt=""/>Wandel</a>
  <h1>Privacy policy</h1>
  <p className="legal-date">Last updated November 8, 2026</p>
  <p>Wandel is made by Studio447. It is a Chrome extension that lets you prototype changes to the web pages you use, by describing them in chat or editing them directly. This policy explains what Wandel collects, why, who else handles it, and how to reach us. Questions go to <a href={'mailto:'+contact}>{contact}</a>.</p>

  <h2>What we collect</h2>
  <h3>Your account</h3>
  <p>When you sign in we receive your email address and name, through our sign-in provider Clerk, or Google if you choose “Continue with Google”. We use them to identify your account, keep your saved work and show your remaining AI edits.</p>
  <h3>What you ask Wandel</h3>
  <p>Your chat messages, images you attach or paste, and the AI’s replies. If you use voice, your recording is sent for transcription and is not kept by us. Spoken replies are generated from the reply text.</p>
  <h3>The page you are working on</h3>
  <p>Only when you send a request, Wandel sends a description of the page so the AI can understand it: visible element names, labels, text and styles, the page address, and a screenshot of the visible page. Before anything leaves your browser, form field contents, password fields, payment card fields and areas a site marks as private are left out or covered, and email addresses and things that look like keys or passwords are removed from text. Wandel does not read other tabs unless you choose an element to copy from one.</p>
  <h3>What you save and share</h3>
  <ul>
   <li><strong>Saved prototypes</strong> you choose to keep in your account: their names, the pages they run on, the changes you made and the text they contain.</li>
   <li><strong>Share links</strong> for the live app: a copy of the prototype that anyone with the link can open. Kept for 30 days, or until you revoke it.</li>
   <li><strong>Links anyone can view</strong>: a copy of the page with your prototype, with real text and images replaced by placeholders unless you turn that off. Kept for 30 days, or until you remove it.</li>
   <li><strong>Walkthrough videos</strong> you upload to share. Kept for 7 days.</li>
  </ul>
  <h3>Code from GitHub</h3>
  <p>Only if you connect GitHub and ask Wandel to implement a prototype: we read files from the repository you choose and send them, with the prototype’s description, to OpenAI to propose changes. You review those changes before Wandel opens a draft pull request. Your GitHub access token is stored encrypted and expires after a few hours, and you can disconnect at any time.</p>
  <h3>Usage and safety records</h3>
  <p>A count of your AI edits for your monthly allowance, records of each AI request and its result so we can count usage and fix problems, short notes when an edit fails, and basic request logs. To limit abuse we keep short-lived counters, using a scrambled form of your IP address where you are not signed in.</p>
  <h3>Payments</h3>
  <p>If you upgrade, payment is handled by Stripe. We receive your plan and payment status, never your full card details.</p>

  <h2>What stays on your computer</h2>
  <p>Drafts of your prototypes, your chat history, your settings and chosen AI model, elements you copy between tabs and values shared between your tabs are kept in your browser’s storage for the extension. They are not sent to us unless you save, share or ask the AI about them, and they are removed when you remove Wandel.</p>

  <h2>Who else handles it</h2>
  <p>We do not sell your information or use it for advertising. We share it only with the services that run Wandel:</p>
  <ul>
   <li><strong>AI providers</strong>: OpenAI, Anthropic (Claude) and xAI (Grok) process your requests and the page details above, depending on the model you choose. OpenAI also handles voice transcription, spoken replies and checking an edit’s screenshot. Each processes this under its own API terms. Where a provider offers a setting not to store requests, we use it.</li>
   <li><strong>Clerk</strong> for sign-in, and <strong>Google</strong> if you sign in with Google.</li>
   <li><strong>GitHub</strong>, only if you connect it.</li>
   <li><strong>Railway</strong>, which hosts our server and database.</li>
   <li><strong>Stripe</strong>, if you upgrade.</li>
  </ul>
  <p>We may disclose information if the law requires it, or to protect Wandel and its users from fraud or abuse.</p>

  <h2>Google user data</h2>
  <p>If you sign in with Google, we receive only your name, email address and profile picture, and use them only to sign you in. Wandel’s use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>

  <h2>How long we keep it</h2>
  <p>Account details, saved prototypes and usage records are kept while your account is open. Links and videos expire as described above. When you ask us to delete your account, we delete it and the work saved in it, except where we must keep a record by law.</p>

  <h2>Your choices</h2>
  <ul>
   <li>Remove share links and videos from Wandel’s Share view at any time.</li>
   <li>Ask us for a copy of your data, a correction, or deletion of your account by emailing <a href={'mailto:'+contact}>{contact}</a>.</li>
   <li>Remove the extension from Chrome to delete what it keeps on your computer.</li>
  </ul>

  <h2>Security</h2>
  <p>Information is sent over encrypted connections, sign-in is handled by Clerk, and access to stored data is limited to the people who run Wandel. No system is perfectly secure, so please don’t use Wandel on pages whose contents you are not allowed to share with the services above.</p>

  <h2>Children</h2>
  <p>Wandel is meant for people at work and is not directed at children under 16.</p>

  <h2>Changes</h2>
  <p>If we change this policy we will update the date above, and tell you in the extension when the change is significant.</p>

  <h2>Contact</h2>
  <p>Studio447 · <a href={'mailto:'+contact}>{contact}</a></p>
 </main>;
}
