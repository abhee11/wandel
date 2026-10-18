# Wandel current checkpoint

Updated October 16, 2026. This is the active check-in document. The broader plan is [User journeys and checkpoints](USER_JOURNEYS_AND_CHECKPOINTS.md).

**Active journey: J1 — Create a manual onboarding prototype on Maeris, save, refresh, and replay.**

**Status: implementation present; automated checks passed; user acceptance pending.** No real-app journey is marked complete by today's automated run alone.

## What we have today

| Capability | Implementation | Verification |
|---|---|---|
| Select, highlight, add, edit, duplicate, move, resize, remove, undo/redo | Present | Automated coverage; site compatibility still needs acceptance |
| Connected screens and recursive editing | Present | Automated coverage; J1 checks the installed extension |
| AI branching, sample data, metrics, cards and tables | Present | Automated and scripted-browser coverage; live AI acceptance pending |
| Version save, page reload and replay | Present | Automated coverage; J1 checks temporary saving |
| Local saving across Chrome restart | Persistent adapter in free build; standard build uses session storage | Not a unified completed journey |
| Feature prompt, profile, Clerk sign-in and account saves | Present | Component/service coverage; fresh end-to-end acceptance pending |
| Stripe upgrade | Test scaffolding | No production billing or paid source-export fulfillment |
| Private app builder, generated source export, GitHub handoff | Not implemented | Planned |
| Production deployment and Maeris testing integration | Not completed as user journeys | Planned |

## Today's engineering check

- [x] `npm test` — 122 tests passed across 15 files.
- [x] `npm run build` — standard extension built in `dist/`.
- [x] `npm run build:free` — local-only extension built in `dist-free/`.
- [ ] Installed-Chrome acceptance of J1 on the freshly built standard extension.
- [ ] User sign-off.

These results describe the current working tree, which contains uncommitted changes. No application behavior was changed for this check-in. Passing these checks does not establish release readiness.

## J1 acceptance card

**User need:** Demonstrate a three-step onboarding feature on a real app and reopen it in the same Chrome session.

**Site:** `https://light.maeris.io/login` in Google Chrome.

**Build:** Standard Wandel loaded from `/Users/abhinavmathur/Documents/DesignX/dist`. Do not substitute the browser demo or free build.

**Services:** None required. Use on-page Add and On click controls, not AI or account saving. The test does not submit the Maeris login form.

**Target flow:** Existing app → Explore onboarding → Profile → Continue → Preferences → Finish → Welcome.

Preserve any earlier work you need before reloading the extension: the standard build clears temporary saves when it reloads. Reload once before creating this test. Do not reload the extension or quit Chrome during J1.

| Step | Action | Expected result | Result |
|---|---|---|---|
| J1.1 | Reload Wandel at `chrome://extensions`, refresh Maeris, open Wandel in Edit mode, and click the large Maeris Sign in button | That button is visibly selected; the login form is not submitted | Pending |
| J1.2 | In the on-page toolbar choose **+ Add → Button**. Type **Explore onboarding** into its inline editor and press Enter | A new button appears beside the selected button | Pending |
| J1.3 | Select Explore onboarding. Choose **On click → New state**, type **Profile**, and press Enter | A linked, editable Profile state opens | Pending |
| J1.4 | Select the Profile panel. Use **+ Add → Button**, name it **Continue**, and use its **On click → New state** field to create **Preferences** | Preferences is connected to Continue; Profile remains in the flow | Pending |
| J1.5 | In Preferences, add a button named **Finish** and connect it to a new state named **Welcome** | The flow contains the original page plus three prototype states | Pending |
| J1.6 | Click **Try flow**, then Explore onboarding → Continue → Finish | Each click reaches the expected state; no real login occurs | Pending |
| J1.7 | Use **Back**, then **Restart** | Back returns to Preferences; Restart returns to the original entry point | Pending |
| J1.8 | Return to **Edit**, name the workflow **Onboarding checkpoint**, choose **Save workflow → Save temporarily · Free**, then close the dialog | A save confirmation appears and a saved version exists | Pending |
| J1.9 | Refresh only the Maeris webpage. Open Wandel → **Saved versions → Saved on this page** and open Onboarding checkpoint | The workflow is available on the same URL with all states and connections | Pending |
| J1.10 | Click **Try flow** and repeat Explore onboarding → Continue → Finish | The restored workflow replays correctly | Pending |
| J1.11 | Return to Edit and choose **Restore original page**, confirming the reset | Prototype changes disappear; Maeris remains usable; saved versions remain | Pending |

If a control or saved workflow cannot be found, record that as the failing step rather than substituting another route. Keep the draft when reporting a failure.

**Completion rule:** All eleven steps pass in the installed extension and the user confirms the result. Automated tests, scripted fixtures, or reconstructing missing states after reload do not close J1.

**Excluded from this sign-off:** AI generation, branching decisions, persistence after Chrome exits, account sync, arbitrary-site support, code generation and deployment. These have separate cards below.

## User check-in

- Outcome: Pending.
- Passed through: Not started.
- First failing step: None reported yet.
- Observed behavior or error: Not recorded.
- Evidence: Not recorded.
- User acceptance date: Pending.

Reply **“J1 passed”** if every step matches, or **“J1 failed at J1.4: [what happened]”**. We update this card before choosing another journey. A J1 pass does not mark other journeys complete.

## Next journey queue

| Journey | Outcome required | Current state |
|---|---|---|
| J1 Manual feature and reopen | The acceptance card above | Active; awaiting user verification |
| J2 AI feature | One prompt on a real app → approve/reject branches → sample data changes → extend a state → replay | Foundations implemented; live AI and installed-extension acceptance pending |
| J3 Durable resume | Save → quit Chrome → restart → load → replay | Standard local saving needs durable storage; account/free paths need acceptance |
| J4 Safe switching | Generate in A → switch to B → A's result never changes B → return to A and apply safely | Existing context checks; full pending-result/recovery journey incomplete |
| J5 Working app | Approved prototype → private workspace → generated source → tests → working preview | Not implemented |
| J6 Paid handoff | Accepted preview → disclosed fee → verified source ZIP → reproducible local run | Not implemented |
| J7 Connected delivery | GitHub handoff and one deployment target, with failure recovery | Not implemented |

Blockers stay attached to their journey until fixed and retested. [VALIDATION.md](VALIDATION.md) records engineering evidence; [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) records distribution requirements.

## AI journey blocker on October 16

The user chose to test prompt-based generation (J2) before manual authoring (J1). Sign-in failed with ERR_CONNECTION_REFUSED because neither the local sign-in frontend (5174) nor API (4320) was running. Both services were restarted. J2 remains awaiting authentication and actual generation/replay verification; J1 has not been accepted. Local service availability is still a development dependency, not a production-ready sign-in route.

