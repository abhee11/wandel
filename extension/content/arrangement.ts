import {visible} from './nativeDesign';
import {verifyContent,type ContentBaseline} from '../assistant/visualVerification';
export type Arrangement={direction:'horizontal'|'vertical'|'grid';columns:number;gap:number};
export type ArrangementStyle={node:HTMLElement;key:string;before:string;priority:string;after:string};
const landmark='nav,header,footer,aside,[role=navigation],[role=banner],[role=contentinfo],[role=complementary]';
const placement=(node:HTMLElement)=>node.dataset.dxOwned?.startsWith('wrap:');
/** Below-placement wrappers are transparent to subsequent arrangements. Keep
 * them in the DOM so saved locators and Undo still refer to the same nodes. */
export function arrangementItems(target:HTMLElement):HTMLElement[]{
 return [...target.children].flatMap(node=>node instanceof HTMLElement&&placement(node)?arrangementItems(node):node instanceof HTMLElement&&visible(node)&&!node.matches(landmark)&&node.dataset.dxIgnore!=='true'?[node]:[]).sort((a,b)=>(Number(getComputedStyle(a).order)||0)-(Number(getComputedStyle(b).order)||0));
}
export function applyArrangement(target:HTMLElement,arrangement:Arrangement){
 const styles:ArrangementStyle[]=[];
 const set=(node:HTMLElement,values:Record<string,string>)=>{for(const [key,value] of Object.entries(values)){const before=node.style.getPropertyValue(key),priority=node.style.getPropertyPriority(key);node.style.setProperty(key,value,'important');styles.push({node,key,before,priority,after:node.style.getPropertyValue(key)});}};
 const items=arrangementItems(target),{direction,columns,gap}=arrangement;
 // Read proportions before writing anything: static copies have computed pixel
 // widths, including internal surfaces that must follow their resized card.
 const fluid=new Set<HTMLElement>();
 for(const item of items)for(const node of item.querySelectorAll<HTMLElement>('div,section,article,form,ul,ol')){
  const parent=node.parentElement;if(!parent||!visible(node))continue;
  const css=getComputedStyle(parent),available=parent.clientWidth-(parseFloat(css.paddingLeft)||0)-(parseFloat(css.paddingRight)||0);
  if(available>0&&node.getBoundingClientRect().width>=available*.85)fluid.add(node);
 }
 const wrappers=(node:HTMLElement)=>{for(const child of [...node.children])if(child instanceof HTMLElement&&placement(child)){set(child,{display:'contents',padding:'0',margin:'0',width:'auto','inline-size':'auto','flex-basis':'auto','grid-column':'auto',translate:'none',transform:'none'});wrappers(child);}};
 wrappers(target);
 set(target,{display:direction==='grid'?'grid':'flex','flex-direction':direction==='horizontal'?'row':'column','flex-wrap':'nowrap','justify-content':'flex-start','align-content':'start','align-items':'stretch',gap:gap+'px','row-gap':gap+'px','column-gap':gap+'px','box-sizing':'border-box','min-width':'0','min-inline-size':'0',width:'100%','inline-size':'100%','max-width':'100%','max-inline-size':'100%',height:'auto','block-size':'auto'});
 if(direction==='grid')set(target,{'grid-template-columns':`repeat(${columns}, minmax(0, 1fr))`});
 const reset={position:'relative',inset:'auto',translate:'none',transform:'none',margin:'0','box-sizing':'border-box','min-width':'0','min-inline-size':'0','max-width':'100%','max-inline-size':'100%','grid-column':'auto','align-self':'stretch','justify-self':'stretch','flex-shrink':'1'};
 for(const item of items){
  set(item,{...reset,width:direction==='horizontal'?'0':'100%','inline-size':direction==='horizontal'?'0':'100%','flex-basis':direction==='horizontal'?'0':'auto','flex-grow':direction==='horizontal'?'1':'0'});
  for(const node of item.querySelectorAll<HTMLElement>('div,section,article,p,h1,h2,h3,h4,form,input,textarea,select')){
   set(node,{'max-width':'100%','max-inline-size':'100%','min-width':'0','min-inline-size':'0','box-sizing':'border-box'});
   if(fluid.has(node))set(node,{width:'100%','inline-size':'100%'});
  }
 }
 if(direction==='grid')for(const child of [...target.children])if(child instanceof HTMLElement&&child.matches(landmark))set(child,{'grid-column':'1 / -1'});
 return styles;
}
export function verifyArrangement(target:HTMLElement,{direction,columns,gap}:Arrangement,baseline?:ContentBaseline){
 const items=arrangementItems(target);if(items.length<2)throw new Error('The arrangement needs at least two visible items.');
 const boxes=items.map(item=>item.getBoundingClientRect()),count=direction==='grid'?columns:direction==='horizontal'?items.length:1;
 for(const item of items)verifyContent(item,baseline);
 for(let i=0;i<boxes.length;i++){
  const box=boxes[i];if(box.width<=0||box.height<=0)throw new Error('An arranged item is no longer visible.');
  if(Math.abs(box.width-boxes[0].width)>2)throw new Error('The arranged cards do not have equal widths.');
  if(i%count){const previous=boxes[i-1];if(Math.abs(box.top-previous.top)>2||Math.abs(box.left-previous.right-gap)>2)throw new Error('The cards do not have the requested columns and gap.');}
  else if(i&&box.top<boxes[i-count].bottom+gap-2)throw new Error('The arranged rows overlap or have insufficient spacing.');
 }
}
