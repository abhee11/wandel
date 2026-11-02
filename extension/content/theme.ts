import {color,mix,brandHue,hueDistance,statusPaint,paintedBackground,textPaint,hexColor} from './themeRoles';
import {sensitive} from '../assistant/privacy';
import {visible} from './nativeDesign';
import type {ThemeSchema} from '../shared/model';
import type {z} from 'zod';
export type Theme=z.infer<typeof ThemeSchema>;
export type ThemeStyle={target:HTMLElement;key:string;before:string;priority:string;after:string};
function luminance(hex:string){const rgb=hex.slice(1).match(/../g)!.map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
export function contrast(a:string,b:string){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export function validateTheme(theme:Theme){if([theme.secondary,theme.tertiary].some(tint=>tint&&(contrast(theme.text,tint)<4.5||contrast(theme.accent,tint)<3)))throw new Error('The secondary theme surfaces need readable text and accent contrast. Nothing was applied.');if(contrast(theme.text,theme.background)<4.5||contrast(theme.text,theme.surface)<4.5||contrast(theme.accentText,theme.accent)<4.5||contrast(theme.accent,theme.surface)<3||contrast(theme.accent,theme.background)<3)throw new Error('The theme needs readable text and link contrast. Nothing was applied.');}
/** Apply a palette to the real subtree; no generated selectors, scripts or host handlers. */
export function applyTheme(root:HTMLElement,theme:Theme):ThemeStyle[]{
 validateTheme(theme);const all=[root,...root.querySelectorAll<HTMLElement>('*')];if(all.length>2000)throw new Error('This page is too large for one theme preview. Ask to theme a named section.');
 const styles:ThemeStyle[]=[];
 const set=(target:HTMLElement,key:string,value:string)=>{const before=target.style.getPropertyValue(key),priority=target.style.getPropertyPriority(key);target.style.setProperty(key,value,'important');styles.push({target,key,before,priority,after:target.style.getPropertyValue(key)});};
 // Apply and inspect final paints, rather than intermediate CSS transitions.
 // This override is part of the reversible theme patch.
 for(const node of all)if(node instanceof HTMLElement&&!sensitive(node)&&visible(node))set(node,'transition','none');
 const paints=all.filter((node):node is HTMLElement=>node instanceof HTMLElement&&!sensitive(node)&&visible(node)&&!node.matches('img,video,canvas,iframe,script,style')).map(node=>{const css=getComputedStyle(node);return {node,foreground:css.color,background:css.backgroundColor,border:css.borderTopColor,image:css.backgroundImage,shadow:css.boxShadow,radius:parseFloat(css.borderRadius)||0};});
 const rootWidth=root.getBoundingClientRect().width;const hue=brandHue(paints),secondary=theme.secondary||mix(theme.surface,theme.accent,.12),tertiary=theme.tertiary||mix(theme.surface,theme.accent,.045);
 const accentPaint=(value:string)=>{const c=color(value);return !!c&&c.a>.05&&hue!==null&&c.s>.25&&c.l>.22&&hueDistance(c.h,hue)<28;};
 const mapAccent=(value:string)=>{const c=color(value)!;const mapped=c.l>.965?tertiary:c.l>.78?secondary:theme.accent;const rgb=color(mapped)!;return c.a<1?`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${c.a})`:mapped;};
 const replacePaints=(value:string)=>value.replace(/#[a-f0-9]{3,8}\b|rgba?\([^)]+\)/ig,part=>accentPaint(part)?mapAccent(part):part);
 for(const p of paints){
  const node=p.node;if(statusPaint(node))continue;
  const fg=color(p.foreground),bg=color(p.background),button=node.closest<HTMLElement>('button,[role=button]');
  const buttonPaint=button?paints.find(item=>item.node===button):undefined;
  const filled=buttonPaint&&accentPaint(buttonPaint.background)&&color(buttonPaint.background)!.l<.78;
  if(filled)set(node,'color',theme.accentText);
  else if(accentPaint(p.foreground))set(node,'color',mapAccent(p.foreground));
  else if(fg&&(fg.s<.25||fg.l<.22)&&fg.l<.7&&!node.matches('[disabled],[aria-disabled=true]'))set(node,'color',fg.l<.32?theme.text:mix(theme.text,theme.surface,Math.min(.62,fg.l*.8)));
  // Transparent/outline/text controls remain transparent. Tinted selected states remain tinted.
  if(node===root)set(node,'background-color',theme.background);
  else if(accentPaint(p.background))set(node,'background-color',mapAccent(p.background));
  else if(bg&&bg.a>.05&&(bg.s<.16||Math.max(bg.r,bg.g,bg.b)-Math.min(bg.r,bg.g,bg.b)<40)&&bg.l>.88){const rect=node.getBoundingClientRect(),pageSurface=!p.radius&&!node.matches('nav,header,footer,aside,[role=navigation],[role=banner]')&&(node.matches('main,[role=main]')||rootWidth>0&&rect.width>=rootWidth*.6&&rect.height>=window.innerHeight*.3);set(node,'background-color',pageSurface?theme.background:theme.surface);}
  if(accentPaint(p.border))set(node,'border-color',mapAccent(p.border));
  if(p.image&&p.image!=='none'&&!/url\s*\(/i.test(p.image)){const mapped=replacePaints(p.image);if(mapped!==p.image)set(node,'background-image',mapped);}
  if(p.shadow&&p.shadow!=='none'){const mapped=replacePaints(p.shadow);if(mapped!==p.shadow)set(node,'box-shadow',mapped);}
  if(node.matches('input[type=checkbox],input[type=radio]'))set(node,'accent-color',theme.accent);
 }

 // Verify actual text/surface combinations after mapping, including inherited and translucent surfaces.
 for(const {node} of paints){if(statusPaint(node)||node.closest('[disabled],[aria-disabled=true]')||!textPaint(node))continue;const bg=paintedBackground(node),css=getComputedStyle(node),fg=hexColor(css.color);if(!bg||!fg)continue;const minimum=parseFloat(css.fontSize)>=24||parseFloat(css.fontSize)>=18.66&&Number(css.fontWeight)>=700?3:4.5;if(contrast(fg,bg)>=minimum)continue;const replacement=[theme.text,theme.accentText,theme.accent,'#000000','#ffffff'].find(candidate=>contrast(candidate,bg)>=minimum);if(replacement)set(node,'color',replacement);}
 return styles;
}
export function restoreTheme(styles:ThemeStyle[]){for(const item of [...styles].reverse())if(item.target.style.getPropertyValue(item.key)===item.after){if(item.before)item.target.style.setProperty(item.key,item.before,item.priority);else item.target.style.removeProperty(item.key);}}

export function verifyTheme(root:HTMLElement){for(const node of [root,...root.querySelectorAll<HTMLElement>('*')].slice(0,2001)){if(!(node instanceof HTMLElement)||!visible(node)||sensitive(node)||statusPaint(node)||node.closest('[disabled],[aria-disabled=true]')||!textPaint(node))continue;const bg=paintedBackground(node),css=getComputedStyle(node),fg=hexColor(css.color);if(!bg||!fg)continue;const minimum=parseFloat(css.fontSize)>=24||parseFloat(css.fontSize)>=18.66&&Number(css.fontWeight)>=700?3:4.5;if(contrast(fg,bg)<minimum-.02)throw new Error(`The rendered theme contains unreadable text on its surface (${node.tagName.toLowerCase()}, ${fg} on ${bg}, contrast ${contrast(fg,bg).toFixed(2)}).`);}}