### Sign-in return fix — October 16
The website session was signed in, but its return button only called `window.close()` and the extension did not receive a session-change notification. Sign-in now starts through the background worker, retaining the source tab and a short-lived nonce in session storage. The trusted auth page can return to that unchanged tab and close its own tab. Cookie changes and return completion notify the profile to refresh. Old/direct sign-in links display explicit recovery guidance instead of silently attempting to close. Build passed; 123 tests passed, including trusted-origin and nonce checks. Installed Chrome return and account profile synchronization still need acceptance after reloading the extension.

### Installed Chrome account recognition verified — October 16
The return handoff worked, but `/api/me` rejected the extension session. Live diagnostics confirmed a signed Clerk worker token with no `azp` claim and a request without an Origin header. Verification now checks signature/expiry first, rejects any present unapproved `azp`, and accepts missing-claim worker Bearer requests without an Origin (or from the explicitly configured extension). The API never accepts ambient cookies for Clerk authentication. The installed extension origin was added to local server configuration. Native Chrome verification on Maeris now visibly shows **Abhinav Mathur · FREE**, account save controls and Sign out; Guest and Sign in are gone. 127 tests pass, including rejection of unauthorized origins and invalid signatures. AI generation/replay is still a separate pending acceptance check.

### AI provider blocker confirmed — October 16
A direct request using the onboarding prompt and synthetic `Sign in` button context returned HTTP 429, provider code `credit_balance_exhausted`: the configured API account has no remaining credits. Generation is blocked before a plan is returned. The signed-in API now reports AI_BILLING_UNAVAILABLE with actionable guidance instead of a generic retry; failed actions remain uncharged. 130 tests and platform build pass. Add API credits to the configured provider account (or configure a funded key) before continuing J2 live generation acceptance.

### Funded AI onboarding check — October 16
The configured provider now successfully returns a valid three-screen onboarding graph: Profile → Preferences → Welcome, with Back actions and bound sample data. A temporary integration check using that actual response passed insertion and forward/back replay in the DOM engine, with zero host form submissions and no unresolved targets. This check used synthetic host markup; the same prompt on installed Chrome/Maeris remains the final real-site acceptance step. The temporary test was removed because it depended on a local diagnostic artifact.

### Real-site onboarding replay verified — October 16
On the user's existing Maeris login tab, the generated four-state workflow was present but clicking its launch control did not advance outside replay. The first Try flow attempt also stalled; closing and reopening the side panel retained the existing draft and restored the connection. Added an always-visible footer Try flow/Edit control and a 10-second page-command timeout with reconnect guidance (no automatic mutation retries). Native Chrome verification then reached Profile, Preferences and Welcome, with sample name/role/preferences rendered and no host login submitted. The page was left on Welcome. Initial stalled-request root cause remains unconfirmed; reconnection resolved this instance. Sidebar state titles still expose variable placeholders and need a display-label cleanup.

### Advanced settings prompt, portable workflow and settings playback — October 16
Implemented a bounded local recipe for the reported prompt: identify the open Advanced content (linked tab panel or Maeris settings headings), insert Appearance and Screen size controls, and inherit typography. Both side-panel and on-page prompts support it without a selected element or AI credit. Ambiguous targets fail with selection guidance. Added controls scroll into view. Theme applies to the section only; width preview does not resize the browser or emulate media queries. Undo/reset restore runtime styles. This is not general AI interpretation of arbitrary app features.

Share & playback exports/imports a workflow JSON file. Recipients need Wandel, access to the same origin/route, and the matching dialog open. Import validates the definition and refuses mirrored real-app actions; replacing the draft requires confirmation. A short settings demonstration clicks only Wandel widget controls and restores original theme/size. This is not a hosted share link or arbitrary recorded walkthrough.

Validation: full 134-test suite passed, then two additional tests passed with the five-test settings suite (on-page prompt/playback and hidden ancestor handling). Standard extension, free extension and platform builds passed. Installed Chrome/Maeris acceptance remains pending: the browser was in use and was not reloaded. Reload Wandel at chrome://extensions, refresh Maeris, open Settings → Advanced, and submit the reported prompt. Verify placement, appearance, Light/Dark, width controls, Undo, export/import and playback before accepting this journey.

### Installed settings test and nested-section fix — October 16
Chrome initially showed the previous panel: the exact Advanced theme/resize prompt still displayed Select starting point, with no Share & playback controls. After reloading Wandel, native Chrome on the actual Maeris Advanced dialog accepted that prompt without a selected element, inserted Appearance and Screen size, changed Dark to pressed, and opened Resize preview with a width slider/presets. Clicked Mobile preset; visual sizing fidelity was not separately measured. The controls remain on the page for inspection. This verifies the bounded settings recipe, not general feature generation.

Separately observed MirrorTalk reporting “The selected element moved or is ambiguous” for a nested Advanced dialog. Locators now store optional ancestor tag context and use it only to disambiguate strong semantic matches; identical sibling dialogs remain rejected. New panel checks page capability before settings commands to prevent old scripts silently returning unchanged workflows. Added the requested resize slider and an exact-prompt panel regression test. 139 tests pass; standard/free/platform builds pass. MirrorTalk Feedback-generation acceptance remains pending after reloading the latest build and refreshing that page. API restarted with updated locator schema.

### MirrorTalk ambiguity acceptance — October 16
Reloaded the installed extension, selected the actual nested Advanced dialog in MirrorTalk /groups/102949, and successfully generated UI without an ambiguous-target error. The first generation used the first line of the prompt (native typing submitted at its newline) and created an unwanted multi-screen flow; it was undone. Added a pre-generation selection validation command so a missing target is rejected before requesting AI. Inline “add ... section” requests no longer receive the forced connected-workflow prefix unless they explicitly mention workflow/screens/journey.

Retested the complete Feedback length request as one line on installed Chrome. It added Feedback length and Concise / Normal / Elaborated controls inside the existing Advanced container; no ambiguity error and only the existing state remained. The generated controls are currently ordinary buttons with On/Off labels, not functional toggles. This functional gap is not accepted as complete. The result remains on the user's page. 73 targeted tests passed (locator/DOM, panel entry/routing, bridge); standard extension build passed and was reloaded. Free build has not been rebuilt for the new preflight command in this turn.

