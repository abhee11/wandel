import {verifyContent,contentBaseline,ContentIssues} from './visualVerification';
import {describe,structuralIdentity} from '../content/locator';
import {sensitive} from './privacy';
import {visible} from '../content/nativeDesign';
import {uid,type Operation,type StylePatch,type Locator} from '../shared/model';
type Layout='vertical'|'horizontal'|'header'|'sidebar'|'grid';
/** Deterministic structural changes: the planner chooses intention/scope, not pixel offsets. */
export function layoutOperations(target:HTMLElement,layout:Layout,root:HTMLElement,locator:Locator,owned:(node:HTMLElement)=>string|undefined,columns=2,currentOwned?:(id:string)=>HTMLElement|undefined){
 const operations:Operation[]=[],checks:(()=>void)[]=[];const identities=new Map<HTMLElement,string>();
 // Captured before the edit renders: rearranged elements are held to their own prior rendering.
 const before=new ContentIssues([...contentBaseline(target),...[...target.children].flatMap(child=>child instanceof HTMLElement?[...contentBaseline(child)]:[])]),baseline=(node:HTMLElement)=>before.get(node);
 const live=(node:HTMLElement)=>{const id=identities.get(node),current=id&&currentOwned?currentOwned(id):node;if(!current?.isConnected)throw new Error('A layout item disappeared while applying the preview.');return current;};
 const locate=(node:HTMLElement)=>{const locator=describe(node,owned(node)).locator;if(!locator.owned){const classes=node.getAttribute('class');if(classes&&classes.length<=2048)locator.attrs.class=classes;if(!['id','data-testid','data-test','data-qa','data-block-id'].some(key=>locator.attrs[key as keyof typeof locator.attrs]))locator.structure=structuralIdentity(node);}return locator;};
 const style=(node:HTMLElement,patch:StylePatch)=>{const id=owned(node);if(id)identities.set(node,id);operations.push({id:uid(),kind:'style',target:node===target?locator:locate(node),style:patch});};
 const available=(node:HTMLElement)=>root.contains(node)&&!sensitive(node)&&visible(node);
 const axis=layout==='horizontal'?'row':'column';
 if(layout==='sidebar'){
  const header=target.closest<HTMLElement>('header,[role=banner]')||target;
  if(header===root)throw new Error('Identify the existing header or navigation region.');
  const shell=header.parentElement;
  const rail=shell&&shell!==root&&shell.children.length===1&&available(shell)?shell:header;
  const parent=rail.parentElement;if(!parent||!available(parent))throw new Error('The navigation container is outside the editable page.');
  const width=Math.min(240,Math.max(180,Math.round(window.innerWidth*.2)));
  style(parent,{paddingLeft:width+24,boxSizing:'border-box',minInlineSize:'0'});
  style(rail,{position:'fixed',left:0,right:'auto',top:0,bottom:0,width,blockSize:'100%',display:'flex',flexDirection:'column',flexWrap:'nowrap',alignItems:'stretch',justifyContent:'flex-start',padding:16,marginTop:0,marginBottom:0,marginLeft:0,marginRight:0,borderRadius:0,minInlineSize:'0',boxSizing:'border-box'});
  if(header!==rail)style(header,{position:'static',display:'flex',flexDirection:'column',flexWrap:'nowrap',alignItems:'stretch',justifyContent:'flex-start',inlineSize:'100%',blockSize:'auto',padding:0,marginTop:0,marginBottom:0,borderRadius:0,minInlineSize:'0',boxSizing:'border-box',gap:20});
  const controls='a[href],button,[role=button]';
  const groups=[...header.querySelectorAll<HTMLElement>('nav,div,ul,ol,li,[role=navigation],[role=menu]')].filter(node=>available(node)&&!node.closest(controls)&&!!node.querySelector(controls));
  for(const node of groups)style(node,{position:'static',left:'auto',right:'auto',top:'auto',bottom:'auto',display:'flex',flexDirection:'column',flexWrap:'nowrap',alignItems:'stretch',justifyContent:'flex-start',inlineSize:'100%',blockSize:'auto',minInlineSize:'0',maxInlineSize:'100%',paddingLeft:0,paddingRight:0,marginLeft:0,marginRight:0,marginTop:0,marginBottom:0,gap:12,boxSizing:'border-box'});
  const links=[...header.querySelectorAll<HTMLElement>(controls)].filter(available);for(const node of links)style(node,{maxInlineSize:'100%',minInlineSize:'0',flexShrink:1,boxSizing:'border-box',alignSelf:'flex-start'});
  const content=[...parent.children].filter((node):node is HTMLElement=>node instanceof HTMLElement&&node!==rail&&available(node));
  checks.push(()=>{const a=live(rail).getBoundingClientRect();if(a.width>0&&(a.left>2||Math.abs(a.width-width)>2))throw new Error('The navigation did not move into the left rail.');for(const node of content){const b=live(node).getBoundingClientRect();if(b.width>0&&b.height>0&&b.left<a.right-1)throw new Error('The left navigation overlaps the page content.');}for(const node of links){const b=live(node).getBoundingClientRect();if(b.width>0&&(b.left<a.left-1||b.right>a.right+1))throw new Error('A navigation control exceeds the sidebar width.');}});
 }else if(layout==='grid'){
  if(!Number.isInteger(columns)||columns<1||columns>6)throw new Error('Choose between one and six grid columns.');
  const all=[...target.children].filter((n):n is HTMLElement=>n instanceof HTMLElement&&available(n));
  const landmarks=all.filter(node=>node.matches('nav,header,footer,aside,[role=navigation],[role=banner],[role=contentinfo],[role=complementary]'));
  const children=all.filter(node=>!landmarks.includes(node));
  style(target,{display:'grid',alignContent:'start',gridTemplateColumns:`repeat(${columns}, minmax(0, 1fr))`,gap:24,inlineSize:'100%',minInlineSize:'0',boxSizing:'border-box',alignItems:'stretch'});
  for(const landmark of landmarks)style(landmark,{gridColumn:'1 / -1',inlineSize:'100%',minInlineSize:'0',boxSizing:'border-box'});
  for(const child of children){style(child,{gridColumn:'auto',blockSize:'auto',minHeight:0,inlineSize:'100%',maxInlineSize:'100%',minInlineSize:'0',boxSizing:'border-box',marginLeft:0,marginRight:0,marginTop:0,marginBottom:0,flexShrink:1,alignSelf:'stretch',justifySelf:'stretch',order:0,x:0,y:0,position:'static',left:'auto',right:'auto',top:'auto',bottom:'auto'});
   for(const node of child.querySelectorAll<HTMLElement>('div,section,article,p,form,input,textarea,select'))if(available(node))style(node,{maxInlineSize:'100%',minInlineSize:'0',boxSizing:'border-box'});
  }
  checks.push(()=>{if(getComputedStyle(live(target)).display!=='grid')throw new Error('The grid did not apply.');const current=live(target),a=current.getBoundingClientRect(),rendered=[...current.children].filter((node):node is HTMLElement=>node instanceof HTMLElement&&available(node)&&!node.matches('nav,header,footer,aside,[role=navigation],[role=banner],[role=contentinfo],[role=complementary]')),boxes=rendered.map(node=>node.getBoundingClientRect());if(rendered.length<children.length)throw new Error('A grid item disappeared.');for(const node of rendered)verifyContent(node,baseline);if(a.width>0&&boxes.some(rect=>rect.width>a.width/columns+2||rect.left<a.left-2||rect.right>a.right+2))throw new Error('A grid item still extends outside its column.');if(boxes.length>columns&&boxes[0].height>0&&boxes[columns].top<boxes[0].bottom-1)throw new Error('The grid rows overlap.');});
 }else if(layout!=='header'){
  style(target,{display:'flex',flexDirection:axis,flexWrap:layout==='horizontal'?'wrap':'nowrap',boxSizing:'border-box',minInlineSize:'0'});
  const children=[...target.children].filter((n):n is HTMLElement=>n instanceof HTMLElement&&available(n));for(const child of children){const id=owned(child);if(id)identities.set(child,id);}
  const repeated=children.length>=2&&children.every(node=>node.matches('article,section,div,li')&&!node.matches('[role=navigation],[role=banner],[role=dialog]'));
  if(repeated)style(target,{alignItems:layout==='horizontal'?'flex-start':'stretch'});
  if(repeated)for(const child of children){style(child,{alignSelf:layout==='horizontal'?'flex-start':'auto',minHeight:0,flexBasis:layout==='horizontal'?'0':'auto',flexGrow:layout==='horizontal'?1:0,flexShrink:1,inlineSize:'auto',maxInlineSize:'100%',minInlineSize:'0',boxSizing:'border-box',blockSize:'auto',marginTop:0,marginBottom:0});for(const nested of child.querySelectorAll<HTMLElement>('div,section,article,p,h1,h2,h3,h4,input,textarea,select'))if(available(nested))style(nested,{maxInlineSize:'100%',minInlineSize:'0',boxSizing:'border-box'});}
  // Fixed columns must return to normal flow when rearranging their shared page container.
  if(layout==='horizontal')for(const child of children){if(getComputedStyle(child).getPropertyValue('inline-size')==='100%'||child.style.inlineSize==='100%')style(child,{inlineSize:'auto',minInlineSize:'0',flexShrink:1});}if(layout==='horizontal')for(const child of children)if(child.matches('aside,nav,main,[role=navigation],[role=main],[role=complementary]'))style(child,{inlineSize:'auto',minInlineSize:'0',flexGrow:child.matches('main,[role=main]')?1:0,...(child.matches('aside,[role=complementary]')?{flexDirection:'column'}:{})});
  const fixed=children.filter(node=>['fixed','absolute'].includes(getComputedStyle(node).position)&&node.matches('aside,nav,[role=navigation],[role=complementary]'));
  for(const node of fixed)style(node,{position:'static',top:'auto',right:'auto',bottom:'auto',left:'auto',blockSize:'auto',minHeight:0,...(layout==='vertical'?{inlineSize:'100%',display:'flex',flexDirection:'row',flexWrap:'wrap'}:{})});
  if(fixed.length)for(const node of children.filter(node=>!fixed.includes(node)))style(node,{marginLeft:0,marginRight:0,...(layout==='vertical'?{inlineSize:'100%',boxSizing:'border-box'}:{flexGrow:1})});
  checks.push(()=>{if(getComputedStyle(live(target)).flexDirection!==axis)throw new Error('The requested layout direction did not apply.');
   const bounds=live(target).getBoundingClientRect();const boxes=children.map(node=>live(node).getBoundingClientRect()).filter(rect=>rect.width>0&&rect.height>0);
   if(bounds.width>0&&boxes.some(rect=>rect.width>bounds.width+2))throw new Error('A rearranged item exceeds the layout width.');
   if(layout==='vertical'&&boxes.some((rect,i)=>i>0&&rect.top<boxes[i-1].bottom-1))throw new Error('The vertical layout still overlaps.');
   if(layout==='horizontal'&&boxes.length>1&&boxes.reduce((sum,rect)=>sum+rect.width,0)<bounds.width-2&&boxes.some(rect=>Math.abs(rect.top-boxes[0].top)>2))throw new Error('The horizontal layout did not place the items alongside each other.');
  });
 }else{
  const host=target.closest<HTMLElement>('aside,[role=complementary]');
  const banner=target.closest<HTMLElement>('header,[role=banner]'),region=host&&available(host)?host:banner&&available(banner)?banner:target;
  const enclosing=region.parentElement,enclosingRail=enclosing&&available(enclosing)&&getComputedStyle(enclosing).position==='fixed'&&enclosing.getBoundingClientRect().width<window.innerWidth*.4;
  const navigation=enclosingRail?enclosing:region;
  if(navigation===root)throw new Error('A navigation region inside the page is needed to make a header.');
  const parent=navigation.parentElement;if(!parent||!available(parent))throw new Error('The navigation layout container is outside the editable page.');
  const css=getComputedStyle(navigation),width=parseFloat(css.width)||navigation.getBoundingClientRect().width;
  style(parent,{display:'flex',flexDirection:'column',inlineSize:'100%',boxSizing:'border-box',...(parseFloat(getComputedStyle(parent).paddingLeft)>=width*.7?{paddingLeft:0}:{})});
  style(navigation,{position:'static',top:'auto',right:'auto',bottom:'auto',left:'auto',display:'flex',flexDirection:'row',flexWrap:'wrap',alignItems:'center',inlineSize:'100%',blockSize:'auto',flexGrow:0,flexShrink:0,justifyContent:'space-between',minHeight:0,maxInlineSize:'100%',minInlineSize:'0',boxSizing:'border-box'});
  if(target!==navigation)style(target,{display:'flex',flexDirection:'row',flexWrap:'wrap',inlineSize:'100%',blockSize:'auto'});
  // A navigation rail is a tree of layout groups, not just its outer nav box.
  const controlSelector='a[href],button,[role=button],[tabindex="0"]';
  const controls=[...navigation.querySelectorAll<HTMLElement>(controlSelector)].filter(node=>available(node)&&!node.parentElement?.closest(controlSelector));
  const groups=[...navigation.querySelectorAll<HTMLElement>('header,nav,div,section,ul,ol,li,[role=banner],[role=navigation],[role=menu],[role=group]')].filter(node=>available(node)&&!node.closest(controlSelector)&&!!node.querySelector(controlSelector+',svg'));
  for(const group of groups){const current=getComputedStyle(group);style(group,{display:'flex',flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'flex-start',inlineSize:group.matches('header,[role=banner]')?'100%':'auto',blockSize:'auto',minHeight:0,minInlineSize:'0',maxInlineSize:'100%',flexGrow:0,flexShrink:1,marginTop:0,marginBottom:0,paddingTop:0,paddingBottom:0,...(['fixed','absolute','sticky'].includes(current.position)?{position:'static',left:'auto',right:'auto',top:'auto',bottom:'auto'}:{})});}
  for(const control of controls)style(control,{inlineSize:'auto',flexGrow:0,flexShrink:0,alignSelf:'center',marginTop:0,marginBottom:0});

  const siblings=[...parent.children].filter((n):n is HTMLElement=>n instanceof HTMLElement&&n!==navigation&&available(n));
  if(siblings[0]&&navigation!==parent.firstElementChild)operations.push({id:uid(),kind:'reorder',target:locate(navigation),anchor:locate(siblings[0]),position:'before'});
  const content=[...new Set([...siblings,...parent.querySelectorAll<HTMLElement>('main,[role=main]')])].filter(node=>node!==navigation&&!navigation.contains(node)&&available(node));
  for(const node of content){
   const current=getComputedStyle(node),patch:StylePatch={marginLeft:0,marginRight:0,inlineSize:'100%',minInlineSize:'0',boxSizing:'border-box',...(['absolute','fixed'].includes(getComputedStyle(node).position)?{position:'static',left:'auto',right:'auto',top:'auto',bottom:'auto'}:{})};
   if(width>0&&parseFloat(current.paddingLeft)>=width*.7)patch.paddingLeft=0;
   style(node,patch);
  }
  checks.push(()=>{
   const result=getComputedStyle(live(navigation));if(result.position==='fixed'||result.flexDirection!=='row')throw new Error('The navigation did not become a horizontal header.');
   for(const node of content)if(parseFloat(getComputedStyle(live(node)).marginLeft)>1)throw new Error('The old sidebar spacing remains.');
   const a=live(navigation).getBoundingClientRect();
   const boxes=controls.map(node=>live(node).getBoundingClientRect()).filter(rect=>rect.width>0&&rect.height>0);
   if(a.width>0&&boxes.length){const maxHeight=Math.max(...boxes.map(rect=>rect.height)),rows=Math.max(1,Math.ceil(boxes.reduce((sum,rect)=>sum+rect.width+16,0)/a.width));if(a.height>rows*(maxHeight+48)+48)throw new Error('The navigation still contains a vertical rail.');if(boxes.reduce((sum,rect)=>sum+rect.width+8,0)<a.width&&boxes.some(rect=>Math.abs((rect.top+rect.height/2)-(boxes[0].top+boxes[0].height/2))>Math.max(8,maxHeight*.15)))throw new Error('The navigation controls are not arranged horizontally.');}
   for(const node of content){const b=live(node).getBoundingClientRect();if(a.width>0&&a.height>0&&b.width>0&&b.height>0&&b.top<a.bottom-1)throw new Error('The new header overlaps the page content.');}
  });
 }
 checks.push(()=>{verifyContent(live(target),baseline);const current=live(target),rect=current.getBoundingClientRect(),parent=current.parentElement?.getBoundingClientRect();if(parent&&rect.width>0&&parent.width>0&&rect.width>parent.width+2)throw new Error('The layout exceeds its available width.');});
 return {operations,verify:()=>checks.forEach(check=>check())};
}
