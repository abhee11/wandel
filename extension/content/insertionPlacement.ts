export type InsertionStyle={node:HTMLElement;key:string;before:string;priority:string;after:string};
/** One placement path for created, copied and manually inserted blocks. */
export function placeBelow(target:HTMLElement,node:HTMLElement,id:string){
 const parent=target.parentElement;if(!parent)throw new Error('The insertion anchor is no longer on the page.');
 const rect=target.getBoundingClientRect(),parentRect=parent.getBoundingClientRect(),css=getComputedStyle(parent);
 const styles:InsertionStyle[]=[];
 const set=(element:HTMLElement,key:string,value:string)=>{const before=element.style.getPropertyValue(key),priority=element.style.getPropertyPriority(key);element.style.setProperty(key,value,'important');styles.push({node:element,key,before,priority,after:element.style.getPropertyValue(key)});};
 // A full-width flex item is still squeezed beside its anchor when nowrap is
 // left in place. Keep the existing anchor's width while opening a new row.
 if(css.display.includes('flex')&&css.flexDirection.startsWith('row'))set(parent,'flex-wrap','wrap');
 if(rect.width>0){set(target,'box-sizing','border-box');set(target,'width',rect.width+'px');set(target,'max-width','100%');set(target,'flex-shrink','0');}
 const wrap=document.createElement('div');wrap.dataset.dxOwned='wrap:'+id;
 const left=parentRect.left+(parseFloat(css.borderLeftWidth)||0)+(parseFloat(css.paddingLeft)||0),available=Math.max(0,parent.clientWidth-(parseFloat(css.paddingLeft)||0)-(parseFloat(css.paddingRight)||0));
 const offset=Math.max(0,Math.min(rect.left-left,available-rect.width));
 wrap.style.cssText='display:flex!important;flex-direction:column!important;align-items:flex-start!important;box-sizing:border-box!important;flex:0 0 100%!important;grid-column:1 / -1!important;width:100%!important;min-width:0!important;max-width:100%!important;margin:24px 0 0!important;';
 wrap.style.paddingLeft=offset+'px';
 for(const [key,value]of Object.entries({width:rect.width>0?rect.width+'px':'100%','max-width':'100%','min-width':'0','box-sizing':'border-box','flex-shrink':'0','flex-grow':'0',margin:'0'}))node.style.setProperty(key,value,'important');
 wrap.append(node);return {wrap,styles};
}
export function restoreInsertionStyles(styles:InsertionStyle[]){for(const item of [...styles].reverse())if(item.node.style.getPropertyValue(item.key)===item.after){if(item.before)item.node.style.setProperty(item.key,item.before,item.priority);else item.node.style.removeProperty(item.key);}}