### Nearby choice styling — October 16
Added a reusable choice-section transformation for inline section prompts containing options/toggles. It recognizes an AI insertion batch with one heading and 2–8 choices, finds a nearby real toggle section, copies its computed heading/pill/section appearance, and inserts after that section rather than appending below the dialog footer. Captured styles and choices serialize with the workflow. Controls provide exclusive local selection with a checkmark and arrow-key support; they do not invoke the application's handlers. Selection during replay is transient, with the generated default restored on remount. If a suitable reference section is absent, the existing generic insertion remains the fallback. This is not universal application theme inference.

143 tests passed, including style/placement, isolated selection behavior, serialized workflow rendering and reset; standard extension, free extension and platform builds passed. Installed MirrorTalk visual acceptance is in progress.

### Native choice section accepted on MirrorTalk — October 16
Installed-Chrome verification passed on the existing Advanced dialog using the user's full Feedback length prompt. The section appears after Metrics and above Cancel/Save, with matching heading typography, vertical spacing, and purple rounded pills. Clicking Normal in Edit and Elaborated in Try flow updated exclusive selection. MirrorTalk's original controls were not invoked. The final page is left in Try flow with Elaborated selected.

Also fixed AI insertion batches that describe this dialog as a form: a recognized native choice section now resolves its own local anchor before generic form targeting. Live visual testing caught missing flex-direction capture; fixed and regression-tested. Full suite: 144 tests passed; final layout-specific suite: 3 passed; standard extension build passed and installed build reloaded. This acceptance covers matching choice sections, not arbitrary components or backend behavior. Runtime selection resets on remount/restart.

### Native application experience — October 16 (implementation, bounded acceptance)
The seven requested streams now have reusable implementation paths, rather than a MirrorTalk-specific recipe:

| Stream | Implemented behavior | Verification / limits |
| --- | --- | --- |
| Destination | Resolve an explicit named heading/region or one open dialog; respect explicit selection and refuse duplicate/missing names before AI. | Unit coverage plus installed Chrome successfully inferred the Advanced container without a click. This is bounded semantic matching, not arbitrary natural-language page understanding. |
| Component matching | Capture local computed surface, heading, text, button, field, card, table and header styles. No host handlers or field values copied. | Serialized profile and DOM tests. Matching uses standard semantics and nearby references; custom canvas/embedded components are not supported. |
| Layout | Insert into the selected container above a recognized action footer; preserve flexible sizing. Five layout variants keep original colors and controls. | Footer order, dark palette, rounded controls and five alternatives tested. Does not reconstruct arbitrary responsive design rules. |
| Interaction | Declarative switches, dropdowns and tabs; exclusive choices; required/type validation on forward flow navigation. | Control isolation, state changes and invalid/valid email progression tested. These are local prototype behaviors, not host backend integrations. |
| Recursive screens | Generated screens and manually added child screens inherit a serialized local design profile. Existing branching/data flow remains editable. | Branching, recursion, styling, save/reload and replay tests. |
| Result checking | Report missing targets and clipped/hidden generated controls; existing graph validation rejects broken/unreachable links. | Clipping test plus real Chrome clipping warning observed. Reports problems; does not guarantee automatic visual repair or detect every overlap. |
| Save/share/replay | New design, control and validation definitions pass through existing validated workflow/version/export/import records. Runtime entered data remains transient. | Record roundtrip, local save/reload/replay and restoration tests. Recipients still need the same application context and Wandel; no hosted public replay link. |

The live Chrome test found a simple dropdown request was still being prefixed as a connected workflow; component prompts now bypass that prefix, and on-page component prompts use AI instead of the simple local button parser. The incorrect test flow was undone. Final installed-Chrome visual acceptance is pending: the native tool returned blank screenshots / elementHasNoFrame, and the user was asked to leave MirrorTalk visible. Do not present all-site compatibility or pixel-perfect matching as verified.

Test evidence: full 151-test suite passed before the final layout-palette regression; final targeted native-design, routing, flow and DOM suites passed with the additional layout test. Standard, free and platform builds passed; final build results recorded in the task response.

### AI failure diagnosis — October 17
Restarted the stopped local API and sign-in services. A direct bounded provider request for Feedback length options succeeded, so credentials/connectivity worked at verification time. The user's later generic 502 does not retain enough information to establish its original cause. Added distinct safe failure codes/messages for timeout, connectivity, incomplete output/output limit, refusal, provider access/configuration errors, and invalid plans. Validation logs contain only issue paths/codes, never prompts or generated content. 31 provider/platform tests and platform build passed; API restarted. Exact failed user prompt requested for reproduction; do not claim its failure is fixed until verified.

### Explicit category requests and misleading success — October 17
The reported complete Feedback length prompt was reproduced against the live provider: HTTP 200 / completed in about four seconds, but the plan used one switch with three options, which the prior switch renderer would collapse to On/Off. The user's screenshot also shows a separate incorrect generated launch action (Set feedback length); this is a different observed bad plan shape, not proof the original generic 502 cause was identified.

Added a bounded, app-independent parser for explicitly named sections/categories with 2–8 listed choices. Both the panel and on-page route compile the original numbered prompt and the previously suggested quoted-category/Include prompt locally, preserving requested defaults. Explicit lists override conflicting AI plans at the content execution boundary. They require a matching native pill section before any edits are committed, rather than claiming success for incomplete generic output. A multi-option AI switch is also adapted to the native choice section. Panel labels show Add matching category / no AI credit and do not require sign-in for this local path. No backend handlers are copied.

Full suite: 164 tests passed before the final panel regression; final 14 parser/panel/native-choice tests passed, including AI unavailable, exact prompt, three options, native appearance/footer placement, selection and undo. Standard/free builds passed. Live Chrome acceptance remains unverified: screenshots show the user's incorrect output, but the native app exposes no page accessibility tree and coordinate actions return noWindowsAvailable. The incorrect output has not been removed in the user's tab. Undo it before reloading the extension to test the corrected build. This does not establish that the original intermittent provider failure is fixed.

### Exact suggested category wording regression — October 17
Reproduced the user's final suggested prompt through the panel test and found two concrete routing defects. The parser accepted plural pills/choices but rejected singular pill/choice used in that exact prompt. After correcting that gate, the regression still failed: generationPrompt prefixed category requests with Create a connected workflow, causing another launch action and screens. Fixed generationPrompt to preserve recognized choice plans and classify category/options/pills as inline additions. Native matching accepts singular/plural control wording too.

The exact user-facing quoted-category prompt now passes the panel regression with no sign-in/AI request and passes content execution tests that verify three matching pills, Normal initially selected, footer placement and undo. Both original numbered and quoted-category wording are covered. Sixteen targeted parser, panel and DOM tests passed; standard/free builds passed. Installed Chrome retest is in progress; these findings replace the earlier assumption that only an older installed build explained the repeated output.

