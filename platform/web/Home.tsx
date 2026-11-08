import './home.css';
const beta='mailto:host@studio447.ai?subject=Wandel%20beta%20access';
const features:[string,string,string][]=[
 ['✦','Just ask','Describe a change in chat, or say it out loud with Talk. Wandel makes it on the page in front of you.'],
 ['◐','Looks like your product','New parts are measured against your app’s own fonts, colours and spacing, so they belong there.'],
 ['⇢','Whole flows, not screens','Connect buttons to new steps, dialogs and pages, and link changes across tabs and sites.'],
 ['↗','Share a link','Anyone can click through your idea. Hide real data with one switch before you share.'],
 ['{ }','Ready for engineers','Copy a build prompt with exact styles and placement, so your coding agent starts from the real design.'],
 ['◇','Your choice of AI','Pick OpenAI, Claude or Grok for each conversation.'],
];
/** The product in one picture: the Wandel panel chatting beside an app it just changed. */
function Showcase(){
 return <div className="h-show" aria-hidden="true">
  <div className="h-app">
   <div className="h-bar"><i/><i/><i/><span>app.yourproduct.com</span></div>
   <div className="h-page">
    <div className="h-side"><b/><span/><span/><span/><span/></div>
    <div className="h-main">
     <div className="h-title"/>
     <div className="h-new"><strong>Spring offer</strong><span>Upgrade this week and get two months free.</span><em>Claim offer</em><small>Added by Wandel</small></div>
     <div className="h-cards"><div><span/><span/><b/></div><div><span/><span/><b/></div><div><span/><span/><b/></div></div>
    </div>
   </div>
  </div>
  <div className="h-panel">
   <div className="h-panel-top"><img src="/brand/wandel-mark.svg" alt=""/>Wandel</div>
   <div className="h-msg h-you">Add a promo banner above the cards, in our style</div>
   <div className="h-msg h-wandel">Added it above your cards, using your button and card styles. Undo is one click away.</div>
   <div className="h-input">Ask or describe a change<i>↑</i></div>
  </div>
 </div>;
}
export function Home(){
 return <div className="h">
  <header className="h-head"><a className="h-brand" href="/"><img src="/brand/wandel-mark.svg" alt=""/>Wandel</a><nav><a href="#how">How it works</a><a href="/privacy">Privacy</a><a className="h-btn h-btn-small" href={beta}>Request beta access</a></nav></header>
  <section className="h-hero">
   <p className="h-kicker"><span>Private beta</span>A Chrome extension by Studio447</p>
   <h1>Change your live app<br/><em>by just asking.</em></h1>
   <p className="h-lede">Wandel turns the product you already have into a working prototype. Describe a change, see it on the real page, and share it as a link.</p>
   <div className="h-cta"><a className="h-btn" href={beta}>Request beta access</a><a className="h-link" href="#how">See how it works ↓</a></div>
   <Showcase/>
  </section>
  <section className="h-how" id="how">
   <h2>From idea to something people can click, in minutes.</h2>
   <ol>
    <li><b>1</b><h3>Open Wandel on any page</h3><p>Your app, a competitor’s site, a staging build. Nothing to install on the page itself.</p></li>
    <li><b>2</b><h3>Say what should change</h3><p>Wandel edits the real page, in your design. Keep going in the same conversation until it’s right.</p></li>
    <li><b>3</b><h3>Share it or build it</h3><p>Send a link anyone can try, or hand engineers a prompt with the exact design.</p></li>
   </ol>
  </section>
  <section className="h-features">{features.map(([icon,title,text])=><article key={title}><i>{icon}</i><h3>{title}</h3><p>{text}</p></article>)}</section>
  <section className="h-trust">
   <div><h2>Your real app stays untouched.</h2><p>Changes live in your browser until you share them. Form fields, passwords and private areas are hidden before anything reaches the AI.</p></div>
   <a className="h-link" href="/privacy">Read the privacy policy →</a>
  </section>
  <section className="h-final"><h2>See your next idea in your own product.</h2><p>We’re letting people in a few at a time.</p><a className="h-btn" href={beta}>Request beta access</a></section>
  <footer className="h-foot"><span>Wandel · Studio447</span><span><a href="/privacy">Privacy</a><a href="/playground">Playground</a><a href="mailto:host@studio447.ai">Contact</a></span></footer>
 </div>;
}
