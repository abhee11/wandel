import type {ChatTurn} from './conversation';
/** The conversation as Markdown: who said what, which page it was on, and what didn't finish or was flagged. */
export function chatMarkdown(turns:ChatTurn[],meta:{name:string;origin:string;exportedAt?:Date}){
 const when=(meta.exportedAt||new Date()).toISOString().slice(0,16).replace('T',' ');
 const lines=[`# Wandel chat · ${meta.name||'Untitled prototype'}`,'',`App: ${meta.origin}  `,`Exported: ${when} UTC`,''];
 let page='';
 for(const turn of turns){
  if(!turn.text.trim()&&!turn.error)continue;
  if(turn.page&&turn.page!==page){page=turn.page;lines.push(`*Page: ${page}*`,'');}
  const who=turn.role==='user'?'**You**':'**Wandel**';
  const status=turn.status==='failed'?' *(not completed)*':turn.status==='stopped'?' *(stopped)*':'';
  lines.push(`${who}${status}${turn.selection?` · about “${turn.selection}”`:''}`);
  lines.push(turn.text.trim().split('\n').map(line=>'> '+line).join('\n'));
  if(turn.error)lines.push('','Error: '+turn.error);
  if(turn.review)lines.push('','Flagged by the visual check: '+turn.review);
  if(turn.edited)lines.push('','*Changed the page.*');
  lines.push('');
 }
 return lines.join('\n').trim()+'\n';
}
export function chatFileName(name:string,at=new Date()){
 return 'wandel-chat-'+((name||'prototype').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50)||'prototype')+'-'+at.toISOString().slice(0,10)+'.md';
}