### Installed Chrome acceptance: exact category prompt — October 17
Completed live verification in the user's actual MirrorTalk /groups/102949 Advanced dialog after reloading the corrected installed extension. The exact quoted-category prompt displayed Add matching category / no AI credit and created Feedback length below Metrics, with matching heading and purple pills, above Cancel/Save. Normal was initially selected; clicked Elaborated in Edit and Concise then Normal in Try flow, confirming mutually exclusive state changes. No Configure/Set launch button or extra workflow screens were created; the flow remained one state. The final tab is left in Try flow with Normal selected. Host Save was not invoked.

The live test also exposed a false clipping warning caused by walking past a viewport-fixed dialog into background overflow containers. The check now stops at the fixed boundary and checks clipping per axis; added regression coverage. Reloaded that final build and repeated the exact live test: Changes applied with no unresolved warnings. Final targeted suite: 25 tests passed. Standard/free extension builds passed. This supersedes the prior pending live-acceptance status for this exact journey.

### Manual editing usability — October 17
Implemented a reusable manual editing pass:
- Explicit Edit / Interact / Try flow controls in the account panel, and Interact in the free panel. Escape from selection restores normal host clicks and shows a compact Interact bar with Resume selecting; V toggles Edit/Interact. A second Escape checkpoints and collapses as previously requested. Added a visible close-selection action and close buttons for menus. Escape closes an open menu before leaving edit mode; inline Escape cancels text editing only. Switching Edit/Interact retains entered prototype values in memory.
- The page toolbar now keeps AI prompting, layout alternatives, ancestor selection and workflow breadcrumbs inside menus. Duplicate is labeled. Add offers immediate named placeholders plus Text, Email, Password, Number, Phone, URL, Date, Time, Checkbox, Radio, Long text and Dropdown. B/T/F/P remain quick insert shortcuts. Typed fields have a Field settings menu for type, Required, dropdown options and radio groups; duplicate fields retain their type configuration.
- Ctrl/Cmd-click a source, then a destination copies only visual appearance. More also exposes Copy style / Paste style; Cmd/Ctrl+Alt+C/V are available. Paste is undoable and serialized; labels and host handlers are preserved. Generated controls and fields still support existing On click → state navigation and Try flow.
- Added capability checks so an old content script rejects new manual commands with refresh guidance instead of silently doing nothing. The backend schema was rebuilt and the local API restarted for typed field/style-copy saves.

Validation: full 183-test suite passed, then final 85 manual/DOM/bridge tests passed after input-preservation and stale-script checks were added. Standard, free and platform builds passed. Manual integration tests cover Escape/resume, menu cancellation, 11 field types, radio grouping, duplication, transient values, style-copy/undo/reset and host click preservation. Installed-Chrome visual acceptance is pending: Chrome was on an active chess game, so no tabs or extension state were changed during that session. This is not a claim of complete real-site compatibility. Mirroring existing host behavior remains an explicit separate action; copying appearance never forwards host events.

### Copied pill double-click and individual field dragging — October 17
Fixed three concrete gaps from the screenshot:
1. Ordinary drag on a selected element now waits for a 4px movement threshold. A stationary pointer down/up is left uncancelled so Chrome can deliver the normal double-click sequence. Inline editing selects the full label and keeps nested elements intact.
2. Double-clicking a Wandel-owned item in Interact mode now returns to Edit and opens its label editor. Host elements retain normal Interact behavior.
3. Generated field controls have stable owned IDs separate from their label wrapper. In Edit, clicking/dragging the dropdown selects and moves the control itself; its label and containing section remain in place. In Interact, the native dropdown works normally. Derived field IDs are included in workflow validation so moves can save/reload. Field settings/duplication resolve back to the field definition.

Regression tests exercise pointer down/up cancellation (not only synthetic dblclick), select-all inline rename of copied nested pill labels, Interact-to-edit double-click, control-only movement/undo, and normal Interact dropdown selection. Installed-Chrome verification was started on the user's original MirrorTalk page, but Chrome focus later moved to another profile/window before the build could be reloaded. Existing prototype was not reset or reloaded; preserve/export it before updating because the account build's session storage is cleared by extension reload. Final build/test results are reported in chat.

Final verification for this pass: all 188 tests passed; standard/free/platform builds passed and API restarted with derived field-control IDs. Native verification could read the original MirrorTalk dialog and copied Talk Time item. Attempted Export workflow before extension reload to preserve the user's session-only draft; the CUA call timed out and reset its kernel. No .wandel.json backup was found in Downloads, and the extension was not reloaded. Browser acceptance of this build remains pending; do not claim the fix was installed or live-verified. Preserve/export the existing draft before an extension reload.

## Text editing acceptance — October 17, 2026

Scope: text elements and text inputs. Complete these five actions before broadening the manual editor.

| Action | Interaction | Evidence |
| --- | --- | --- |
| Horizontal alignment | Select text → Align → left / center / right | Browser: center applied; automated horizontal input and independent axes checks |
| Vertical alignment | Align → top / middle / bottom; resize box height to see effect | Browser: middle applied in 130px text box. Native inputs and elements containing controls are disabled explicitly |
| Move | Select once, drag selected item | Browser: translated 80px horizontally and 20px vertically |
| Duplicate and edit | Duplicate or Cmd/Ctrl+D; double-click label to edit, Enter commits, Escape cancels | Browser: copied label renamed without changing original; double-click reopened editor |
| Transfer style | Ctrl/Cmd-click source, then destination; Cancel exits transfer | Browser: Georgia/purple reference applied to renamed copy, text retained |

Changes: bounded alignment commands saved as reversible appearance operations; alignment menu; toolbar prefers space above selection; style transfer temporarily shows only a bottom instruction and Cancel so it does not obstruct the destination; text copies omit irrelevant Behavior menu; alignment and style transfer retain the live generated selection after rerender.

Reproducible local acceptance page: http://127.0.0.1:5173/demo/fixtures/text-editor.html (run `npm run dev`). It uses the production Session/PageEditor/Renderer, with isolated local browser storage and no AI or service dependency. Save locally → reload → Restore saved was verified in the in-app browser, retaining alignment, movement, renamed copy and transferred styling. This does not verify installed-Chrome storage or real-site compatibility.

Validation: 192 tests passed, standard and free builds passed, diff whitespace check passed. Browser screenshot: `docs/text-editing-acceptance.png`.

Remaining gate: preserve/export the existing Chrome draft, reload the unpacked extension, refresh MirrorTalk and run the same five actions on its actual text labels. The installed extension was deliberately not reloaded in this pass to avoid clearing the current session draft. No claim of full MirrorTalk acceptance yet.

### Mode shortcuts with panel focus — October 17

