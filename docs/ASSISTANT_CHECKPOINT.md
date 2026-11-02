## Native card reference correction — 2026-10-19

The previous duplication shortcut recognized semantic heading tags but rejected confirmed cards whose titles were styled divs/spans. Card detection, context capture, highlighting, grounding and execution now share structural card detection. Context includes a short heading for each identified card while retaining the exact element ref. The duplicate contract also carries an explicit optional description, so title, subtext and CTA labels are replaced together without rebuilding the card or copying host handlers.

Regression/browser request: `Yes - duplicate it with heading "Feedback & Support" and the sub text is for feedback please click on create and call the button inside as "Create"`. Evidence: `docs/acceptance/native-card-exact-request.png`. Verified against nested div/span markup, source preservation, style preservation, undo, and the prior semantic-heading fixture. Installed MirrorTalk acceptance remains to be checked.

## Conversation checkpoint — 2026-10-19

Implemented and tested: identify/highlight a card → retain its reference → duplicate with requested heading/CTA → connect a known route. Unknown routes use the destination browser and require captured-screen confirmation; ambiguous controls show options. Bounded chat context follows the workflow in the panel session. Setup/privacy details are collapsed, request timeouts restore editable instructions, and optional live browser dictation falls back to WAV transcription.

Browser evidence: `docs/acceptance/conversational-card-editing.png` shows the real App/Session operating on `demo/fixtures/conversation.html`. The typed conversational path was verified in the browser. Microphone hardware, browser dictation service availability, and full installed-extension acceptance on MirrorTalk remain to be verified. Native backend functionality is not copied from third-party applications.

# Conversational assistant checkpoint — October 18, 2026

> **October 19 update — unified extension:** the voice/conversational assistant is now part of regular Wandel. Run `npm run build` and reload `dist/`; choose **Voice assistant** beside Imagine a feature / Edit this page. `npm run build:assistant` is now a compatibility alias for the same build, with no separate package, name or extension identity. Do not run an older Assistant Beta alongside it. The isolated-build instructions below are historical and superseded by this update.
>
> Server voice/context endpoints are enabled by default, with existing authentication, consent, size/rate/credit limits. `WANDEL_ASSISTANT_ENABLED=false` is an optional server kill switch. OpenAI credentials/model and functioning account sign-in are still needed for cloud requests. No microphone starts just by opening the panel. The separate offline/free build stays network-free.
>
> Validation: 362 tests; regular/free/platform builds. A browser check of the regular App and default Session verified voice discovery, Hold to speak, offline conversational rename and Undo without a beta flag. Microphone hardware/provider acceptance in installed Chrome remains pending.

Branch: `codex/context-aware-assistant`. Base: `30c810d`. This is an isolated working slice, not a public-release sign-off. Main, existing beta builds, deployment and environment files were not changed.

## What is implemented

The assistant uses the real selection, renderer, history, workflow graph, persistence and export/import paths. A bounded context collector combines explicit selection (preferred over hover), nearby semantic elements, actual computed styles, recent created elements, a pinned style reference and known views. Short-lived handles are revalidated against semantic locators; navigation or a changed workflow invalidates a pending plan. Accessible open shadow roots are supported. Hidden/disabled/private targets are excluded.

Typed commands and push-to-talk transcripts enter the same interpretation, grounding and execution pipeline. Common explicit instructions run locally. Other typed phrasing uses authenticated OpenAI structured output directly in Chat & voice, with scoped sharing disclosed in settings; voice still requires explicit recording permission. Plans have a strict allowlist and compile into ordinary reversible workflow operations; arbitrary HTML, scripts and real host handlers are not accepted. A failed transaction restores the preceding workflow and DOM. Missing labels, destinations or ambiguous styles produce clarification rather than invented controls or a guessed target.

Supported actions in this slice: create button/text/simple field/panel, matching single-select pills, text, styles, delta movement, removal, default selection, connect a control to an existing prototype view or an explicitly requested blank view, undo/redo and opening the existing save chooser. Every new view can be edited using the same assistant. Existing visual tools remain accessible from a compact on-page toolbar.

## Test the isolated build

