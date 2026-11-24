import {resolveInspections} from './inspection';
import {requiresVisualReview} from './reviewPolicy';
import {applyVerifiedPlan,keptPreview} from './applyVerified';
import {continueRequest,type ChatTurn} from './conversation';
import {samePage,stateURL} from '../shared/liveNavigation';
import {MAX_HOPS,carriedText,holdCarry,dropCarry,navigated} from './carry';
import type {Command,Snapshot,Workflow} from '../shared/model';
import type {PageContext,AssistantPlan} from './schema';
import type {planConversation as PlanConversation,verifyConversation as VerifyConversation} from './client';
type Ref<T>={current:T};
/** Execution and review share the plan's intended visibility: content that only a click or hover shows is meant to be absent from AFTER. */
export function revealNote(plan:AssistantPlan){
 const shown=plan.actions.some(action=>action.kind==='behavior'&&(action.event==='click'||action.event==='hover')&&action.effects?.some(effect=>effect.action==='show'||effect.action==='toggle'));
 return shown?'\nThe plan shows some content only after a click or hover. It is correctly hidden in AFTER; do not report it as missing. Its layout is checked by Wandel when it is shown.':'';
}
/** Everything one request touches outside itself: the page (bridge, context, capture), the AI (planConversation,
 * verifyConversation) and the chat (answer, progress, the refs the panel keeps). The panel passes its own; the
 * conversation replay tests pass a page in jsdom, so both run this exact loop. */
export interface RequestIO{
 bridge:{send(command:Command):Promise<Snapshot>};
 context(inspect?:string[],instruction?:string):Promise<PageContext>;
 capture(context:PageContext):Promise<string|undefined>;
 planConversation:typeof PlanConversation;
 verifyConversation:typeof VerifyConversation;
 talkContext(page:PageContext):PageContext;
 workflow():Workflow;
 setProgress(text:string):void;setMessage(text:string):void;
 answer(text:string,edited?:boolean,review?:string,steps?:number):void;
 remember(plan:AssistantPlan):Promise<void>;
 setClarification(plan:AssistantPlan|null):void;
 applying():void;onSave():void;stillHere():boolean;
 conversation:Ref<ChatTurn[]>;reopen:Ref<{text:string;id:string;hops?:number}|null>;lastPlan:Ref<string>;spokenLine:Ref<string>;
 clarificationRequest:Ref<{text:string;id:string;scope:string}|null>;continuation:Ref<string|null>;pending:Ref<string>;
 watchRequest:Ref<{text:string;id:string}|null>;epoch:Ref<number>;scopeRef:Ref<string>;referenceRef:Ref<string|undefined>;
 /** How many times Wandel has already moved screens for this request; at most MAX_HOPS. */
 hops?:number;
 request:number;controller:AbortController;followUp:{text:string;id:string;scope:string}|null;recordTurn:boolean;value:string;origin:string;userId:string;
}
/** One request, from the first plan to the reply: plan, inspect, open, apply with review and correction, and the answer.
 * Returns whether the request now waits on the user's answer to a question. */
