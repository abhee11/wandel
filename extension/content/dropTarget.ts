/** Where a dragged element lands: beside another element in the page's own layout, or inside a panel. */
export type Drop={item:HTMLElement;anchor:HTMLElement;position:'before'|'after'|'inside';axis:'horizontal'|'vertical'};
type Spot=Omit<Drop,'item'>;
const controls='button,a,input,textarea,select,img,svg,label,br,hr,video,canvas';
const shown=(el:HTMLElement)=>{const box=el.getBoundingClientRect(),css=getComputedStyle(el);return box.width>=8&&box.height>=8&&css.display!=='none'&&css.visibility!=='hidden';};
const area=(box:DOMRect)=>box.width*box.height;
/** A visible surface: the look of a card or panel, rather than a plain layout wrapper. */
function surface(el:HTMLElement){
 const css=getComputedStyle(el);
 return css.backgroundImage!=='none'||!/^(transparent|rgba\([^)]*,\s*0\))$/.test(css.backgroundColor)||parseFloat(css.borderTopWidth)>0&&css.borderTopStyle!=='none'||css.boxShadow!=='none';
}
/** Whether items of this container sit side by side. */
function axisOf(container:HTMLElement|null):Drop['axis']{
 if(!container)return 'vertical';
 const css=getComputedStyle(container);
 if(css.display.includes('flex'))return css.flexDirection.startsWith('row')?'horizontal':'vertical';
 if(css.display.includes('grid'))return css.gridTemplateColumns.trim().split(/\s+/).length>1?'horizontal':'vertical';
 return 'vertical';
}
/** The layout item an element really is: apps wrap cards in cells that hold nothing else, and moving only the card would leave an empty cell behind. */
function layoutItem(el:HTMLElement,root:HTMLElement){
 let item=el;
 for(let parent=item.parentElement;parent&&parent!==root&&!parent.matches('body,main')&&!surface(parent);parent=item.parentElement){
  if([...parent.children].filter(child=>child instanceof HTMLElement&&(child===item||!child.hasAttribute('data-dx-ignore')&&shown(child))).length!==1)break;
  item=parent;
 }
 return item;
}
const beside=(from:HTMLElement,x:number,y:number,root:HTMLElement):Spot=>{
 const anchor=layoutItem(from,root),axis=axisOf(anchor.parentElement),box=anchor.getBoundingClientRect();
 return {anchor,axis,position:(axis==='horizontal'?x-box.left<box.width/2:y-box.top<box.height/2)?'before':'after'};
};
/** The closest visible child, for a pointer over the gaps of a container. A pointer further than reach from any of them is not aiming at this container. */
const reach=120;
function nearestChild(container:HTMLElement,dragged:HTMLElement,x:number,y:number){
 let best:HTMLElement|null=null,distance=Infinity;
 for(const child of container.children){
  if(!(child instanceof HTMLElement)||child===dragged||child.contains(dragged)||child.hasAttribute('data-dx-ignore')||!shown(child))continue;
  const box=child.getBoundingClientRect(),dx=Math.max(box.left-x,0,x-box.right),dy=Math.max(box.top-y,0,y-box.bottom),gap=Math.hypot(dx,dy);
  if(gap<distance){best=child;distance=gap;}
 }
 return distance<=reach?best:null;
}
/** A move that would leave the element exactly where it is. */
function unchanged(dragged:HTMLElement,drop:Spot){
 if(drop.position==='inside')return dragged.parentElement===drop.anchor&&dragged===[...drop.anchor.children].filter(child=>!child.hasAttribute('data-dx-ignore')).at(-1);
 if(dragged.parentElement!==drop.anchor.parentElement)return false;
 const items=[...dragged.parentElement!.children].filter((child):child is HTMLElement=>child instanceof HTMLElement&&(child===dragged||shown(child))).sort((a,b)=>(parseInt(getComputedStyle(a).order)||0)-(parseInt(getComputedStyle(b).order)||0));
 const from=items.indexOf(dragged),to=items.indexOf(drop.anchor);
 return to===from+(drop.position==='before'?1:-1);
}
/** An invisible layer stretched over its parent to catch clicks: what it covers is what the user is aiming at. */
function clickLayer(el:HTMLElement){
 const parent=el.parentElement;if(!parent||!['absolute','fixed'].includes(getComputedStyle(el).position))return false;
 return area(el.getBoundingClientRect())>=area(parent.getBoundingClientRect())*.8;
}
function locate(dragged:HTMLElement,x:number,y:number,root:HTMLElement):Spot|null{
 const hit=document.elementsFromPoint(x,y).find((el):el is HTMLElement=>el instanceof HTMLElement&&!dragged.contains(el)&&!el.closest('[data-dx-ignore]')&&root.contains(el)&&!clickLayer(el));
 if(!hit)return null;
 const size=dragged.getBoundingClientRect();
 // A panel-sized element: the rim of a panel places it beside that panel, the middle places it inside.
 let panel:HTMLElement|null=hit;
 while(panel&&panel!==root&&(panel.contains(dragged)||!surface(panel)||panel.matches(controls)))panel=panel.parentElement;
 if(panel&&panel!==root&&!panel.contains(dragged)&&area(size)>area(panel.getBoundingClientRect())*.25){
  const item=layoutItem(panel,root),box=panel.getBoundingClientRect(),axis=axisOf(item.parentElement),along=axis==='horizontal'?(x-box.left)/box.width:(y-box.top)/box.height;
  if(along>=.25&&along<=.75)return {anchor:panel,position:'inside',axis};
  return {anchor:item,axis,position:along<.25?'before':'after'};
 }
 for(let node:HTMLElement|null=hit;node;node=node.parentElement){
  // Over a container holding the element, such as a gap between its neighbours: it lands next to the closest one.
  if(node.contains(dragged)){const near=nearestChild(node,dragged,x,y);if(near)return beside(near,x,y,root);if(node===root)return null;continue;}
  if(node===root||!root.contains(node))return null;
  // Anything smaller joins the content around it, beside the first thing of a comparable size.
  const box=node.getBoundingClientRect();
  if(box.width>=Math.min(size.width*.5,120)&&box.height>=Math.min(size.height*.5,16)&&!node.closest('svg'))return beside(node,x,y,root);
 }
 return null;
}
/** The page's frame: headers, navigation and pinned bars. It is sized for small controls, not for panels. */
function pageFrame(el:HTMLElement,root:HTMLElement){
 for(let node:HTMLElement|null=el;node&&node!==root;node=node.parentElement){
  if(node.matches('header,nav,aside,[role=banner],[role=navigation],[role=complementary]')||['sticky','fixed'].includes(getComputedStyle(node).position))return node;
 }
 return null;
}
export function findDrop(dragged:HTMLElement,x:number,y:number,root:HTMLElement):Drop|null{
 const item=layoutItem(dragged,root),spot=locate(item,x,y,root);
 if(!spot||unchanged(item,spot))return null;
 const size=item.getBoundingClientRect(),frame=pageFrame(spot.anchor,root);
 if(size.width>=200&&size.height>=120&&frame&&!frame.contains(item))return null;
 return {...spot,item};
}
/** Elements taken out of the page's flow have no slot to move to. */
export const floats=(el:HTMLElement)=>['absolute','fixed'].includes(getComputedStyle(el).position);
