import {captureCopy} from './duplicate';
import {copiedHeading} from '../assistant/card';
import type {CopyNode} from '../shared/model';
/** Replace only the copied heading's text, preserving nested markup and all other labels. */
export function copyWithHeading(source:HTMLElement,heading:string){
 if(source.closest('[data-private],[data-sensitive]')||source.matches('input,textarea,select')||source.querySelector('[data-private],[data-sensitive]'))throw new Error('Select a non-private card or text label to copy.');
 const identities=new Map<Node,number>(),copy=captureCopy(source,identities);
 renameCopyHeading(source,heading,copy,identities);
 // Copied controls do not acquire live navigation or actions.
 for(const item of copy)delete item.href;
 return copy;
}
/** Apply the same heading rule to an existing capture without changing its root. */
export function renameCopyHeading(source:HTMLElement,heading:string,copy:CopyNode[],identities:Map<Node,number>){
 const controls='button,a,[role=button],[role=link]';
 const visible=(el:Element)=>!el.closest('[hidden],[aria-hidden=true],svg,input,textarea,select,[data-dx-ignore]')&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden';
 const headings=[...(source.matches('h1,h2,h3,h4,h5,h6,[role=heading]')?[source]:source.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6,[role=heading]'))].filter(visible);
 if(headings.length>1)throw new Error('This selection contains multiple headings. Select one card to copy.');
 let target:HTMLElement|Text|null=headings[0]||copiedHeading(source);
 if(!target){const walk=document.createTreeWalker(source,NodeFilter.SHOW_TEXT);let node:Node|null;while((node=walk.nextNode())){const parent=node.parentElement;if(node.textContent?.trim()&&parent&&visible(parent)&&(!parent.closest(controls)||source.matches(controls))&&identities.has(node)){target=node as Text;break;}}}
 if(!target)throw new Error('No clear heading was found. Select the card heading or a smaller section.');
 const texts:Text[]=[];
 if(target instanceof Text)texts.push(target);else{const walk=document.createTreeWalker(target,NodeFilter.SHOW_TEXT);let node:Node|null;while((node=walk.nextNode()))if(node.textContent?.trim()&&identities.has(node))texts.push(node as Text);}
 if(!texts.length)throw new Error('The selected heading has no editable text.');
 const headingBox=target instanceof Text?target.parentElement:target,index=headingBox&&identities.get(headingBox);
 // An unchanged heading keeps its captured runs, tag and sizing exactly.
 const normalize=(text:string)=>text.replace(/\s+/g,' ').trim();
 if(normalize(texts.map(text=>text.data).join(''))===normalize(heading))return index??0;
 if(headingBox!==source&&index!==null&&index!==undefined)copy[index].style={...copy[index].style,width:'auto','min-width':'0px','max-width':'100%'};
 // Give an adapted non-semantic card label a durable heading identity for
 // subsequent conversation, while keeping its captured visual styling.
 if(index!==null&&index!==undefined&&index>0&&headingBox&&!headingBox.matches(controls+',h1,h2,h3,h4,h5,h6,[role=heading]')&&!headingBox.querySelector(controls))copy[index].tag='h3';
 texts.forEach((text,i)=>{copy[identities.get(text)!].text=i===0?heading:'';});
 return index??0;
}