export async function runRequest(io:RequestIO):Promise<{waiting:boolean}>{
 const {bridge,context,capture,planConversation,verifyConversation,talkContext,workflow,setProgress,setMessage,answer,remember,setClarification,applying,onSave,stillHere,
  conversation,reopen,lastPlan,spokenLine,clarificationRequest,continuation,pending,watchRequest,epoch,scopeRef,referenceRef,request,controller,followUp,recordTurn,value,origin,userId}=io;
 let waiting=false;const hops=io.hops||0;
   let c=await context(undefined,value);
   // Selection is optional; the collector recovers or drops expired handles.
   // appliedSteps counts plans applied for this request, so a result the visual review rejects can be undone exactly.
   let verificationNote='',reviewIssue='',appliedSteps=0,lastVerdict='',undone='',flagged=false;
   // Asking the exact same thing twice in a row means "try again": skip the saved answer for this request.
   const askedAgain=(()=>{const prior=[...conversation.current].reverse().find(turn=>turn.role==='user'&&turn.id!==userId);return !!prior&&prior.text.trim().toLowerCase()===value.trim().toLowerCase();})();const combined=followUp&&recordTurn&&followUp.scope===origin?continueRequest(followUp.text,value):value;const image=referenceRef.current;setProgress('Looking at the page…');let pageScreenshot=await capture(c);
   setProgress(c.workspace?.goal?'Continuing our design…':'Thinking…');
   lastPlan.current='';
   let plan=await planConversation(combined,talkContext(c),controller.signal,conversation.current.filter(turn=>turn.id!==userId),image,pageScreenshot,userId,askedAgain,true);spokenLine.current=plan.spoken||'';
   // When the panel can't do the step a plan asks for, the AI hears why and decides what to say or do instead.
   // It is never answered with fixed text the AI didn't write, which is how conversations went in circles.
   const refuse=async(reason:string,current:PageContext)=>{
    setProgress('Finding another way…');
    // What is still possible: other screens of this flow can be reached (inspect view:<id>), and copy/paste carry elements between them.
    const others=current.views.filter(view=>view.id!==current.stateId).map(view=>`view:${view.id} “${view.title}”${view.route?' '+view.route:''}`).join('; ');
    const options=(others&&hops<MAX_HOPS?' Screens you can still go to with inspect: '+others+'. On another screen you can copy an element and then paste it back here.':'')+(current.copiedElement?` Wandel’s clipboard holds “${current.copiedElement.label}”, ready to paste.`:'');
    const next=await planConversation(combined,talkContext(current),controller.signal,[...conversation.current.filter(turn=>turn.id!==userId),{role:'assistant',text:'Wandel could not carry out the last step: '+reason+options+' Do not ask for that same step again in this request. Use what is possible, or reply in plain words: what you can do, and what the user needs to do, naming screens and controls the way they see them.',status:'sent'}],image,pageScreenshot,userId);
    spokenLine.current=next.spoken||'';return next;
   };
   // Wandel moving to another screen for this request: the request is kept and continues there (see carryOn in carry.ts).
   const moveFor=async(name:string)=>{if(hops>=MAX_HOPS)return false;const text=carriedText(combined,name);reopen.current={text,id:userId,hops:hops+1};await holdCarry({text,id:userId,name,hops:hops+1,at:Date.now()});return true;};
   let refused='';
   const inspectPlan=async(input:AssistantPlan,current:PageContext,allowNavigation:boolean)=>resolveInspections(input,current,{
    active:stillHere,
    inspect:async refs=>{
     const screen=refs.map(ref=>ref.startsWith('view:')?current.views.find(view=>view.id===ref.slice(5)):undefined).find(Boolean);
     if(screen&&screen.id!==current.stateId){
      const target=stateURL(workflow(),screen.id),here=stateURL(workflow(),current.stateId);
      // Another screen of the same app (another activity, another tab of the app) is reachable: Wandel goes there and carries on.
      const reachable=(()=>{try{return new URL(target).origin===new URL(here).origin;}catch{return false;}})();
      if(!allowNavigation){refused=`it asked to look at the “${screen.title}” screen, but Wandel already moved once in this step.`;return null;}
      if(!reachable){refused=`the “${screen.title}” screen is on another site, which Wandel can’t open from here.`;return null;}
      if(!samePage(target,here)&&!await moveFor(screen.title)){refused=`it asked to move to the “${screen.title}” screen, but Wandel has already moved screens ${MAX_HOPS} times for this request.`;return null;}
      if(samePage(target,here))reopen.current={text:carriedText(combined,screen.title),id:userId,hops:hops+1};
      // The page goes away under this call as it moves, so its reply may never come or may say the tab changed. That is the
      // move working: the kept request continues on the new screen.
      setProgress(`Opening “${screen.title}”…`);await bridge.send({type:'state',id:screen.id}).catch(()=>undefined);return null;
     }
     setProgress('Inspecting the relevant layout…');return context(refs.filter(ref=>!ref.startsWith('view:')),combined);
    },
    replan:(expanded,note)=>planConversation(combined,talkContext(expanded),controller.signal,[...conversation.current.filter(turn=>turn.id!==userId),{role:'assistant',text:note,status:'sent'}],image,pageScreenshot,userId)
   });
   {const inspected=await inspectPlan(plan,c,true);if(inspected.interrupted&&!refused)return {waiting};if(refused){plan=await refuse(refused,c);refused='';}else{plan=inspected.plan;c=inspected.context;spokenLine.current=plan.spoken||'';}}
   // One level deep: the thing the user means only appears once a control of the app is opened. Wandel opens it once, then plans again on what it shows.
   // Up to two clicks in one step: a menu, then the item inside it (M2's activity switcher, a tab inside a dialog).
   for(let opened=0;plan.status==='open'&&plan.candidates[0]&&opened<2;opened++){
    const opener=c.elements.find(element=>element.ref===plan.candidates[0]),name=(opener?.name||opener?.text||'it').slice(0,60);
    // Opening may take the app to another page or activity (a link, a menu item, a switcher): the request is kept for
    // this tab first, so wherever the click lands, the panel carries the request on there.
    const moving=await moveFor(name);
    setProgress(`Opening “${name}”…`);
    const open=async(confirmed:boolean)=>bridge.send({type:'openControl',ref:plan.candidates[0],...(confirmed?{confirmed:true}:{})});
    try{await open(false);}catch(error){
     const message=error instanceof Error?error.message:'';
     // A control that changes real data needs the user's yes for this one click.
     if(message.startsWith('CONFIRM:')){const label=message.slice(8);if(!confirm(`This will really click “${label}” in the app. It may change real data, and Wandel can’t undo it. Click it?`)){await dropCarry(reopen);answer('Okay, I didn’t click it. I can prototype it instead, so nothing real changes.');return {waiting};}
      try{await open(true);}catch(again){await dropCarry(reopen);plan=await refuse(`clicking “${name}” didn’t work: ${again instanceof Error?again.message:'no reason given'}.`,c);}}
     // The click took the app to another page or activity, which cuts this step off: the kept request continues there.
     else if(moving&&navigated(message)){setMessage(`Opening “${name}”… I’ll continue there.`);return {waiting};}
     else{await dropCarry(reopen);plan=await refuse(`opening “${name}” didn’t work: ${message||'no reason given'}.`,c);}
    }
    if(plan.status==='open'){
    // Did the click move the app (another activity, another page)? Give it a moment. A move continues this request on
    // the new screen through the kept record; a menu or dialog that opened here needs no carrying.
    await new Promise(resolve=>setTimeout(resolve,800));
    const after=await bridge.send({type:'snapshot'}).catch((error:unknown)=>error instanceof Error?error:new Error(String(error)));
    const moved=after instanceof Error?navigated(after.message):!stillHere()||after.stateId!==c.stateId||!!after.resumeChoice;
    if(moved&&moving){setMessage(`Opening “${name}”… I’ll continue there.`);return {waiting};}
    await dropCarry(reopen);
    if(request!==epoch.current)return {waiting};
    c=await context(undefined,combined);pageScreenshot=await capture(c);setProgress('Looking at what opened…');
    plan=await planConversation(combined+`\n(Wandel opened “${name}” so you can see what it shows. Continue the request on this screen; ${opened===0?'you may open one more control that just appeared (a menu item, a tab) if that is the way, nothing else':'do not open anything else'}.)`,c,controller.signal,conversation.current.filter(turn=>turn.id!==userId),image,pageScreenshot,userId);
    {const inspected=await inspectPlan(plan,c,false);if(inspected.interrupted&&!refused)return {waiting};if(refused){plan=await refuse(refused,c);refused='';}else{plan=inspected.plan;c=inspected.context;spokenLine.current=plan.spoken||'';}}
    if(plan.status==='inspect'||plan.status==='open'&&opened===1)plan=await refuse(`Wandel already opened “${name}” for this request and can’t open or inspect anything else in this step.`,c);
    }
   }
   if(plan.status==='open'||plan.status==='inspect'){answer(plan.question||plan.message);return {waiting};}
   if(plan.status==='watch'){if(plan.candidates.length)await bridge.send({type:'assistantCandidates',refs:plan.candidates});watchRequest.current={text:value,id:userId};await bridge.send({type:'watch'});answer(plan.question||'Click it once in the page and I’ll watch what opens, then build it.');return {waiting};}
   if(request!==epoch.current||origin!==scopeRef.current)return {waiting};
   if(plan.status==='answer'){await remember(plan);
    // A recommendation that ends by asking the user to choose waits on their answer: it is shown, and the answer continues the same request.
    const asks=plan.question?.trim()||'';if(asks)clarificationRequest.current={text:combined,id:userId,scope:origin};
    answer(asks&&!plan.message.includes(asks)?plan.message.trim()+'\n\n'+asks:plan.message);if(plan.candidates.length)await bridge.send({type:'assistantCandidates',refs:plan.candidates});pending.current='';return {waiting};}
   if(plan.status==='clarify'||plan.status==='unsupported'){await remember(plan);setClarification(plan);if(plan.status==='clarify'){clarificationRequest.current={text:combined,id:userId,scope:origin};waiting=true;}if(plan.candidates.length)await bridge.send({type:'assistantCandidates',refs:plan.candidates});pending.current='';answer(plan.status==='clarify'?(plan.question||plan.message):plan.message);return {waiting};}
   pending.current='';
   if(plan.status==='undo'||plan.status==='redo')await bridge.send({type:plan.status});
   else if(plan.status==='save')onSave();
   else{
    // Copies first: they only fill Wandel's clipboard (for a paste on another screen) and change nothing on the page.
    const copies=plan.actions.filter(action=>action.kind==='copy');
    if(copies.length){for(const action of copies)await bridge.send({type:'assistantCopy',ref:action.targets[0]});plan={...plan,actions:plan.actions.filter(action=>action.kind!=='copy')};
     if(!plan.actions.length){await remember(plan);answer(plan.reply||plan.message);if(plan.next?.trim()&&request===epoch.current)continuation.current=plan.next.trim();return {waiting};}}
    const latest=await bridge.send({type:'snapshot'});if(latest.workflow.id!==c.workflowId||latest.stateId!==c.stateId)throw new Error('The current page changed while planning. No edit was applied.');setProgress('Applying a reversible preview…');applying();plan=await applyVerifiedPlan(combined,plan,c,{apply:async(proposed,current)=>{
     const before=pageScreenshot;let kept='';
     // A change that rendered but failed a layout check is left on the page; the user decides.
     // The exact plan being applied, with each step's target, goes into any failure report.
     lastPlan.current=proposed.actions.map(action=>{const target=current.elements.find(element=>element.ref===action.targets[0]);return action.kind+(action.element?' '+action.element:'')+(action.position?' '+action.position:'')+' → '+(target?target.tag+(target.attributes?.role?'['+target.attributes.role+']':'')+' "'+(target.name||target.text||'').slice(0,30)+'"'+(!(target.name||target.text||'').trim()&&target.classes?.length?' .'+target.classes[0].slice(0,40):''):action.targets[0]);}).join(' | ');
     try{await bridge.send({type:'assistantApply',plan:proposed,token:current.token});}catch(e){const m=e instanceof Error?e.message:'';if(!m.startsWith(keptPreview))throw e;kept=m.slice(keptPreview.length);}
     appliedSteps++;
     verificationNote='';reviewIssue='';
     // Review the applied page, including warnings. A warning is evidence, not a veto.
     // One targeted correction and one recheck bound latency and cost; never replay the original request here.
     for(let repair=0;repair<2;repair++){
      lastVerdict='';
      if(!stillHere())throw new Error('Request canceled.');
      if(!kept&&!requiresVisualReview(proposed,!!image)&&repair===0)break;
      setProgress(repair?'Checking the correction…':'Checking the rendered result…');
      let afterContext:PageContext,after:string|undefined,issue=kept;
      try{
       const revealed=(await bridge.send({type:'revealChange'})).revealed;
       afterContext=await context(undefined,combined);after=await capture(afterContext);
       if(before&&after){
        const verdict=await verifyConversation(combined.slice(0,1350)+revealNote(proposed)+(revealed?'\nAFTER is scrolled to the changed area. Judge the edit, not the scroll position.':'')+(kept?'\nLayout diagnostic (a clue, not proof of failure): '+kept.slice(0,700):''),proposed,before,after,controller.signal,userId,image);
        lastVerdict=verdict.status;
        if(verdict.status==='pass'){reviewIssue='';break;}
        if(verdict.status==='uncertain'){verificationNote='The change is visible, but visual review could not confirm it: '+verdict.message;reviewIssue=kept;break;}
        issue=verdict.message;
       }else if(!kept){verificationNote='The change was applied; screenshot review was unavailable.';break;}
      }catch(error){
       if(controller.signal.aborted||request!==epoch.current)throw error;
       reviewIssue=issue;verificationNote='The change was applied, but its review could not finish.';break;
      }
      reviewIssue=issue;
      if(repair===1)break;
      setProgress('Correcting the layout…');
      const correctionRequest='The user requested: '+combined+'\nThe requested edit is ALREADY APPLIED on the current page. Do not repeat it or add another copy. Inspect the current DOM and screenshot. Diagnose this evidence: '+issue+'\nTreat geometry warnings as clues: ignore harmless pixel, font, or spacing differences and intentional clipping already present in the original. Fix only a clear defect such as unreadable overlapping text, unintended overflow, missing requested content, or unusable controls. Preserve the rest of the applied edit. Return answer if the result is acceptable and explain why. Ask clarification only for a genuine design choice, never whether broken rendering is acceptable. Do not open application controls, navigate, undo, or redo.';
      try{
       let correction=await planConversation(correctionRequest,afterContext!,controller.signal,conversation.current.filter(turn=>turn.id!==userId),image,after,userId);
       const inspected=await resolveInspections(correction,afterContext!,{
        limit:2,active:stillHere,
        inspect:async refs=>{const expanded=await context(refs,correctionRequest);after=await capture(expanded);return expanded;},
        replan:(expanded,note)=>planConversation(correctionRequest,expanded,controller.signal,[...conversation.current.filter(turn=>turn.id!==userId),{role:'assistant',text:note,status:'sent'}],image,after,userId)
       });
       correction=inspected.plan;afterContext=inspected.context;
       if(inspected.exhausted){verificationNote='The change is applied, but I could not resolve the remaining layout issue.';break;}
       if(!stillHere())throw new Error('Request canceled.');
       if(correction.status==='answer'){reviewIssue='';verificationNote=correction.message;break;}
       if(correction.status!=='edit'){verificationNote='The change is applied, but I could not complete its layout correction.';break;}
       const latest=await bridge.send({type:'snapshot'});
       if(latest.workflow.id!==afterContext!.workflowId||latest.stateId!==afterContext!.stateId)throw new Error('The page changed during review.');
       // A correction that adds elements on top of an attempt that added elements stacks a second copy (two chevrons, two banners).
       // Remove the attempt and plan the request again on the clean page, told what went wrong, so there is only ever one.
       let token=afterContext!.token;
       if(correction.actions.some(action=>action.kind==='create')&&proposed.actions.some(action=>action.kind==='create')){
        setProgress('Redoing the change cleanly…');
        for(;appliedSteps>0;appliedSteps--)await bridge.send({type:'undo'});
        const retryRequest=combined+'\nA first attempt at this was removed because: '+issue.slice(0,500)+'\nDo it once, with the smallest change: place it exactly where asked, keep existing text on one line, and do not add anything else.';
        let clean=await context(undefined,retryRequest),shot=await capture(clean);
        const redo=await resolveInspections(await planConversation(retryRequest,clean,controller.signal,conversation.current.filter(turn=>turn.id!==userId),image,shot,userId),clean,{
         limit:2,active:stillHere,
         inspect:async refs=>{const expanded=await context(refs,retryRequest);shot=await capture(expanded);return expanded;},
         replan:(expanded,note)=>planConversation(retryRequest,expanded,controller.signal,[...conversation.current.filter(turn=>turn.id!==userId),{role:'assistant',text:note,status:'sent'}],image,shot,userId)
        });
        if(!stillHere())throw new Error('Request canceled.');
        if(redo.exhausted||redo.plan.status!=='edit'){verificationNote='I removed the first attempt because '+issue.replace(/\.?$/,'.')+' I couldn’t find a cleaner way to make the change, so the page is back to how it was.';reviewIssue='';lastVerdict='';break;}
        correction=redo.plan;token=redo.context.token;clean=redo.context;afterContext=clean;
       }
       kept='';
       try{await bridge.send({type:'assistantApply',plan:correction,token});}
       catch(error){const message=error instanceof Error?error.message:'';if(!message.startsWith(keptPreview))throw error;kept=message.slice(keptPreview.length);}
       appliedSteps++;
      }catch(error){
       if(controller.signal.aborted||request!==epoch.current)throw error;
       // A failed correction must not replay (and duplicate) the already-applied original edit.
       verificationNote='The change is applied, but I could not finish correcting its layout.';break;
      }
     }
    },refresh:async()=>{const fresh=await context(undefined,combined);pageScreenshot=await capture(fresh);return fresh;},inspect:(refs)=>context(refs,combined),replan:(feedback,current)=>planConversation(combined,current,controller.signal,[...conversation.current.filter(turn=>turn.id!==userId),{role:'assistant',text:'The last proposed edit was not applied or its preview was fully rolled back. Repair only the current request; inspect or ask a concise clarification when the target is genuinely ambiguous. '+feedback,status:'failed'}],image,pageScreenshot,userId,true),active:stillHere,repairing:()=>setProgress('Checking a safer way to apply your request…')});}
   // The review still has a concern after one correction. Keep the change (the user can see it and may well want it),
   // say what looks off, and leave undo to them rather than reverting without asking.
   if(lastVerdict==='revise'&&reviewIssue&&appliedSteps&&request===epoch.current){
    flagged=true;
   }
   spokenLine.current=plan.spoken||'';
   lastPlan.current=plan.status+': '+plan.actions.map(action=>action.kind+(action.element?' '+action.element:'')+(action.position?' '+action.position:'')).join(', ');
   if(plan.status==='clarify'||plan.status==='unsupported'){setClarification(plan);if(plan.status!=='unsupported'){waiting=true;clarificationRequest.current={text:combined,id:userId,scope:origin};}if(plan.candidates.length)await bridge.send({type:'assistantCandidates',refs:plan.candidates});answer(plan.status==='clarify'?(plan.question||plan.message):plan.message);return {waiting};}
   if(request===epoch.current){await remember(plan);answer(undone?'I undid that change because the result wasn’t right: '+undone.replace(/\s*\([^)]*\)/g,'').trim().replace(/\.?$/,'.')+' The page is back to how it was. Say “redo” to see it anyway, or ask for it in smaller steps.':plan.status==='edit'?(plan.reply||'Applied: '+plan.actions.map(action=>action.kind==='create'?'added '+(action.text||action.element):action.kind==='duplicate'?'duplicated '+(action.text||'the referenced element'):action.kind==='theme'?'updated the theme':action.kind==='layout'?'updated the layout':action.kind==='text'?'updated the text':action.kind==='remove'?'removed the element':action.kind==='connect'?'connected the views':'updated the element').join('; ')+'. Undo is available.')+(reviewIssue?(flagged?' One thing to check: ':' The edit still needs attention: ')+reviewIssue.replace(/\s*\([^)]*\)/g,'').trim().replace(/\.?$/,'.')+(flagged?' Keep it, try again, or discard it?':' I couldn’t resolve this automatically. Undo is available.'):verificationNote?' '+verificationNote:''):plan.message,!undone&&plan.status==='edit',!undone&&plan.status==='edit'?reviewIssue:'',flagged?appliedSteps:0);}
   if(request===epoch.current&&!undone&&!flagged&&plan.status==='edit'&&plan.next?.trim())continuation.current=plan.next.trim();
 return {waiting};
}
