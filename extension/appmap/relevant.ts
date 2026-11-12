/**
 * Picks the part of an app map that matters for one request or one build prompt, as plain text.
 * The text holds no counts or dates, so the same map and request always give the same words:
 * that keeps answers consistent and lets the provider cache them.
 */
import {describeShape,type Shape} from './shape';
import {isStale,type AppMap,type Endpoint} from './catalog';
const STOP=new Set(['the','and','for','with','this','that','from','into','onto','add','make','show','page','screen','button','new','api','app','get','set','all','each','every','please','can','you','our','your','them','then','when']);
/** Lowercase words of three letters or more, with a trailing plural s dropped, so "invoices" matches "invoice". */
export function words(text:string){
 return new Set((text.toLowerCase().match(/[a-z][a-z]{2,}/g)||[]).map(word=>word.length>4&&word.endsWith('ies')?word.slice(0,-3)+'y':word.length>3&&word.endsWith('s')&&!word.endsWith('ss')?word.slice(0,-1):word).filter(word=>!STOP.has(word)));
}
function fieldNames(shape:Shape|undefined,depth=0,out=new Set<string>()){
 if(!shape||depth>2)return out;
 const fields=shape.fields||shape.items?.fields;
 if(fields)for(const [name,child] of Object.entries(fields)){for(const word of words(name.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]/g,' ')))out.add(word);fieldNames(child,depth+1,out);}
 return out;
}
function score(endpoint:Endpoint,asked:Set<string>,route:Set<string>){
 const path=words(endpoint.path.replace(/[/:_-]/g,' ')),fields=fieldNames(endpoint.response||endpoint.request);
 let total=0;
 for(const word of asked){if(path.has(word))total+=3;else if(fields.has(word))total+=1;}
 for(const word of route)if(path.has(word))total+=2;
 return total;
}
export function describeEndpoint(endpoint:Endpoint){
 const lines=[endpoint.method+' '+endpoint.path+(endpoint.query.length?'?'+endpoint.query.join('&'):'')];
 const indent=(text:string)=>text.split('\n').map(line=>'    '+line).join('\n');
 if(endpoint.request)lines.push('  sends:\n'+indent(describeShape(endpoint.request)));
 if(endpoint.response)lines.push('  returns:\n'+indent(describeShape(endpoint.response)));
 if(endpoint.rules.length)lines.push('  rules: '+endpoint.rules.join('; '));
 return lines.join('\n');
}
/** The endpoints most related to the words given, most related first, within `limit` characters. With no match, the most used reads. */
export function relevantEndpoints(map:AppMap|null|undefined,text:string,route='',limit=6000,now=new Date()){
 if(!map)return '';
 const fresh=Object.values(map.endpoints).filter(endpoint=>!isStale(endpoint,now));
 if(!fresh.length)return '';
 const asked=words(text),here=words(route.replace(/[/:_-]/g,' '));
 let picked=fresh.map(endpoint=>({endpoint,score:score(endpoint,asked,here)})).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||(a.endpoint.method+a.endpoint.path).localeCompare(b.endpoint.method+b.endpoint.path)).map(item=>item.endpoint);
 if(!picked.length)picked=fresh.filter(endpoint=>endpoint.method==='GET').sort((a,b)=>b.seen-a.seen||a.path.localeCompare(b.path)).slice(0,5);
 const parts:string[]=[];let size=0;
 for(const endpoint of picked){const text=describeEndpoint(endpoint);if(size+text.length+2>limit)break;parts.push(text);size+=text.length+2;}
 return parts.join('\n\n');
}
