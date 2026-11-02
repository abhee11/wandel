import {action,response,type PageContext} from './schema';
/** Resolve an explicit grid against existing sibling groups, independent of incidental selection. */
export function gridIntent(instruction:string,c:PageContext){
 const dimensions=instruction.match(/\b([1-6])\s*[x×]\s*([1-6])\b/i),columns=instruction.match(/\b([1-6])\s*(?:columns?|cols?)\b/i);
 if(!/\bgrid\b/i.test(instruction)||!dimensions&&!columns)return null;
 const countWord=instruction.match(/\b(two|three|four|five|six|[2-8])\s+(?:feature\s+)?cards?\b/i)?.[1]?.toLowerCase();
 const members=countWord?({two:2,three:3,four:4,five:5,six:6} as Record<string,number>)[countWord]||Number(countWord):null;
 const groups=(c.groups||[]).filter(group=>!members||group.members.length===members);if(!groups.length)return null;
 // Nested groups are distinct possibilities; never guess between separate sections.
 const top=groups.filter(group=>!groups.some(other=>other!==group&&other.members.includes(group.ref)));
 if(top.length!==1)return null;
 const count=columns?Number(columns[1]):Number(dimensions![2]);
 return {...response('edit',`Arranged the existing content in a ${count}-column grid.`,[action('layout',[top[0].ref],{layout:'grid',columns:count})]),scope:'page' as const};
}

/** Common group rearrangements are grounded locally; more complex layout reasoning stays with the planner. */
export function directionIntent(instruction:string,c:PageContext){
 if(!/\b(?:arrange|stack|organize|organise|rearrange)\b/i.test(instruction)||/\b(?:center|centre)\s+vertically\b/i.test(instruction))return null;
 const direction=instruction.match(/\b(vertical(?:ly)?|vertic+l?aly|horizontal(?:ly)?|horizonal(?:ly)?)\b/i)?.[1]?.toLowerCase();if(!direction)return null;
 if(!/\b(?:cards?|them|these|those|items)\b/i.test(instruction))return null;
 const count=instruction.match(/\b(two|three|four|2|3|4)\s+(?:of the\s+)?(?:cards|items)\b/i)?.[1];const n=count?({two:2,three:3,four:4}[count]||Number(count)):undefined;
 const groups=(c.groups||[]).filter(g=>!n||g.members.length===n);if(groups.length!==1)return groups.length>1?response('clarify','Which group should I rearrange?',[],groups.map(g=>g.ref)):null;
 const vertical=direction.startsWith('vert'),gap=instruction.match(/\b(\d{1,3})\s*(?:px|pixels?)\s+(?:gap|spacing)\b/i)?.[1];
 return {...response('edit',vertical?'Stacked the cards vertically.':'Arranged the cards horizontally.',[action('layout',[groups[0].ref],{layout:vertical?'vertical':'horizontal',...(/\bcent(?:er|re)\b.*\bhorizontally\b/i.test(instruction)&&vertical||/\bhorizontally\s+cent(?:er|re)\b/i.test(instruction)&&vertical?{style:{alignItems:'center' as const}}:{}),...(gap&&Number(gap)<=160?{style:{...(/cent(?:er|re)/i.test(instruction)&&vertical?{alignItems:'center' as const}:{}),gap:Number(gap)}}:{})})]),scope:'page' as const};
}