1. Run `npm run build:assistant`. Load **dist-assistant/** as an unpacked Chrome extension. Its name is **Wandel — Assistant Beta** and it does not reuse the main extension key. Do not replace the main beta's dist/ installation.
2. Disable the other Wandel extension on the test page to avoid two editors capturing the same clicks. Reload the page, then open Assistant Beta from Chrome's toolbar.
3. Local text commands work without an API. For cloud interpretation/voice, run the branch's platform build with `WANDEL_ASSISTANT_ENABLED=true`, existing `OPENAI_API_KEY` and `OPENAI_MODEL`, and optionally `OPENAI_TRANSCRIBE_MODEL` (default gpt-4o-mini-transcribe). Existing API origin, Clerk and quota configuration still apply. Sign in using this extension; add its distinct extension origin to the existing auth allowlist if required. Never put secret keys into extension/browser environment variables.
4. No environment values were changed here. The default server keeps these new endpoints disabled. A deployed main server does not gain them until this branch's server is deliberately deployed/enabled.
5. A synthetic browser fixture is available at `/demo/fixtures/assistant.html` on the Vite server. It uses the real Session and AssistantPanel, not a mocked editor. Its Save locally control is a test shortcut; the installed panel uses the existing save chooser.

### Acceptance journey

Open the source application's dialog, activate Edit and select a heading above native controls. Example labels below are acceptance inputs, not application-specific logic:

1. Select Metrics: **Add a Feedback length option below this.**
2. Select an existing pill: **Match this style. Give me Concise, Normal, and Elaborated.**
3. **Make Normal selected by default.**
4. **When someone selects Elaborated, show a detail view.** If no destination exists, answer **Create a blank detail view.**
5. **Change the detail view heading to Advanced Feedback.**
6. **Undo that last change.** Only the heading change should reverse.
7. Save using the existing chooser. Try flow, select Elaborated, then restore the saved workflow and repeat.
8. Export the .wandel.json file. A recipient needs this assistant branch's runtime, their own access to the original application, the matching page/dialog, and Import → Try flow. No creator credentials are included.

For buttons: select a heading, ask **Add two buttons below this heading**, then supply **Continue and Back** when asked for labels. Follow with **Make the second one green**, **Make both smaller** and **Move them right 12 pixels**.

For voice, first enable scoped sharing, use **Set up microphone** if Chrome needs permission, then click **Start speaking**, speak one instruction, and click **Stop & send**. Microphone use is explicit, capped at 20 seconds and visibly indicated; Cancel discards a pending recording/request. Permission failure leaves text usable. Actual microphone acceptance on installed Chrome is still pending.

## Validation and evidence

Final validation: **334 tests across 41 files passed**. TypeScript, isolated assistant extension build, platform build and whitespace checks passed.

- Automated coverage exercises the native category/default/detail/undo/save/export/fresh-session replay journey and a differently structured pricing page, plus selection ambiguity, style ambiguity, missing labels/targets, re-rendering, navigation, shadow roots, hidden/disabled controls, iframe limitations, malicious page text, atomic rollback, auth/quota/idempotency, payload/audio limits, cancellation and UI clarification.
- Browser fixture acceptance exercised category placement and native pill styling, default selection, destination clarification, detail-view editing, undo, local save, playback transition and restore. Screenshot: `docs/acceptance/assistant-native-category.png`.
- Real configured-provider checks succeeded with a synthetic heading/edit request and synthetic audio saying “Make the second button green.” These verify the Responses structured-output and audio transcription contracts. No production page data was sent.
- Production MirrorTalk and Maeris, a second human's installed extension, cross-viewport real-site replay and a real microphone have **not** been verified in this checkpoint. Fixture/provider success does not establish those acceptance results.

## Privacy, storage and cost

Typed chat routes through the configured AI service. Requests include the instruction, up to 24 recent conversation messages with delivery outcomes, up to 160 prioritized DOM elements (within a 140 KB element budget), regions, groups and edit memory. Chrome supplies a redacted viewport screenshot when capture is available. Form controls, marked private regions, frames and editor overlays are masked locally before upload. Explicit reference images are separately identified. Cookies, query strings and typed field values are excluded from DOM context. Screenshot and text redaction are best-effort protections, not a guarantee that all confidential content is detected. Before/after screenshots can be reviewed by the AI after DOM checks; a rejected visual result is rolled back using a workflow-revision guard before any repair. If screenshot capture/review is unavailable, the completion explicitly states that limitation. No automated tests were run for this pipeline change; build validation is not browser acceptance.

Audio is not persisted by Wandel. Sanitized transcription text and validated plans are cached in the existing ai_actions table for request idempotency; they inherit that database's retention and deletion behavior (no new automatic expiry is introduced here). OpenAI Responses requests set store:false; provider policy and any account-specific retention terms still apply. Ordinary workflow saves retain the UI text/styles/graph required for replay as before. This slice does not persist a raw conversation or raw DOM snapshot.

Each successful cloud plan or transcription consumes an existing AI action. A voice command requiring cloud interpretation can consume two actions. Failed provider/validation requests are marked failed and excluded from billed action usage. Rate, instruction, context, output and audio bounds prevent unbounded requests. Cancel prevents a late edit but cannot guarantee cancellation/refund of a provider request already accepted by the server.

## Boundaries and remaining work

- This is DOM/style grounding with speech transcription, not screenshot vision or an autonomous browser agent. Frames (including same-origin) and closed shadow roots are not inspected. Unusual framework portals and complex custom controls require real-site testing.
- Appearance is copied selectively; arbitrary custom hover animations and host business behavior are not replicated. Generated choices run prototype-only selection/navigation, not application saves or backend operations. Arbitrary show/hide, route creation from conversational URLs and complex layout rearrangement are outside this slice; use existing visual Connections where supported.
- Free-form language outside local shortcuts requires configured cloud service and auth. There is no guest voice endpoint or offline speech recognition.
- Selection handles, conversation memory, transaction labels and undo history are session state. Resulting ordinary workflow definitions and versions use existing persistence. This does not change the standard build's temporary-save lifetime.
- No persisted workflow schema was changed. Derived choice control IDs are now recognized as graph sources; older main runtimes/servers do not recognize those new connection sources. Share these new flows only with matching assistant runtimes until this validator support is deliberately merged/released. Existing saved workflows continue to validate.
- Broad existing extension permission and store/privacy review remains a release task; this branch adds no Chrome permission or remote executable-code loading. The separate build's changed extension ID needs normal Clerk/API-origin setup.
- Before merging: installed-Chrome MirrorTalk category journey, actual microphone test, recipient replay with missing targets/another viewport, and review of privacy disclosures and rollout configuration. The final attachment ends at “STAGE F: JOURNEY INTEGR”; no omitted requirements were inferred.

## 2026-10-28 selected-card duplication follow-up

- Exact requests: “can you add another card like the one selected ?” and “duplicate the selected”. The referenced unit is MirrorTalk's outer Select Group card, including nested wrappers, icon and labels.
- Chat duplication now copies the referenced node directly instead of requiring a button/link-based card heuristic. Optional heading changes use the same text-preserving rule as manual copying. Stable unique element IDs take precedence over matching descendant text.
- Observed in the actual installed Chrome/MirrorTalk tab after the first fix: `Preview could not be applied: New element: hidden control; inspect the containing section.` The first fixture success did not establish installed-site success.
- Follow-up: visual capture omits hidden branches and hidden inputs. Layout validation checks a copied unit and its actionable descendants, rather than treating empty spans, line breaks and layout wrappers as failed controls. Those descendants remain individually editable. An actual zero-width button still fails and rolls back atomically.
- Regression coverage includes the exact chat request, direct assistant duplicate execution, a div-only card, the outer wrapper, heading changes, repeated copy, Undo, save/restore, private subtrees, hidden helpers and browser-like nonzero/zero element dimensions.
- Verification: 483 tests across 62 files passed; standard and free builds passed. Browser fixture with hidden branches and empty inline markup succeeded. Evidence: `docs/acceptance/card-copy-layout-validation.png`.
- Installed MirrorTalk acceptance of the follow-up remains pending extension reload and real-page verification. Do not describe the installed journey as verified based on fixture/test results.


## 2026-10-28 conversational layout foundation

- Typed chat uses AI directly; removed the repeated Use AI request gate. Voice retains its separate microphone/sharing flow. Authentication, bounded payloads, rate/credit limits, and excluded private fields still apply.
- Current instruction and recent history are separate API fields. History retains failed/stopped outcomes and excludes in-flight messages. Applied edit summaries and recent-object memory are shared with native duplication/manual changes. Copied heading identity supports styled div/span cards.
- Context includes the selected object's parent/siblings/descendants. An inspect plan can request more scoped DOM detail, for at most two enrichment rounds. This is bounded DOM/style inspection, not screenshot vision.
- Style operations now cover flex/grid alignment, wrapping, grid columns, spacing, typography, palette colors, borders and shadows. Reorder moves existing elements before/after/inside a grounded destination and restores their original position on Undo.
- Compound plans may name new results and reference their copied descendants in later steps. Duplicate placement is honored. These operations persist through the existing workflow save/export path. Older runtimes will not understand the new reorder operation; use matching server/extension builds.
- Validation discards fields irrelevant to the action instead of demanding new control labels for a layout edit. New UI copy can be inferred when the user asks for a design. Invalid schema/reference plans get at most one internal planning repair before any execution.
- Automated coverage includes continuous copy/layout/theme/Undo conversation; compound duplicate/theme/reorder/connect; save/restore; native copy memory; generated descendant references; context expansion; cancellation and changed-selection protection. Opt-in real-provider acceptance sends only synthetic cards and checks vertical stacking plus a themed copy placed before its source.
- Actual installed MirrorTalk/Maeris conversation acceptance still needs the updated local API and extension runtime. No production deployment or push is implied by these local changes.

- Final verification for this checkpoint: 497 regular tests passed; the opt-in synthetic real-provider acceptance also passed separately. Standard extension, free extension and platform builds passed. The final local API was restarted with OpenAI enabled.
- Browser proof replays that real-provider workflow against the same synthetic content: `demo/fixtures/designer-proof.html`, `docs/acceptance/designer-provider-workflow.json`, and `docs/acceptance/designer-layout-theme.png`. This is evidence for the synthetic journey, not installed MirrorTalk acceptance.
- `copySource` is reconstructed from saved operations, so follow-ups can resolve the original of the selected copy after other edits and reload. Matching page runtimes advertise `designer-layout-v1`; stale content scripts are rejected before planning/applying these new operations.

## Page-level design context — 2026-10-28

Selection is optional for conversational design. The bounded collector now includes page landmarks/spatial navigation, repeated card groups and their shared layout containers, plus surrounding layout and computed positioning. Local deictic shortcuts no longer steal explicitly described navigation/layout/theme or named typography requests. Grounding uses unique scene groups/regions and related layout nodes; competing card groups return conversational candidates. The composer labels selection as optional context rather than a mandatory target.

The shared style contract and provider schema support safe positioning/insets, full inline size, automatic block size and box sizing, so moving a fixed sidebar to a horizontal header can preserve its links while resetting content offsets. Standard and free extension builds include the same renderer. `designer-scene-v1` prevents an updated panel from planning against an older content script.

Verification: 501 regular tests passed, two opt-in real-provider tests passed (no selected target for stacked cards, named duplication/theme and sidebar-to-header). The header case was captured again for browser verification. Synthetic actual-provider records and replay fixtures are `docs/acceptance/designer-provider-workflow.json`, `docs/acceptance/designer-header-workflow.json`, and `demo/fixtures/designer-header-proof.html`. Standard/free/platform builds passed. No installed MirrorTalk transformation or production deployment is claimed by these fixture checks.

### Broader acceptance verification correction — 2026-10-28

The earlier two synthetic success cases do not establish reliable general page editing. A broader no-selection fixture containing fixed navigation, main content, and two cards exposed four acceptance failures:

- Theme: both the original request and an explicit blue whole-page follow-up produced edit plans that grounding converted to `Select the target you mean`; no operations applied.
- Navigation to header: navigation became horizontal/static and its wrapper became a column, but the main area's 220px sidebar margin remained. The model's no-overlap claim was not satisfied.
- New header with links: the full server pipeline (including its automatic repair attempt) first returned a target clarification, then HTTP 400 on the explicit Contact us /contact and About /about follow-up. No header or links were added. The current action contract lacks native header/link creation and href destinations.
- Vertical/horizontal page: both model plans were blocked by grounding's target requirement. No rearrangement applied.

`tests/designer-requests.acceptance.test.ts` is opt-in (`WANDEL_RUN_DESIGNER_ACCEPTANCE=1`) and intentionally retains the unmet acceptance assertions. Per-case synthetic plans, results and DOM evidence are in `docs/acceptance/verified-request-*.json`. The initial four-case actual-provider run failed all four acceptance checks; the header case was additionally verified through the real account/API/repair path with an in-memory test account. These verification runs did not change application behavior or deployment. Do not describe these four broad requests as working until their acceptance checks pass.

### Page-design implementation and acceptance — 2026-10-28

Supersedes the four failures above. Plans now declare selection/region/page scope, with an explicit captured page root. Broad scope authorizes reversible design operations on captured structure, never arbitrary deletion or text replacement. New typed `theme` and `layout` actions compile into shared workflow operations. Themes apply a contrast-checked palette throughout the actual visible subtree (up to 2,000 nodes), excluding private/editor branches. Navigation-to-header layout resets positioning, dimensions and dependent content margins/padding; vertical/horizontal layout clears prior full-width sizing when changing direction. Runtime postconditions reject incorrect direction, remaining offsets, overlap or width overflow before recording a successful transaction, with atomic rollback.

Header/link creation uses semantic header and anchor nodes, validated destination URLs, real browser navigation in Interact, and ordinary persistence/export/Undo paths. Missing link labels/destinations get one contextual clarification; no element selection is required. The server provider contract exposes these actions and improves invalid-style repair feedback. The matching content capability is now `designer-page-v1`.

Acceptance: 508 regular tests passed, six real-provider cases passed (four page conversations plus existing card/layout/compound cases); the four page conversations passed a second run against the final sizing logic. Standard, free and platform builds passed. Browser verification of the actual provider records confirmed theme appearance, navigation spacing, semantic header links (Contact us navigated to /contact), and vertical-to-horizontal flow. Evidence is `docs/acceptance/page-design-*.png`; replay is `demo/fixtures/page-design-proof.html`. These are synthetic acceptance pages, not an installed MirrorTalk/Maeris acceptance claim. Local API restarted with the matching build; production was not deployed.

### Native MirrorTalk correction and live acceptance — 2026-10-28

The user's real application disproved the prior synthetic fixture checks. This correction was tested in the installed unpacked Chrome extension on MirrorTalk `/group-onboarding`, rather than treating fixture screenshots as proof of native behavior.

Root causes and changes:
- The navigation has nested rail groups and icon-only controls. Reflow now includes those groups, clears inherited full-width control sizing and rail spacing, and aligns controls by their centers. Deterministic layout rules run after model-supplied style patches. Runtime checks reject unresolved targets, overlap, excessive rail height and staggered controls, with rollback before success is recorded.
- Anonymous layout wrappers lacked usable text identity. Only anonymous layout targets now carry a guarded structural address anchored to a unique application ID. Ordinary conservative locators retain their ambiguity behavior. Accessible `aria-label` is included as locator evidence for icon-only controls. Tests still reject duplicate sibling controls/dialogs.
- The previous theme algorithm treated arbitrary buttons as filled primary actions. Theme application now snapshots existing colors and infers the original brand hue, then maps accent, selected tint and faint surfaces independently. Transparent/outline/text controls retain their roles, disabled controls remain muted, status colors remain separate, and branding SVG/image assets are preserved. Optional secondary/tertiary palette fields remain backward compatible with saved workflows.
- Card discovery assumed a semantic heading or multiple non-control text blocks. MirrorTalk has a rounded surface with one styled title and controls. Discovery now recognizes that structure, preserves its elevated outer shell, and prioritizes identified cards in bounded context capture. Explicit selection still copies exactly the selected element. The last created/discussed card is retained across theme/layout operations and incidental hover, so follow-up copies do not require reselection.

Live verified sequence on the final build (no manual element selection):
1. `Duplicate the Select Group card and change the copy heading to Recently Deleted.` — produced a visual card copy with its heading and controls.
2. `Make the page theme orange.` — applied cream/white surfaces and orange accents while General remained a text button and the disabled helper stayed muted.
3. `Move the left navigation to a horizontal header at the top.` — produced a horizontal top header with the original logo, Library, notifications, Help and profile controls, and content below.
4. `Duplicate it again and change the heading to Test.` — produced another card with controls without asking for selection again.

Earlier attempts in this turn failed native target resolution or layout postconditions and were rolled back. These failures drove the additional icon-only and anonymous-wrapper regressions; they were not counted as acceptance success. Evidence: `docs/acceptance/mirrortalk-header-orange-live.png` and `docs/acceptance/mirrortalk-card-followup-live.png`. The latter shows the follow-up chat outcome and one of the copied cards; all three cards are present in the accessibility tree, but are not simultaneously visible in that viewport. Native copied-card placement in the existing flex layout can require scrolling; this verification does not establish an automatic responsive card arrangement.

Final validation: 512 tests passed, 6 opt-in provider tests skipped; standard extension, free extension and platform builds passed. Local API restarted with the matching shared locator schema, and the installed extension reloaded. No production deployment or Git push was performed.

### Header references, grid layout and clarification continuation — 2026-10-29

The user's transcript exposed additional gaps beyond the previously verified cases: a converted top navigation was not resolved as “the header”; the action contract had no grid layout; generated text-only panels did not count alongside an original card; and clarification candidate buttons discarded the pending edit and asked what to do again.

Changes: resolve header references to a unique top navigation/sidebar when no semantic header exists; reserve bounded context space for landmarks and complete sibling groups; add a typed grid layout with one to six columns and fit existing children into their columns; count generated section panels as visual items; support isolated bottom-border styling; and resume the original pending edit after a clarification choice, retaining one user message and the selection guard. Grid conversion resets prior per-item movement offsets, margins and sizing constraints. The renderer honors an explicit position when resetting movement. Layout checks still roll back overlap/overflow rather than claiming success. Matching extension capability is `designer-layout-v3`.

Regression cases include the user's exact 2x2 wording, four mixed existing/generated sibling items, a converted header while another item is selected, separator save/load, prior translation reset, and clarification-button continuation. The initial regression run failed both header/grid tests before implementation. The first native grid runs rejected row geometry and rolled back. Grid conversion now resets item offsets and reserves a full-width row for header landmarks. The decisive native measurements showed that generated panel references had been detached by rendering: their stale rectangles were zero-sized. Layout verification now resolves the current owned nodes before measuring, rather than weakening overlap checks. A geometry-aware regression reproduces the renderer replacement.

The original user draft was preserved to account version 1 before refreshing the extension. The exact “add a dark blue line under the header” request was verified on that loaded MirrorTalk workflow, without selecting a header. Native screenshot evidence: `docs/acceptance/mirrortalk-header-divider-live.png`. The account save/read and native page reloads can take several seconds; do not infer failure from the first pending UI snapshot.

Final native result: restored the user's original account workflow, applied the exact `they needs to be visible - grid meaning 2x2` instruction, and visually verified Select Group, Product, Marketing and Design Team in a two-column/two-row arrangement, with the navigation header across the top. Then applied the exact `add a dark blue line under the header` instruction with no header selection. Saved the corrected result to the same account workflow as version 2; version 1 preserves the original. Evidence: `docs/acceptance/mirrortalk-grid-divider-v2.png`. The first grid success reply counted only the three classified generated sections even though execution included all four content siblings; the reply was subsequently corrected to describe the existing content grid without that inaccurate count. Existing plain text panel styling was retained; this test establishes arrangement and reference resolution, not a redesign of those panels.

Final verification: 517 tests passed, 6 opt-in provider tests skipped. Standard, free and platform builds passed. The local API and installed extension were updated for live tests; no Git push or production deployment. The last source-only change adjusts the grid success reply wording; the installed build used for the saved live evidence has the same layout/validation behavior.

## Experience audit — 2026-10-29

Scope: the seven core authoring experiences requested by the user. Scores are conservative engineering judgments of product readiness, not measured user satisfaction or proof of compatibility with every application. Ten means dependable, visually polished, fast, and proven across varied real apps. This audit does not recertify billing, GitHub, voice hardware permissions, or anonymous production sharing.

| Experience | Score / 10 | Current evidence | Remaining limitation |
| --- | --- | --- | --- |
| Duplicate & adapt | 7 | Exact selected unit copy, heading/button adaptation, explicit named source over remembered copy, disabled state, Undo; rendered long heading at 480px | Visual copies do not inherit the app's JavaScript/backend behavior; complex responsive components remain unproven |
| Layout & alignment | 7 | Grid, vertical/horizontal, grid-to-row sizing reset, header spanning, bounds and overlap checks; browser desktop and narrow container | Content-aware responsive decisions and arbitrary deeply nested layouts need broader real-app coverage |
| Themes & style | 6.5 | Primary/tint/outline roles, neutral text, secondary/tertiary contrast checks; orange theme visually reviewed | Brand-role inference remains heuristic; gradients, media and semantic color use can require correction |
| Add elements precisely | 7 | Typed fields, required state, select options/radio groups in planner contract; native-style required email before Save verified through real AI and browser | Rich custom controls and app backend integration are not automatic |
| Reorganize page | 6.5 | Sidebar-to-header, content reflow, links retained and Undo; real provider and synthetic rendered fixture | No guarantee for every framework's nested/sticky navigation |
| Connect interactions | 6.5 | Named button source without selection; short follow-up preserves copied card; saved Create connection activated in Interact after reload | Browser check uses a local prototype destination; authenticated cross-route production behavior was not retested here |
| Conversational refinement | 6 | Copy memory survives theme/layout; explicit source overrides memory; unambiguous generated-button alias canonicalized; chat regression suite passes | Long sessions, ambiguous spatial intent, latency and broader designer judgment still need work |

Overall: approximately **6.5/10**. The execution foundation is stronger than the overall product experience. The desired effortless design-partner experience is not yet established.

### Reproducible fixes from this audit

- Added 12 targeted experience regressions. The corrected initial seven-case audit had five failures and two passes before these fixes; the later cases cover additional discovered gaps.
- Exposed field type, required state, select options and radio grouping to the assistant schema, provider contract and executor. Field verification checks the rendered control rather than the action's success message.
- Prevented “Make it connect…” from matching an unrelated button named Connect. Named control requests resolve from page context without mandatory selection.
- Explicitly named original cards override conversational memory; new output headings do not masquerade as source names.
- Canonicalized the model's `new:feedback/button` alias only for a declared duplicate result; normal reference validation still applies.
- Grid-to-horizontal conversion removes forced 100% child widths. Grid rows align to the start.
- Preserved disabled copies. Copied text heights now grow intrinsically, with width constraints, so renamed headings can wrap without overlapping descriptions.
- Added secondary/tertiary contrast validation. Dark muted purple body text no longer becomes the accent when changing a purple app to orange.
- Prioritized landmarks, card groups and actionable controls in the bounded context; omitted redundant style properties. Browser verification demonstrated that required anchors previously fell out of capture after multiple edits.
- Scoped prototype field validation to the relevant form/section. An empty required field in a different form no longer blocks a copied card's connection; the form's Save still validates it.
- Bumped designer capability to `designer-experience-v4` so stale content scripts are rejected with refresh guidance.

### Verification and limits

- Full automated suite: **529 passed, 7 opt-in cases skipped**. The opt-in cases were separately run with the configured real AI provider: **7/7 passed**. Extension build and platform build passed, including TypeScript checks. The local API was restarted with the matching provider contract; billing remains unavailable in that local service.
- Real AI tests send synthetic page context, not private browser content. They cover layout, compound duplication, navigation conversion, themes, new linked header and required email creation. These are limited acceptance examples, not a statistical reliability benchmark. The final real-AI run took about 39 seconds with test files running concurrently. Example individual cases: navigation ~3.2 seconds, email ~4.9 seconds, new header ~8.2 seconds. Compound multi-turn cases took longer.
- Browser fixture: `demo/fixtures/experience-audit.html` and `experience-audit.ts`, served at `http://127.0.0.1:5173/demo/fixtures/experience-audit.html`. Ten execution/geometry/persistence assertions passed at a 1280px desktop container and a 480px constrained container in the same 1280×720 browser viewport. A constrained container is not a mobile-device compatibility test.
- A separate browser button verified creating a connection, saving/reloading, switching to Interact, and activating the copied Create button to reach Profile preview. That destination is deliberately a prototype panel, not a fabricated capture of the real production profile.
- Screenshots: `docs/acceptance/experience-audit-desktop.png`, `experience-audit-narrow.png`, `experience-audit-connection.png`. The narrow screenshot was inspected and corrected after finding heading/description overlap despite earlier checks reporting success.
- Earlier live MirrorTalk evidence remains in `mirrortalk-grid-divider-v2.png` and `mirrortalk-header-divider-live.png`; those are previous verification, not a fresh live MirrorTalk test of every change in this audit.
- No production deployment or Git push was performed. Local `dist/` is rebuilt. Reload the unpacked extension and the application tab to use the updated content script.

Next highest-value work: a held-out real-app acceptance matrix; preview-before-apply for major restructuring; automatic repair driven by post-render bounds/overlap/contrast; shorter planning latency; and more dependable long-session semantic memory. DOM access does not by itself provide those capabilities. Canvas-based apps, inaccessible frames/closed shadow roots, source-app backend actions and exact custom component state machines remain outside universal support.

## Eight-point readiness pass — 2026-10-29

This is the follow-up implementation pass requested after the 6.5/10 audit. No additional product decisions were required: the user's existing failure examples defined the acceptance cases. The improvements remain a validated, reversible design patch stored in workflow data, not arbitrary generated JavaScript or changes to the source application's backend.

### Changes implemented

- Added post-render bounds, clipping and text-overlap verification for copied/created content and typed layouts. Verification failures restore the previous workflow, DOM and Undo history before reporting failure.
- Added one automatic AI repair attempt only after an explicitly confirmed preview rollback. A lost response/uncertain commit is never retried automatically. Repair uses fresh context, checks workflow/view/selection again, respects cancellation, revalidates references and grounding, and cannot loop indefinitely.
- Restored remembered copied cards from saved operations in the current render lineage. Their styled span headings are prioritized in context. Simple rename/duplicate follow-ups now use that memory without mandatory selection; the original-copy relationship is also recovered after reload.
- Common uniquely identified card stacking/rearrangement can run locally. Missing layout-group context now falls through to page reasoning instead of a premature “Which two elements?” prompt triggered by the word “both.” Multiple genuine groups still get a concise choice.
- Recognized native cards from the same component discovery used by duplication, including nested styled divs. Discovery is bounded and performed through a limited set of controls.
- Copied items no longer shrink into narrow strips in a non-wrapping flex row. Copy placement enables wrapping when needed, and the copied root resists compression. Text dimensions become intrinsic, including when loading older saved copies. Explicit later editing operations still apply afterward.
- Horizontal card layouts use equal flexible columns. Returning to vertical clears their horizontal flex basis. Content height/top alignment are preserved; requested spacing/centering are applied after structural defaults, while conflicting display/direction overrides cannot silently defeat a typed layout action. Anonymous wrappers use fingerprint-checked structural locators.
- Added rendered text/surface contrast correction and verification. Muted text stays readable, translucent backgrounds are resolved, semantic status colors and disabled controls are excluded from text correction, and faint purple/gray page backgrounds map to the new palette instead of remaining behind.
- Captured ordinary HTML field labels without entered field values. Route connections can distinguish identical button labels by the named/remembered card. Named checkbox/radio routes use change + checked conditions, rather than unconditional click behavior.
- “Opened workflow” account notifications clear automatically instead of permanently occupying the chat layout.

### Evidence

- **549 automated tests passed; 7 opt-in tests skipped in the regular run.** All **7/7 real-AI acceptance cases passed separately**. Extension and platform builds, TypeScript checking and diff whitespace checks passed. The total includes 17 new readiness regressions and three additional chat integration tests in this pass.
- Three synthetic DOM structures each pass a seven-stage sequence: semantic dashboard, nested styled div application, and accessible role-based controls. The sequence covers full duplication/adaptation, layout, palette, navigation conversion, required email insertion, save/reload memory, and connected form navigation. These are three fixture structures, not three independently tested production apps.
- Browser execution checks pass at desktop width and in a 480px container. Saved connection activation also passes in Interact after reload, with an unrelated empty required field present. Screenshot: `docs/acceptance/eight-readiness-narrow.png`.
- The installed extension was tested on live MirrorTalk using a separate account workflow named **Wandel acceptance audit — 8 readiness**, saved as **v2**. Existing user workflows were preserved.
- Live sequence: duplicate Select Group with Recently Deleted heading without selecting a target; arrange the pair vertically; convert the real nested navigation into a header; apply a warm orange palette; save, reload the extension/application and restore the account workflow; arrange both cards horizontally without selection; follow up with content-height/top alignment. The initial strip-shaped copy and the premature “Which two elements?” response were observed, fixed and re-exercised rather than counted as passes. Screenshot: `docs/acceptance/eight-readiness-mirrortalk-layout.png`.
- Several live checks ran during iteration; the final automated suite and browser fixture checks use the final code. The final local build was loaded into the existing Chrome extension afterward. No production deployment or Git push was performed.

### Score interpretation

The exercised core DOM editing flows are now approximately at the **8/10 engineering-readiness bar**: intent resolves in the acceptance examples, native content is retained, changes are reversible, failures can be detected/rolled back, and follow-up memory survives a saved reload. This is a subjective assessment for the tested scope, not a statistically measured success rate, a user-satisfaction score, or certification that each category works on every app.

Broader product readiness still depends on held-out real applications, longer sessions and responsive/device testing. The repair loop is bounded recovery, not a guarantee that every failed plan will be repaired. Render checks do not establish visual taste or prove all accessibility requirements. Canvas apps, inaccessible frames, complex custom component state machines and production backend behavior remain outside universal support. Voice hardware permissions, public recipient sharing, GitHub implementation and billing were not recertified in this pass. No further user input is required for the completed changes; future user input is most valuable as real-app acceptance evidence and preference feedback, not repeated descriptions of what duplicate or layout means.

## AI-only chat routing and dashboard swap — 2026-10-30

All chat submissions now use the AI planner, including greetings, edits and follow-ups. The chat submit and repair paths no longer run local intent interpretation or `groundPlan`. Schema/reference validation, execution and rollback remain local. Legacy connected-feature creation is a separate path and was not recertified.

Manual acceptance request: “Can you switch the Revenue Overview and Deal pipeline cards” on the Sample Application CRM dashboard, without selection, in Chat. The AI correctly proposed moving Deal Pipeline before Revenue Overview. The earlier rendered result was **not a pass**: the user confirmed Revenue Overview was missing. Later attempts correctly rolled back when chart bounds escaped the card.

Implemented corrections: capture named cards' actual flex/grid item wrappers; retain wrapper CSS classes in operation locators to distinguish nested containers with identical text; preserve request-specific context on repair; use reversible CSS ordering for sibling flex/grid items so framework-owned charts stay mounted; wait two animation frames before post-render verification; check complete card/chart visibility and containment. CSS ordering preserves DOM/accessibility order; a visual reorder does not change screen-reader order.

The final unpacked build was reloaded with explicit user approval and the dashboard refreshed. Final manual execution was blocked by repeated upstream HTTP 429 responses. The final visual swap, Undo and Redo are **unverified**, not passed. Provider quota/rate-limit errors now have distinct messages. No automated tests, deployment or push were performed. TypeScript/extension build, platform build and diff whitespace checks passed. Temporary compiled-server diagnostic logging was removed and the normal local API restarted.

### Follow-up: Chat mode and responsive chart references

User reported that the first response enabled visual editing and the swap rolled back with “The moved element or its destination is missing.” Corrected both automatic connection entry points to use normal interaction in the regular extension (offline visual editor retains Edit). Chat context capture explicitly disables picking/dragging while preserving the semantic selection; applying a conversational edit also stays in interaction mode. Explicit Visual edit remains available.

Reorder verification now retains the exact connected DOM nodes captured before application. Persistent class/ancestry identity can resolve a unique non-interactive wrapper even after responsive axis labels change. Ambiguous duplicate wrappers are still refused. TypeScript/extension build and diff whitespace checks passed; no automated tests run. The unpacked build was reloaded. Manual verification is pending because Chrome stopped accepting chat input and captured a blank dashboard; user was asked to foreground the test page.

### Follow-up: sidebar-to-header batch resolution

Reported failure: “Preview could not be applied: style: target missing or ambiguous.” Layout-generated child/ancestor operations were still using weaker locators than the AI's primary target, and the renderer re-resolved each target after preceding operations had already modified the layout. Added CSS class fingerprints to layout-generated native locators and bound native targets/reorder anchors against the pre-application DOM snapshot. Connected bound nodes remain the targets throughout that reconciliation batch; newly created prototype-owned nodes continue resolving in operation order.

Extension/TypeScript build and diff whitespace checks passed. No automated tests run. Manual check pending: the existing dashboard has unsaved swaps and an unfinished composer message; a separate test tab was attempted, but Chrome reported concurrent user activity. Asked user to leave Chrome idle before continuing. No live-pass claim is made for the header conversion yet.

### Follow-up: metric card icon replacement

Request to add two cards (“Toal tokens” and “Drift”) failed with “Identify one icon in the copied component.” The executor required exactly one captured SVG below a copied card; common metric tiles contain both a primary symbol and a smaller trend indicator. Card-level icon replacement now chooses a clearly dominant icon by captured dimensions and preserves the smaller icons. Explicit wrappers still permit precise icon targeting; equally prominent alternatives remain a bounded ambiguity. Added static tokens/drift line icons and documented their use for the AI planner. Extension/TypeScript and platform builds plus whitespace checks passed; no automated tests run. Local API restarted. Live two-card creation remains unverified; updated dist must be reloaded before user testing.

### Follow-up: metric heading consistency

Two-card request next failed post-render heading verification. Renaming used the first text node while verification rediscovered a card heading independently; trend percentages can precede the metric label and contain multiple text runs. Metric labels are now distinguished from numeric values, duplication and verification share the exact serialized heading element ID, and adapted plain labels gain heading semantics while preserving captured styles. Requested descriptions are appended when the source metric has no existing subtext; description verification likewise uses its exact rendered ID. Validation remains enabled. Extension/TypeScript build and whitespace checks passed. No automated tests or Chrome interaction performed, per the user's choice to test the build themselves. Live outcome remains unverified.

### Follow-up: percentage badges and conversational repair

Selected trend badge request (“make this trending up with value 6.5%”) hit the narrow text-leaf guard. Added bounded percentage-run editing for copied and native badges; all value/sign/percent text runs are updated together while retaining icon/wrapper markup. Native split text uses exact text-node paths and supports intentionally clearing remaining runs. Added up/down line icons and reversible replacement for a single small native badge SVG; copied icons retain their existing serialization path. Native charts/large SVGs are excluded.

Compile/preflight failures are now explicitly distinguished from uncertain commits. A confirmed unapplied failure or confirmed rollback permits one AI repair; the AI can return a proper clarify response with grounded candidates, and the chat renders that response as conversation rather than a failed user message. Unknown transport/commit failures remain non-retryable. Planner instructions describe percentage/arrow/color changes as a coherent badge edit and tell the AI to inspect or clarify genuine ambiguity.

Extension/TypeScript and platform builds plus diff whitespace checks passed. No automated tests or Chrome interaction performed. Local API restarted. User is testing the updated build; the live badge result remains unverified.