Reported E/I shortcuts not working. Found a concrete gap: content document listeners cannot receive keystrokes from Chrome's separate side-panel document. Added shared side-panel mode handler to both standard and free panels. E enters Edit, I enters Interact, V toggles; prompt/form typing, modifier combinations, repeat/composition, save dialogs and busy states are excluded. Existing page handler remains active.

39 targeted editor and panel tests passed, including a panel-only focus regression; standard/free builds passed. Fresh local demo browser visibly switched I → Interact and E → Edit. Evidence: `docs/mode-shortcuts-verification.png`. This does not prove the user's installed extension has loaded the rebuild. Preserve/export its current session draft before reloading the unpacked extension, then refresh the host app.

## Buttons, links and role buttons — October 17, 2026

Scope: shared manual controls for native buttons, anchors and `role="button"` elements.

- Double-click a label to edit in place; Enter commits, Escape cancels. Links are normalized to the control when it has a single editable label, preserving nested markup.
- Move by dragging the selected control or the visible Move action. Native HTML drag is suppressed only in Edit, so link dragging does not steal the move gesture. Resize via the corner.
- Duplicate / Cmd/Ctrl+D, rename the copy, Delete/Backspace and undo. Safe link URLs and button/link roles now survive duplication. Executable and credential-bearing link URLs are not copied. Host JavaScript listeners are not serialized into duplicates; original host controls retain their listeners, and explicit Mirror behavior remains available separately from prototype state links.
- Style includes swatches and editable #RGB / #RRGGBB colors, clear fill, padding, corner radius, weight, width, height and font size. Links expose underline. Valid values apply without an Apply button; invalid hex is marked and does not apply. Transparent backgrounds show No fill rather than an opaque black hex value.
- Copy style is a primary toolbar action. Click it on the source, then normally click a destination. Ctrl/Cmd-click and keyboard copy/paste remain available. Transfer offers Cancel and preserves destination text.
- Horizontal/vertical content alignment applies to buttons, anchors and role buttons, including icon-bearing controls, without stacking the icon and label into a column.
- Toolbar has separate rows for editing and prototype/page actions. Copied button behavior is merged into On click rather than another top-level menu. Menus render above selection handles.

Acceptance: 210 full-suite tests passed; 40 focused manual-editor tests passed again after final visual adjustments; standard/free builds and diff whitespace check passed. Parameterized tests cover all three control types and connecting/replaying a prototype state without invoking the real host action.

Browser verification on http://127.0.0.1:5173/demo/fixtures/button-editor.html: edited native button/link/role-button labels; applied link hex color; duplicated link and retained URL; dragged role button via Move (40px/40px); copied reference styling with a normal click; deleted a copied link with Backspace and restored it with Undo; verified original host click still fires in Interact; saved/reloaded/restored changes. Evidence: `docs/button-link-acceptance.png`.

Installed Chrome / MirrorTalk / Maeris acceptance is still a separate gate. Export any current session draft before reloading the unpacked extension and refreshing the host app. Rebuilding dist does not replace an already running Chrome content script.

## Talk Time chip and arbitrary text targets — October 17, 2026

User supplied a real MirrorTalk chip: direct `Talk Time` text followed by a nested decorative SVG, with `aria-pressed=true`. Its single text run was already detectable in Edit; regression tests reproduced missing host-text editing in Interact and document modal focus traps stealing inline-editor focus.

Changes:
- Double-clicking eligible existing host text in Interact enters Edit and opens inline editing. Native input text selection and contenteditable editors retain their own behavior; replay/closed modes do not start edits.
- Wandel's own focus events are isolated from document-level app focus traps while authoring. Application focus events outside Wandel are unchanged. Editor focus listeners are cleaned up with the editor.
- Formatted text containing multiple text runs can target the clicked run using DOM caret hit testing and a bounded serialized `textPath` locator. Renderer and validation use the same path; save/load and undo retain nested formatting instead of flattening the element. Missing/unsafe paths fail rather than editing another run.
- Browser testing found insertion handles/toolbar stealing clicks on adjacent text. Plain-text selections now use the bottom toolbar and omit insertion handles; Add remains available on the toolbar. Resize and editing actions remain available.

Verification: 220 full-suite tests passed, standard/free builds passed, whitespace check passed. New cases cover the supplied chip in Edit and Interact, SVG identity/state preservation, label/div/span/p editing, modal focus trapping, mixed-format text, undo/save/load, and native input behavior.

Real browser: http://127.0.0.1:5173/demo/fixtures/chip-editor.html uses the supplied chip markup and an active document-level modal focus trap. Talk Time → Feedback length retained its checkmark and aria-pressed; label/div/span/paragraph were edited individually. Evidence: `docs/chip-text-acceptance.png`. Mixed-format run targeting has automated coverage; live MirrorTalk acceptance is still pending. Existing Chrome content scripts require reloading the unpacked extension and refreshing the host page after preserving the session draft.


## J1 completed in the browser; private beta candidate prepared — October 17, 2026

**Local browser checkpoint passed; installed release gate stays open.** Created Risk Analysis Flow — v1 through normal on-page UI controls at `http://127.0.0.1:5173/?journey=risk-beta`:

1. Selected Customers and prompted Add Risk Analysis beside this.
2. On click → New state Risk Analysis.
3. Prompted Add View Details inside this; On click → Details.
4. Prompted Add Approve inside this; On click → Confirmation.
5. Prompted Add text called Approved inside this.
6. Saved version 1, reloaded the page, restored the saved flow, started Try flow and clicked Risk Analysis → View Details → Approve. The active state reached Confirmation and the actual Approved text was visible.
7. Exported through Share & playback. The export has four states and three edges. Export contains a copy of the current workflow, not its immutable version history.

Evidence: `docs/acceptance/risk-analysis-flow-v1.wandel.json` and `docs/acceptance/risk-analysis-v1-replay.png`. Uses fictional demo customer data, BrowserStorage, bounded local prompts and no AI request. This is not an installed-Chrome restart test, a cloud save, or an arbitrary-app compatibility claim.

Prepared `releases/wandel-local-beta-0.2.0.zip` from current dist-free. ZIP root/CRC, referenced runtime files, allowed asset extensions and manifest checks passed. Name carries BETA; description declares beta purpose. No cookies/host_permissions/external sign-in bridge; CSP connect-src none. Package SHA-256: `98f3010c3a1e21595a7a66fea1b6a803e2fb0e07ee08d6e4e1aae1243b475aeb`. Per-file hashes and source HEAD/dirty-tree status are in the adjacent manifest JSON. The source checkout has uncommitted changes; this is a candidate snapshot, not a clean tagged release or complete security audit.

