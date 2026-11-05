/** Turns the renderer's issue strings into accurate, actionable groups.
 * Intentionally hidden or deferred content never reaches this list (see content/visibility.ts),
 * so every group here is something the user can act on. */
export type IssueKind='missing'|'hidden'|'shown'|'page'|'other';
export interface IssueGroup{kind:IssueKind;title:string;hint:string;items:string[]}
export function issueKind(issue:string):IssueKind{
 if(/^After it was shown:/.test(issue))return 'shown';
 if(/hidden control/i.test(issue))return 'hidden';
 if(/another application page/i.test(issue))return 'page';
 if(/target missing or ambiguous|is missing|text changed on the host page|no longer on the page/i.test(issue))return 'missing';
 return 'other';
}
const plural=(n:number,one:string,many:string)=>`${n} ${n===1?one:many}`;
function clean(issue:string){return issue.replace(/^After it was shown:\s*/,'').replace(/: target missing or ambiguous$/,' — its element wasn’t found').replace(/;\s*/,' — ');}
export function groupIssues(issues:string[]):IssueGroup[]{
 const by=new Map<IssueKind,string[]>();for(const issue of issues){const kind=issueKind(issue);by.set(kind,[...(by.get(kind)||[]),clean(issue)]);}
 const groups:IssueGroup[]=[];
 const add=(kind:IssueKind,title:(n:number)=>string,hint:string)=>{const items=by.get(kind);if(items?.length)groups.push({kind,title:title(items.length),hint,items});};
 add('missing',n=>plural(n,'edit couldn’t find its element','edits couldn’t find their elements'),'The page no longer has what these edits changed (content reloaded, a menu or dialog is closed, or text changed). Open that part of the page, or select the element and ask again. Undo removes the last change.');
 add('hidden',n=>plural(n,'new element can’t be seen','new elements can’t be seen'),'They were added but nothing on the page shows them. Ask Wandel to place them in a visible section, or to show them on a click.');
 add('shown',n=>plural(n,'problem appeared','problems appeared')+' when content was shown','The content a click revealed doesn’t render correctly. Ask Wandel to fix it, or Undo.');
 add('page',()=>'This step belongs to another page','Open its connected page before editing.');
 add('other',n=>plural(n,'edit couldn’t be applied','edits couldn’t be applied'),'Select the element and ask again, or Undo the last change.');
 return groups;
}
/** One line naming what is wrong, never counting intended or deferred content as missing. */
export function issueHeadline(issues:string[]){const groups=groupIssues(issues);return groups.length===1?groups[0].title:plural(issues.length,'problem','problems')+' with this prototype';}
