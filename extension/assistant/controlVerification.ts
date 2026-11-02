import {color} from '../content/themeRoles';
/** A fast additive-button check: a real, readable control with visible affordance. */
export function verifyNewButton(node:HTMLElement){
 const box=node.getBoundingClientRect(),css=getComputedStyle(node);
 if(!(node instanceof HTMLButtonElement)||node.disabled||box.width<24||box.height<24)throw new Error('The new button is not a usable visible control.');
 const background=color(css.backgroundColor),border=color(css.borderColor),text=color(css.color);
 const filled=!!background&&background.a>.1,outlined=!!border&&border.a>.1&&parseFloat(css.borderWidth)>0&&css.borderStyle!=='none';
 if(!filled&&!outlined)throw new Error('The new button looks like plain text. Add a visible background or border.');
 if(filled&&text&&background!.a>=.99){const luminance=(c:NonNullable<ReturnType<typeof color>>)=>[c.r,c.g,c.b].map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);const a=luminance(text),b=luminance(background!);if((Math.max(a,b)+.05)/(Math.min(a,b)+.05)<3)throw new Error('The new button text does not have enough contrast against its background.');}
}