Next: install this exact package in a clean Chrome profile with local servers stopped; complete J1 on an agreed live application; quit/reopen Chrome and restore/replay; verify export/import, host restoration and update behavior. Then finish developer account, privacy/support pages, listing/screenshots, permission explanations and reviewer instructions and submit privately. No store upload or publication performed. A private beta still requires Chrome review. See the updated release checklist for official sources and Private vs Unlisted details.


## Visual connections and conditional navigation — October 17, 2026

Implemented a non-AI Connect → editor for buttons, links, role buttons, checkbox/radio controls, dropdowns and text inputs. Source and destination previews appear side by side. Choose a saved prototype state (visited states marked during the session) or name a new child view, then edit that destination recursively.

Triggers: click, value change or Enter, filtered by control type. Rules support up to eight AND conditions: checked, unchecked, filled, native validity or exact value. Checkbox/radio connections default to requiring checked. Otherwise can stay and show feedback or open another saved state. Missing condition targets fail with feedback instead of taking a fallback. Reconnecting is undoable and saved edges retain their conditions; existing unconditional edges remain compatible. Test connection starts replay at its source; host actions are intercepted for mapped prototype controls. No AI or account is needed.

Browser acceptance: selected Continue; created Account details; picked Terms checked and Email valid; connected and tested. Incomplete values stayed with feedback; a valid fictional email plus checked Terms opened Account details. Saved locally, reloaded, restored, reopened Connect and verified both conditions and the destination remained. Editing the destination was also verified. Fixture: http://127.0.0.1:5173/demo/fixtures/connections.html. Evidence: docs/acceptance/visual-connections.png.

Validation: 236 tests passed across 23 files, standard/free/platform builds passed, whitespace check passed. Automated regressions cover fallback/missing fields, checkbox/radio labels, Enter/dropdown changes, atomic validation/undo, preview privacy, bridge capability detection and account API persistence.

Scope: destinations are Wandel prototype states. This does not capture arbitrary browser history or reconstruct a live application's internal state. Previews are bounded read-only references to prototype content, not fully interactive copies. Entered field values are evaluated during replay and are not persisted as captured user data. One rule per source with optional otherwise; arbitrary Boolean expressions, multiple competing rules and cross-origin app navigation are not included.

Prepared releases/wandel-local-beta-0.2.1.zip, SHA-256 8eb022d02034c117d36b06a1278e1dd04fae2c6d067b221c9729e8dcbb0dc2c3. Local-only BETA manifest, ZIP integrity/runtime asset checks passed; adjacent manifest records hashes and dirty source revision. Previous 0.2.0 candidate retained. No Chrome upload or publication. Installed Chrome/MirrorTalk/Maeris acceptance, restart and update preservation remain open. Export existing drafts before replacing an unpacked build, then refresh the host page to load new content scripts.


### Connections moved into the Wandel toolbar workspace — October 17, 2026

Replaced the narrow right-side dialog with a wide bottom-docked Wandel workspace. Source/destination previews sit beside rule controls at desktop widths; narrow windows stack the content without horizontal clipping. Header actions remain outside the scrolling body: Collapse, Expand/Fit workspace and Back to editing. Test/Connect remain in the fixed footer. Collapse preserves the current source, destination, conditions and unfinished title in memory and leaves an always-visible Open connections toolbar action. Escape collapses first; a second Escape closes. Picking a field temporarily collapses the workspace; Cancel field selection restores it. Closing returns the ordinary element toolbar.

Browser-verified restore → open → collapse → reopen → expand → pick field → cancel → collapse. Evidence: docs/acceptance/connections-toolbar-collapsed.png. Automated coverage verifies draft retention, workspace structure, expansion, Escape and return to the editing toolbar. All 237 tests passed; standard/free builds passed; diff whitespace check passed. The existing 0.2.1 ZIP is the previous snapshot; current dist/ and dist-free/ contain this toolbar update. No installed Chrome or real-site acceptance claim for this update.


### Connections now use the actual Chrome side panel — October 17, 2026

Supersedes the previous bottom-dock implementation for installed extensions. The reported screenshot exposed two distinct problems: connection controls were opening over the application, while a full cloned modal dominated the preview and displaced the destination picker. Installed standard/free builds now publish a transient connection workspace to the existing Chrome side panel. The connection screen replaces the normal account/project/prompt screen rather than appearing alongside it. No host modal is cloned. The page keeps its selected control; the panel shows its name, trigger, destination selector/new screen name, conditions, fallback, and fixed Test/Connect actions. Back to editing and Escape return to the normal panel. Escape while picking cancels field selection. Saved destinations expose Edit destination screen for recursive authoring.

Content remains responsible for source identity, field picking and bounded rule validation. Authoring state is transient and excluded from saved workflow records. A new connection-panel-v2 capability gate catches old page scripts before panel commands. The extension requests the panel only after a user clicks Connect; if Chrome rejects the gesture, an on-page message directs the user to the extension icon. Unrelated/new tabs remain closed.

Browser acceptance uses the same Connections React component, Session and bridge shape at demo/fixtures/connections.html. Selected the Terms checkbox, opened Connect, named Feedback settings, connected and tested; checking Terms reached Feedback settings. No account, AI or external app mutation. Evidence: docs/acceptance/connections-right-panel.png. Small windows show a full-width panel; desktop windows keep it on the right. Native installed Chrome/MirrorTalk acceptance is still pending; preserve/export the current draft, reload the installed extension, then refresh the application to load both updated panel and content scripts.

Validation: 241 full-suite tests passed; standard/free builds passed. New coverage includes transient panel transport, source preservation during field picking, connection save/test, React panel destination controls, stale-script rejection and authenticated tab-specific panel opening with gesture-error handling. Final focused tests also cover panel Escape cancellation. Existing ZIP candidates remain historical snapshots; dist/ and dist-free/ contain this update.


## Visited route thumbnails and a live destination browser — October 17, 2026

Implemented the clarified journey: keep the source control pinned, choose a thumbnail from screens visited while Wandel was active, or open a companion application browser and navigate to a new screen. The Chrome side panel keeps the source connection and shows captured routes, automatic heading/title names, layout thumbnails, current destination preview and a Use this screen as destination action. The companion is a real Chrome popup window with its own navigation, not a remote app iframe. The source tab is not navigated. Activation in a different window no longer disconnects its authoring bridge.

Tracking starts only for explicitly activated Wandel source tabs and their companion; it does not query browser history. Top-frame navigation/SPA route events update the gallery. Same-route modal/content changes can be refreshed; Use this screen always refreshes before selecting, preventing stale destination capture. Cross-origin navigation, protected/auth-token URLs, access denial, oversize payloads, mismatched navigation and storage failures produce explicit errors and retain the existing gallery. A free build may require clicking the extension icon in the companion to grant site access before capture. No new permissions or header/security-policy bypass was added.

