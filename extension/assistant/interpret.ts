import {action,response,type AssistantAction,type AssistantPlan,type PageContext} from './schema';
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
 if(/\b(?:submit|purchase|buy|send an? email|delete account|backend|run javascript|execute code)\b/i.test(p))return response('unsupported','I can build a local prototype interaction, but cannot submit forms or change the production backend.');
 const target=c.selected||c.hover;
 const find=(name:string)=>{const matches=c.elements.filter(e=>e.name.replace(/\s*[✓✔]$/,'').toLowerCase()===name.trim().replace(/[.!]$/,'').toLowerCase());const semantic=matches.filter(e=>e.interactive||e.role==='heading'||/^h[1-6]$/.test(e.tag));return semantic.length?semantic:matches;};
 const choose=(refs:string[],message='Which highlighted element should I use?')=>response('clarify',message,[],refs);
 const selected=(targets:string[],a:Partial<AssistantAction>)=>response('edit','Updated the prototype.',[action(a.kind||'style',targets,a)]);
 const ordinal=lower.match(/\b(first|second|third|last)\s+(?:one|button|option)?\b/),index=ordinal?({first:0,second:1,third:2,last:c.recent.length-1}[ordinal[1]]??-1):-1;
 let targets=/\b(both|them|these|all of them)\b/i.test(p)?c.recent:index>=0?(c.recent[index]?[c.recent[index]]:[]):target?[target]:c.recent.slice(-1);
 if(/\bboth\b/i.test(p)&&c.recent.length!==2)return choose(c.recent,'Which two elements do you mean?');
 const rename=p.match(/\b(?:change|rename|set)\b.*?\b(?:text|label|heading|title|name)\s+(?:to\s+)?["“]?(.+?)["”]?[.!]?$/i);
 if(rename){
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
 if(color&&/\b(make|change|set)\b/i.test(p)&&targets.length)return selected(targets,{kind:'style',style:{backgroundColor:colors[color]||color}});
 if(/\b(?:smaller|larger|bigger)\b/i.test(p)&&targets.length){return response('edit','Adjusted the size.',targets.map(ref=>{const e=c.elements.find(e=>e.ref===ref);const size=parseFloat(e?.style['font-size']||'14')||14;return action('style',[ref],{style:{fontSize:Math.max(6,Math.min(200,Math.round(size*(/smaller/i.test(p)?0.85:1.15))))}});}));}
 if(/\bmove\b/i.test(p)&&/\b(left|right|up|down)\b/i.test(p)&&targets.length){const offset=Number(p.match(/\b(\d+)\s*(?:px|pixels?)?\b/)?.[1]||12);return selected(targets,{kind:'move',style:{x:/left/i.test(p)?-offset:/right/i.test(p)?offset:0,y:/up/i.test(p)?-offset:/down/i.test(p)?offset:0}});}
 if(/^(remove|delete)\s+(this|that|them|both|the (?:first|second|third) one)[.!]?$/i.test(p)&&targets.length)return selected(targets,{kind:'remove'});
 if(!target&&!targets.length){const named=p.match(/["“]([^"”]+)["”]/)?.[1];if(named){const candidates=find(named);return choose(candidates.map(e=>e.ref),candidates.length?'Choose the highlighted target.':'Select the section you mean.');}return choose([],'Select the element or section you want to change.');}
 return null;
}
