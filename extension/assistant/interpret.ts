import {referencedRegions} from './scene';
import {gridIntent,directionIntent} from './layoutIntent';
import {designDiscussion} from './discussion';
import {cardCopyIntent} from './cardIntent';
import {action,response,type AssistantAction,type AssistantPlan,type PageContext} from './schema';
export function greetingReply(instruction:string){return /^(?:hi|hello|hey|thanks|thank you)[!. ]*$/i.test(instruction.trim())?'Hi! We can talk through the layout, compare ideas, or edit the page. What would you like to improve?':null;}
/** History/save commands do not depend on a DOM selection or scoped capture. */
export function interpretControl(instruction:string):AssistantPlan|null{
 const p=instruction.trim();
 if(/^(?:actually[, ]*)?undo(?: that| the| last| change| one| please)*[.!]?$/i.test(p)||/^undo that last change[.!]?$/i.test(p))return response('undo','Undid the last edit.');
 if(/^redo\b/i.test(p))return response('redo','Redid the last edit.');
 if(/^save\b/i.test(p))return response('save','Name and save your flow in the save dialog.');
 return null;
}
/** Small evidence-based shortcuts; other phrasing goes through the same validated model contract. */
export function interpret(instruction:string,c:PageContext):AssistantPlan|null{
 const p=instruction.trim(),lower=p.toLowerCase();
 const control=interpretControl(p);if(control)return control;
 const greeting=greetingReply(p);if(greeting)return response('answer',greeting);
 if(designDiscussion(p))return null;
 if(/\b(?:move|convert|turn|make)\b/i.test(p)&&/\bheader\b.*\b(?:as|into|to)\b.*\b(?:left panel|left sidebar|sidebar|side bar)\b/i.test(p)){
  const regions=referencedRegions(p,c);if(regions.length===1)return {...response('edit','Converted the header into a left sidebar.',[action('layout',[regions[0].ref],{layout:'sidebar'})]),scope:'page' as const};
 }

 if(/\b(?:move|convert|turn|make|restore)\b/i.test(p)&&/\b(?:left navigation|left panel|sidebar|side bar|navigation)\b.*\b(?:to|into|as)\b.*\bheader\b/i.test(p)){
  const regions=referencedRegions(p,c),byRef=new Map(c.elements.map(e=>[e.ref,e]));
  const sources=regions.filter(region=>!regions.some(other=>other!==region&&byRef.get(region.ref)?.parent===other.ref));
  const banners=regions.filter(region=>region.kind==='header');const source=banners.length===1?banners[0]:sources.length===1?sources[0]:null;
  if(source)return {...response('edit','Restored the navigation as a top header.',[action('layout',[source.ref],{layout:'header'})]),scope:'page' as const};
 }
 const grid=gridIntent(p,c)||directionIntent(p,c);if(grid)return grid;
 if(/\b(?:arrange|rearrange|stack|organize|organise)\b/i.test(p)&&/\b(?:vertical|vertically|horizontal|horizontally|grid)\b/i.test(p))return null;
 if(/\b(?:submit|purchase|buy|send an? email|delete account|backend|run javascript|execute code)\b/i.test(p))return response('unsupported','I can build a local prototype interaction, but cannot submit forms or change the production backend.');
 // Only deictic shortcuts may bind to the selection. Named/spatial descriptions need page interpretation.
 const deictic=/\b(?:this|that|it|them|these|both|selected|selection)\b/i.test(p);
 const described=/\b(?:left|right|top|bottom)\s+(?:panel|sidebar|navigation|menu|header|bar|column)\b|\b(?:sidebar|header|footer|navigation|theme|layout)\b/i.test(p);
 if(described)return null;
 const target=c.selected||c.lastCard||c.hover;
 const cardQuestion=/\b(?:do you|can you|what|which|where)\b.*\b(?:see|find|cards?)\b/i.test(p)&&/\bcards?\b/i.test(p)&&!/\b(?:add|create|duplicate|copy|remove|delete|change|make)\b/i.test(p);
 if(cardQuestion&&!c.elements.some(e=>e.attributes['wandel-card']==='true'))return null;
 if(cardQuestion){const cards=c.elements.filter(e=>e.attributes['wandel-card']==='true');const remembered=cards.find(e=>e.ref===c.lastCard);const identified=remembered||cards.length===1&&cards[0];if(identified)return response('answer',`Yes—“${identified.attributes['wandel-heading']||identified.name}”.`,[],[identified.ref]);return response('clarify',`I see ${cards.length} cards. Which one do you mean?`,[],cards.slice(0,8).map(e=>e.ref));}

 // Resolve short follow-ups against the actual remembered component and its
 // captured parts. A model must never receive dangling part references.
 const iconName=p.match(/\b(speedometer|gauge|flask|check|chart|shield|mail|user)\s+icon\b/i)?.[1]?.toLowerCase();
 if(iconName&&/\b(?:give|change|set|use|add|replace)\b/i.test(p)){
  const cards=c.elements.filter(e=>e.attributes['wandel-card']==='true'),named=cards.filter(e=>p.toLowerCase().includes((e.attributes['wandel-heading']||e.name).toLowerCase()));
  const card=named.length===1?named[0]:!named.length&&/\b(?:its|this|that|selected)\b/i.test(p)?cards.find(e=>e.ref===c.lastCard||e.ref===c.selected):null;
  if(card?.owned)return response('edit','Updated the card icon.',[action('icon',[card.ref],{text:iconName==='speedometer'?'gauge':iconName})]);
 }
 const descriptionChange=p.match(/\b(?:change|set|update)\s+(?:its|the\s+(?:new\s+)?card(?:'s)?)\s+(?:details?|description|sub\s*text|body)\s+(?:to\s+)?["“]([^"”]+)["”]/i);
 if(descriptionChange){const card=c.elements.find(e=>e.ref===c.lastCard)||c.elements.find(e=>e.ref===c.selected&&e.attributes['wandel-card']==='true');const part=card?.attributes['wandel-description-ref'];if(part&&c.elements.some(e=>e.ref===part))return response('edit','Updated the card description.',[action('text',[part],{text:descriptionChange[1]})]);}
 const copy=cardCopyIntent(p);
 if(copy){
  if(copy.incomplete||!copy.title&&/\b(?:for|details|mention)\b/i.test(p)||/\b(?:connect|navigate|align|center|centre|arrange|reorder|theme|move|spacing|dark|light)\b/i.test(p))return null;
  const cards=c.elements.filter(e=>e.attributes['wandel-card']==='true'),normalize=(value:string)=>value.toLowerCase().replace(/\+/g,' plus ').replace(/[^a-z0-9]/g,'');
  const selection=c.elements.find(e=>e.ref===c.selected);let selected=selection;
  // Deictic requests refer to the explicit selection, regardless of whether
  // the application implements a card using semantic elements or styled divs.
  const sourcePhrase=p.split(/\b(?:with|and|heading|title|description)\b/i)[0];
  const named=cards.filter(card=>{const heading=card.attributes['wandel-heading'];return heading&&normalize(heading).length>2&&normalize(sourcePhrase).includes(normalize(heading));});
  const explicit=/\b(?:selected|selection|this|that)\b/i.test(p)||!named.length&&/\bit\b/i.test(p);
  const memory=c.elements.find(e=>e.ref===c.lastCard);let ancestor=memory?.parent;const seenParents=new Set<string>();while(ancestor&&ancestor!==c.selected&&!seenParents.has(ancestor)){seenParents.add(ancestor);ancestor=c.elements.find(e=>e.ref===ancestor)?.parent;}
  const remembered=memory&&!/\b(?:selected|selection)\b/i.test(p)&&(!selection||/\bcard\b/i.test(p)||ancestor===c.selected);
  let source=named.length===1&&!/\b(?:selected|selection)\b/i.test(sourcePhrase)?named[0]:remembered?memory:explicit&&selected?selected:cards.find(e=>e.ref===selected?.ref);
  const seen=new Set<string>();while(!source&&selected?.parent&&!seen.has(selected.parent)){seen.add(selected.parent);selected=c.elements.find(e=>e.ref===selected?.parent);source=cards.find(e=>e.ref===selected?.ref);}
  if(!source&&named.length===1)source=named[0];
  if(!source&&!named.length&&c.lastCard)source=c.elements.find(e=>e.ref===c.lastCard);
  if(!source&&!named.length&&cards.length===1)source=cards[0];
  if(!source&&!cards.length&&selection)source=selection;
  if(!source)return null;
  return response('edit',copy.title?'Added a matching '+copy.title+' card'+(copy.button?' with a '+copy.button+' button.':'.'):'Duplicated the highlighted card.',[action('duplicate',[source.ref],{text:copy.title,description:copy.description,labels:copy.button?[copy.button]:[]})]);
 }

 const find=(name:string)=>{const matches=c.elements.filter(e=>e.name.replace(/\s*[✓✔]$/,'').toLowerCase()===name.trim().replace(/[.!]$/,'').toLowerCase());const semantic=matches.filter(e=>e.interactive||e.role==='heading'||/^h[1-6]$/.test(e.tag));return semantic.length?semantic:matches;};
 const quoted=p.match(/["“]([^"”]+)["”]/)?.[1];if(quoted){const matches=find(quoted);if(matches.length>1)return response('clarify','Which '+quoted+' section do you mean?',[],matches.slice(0,8).map(e=>e.ref));}
 const choose=(refs:string[],message='Which highlighted element should I use?')=>response('clarify',message,[],refs);
 const selected=(targets:string[],a:Partial<AssistantAction>)=>response('edit','Updated the prototype.',[action(a.kind||'style',targets,a)]);
 const ordinal=lower.match(/\b(first|second|third|last)\s+(?:one|button|option)?\b/),index=ordinal?({first:0,second:1,third:2,last:c.recent.length-1}[ordinal[1]]??-1):-1;
 const pair=c.copySource&&(c.selected||c.lastCard)?[c.copySource,(c.selected||c.lastCard)!]:c.recent;
 let targets=/\b(both|them|these|all of them)\b/i.test(p)?pair:index>=0?(c.recent[index]?[c.recent[index]]:[]):target?[target]:c.recent.slice(-1);
 if(/\bboth\b/i.test(p)&&pair.length!==2)return choose(pair,'Which two elements do you mean?');
 const rename=p.match(/^(?:rename|call)\s+(?:it|this|that|the selected(?: card| element)?)\s+(?:to\s+)?["“]?(.+?)["”]?[.!]?$/i)||p.match(/\b(?:change|rename|set)\b.*?\b(?:text|label|heading|title|name)\s+(?:to\s+)?["“]?(.+?)["”]?[.!]?$/i);
 if(rename&&!deictic&&!/\b(?:detail|new) view\b/i.test(p))return null;
 if(rename){
  const selectedElement=c.elements.find(e=>e.ref===target);
  if(selectedElement?.attributes['wandel-card']==='true'){
   const inside=(ref:string)=>{const seen=new Set<string>();let element=c.elements.find(e=>e.ref===ref);while(element?.parent&&!seen.has(element.parent)){if(element.parent===selectedElement.ref)return true;seen.add(element.parent);element=c.elements.find(e=>e.ref===element!.parent);}return false;};
   const exact=c.elements.find(e=>e.ref===selectedElement.attributes['wandel-heading-ref']);const headings=exact?[exact]:c.elements.filter(e=>e.name===selectedElement.attributes['wandel-heading']&&inside(e.ref));
   if(headings.length!==1)return choose(headings.map(e=>e.ref),'Select the card heading you want to rename.');
   targets=[headings[0].ref];
  }
  if(/\b(?:detail|new|that) view\b/i.test(p)&&c.lastView){const heading=c.elements.find(e=>e.tag==='h2'&&e.owned&&e.name===c.views.find(v=>v.id===c.lastView)?.title);if(heading)targets=[heading.ref];}
  return targets.length?selected(targets,{kind:'text',text:rename[1].trim()}):choose([],'Select the text or open the view heading you want to rename.');
 }
 const defaultMatch=p.match(/\bmake\s+(.+?)\s+selected\s+(?:by\s+)?default/i);
 if(defaultMatch)return c.lastGroup?selected([c.lastGroup],{kind:'default',text:defaultMatch[1]}):choose([],'Select a prototype option group first.');
 const connect=p.match(/\bwhen\s+(?:someone|the user|a user|I)\s+(?:selects?|clicks?)\s+(?:the\s+)?(.+?),?\s+(?:show|open|navigate to)\s+(?:a\s+|the\s+)?([^.!?\n]+)[.!]?/i);
 if(connect){const source=find(connect[1].replace(/,$/,''));if(source.length!==1)return choose(source.map(e=>e.ref),'Select the control that should open the view.');const destination=c.views.filter(v=>v.title.toLowerCase()===connect[2].toLowerCase());if(destination.length>1)return choose([],'Choose a destination from the flow list.');if(!destination.length&&!/\bcreate (?:a )?blank\b/i.test(p))return choose([],'No matching view exists yet. Say “Create a blank '+connect[2]+'” to add one, or choose an existing view.');return selected([source[0].ref],{kind:'connect',...(destination.length?{destination:destination[0].id}:{newViewTitle:connect[2]})});}
 const give=p.match(/\b(?:give me|options?\s*(?:are|:)|labels?\s*(?:are|:)|include)\s+(.+?)[.!]?$/i);
 if(give&&!c.lastGroup&&/\bbuttons?\b/i.test(p)&&target){const labels=give[1].split(/\s*,\s*|\s+and\s+/i).map(x=>x.replace(/^and\s+/i,'').trim()).filter(Boolean);if(labels.length<2||labels.length>8)return choose([],'What are the button labels?');const references=c.elements.filter(e=>e.interactive&&e.tag==='button'&&!/^(save|cancel|close|delete)$/i.test(e.name));const styles=new Set(references.map(e=>JSON.stringify(e.style)));if(!c.styleReference&&styles.size>1)return choose(references.slice(0,8).map(e=>e.ref),'Which existing button style should I match?');return response('edit','Added matching buttons.',labels.map(text=>action('create',[target],{element:'button',text,position:'after',styleRef:c.styleReference||references[0]?.ref||null})));}
 if(give&&c.lastGroup){const labels=give[1].split(/\s*,\s*|\s+and\s+/i).map(x=>x.replace(/^and\s+/i,'').trim()).filter(Boolean);if(labels.length<2||labels.length>8)return choose([],'What are the labels for the options?');const reference=/\bmatch (?:this|that) style/i.test(p)?target:c.styleReference;return selected([c.lastGroup],{kind:'choices',labels,styleRef:reference});}
 const group=p.match(/\badd\s+(?:an?\s+|another\s+)?["“]?(.+?)["”]?\s+(?:option|section|category)\s+(?:below|under|underneath|inside|here|next to)\s*(?:this|that)?[.!]?$/i);
 if(group){if(!target)return choose([],'Select the heading or section where this belongs.');return selected([target],{kind:'create',element:'panel',text:group[1],position:/inside|here/i.test(p)?'inside':'after'});}
 if(/\badd\b.*\b(?:two|three|four|[2-8])\s+(?:buttons?|options?)/i.test(p)&&!give)return choose([],'What labels should the new buttons or options have?');
 const add=p.match(/\badd\s+(?:an?\s+|another\s+)?(?:button|text|field|panel|card)\s+(?:called|named|with (?:the )?(?:label|text))\s+["“]?(.+?)["”]?(?:\s+(below|inside|before|after|beside)\s+(?:this|that|here))?[.!]?$/i);
 if(add&&target)return selected([target],{kind:'create',element:/\bbutton\b/i.test(p)?'button':/\bfield\b/i.test(p)?'field':/\b(?:panel|card)\b/i.test(p)?'panel':'text',text:add[1],position:add[2]==='inside'?'inside':add[2]==='before'?'before':'after',styleRef:c.styleReference});
 if(/\bmatch\b.*\bstyle\b/i.test(p)&&!give){const ref=target||c.styleReference,recents=c.recent.filter(id=>id!==ref);return ref&&recents.length?selected(recents,{kind:'style',styleRef:ref}):choose([],'Select an existing style reference, then choose the prototype element to restyle.');}
 const colors:Record<string,string>={green:'#16834b',red:'#cc3344',blue:'#2563eb',purple:'#8644ff',black:'#111111',white:'#ffffff'};
 const color=p.match(/\b(green|red|blue|purple|black|white|#[0-9a-f]{6})\b/i)?.[1]?.toLowerCase();
 if(deictic&&color&&/\b(make|change|set)\b/i.test(p)&&targets.length)return selected(targets,{kind:'style',style:{backgroundColor:colors[color]||color}});
 if(deictic&&/\b(?:smaller|larger|bigger)\b/i.test(p)&&targets.length){return response('edit','Adjusted the size.',targets.map(ref=>{const e=c.elements.find(e=>e.ref===ref);const size=parseFloat(e?.style['font-size']||'14')||14;return action('style',[ref],{style:{fontSize:Math.max(6,Math.min(200,Math.round(size*(/smaller/i.test(p)?0.85:1.15))))}});}));}
 if(deictic&&/\bmove\b/i.test(p)&&/\b(left|right|up|down)\b/i.test(p)&&targets.length){const offset=Number(p.match(/\b(\d+)\s*(?:px|pixels?)?\b/)?.[1]||12);return selected(targets,{kind:'move',style:{x:/left/i.test(p)?-offset:/right/i.test(p)?offset:0,y:/up/i.test(p)?-offset:/down/i.test(p)?offset:0}});}
 if(/^(remove|delete)\s+(this|that|them|both|the (?:first|second|third) one)[.!]?$/i.test(p)&&targets.length)return selected(targets,{kind:'remove'});
 // Unselected descriptions go to contextual AI resolution; absence of a click is not ambiguity.

 return null;
}