Screens have locally generated PNG layout thumbnails (not photographic screenshots) and bounded editable DOM captures: at most 800 nodes, scripts/handlers/entered field values/contenteditable contents/remote images excluded, oversized pages marked partial. Eight recent screens are retained in trusted session storage with a 3 MB gallery budget and a 900 KB per-screen payload cap. Only screens explicitly connected are copied into the workflow and its saved versions. Saved captures retain thumbnail/route metadata and remain selectable after restart or export/import. Captures simulate a prototype; the application's backend, listeners, canvas and embedded documents are not reconstructed.

Selection is provisional. Connect atomically adds the captured destination and edge; Cancel adds nothing; Undo removes both together. The destination is editable through the normal editor and can be extended recursively. Saved screen thumbnails also appear in Prototype screens when restoring a saved workflow.

Browser acceptance at demo/fixtures/connections.html: selected Terms → Connect → Browse live app; Home appeared in the route gallery; navigated companion to the existing Settings fixture; refreshed and saw its Settings thumbnail and route; used the current screen and connected it to Terms. Saved locally, reloaded, restored, started Try flow and checked Terms. The captured Settings screen rendered its heading, Notifications checkboxes and Light/Dark buttons. Source route stayed unchanged. Evidence: docs/acceptance/visited-screen-gallery.png. The fixture uses the production capture, model, connection, renderer, storage and React panel; its live browser adapter uses same-origin local fixture pages instead of Chrome extension APIs.

Validation: 250 tests passed before the additional cloud-capture persistence test; standard/free/platform builds passed. Coverage includes safe capture, replay/edit/save/load, atomic cancel/undo, cross-app rejection, stale previews, companion/source isolation and session-gallery restore. The local API was rebuilt and restarted on port 4320 to accept captured screens. Installed-extension acceptance on MirrorTalk/Maeris is still pending. Existing beta ZIPs are historical snapshots; dist/ and dist-free/ contain this feature.

Final persistence check: the additional captured-screen cloud save/load test passed (24 targeted platform/gallery checks). Final browser replay evidence after reload is docs/acceptance/visited-screen-replay.png. Whitespace check passed.


## Connection strings, selected targets and failed-save feedback — October 17, 2026

User reported choosing a destination without a visible string or successful Connect feedback. Added a live page-to-panel connection string: dashed violet while selecting, solid green once the edge is saved. It follows the source's geometry during scrolling/resizing; the panel reports the selected thumbnail or sticky mapping summary as its endpoint. Chrome page and panel each draw their half, joined at the boundary. Selecting a thumbnail adds a visible outline/checkmark. A fixed source → destination summary, route, Connected status and Test action stay beside Connect; errors are now in this footer, retain the selected target and reject the caller instead of appearing only below the form. Busy state disables duplicate submission. Close/replay/navigation removes the wire and cancels animation. Existing extension scripts are gated by connection-wire-v3 to prevent panel/content version mismatch.

Fixed concrete logic defects: CopyNode parent indices still stopped at 149 even though captures allowed 800 nodes; the parent bound now matches the validated 800-node tree. Returning to an already connected source tab no longer tears down/reopens the port and pauses the pending connection. Returning to an already active tab avoids unnecessary activation. Generated checkbox labels now use their enclosing label, so Show profile is identified by name rather than input.

Regression coverage creates a generated Show profile checkbox, selects a captured screen with parents beyond index 149, and confirms a saved edge. Other checks cover retry retention after failed saves, string geometry/anchor/saved color/cleanup, and source-port retention. Full suite: 255 tests passed. Standard/free/platform builds passed; local test server 5173 and rebuilt API 4320 were restarted because both were stopped. The API uses the corrected parent validation too.

Browser acceptance in an isolated wide fixture: restored a workflow, opened Terms → Connect, selected the saved Settings thumbnail, verified the dashed source-to-thumbnail string, clicked Connect and verified solid green + Connected + enabled Test. Test followed by checking Terms rendered the captured Settings view. Evidence: docs/acceptance/connection-string-pending.png and docs/acceptance/connection-string-connected.png. These are local production-component checks; the updated installed Chrome/MirrorTalk flow remains to be verified. Export any existing draft before reloading the extension, then refresh the host page to replace its old content script.

## Save connection → Interact → destination — October 17, 2026

Corrected the mismatch between Interact and Try flow: explicit prototype connections now run in both modes. Checkbox/radio choices (including label clicks), dropdown changes, Enter and mapped button/link clicks use the saved event and conditions. Unmapped host actions retain normal Interact behavior; mirrored host-action forwarding remains restricted to replay. Entering Interact does not automatically fire connections for already checked fields: the user changes the control to trigger its rule. Checked/unchecked rules are saved; transient form values are not persisted as defaults.

Successful Connect closes the connection workspace, removes its wire, returns to the editor and shows a four-second accessible “Connected. Switch to Interact to use it.” toast. A failed save keeps its destination and conditions open for retry. Workflow saving remains a separate action. Panel copy now explains that saved connections work in Interact and labels replay as starting from the beginning.

Acceptance: browser fixture selected Terms, configured an Is checked → Profile connection, saved, verified the workspace/wire disappeared and confirmation toast appeared; switched Interact and clicked Terms; Profile became the current view without entering Try flow. Evidence: docs/acceptance/connection-saved-toast.png and docs/acceptance/connection-interact-profile.png. Regression tests also cover a generated Show profile checkbox, save/load, label activation, unchecked staying at source, and unrelated host controls remaining usable. Full suite passed 258 tests before adding the additional dropdown/Enter Interact case; targeted follow-up and standard/free builds passed. Installed Chrome/MirrorTalk acceptance still needs the rebuilt extension loaded; captured destinations render a local prototype rather than navigating the live application's backend.

## Floating Wandel panel and finishing destination browsing — October 17, 2026

The main panel, free panel, connection workspace and page toolbar now expose Minimize. Minimizing checkpoints the workflow before hiding the panel and leaves a compact bottom-right Wandel control with Reopen and Close. Page selection is suspended while minimized; the draft and unfinished connection remain in memory. Expected panel disconnection no longer pauses/restores the original page. Reopening resumes the existing mode, selection and pending connection instead of forcing Edit. Explicit Close still restores the host page and retains the saved draft. Failed checkpointing leaves the full panel available. This is an explicit Minimize action, separate from Chrome's native panel close button.

