import {color} from '../content/themeRoles';
import {hiddenByDesign} from '../content/visibility';
const luminance=(c:NonNullable<ReturnType<typeof color>>)=>[c.r,c.g,c.b].map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
/** Text an edit left too faint to read against the solid surface behind it. A gradient or image behind the text can't be measured, so it is left alone. */
export function verifyReadableText(root:HTMLElement){
 if(!root.isConnected)return;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 for(let count=0,node=walker.nextNode();node&&count<80;node=walker.nextNode()){
  const text=node.textContent?.trim(),el=node.parentElement;if(!text||!el)continue;count++;
  const css=getComputedStyle(el),box=el.getBoundingClientRect(),ink=color(css.color);if(!ink||ink.a<.1||!box.width||!box.height||css.visibility==='hidden'||hiddenByDesign(el))continue;
  for(let p:HTMLElement|null=el;p;p=p.parentElement){const style=getComputedStyle(p);if(style.backgroundImage!=='none')break;const paper=color(style.backgroundColor);if(paper&&paper.a>=.99){const a=luminance(ink),b=luminance(paper);if((Math.max(a,b)+.05)/(Math.min(a,b)+.05)<3)throw new Error(`Text is too faint to read: “${text.slice(0,40)}”.`);break;}}
 }
}
/** A fast additive-button check: a real, readable control with visible affordance. */
export function verifyNewButton(node:HTMLElement){
 if(node.isConnected&&hiddenByDesign(node))return;
 const box=node.getBoundingClientRect(),css=getComputedStyle(node);
 if(!(node instanceof HTMLButtonElement)||node.disabled||box.width<24||box.height<24)throw new Error('The new button is not a usable visible control.');
 const background=color(css.backgroundColor),border=color(css.borderColor),text=color(css.color);
 const filled=!!background&&background.a>.1,outlined=!!border&&border.a>.1&&parseFloat(css.borderWidth)>0&&css.borderStyle!=='none';
 if(!filled&&!outlined)throw new Error('The new button looks like plain text. Add a visible background or border.');
 if(filled&&text&&background!.a>=.99){const a=luminance(text),b=luminance(background!);if((Math.max(a,b)+.05)/(Math.min(a,b)+.05)<3)throw new Error('The new button text does not have enough contrast against its background.');}
}
