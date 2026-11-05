/** Shared knowledge of where execution expects an element to be on screen.
 * The renderer records it as it applies operations; layout inspection, the plan's
 * checks and the reveal re-check all read it, so a card the prototype hides until a
 * click is never mistaken for one that failed to render, and a card hidden by
 * accident still is. Once revealed, an element is checked like any other. */
export type Intent=
 /** Hidden now, and a click or hover in the prototype shows it. */
 'interaction'
 /** Hidden on purpose and kept hidden (the user hid it). */
 |'hidden'
 /** Hidden by a load behavior with nothing that ever shows it: a planning mistake for new content. */
 |'unrevealed';
export type Expectation=Intent|'deferred';
const intents=new Map<HTMLElement,Intent>();
const deferredIds=new Set<string>();
export function expectHidden(el:HTMLElement,intent:Intent){const known=intents.get(el);if(known==='interaction')return;intents.set(el,intent);}
export function deferOwned(id:string){deferredIds.add(id);}
/** Content in a closed host menu, or under a screen that isn't open: kept, not missing. */
export function isDeferred(id:string){return deferredIds.has(id);}
export function clearExpectations(){intents.clear();deferredIds.clear();}
const shown=(el:HTMLElement)=>{if(el.hidden)return false;const css=getComputedStyle(el);return css.display!=='none'&&css.visibility!=='hidden';};
/** Why an element is intentionally off screen right now, or undefined when it should be visible.
 * Only the element or an ancestor that execution itself hid counts; an unrelated
 * hidden container is a real problem and stays one. */
export function expectation(el:HTMLElement):Expectation|undefined{
 for(let p:HTMLElement|null=el;p;p=p.parentElement){
  const intent=intents.get(p);if(intent&&!shown(p))return intent;
  // A collapsed block disclosure hides its body by design until expanded.
  if(p.matches('[data-dx-disclosure="closed"] > [data-dx-body]'))return 'deferred';
 }
 // A layout wrapper (for example the row Wandel opens below a card) whose
 // content is all intentionally hidden is empty for the same reason.
 const children=[...el.children].filter((c):c is HTMLElement=>c instanceof HTMLElement);
 if(children.length&&!el.getBoundingClientRect().height){const reasons=children.map(expectation);if(reasons.every(Boolean))return reasons.includes('unrevealed')?'unrevealed':reasons.includes('interaction')?'interaction':reasons[0];}
 return undefined;
}
/** The element execution hid, for one diagnostic per hidden block rather than one per part. */
export function hiddenRoot(el:HTMLElement){for(let p:HTMLElement|null=el;p;p=p.parentElement)if(intents.has(p)&&!shown(p))return p;return el;}
/** Intentionally hidden content that is valid as it is; an unrevealed new element is not. */
export function hiddenByDesign(el:HTMLElement){const reason=expectation(el);return !!reason&&reason!=='unrevealed';}
/** A short, human name for the element that hides another, so a diagnostic says where to look. */
export function hidingAncestor(el:HTMLElement){
 for(let p:HTMLElement|null=el;p&&p!==document.body;p=p.parentElement){
  const css=getComputedStyle(p);
  if(p.hidden||css.display==='none'||css.visibility==='hidden'||p.getAttribute('aria-hidden')==='true'){
   if(p===el)return 'it is set to hidden';
   const heading=p.querySelector('h1,h2,h3,h4,[role=heading]')?.textContent?.trim().slice(0,40);
   const name=p.getAttribute('aria-label')||heading||(p.id?'#'+p.id:'')||p.tagName.toLowerCase();
   return `its container “${name}” is hidden`;
  }
 }
 return 'it has no size on the page';
}