Destination browsing now has an isolated floating toolbar directly in the companion app window: “Use this screen & close” captures the current screen, selects it in the original connection workspace, closes only the tracked companion tab, then focuses the source. “Cancel & return” closes browsing without changing the destination. Source-side Use also ends the browser session. Capture/selection failure keeps the browser open and displays a retryable error. Controls isolate their events so clicking them does not dismiss the application's modal through document outside-click handlers. Browser ownership is checked against the sending tab; session storage retains its source mapping across worker restart. Closing the source cleans up its tracked companion.

Validation: 267 tests passed; a targeted toolbar event-isolation follow-up passed; standard and free extension builds passed. Browser fixture verified minimize → floating control → reopen, selecting a current live screen → companion ends → destination stays selected, and minimizing/reopening that unfinished connection. Evidence: docs/acceptance/wandel-minimized.png and docs/acceptance/destination-browser-finished.png. The fixture uses the production controls with a local browser adapter; native Chrome side-panel open/close and companion toolbar acceptance require reloading the rebuilt installed extension and refreshing the host page. No services or environment keys changed.

## Header polish and page shortcut corrections — October 17, 2026

Minimize is now a compact SVG icon with hover/focus styling, grouped at the right beside the green status dot in the account, free and Connections headers. The demo header logo also resolves correctly on nested fixture routes.

Corrected keyboard guards that treated an entire role=dialog subtree as text entry and blocked focused checkboxes/buttons. E/I/V now work on non-text controls inside application dialogs. In Edit, a selected host form control can receive Duplicate, Delete, style-copy and undo shortcuts even when it holds focus. Actual typing in Interact fields, unselected fields and Wandel's inline editor retains normal keyboard behavior. Explicit Wandel shortcuts no longer silently defer just because a host handler marked the event prevented. Mode shortcuts also restore the panel when minimized before switching mode.

Browser acceptance: in the Advanced dialog with a document-level modal focus trap, pressed I on Talk Time and saw Interact; pressed E, selected Talk Time and pressed Cmd+D; an independent button appeared with its text selected in the inline editor. Evidence: docs/acceptance/dialog-duplicate-shortcut.png. Header evidence: docs/acceptance/panel-header-minimize.png. Regression tests cover the focused dialog button, checkbox mode keys, selected email-field duplication and preserving real text input. Installed Chrome still requires reloading the rebuilt extension and refreshing the host page.

## Existing app route → scoped edits → Back — October 17, 2026

**Implemented and verified in the local browser; installed Chrome/MirrorTalk acceptance is pending.** Connections made from visited-page thumbnails now create live URL states. They open the real page in the originating tab instead of reconstructing captured HTML. Generated prototype screens remain separate and can be added recursively from a live state. Old captured/empty prototype states are retained; reconnect the actual visited page once to replace an old blank-copy connection.

The transition checkpoints the workflow first. A validated, tab-bound handoff stores only workflow/state IDs, navigation history, mode and dialog titles in Chrome session storage; it carries no entered form values. The destination content script restores that workflow and applies only that page's operation lineage. Ancestor source edits are excluded at live-page boundaries, and a route guard prevents applying a state to a different page. Refresh, browser Back and BFCache restoration recognize the handoff. Interact offers a visible Back action; selecting states or restarting replay also navigates when necessary. Closing Wandel clears the active handoff. Unrelated routes stop restoration. Invalid targets or failed navigation keep the saved workflow and source state available. An outdated content script is rejected before a new live connection is saved.

Native dialog restoration is best effort: an unambiguous existing button matching the recorded dialog title can reopen it; otherwise Wandel explicitly asks the user to reopen that dialog. This is not a general recorder of arbitrary application UI history. Existing app controls retain their real functionality and can perform real actions; generated controls still run local prototype behavior. Live workflows require the recipient's own app access; standalone screenshot/hotspot playback is not part of this checkpoint.

Browser acceptance: Terms checkbox → Browse live app → Settings visited page → Use this screen & close → Connect → Save v1 → Interact → check Terms. The browser navigated to /demo/fixtures/app-settings.html and showed the native navigation, Notifications fields, Appearance buttons and page text, without a “Prototype state” wrapper. Edited Settings to “My settings,” saved v2, returned using Back, checked Terms again, then reloaded the destination. The edit, workflow, mode and native content survived. Evidence: docs/acceptance/live-route-destination.png and docs/acceptance/live-route-return.png. This uses the production session/model/renderer with a browser-native local navigation adapter; installed Chrome uses a tab-bound background adapter.

Validation: 277 tests passed in the full suite; the additional recursive live-page → generated-screen → Back regression passed in a targeted follow-up. Standard/free/platform builds passed. The local API on port 4320 was restarted with the updated workflow validator. No environment keys or database migration are required.

To test on MirrorTalk: export any important current draft, reload the unpacked extension from dist/ (or dist-free/ for the local build), refresh the app, reopen the source dialog, select the checkbox, and reconnect using the actual visited Profile thumbnail. Save the workflow, switch Interact and check it. Expect the real profile route and native page content. Use Wandel's Back to return; if the original dialog cannot reopen automatically, follow the explicit prompt to open it. Verify profile edits and the connection after saving and reopening. A prior blank prototype card is not automatically converted to a live route.

## Git checkpoint — October 17, 2026

Prepared the current implementation, fixtures, tests and acceptance evidence for the Wandel repository. Final pre-push validation: 278 tests passed across 32 test files; whitespace checks passed. Local environment files, databases, generated builds and release archives remain excluded. A configured-secret comparison found no exact secret values in candidate source/document files. Native Chrome/MirrorTalk acceptance and public release readiness remain as described above.

## Deployment startup repair — October 18, 2026

Fixed the startup crash when WANDEL_DB points into a missing directory. The database helper now creates the configured file's parent directories recursively with restricted permissions before opening SQLite; in-memory/temporary databases retain their existing behavior. Invalid database URLs fail with a clear SQLite file-path requirement. Production no longer creates the unrelated development .data directory when a custom volume path is used. Existing database contents are retained and migrations still run once.

Container startup now listens on 0.0.0.0 in production, supports hosting-provided PORT, and allows WANDEL_HOST overrides. Explicit WANDEL_PORT takes precedence; otherwise PORT, then 4320. Local defaults remain 127.0.0.1:4320. Updated .env.example and the deployment checklist.

Verified the compiled server using isolated production settings, a nonexistent nested database directory, a dynamically chosen PORT and a temporary working directory. Startup created the SQLite file, applied migrations and returned HTTP 200 from /api/plans. Unit regressions also cover reopening persistent data, in-memory operation, invalid paths and bind/port settings. All 283 tests across 33 files and the platform build passed. Deployment must still mount a writable persistent volume and set WANDEL_DB to a file within it; creating a folder does not make container storage durable. No production deployment was accessed from this chat.
