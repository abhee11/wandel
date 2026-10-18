# Milestone validation and architecture review gate

## Automated

`npm run build` runs strict TypeScript checking and bundles the Manifest V3 worker, isolated content script, and React side panel. `npm test` covers the following behaviors:

- Recursive graph creation, traversal, schema round-trip, broken ancestry and depth limits.
- Core natural-language command variants and rejection of unsupported plans.
- Immutable complete-graph versions and restoration without history loss.
- Unique semantic relocation after DOM replacement and rejection of ambiguous anchors.
- No password-value capture; model markup rendered as text, never HTML.
- Idempotent projection, rollback, generated-control renaming, and retained interactions.
- Customers → Risk Analysis → Details → Approve → Confirmation, saved and reloaded.
- Undo/redo of complete child states and edges.
- In-tab SPA route scoping and unsaved route draft recovery.
- Rejection of plans generated for a stale workflow/state/selection.
- MutationObserver-driven repair after actual host DOM replacement.

## Browser walkthrough

Tested the interactive sandbox using the Codex in-app browser:

1. Selected the Customers navigation item.
2. Added Risk Analysis and created Analysis Panel.
3. Added View Details inside the panel and created Detail State.
4. Added Approve and created Confirmation State.
5. Added Approved text and saved Risk Analysis Flow v1.
6. Reloaded the browser page, then replayed all three button transitions successfully.
7. Renamed the workflow, saved v2, and restored v1; both immutable versions remained available.
8. Confirmed the restored name and current-version badge. No console errors/warnings were reported during the walkthrough.

The demo uses the production engine and panel with the BrowserStorage adapter. This confirms browser DOM/UI behavior but does **not** substitute for a native Chrome extension installation test. Chrome automation was unavailable in this session. Load the generated `dist` directory in Chrome and run the README acceptance walkthrough to verify Chrome API integration in the target environment.

The optional OpenAI planner has not been tested against a live paid API. It requires the user's server-side API key and chosen compatible model. Its client schema and operation boundary are tested; the deterministic local planner supplies the verified end-to-end authoring path.

## Review before expanding

The milestone demonstrates the recursive prototype engine. Review these deliberate tradeoffs before adding more features:

- States inherit all ancestor inserts and open as appended panels. This keeps the model understandable; a future replacement-screen/modal renderer should reuse the graph rather than introduce separate authoring tools.
- Click edges are explicit and only active in their source state. Existing-state links allow branches and loops. The flow list names each outgoing control and its actual destination.
- A conservative confidence threshold can leave targets unresolved rather than risk a wrong edit. Evaluate this on representative real apps before widening matching heuristics.
- Saved workflows are exact-route scoped. Route patterns, iframe/shadow-root support, concurrent multi-tab editing, and cloud persistence are future work.
- Local commands prove the interaction loop; broader natural-language quality needs evaluation with the optional AI planner enabled.
- Versions are local immutable snapshots. Unsaved edits are intentionally lost on full reload; the panel indicates unsaved changes.

Do not expand the CSS editor or property inspector before reviewing this slice in real applications.

## Direct editing update

Added regression coverage for continuous selection after panel activation and SPA navigation; side-panel connection/tab switching (mock Chrome APIs); style/remove persistence and rollback; Cmd+Z; full reset preserving saved versions; and one-operation pointer dragging. Browser checks verified applying a text color, adding an element using direct controls, removal, and Cmd+Z. The native Chrome extension lifecycle is covered by mocks but still needs verification in the user's real Chrome environment.

Style and remove are now additional validated operation variants. Dragging records x/y visual translation, not DOM reparenting or layout reordering. Full reset clears the draft graph, preserves immutable saved versions, and is undoable. Save a new version to persist a reset.


## Hover gesture update

Automated DOM tests cover Option-drag without prior selection; Shift+Option-drag resizing; one-operation undo; saved size restoration; Escape/window-blur cancellation without history changes; one-pixel keyboard movement/resizing; and noninterference with text fields and Replay. These use synthetic pointer/keyboard events. Native Chrome modifier gestures still need testing on the user's target application.

## On-page editor simplification

Added an isolated shadow-DOM action toolbar beside selected elements and an inline text overlay. Text commits on Enter/blur and cancels on Escape; no host input/change/form events are emitted. Editing one direct text run preserves sibling icons/badges and listeners. Appearance inputs apply immediately, coalescing a focused input gesture into one operation and one undo entry. The redundant selected-name/text fields, Rename button, Apply button, and direct-control sections were removed from the side panel. Sandbox selection no longer scrolls users away from the element.

Additional tests cover inline Enter/blur/Escape, native text-undo isolation through a shadow boundary, preservation of child node identity/listeners, immediate size changes and history grouping, and adding UI/creating a child state through on-page menus. In-browser checks confirmed double-click text editing and immediate color changes without an Apply action. Native Chrome installation still requires a reload and a check on the user's real app.

## Session cleanup, resize shortcut, and prompt update

Lifecycle expectations now supersede automatic replay: the initial document and newly navigated routes start clean; saved workflows load only explicitly. Closing authoring synchronously rolls back the projection and gates observer reconciliation. Unsaved SPA drafts remain recoverable in the current tab. Tests assert original text/styles and zero inserted nodes after closing, including subsequent host mutation.

Resize now uses held KeyS + Option/Alt, including Option-generated non-Latin key values via event.code. Key release and window blur clear the modifier; Shift alone no longer resizes. Saved-workflow tests explicitly load after reload.

Local prompts now support common text, color, size, removal, and insertion requests. On-page Ask and side-panel prompts execute on Enter. Tests exercise the actual Ask input for rename, appearance, insertion, and removal; a browser walkthrough verified “Change this to Accounts” and “Make this red” against a selected heading. All 39 automated tests pass. Native extension close/navigation behavior is covered through the lifecycle engine and mocked Chrome connection tests; verification in the user's target Chrome app remains necessary.

## Multi-change form prompt regression

- Build passes; 45 tests pass across four files.
- Exact reported prompt tested against a login form with a nested Sign in label: First name, Last name, Address, vertical form layout, purple/white submit appearance. Button text preserved because no replacement was specified.
- Verified the exact prompt through the side-panel UI in the local browser fixture; accessibility tree shows three new fields and DOM style inspection confirms the button appearance.
- Tests cover grouped undo/redo, save/load, close cleanup, ambiguous form refusal before mutation, malformed AI batches, nullable AI response properties, missing/unreachable AI setup, and preventing generated input values from entering saved workflows.
- Existing Add menu and recursive workflow regression tests remain passing.
- AI response handling tested with mocked provider responses, not a live API request. Native Chrome / the user's live login application was not directly exercised. The offline form preset is intentionally bounded; it is not general natural-language page redesign.
- AI schema updated following official OpenAI Structured Outputs documentation: https://developers.openai.com/api/docs/guides/structured-outputs

## AI connection gating

The side panel now defaults to AI planner and shows configuration before the prompt. Run and Enter are blocked until an authenticated local-server health check succeeds. Health checks send no prompt or page data and make no provider request. Offline mode is an explicit choice. Verified in the browser that the user's green-theme/header prompt is preserved without submitting to the offline parser while disconnected. No API key/model was present in the accessible environment; live generation remains unverified and blocked on configuration. 47 tests pass, including server connection validation.

## Live AI verification with user configuration

The AI server now loads the project-root `.env` automatically. Started successfully with the user's configured model, and connected the local browser fixture through the authenticated health endpoint. Submitted “change the layout and make the theme green and add a header” through the real side-panel UI. The provider returned a valid plan; the form acquired a vertical layout, green text/pale-green background, and a new Sign in text header. Verified one Undo removed the group and Redo restored it. No API key was printed or added to frontend code. Native Google Chrome control was unavailable, so its side-panel token connection must be completed by the user.

## Tab-scoped activation and site connection recovery

Wandel now disables the global side panel and newly created tabs. A toolbar click enables and opens a panel scoped to that tab. The panel bridge is bound to its tab ID, releases its authoring port on switching away, and never starts editing an unrelated tab. Added a top-frame connection probe and on-demand content-script injection for pages already open at installation, with a duplicate-injection guard. Connection failures surface site-access guidance and a Retry button. The scripting permission supports this fallback; no additional host scope was added.

52 automated tests pass, including tab ownership, new-tab non-activation, missing-script recovery, and denied-access retry. The public MirrorTalk homepage and /auth page were inspected in the browser; login buttons use ordinary DOM with nested SVG icons. No signed-in page or native Chrome extension reproduction was available, so the specific MirrorTalk failure remains unconfirmed pending the failing action/URL.

Implementation reference: https://developer.chrome.com/docs/extensions/reference/api/sidePanel

## Account platform vertical slice

- Both extension and platform builds pass. The full suite has 67 passing tests, including 15 platform tests.
- Direct API tests cover password hashing/session revocation, reset token one-time use, ownership on every prototype route, workflow/duplicate limits, depth vs. sibling count, checkpoint limits, Pro history, optimistic save conflicts, concurrent AI reservations, idempotent responses, AI failure refund, monthly reset, mock checkout ownership/replay, cancellation expiry, downgrade retention, CORS, token types/revocation, and auth rate limits.
- A disk-backed database test closes/reopens SQLite and verifies sessions, workflow definitions and migration state survive.
- Browser verified signup → Free dashboard → create prototype → save metadata → metered AI preview. The exhausted-usage fixture returned an explanatory upgrade link, followed through pricing → test checkout → Pro, then AI succeeded with usage 21/500. Inline cancellation scheduled period-end cancellation while the account remained Pro and retained its workflow.
- Production dependency audit: zero known runtime vulnerabilities at verification time. Development/build dependencies remain separate from the deployed API.
- The local platform preview is running in clearly labeled mock AI + mock billing mode; no real payment or card information was used. Development fixtures were restored after the browser exercise. Credentials are in the ignored `.data/fixture-accounts.txt` file.
- Live Stripe, production email delivery, deployment and automatic extension/cloud synchronization are not implemented or claimed as tested. Their boundaries and migration steps are documented in the account-platform section of ARCHITECTURE.md.

## Clerk + account saves + Stripe test integration

- 80 automated tests pass, including owner-isolated Clerk identity provisioning, atomic complete-workflow saves, repeated save idempotency, stale cross-browser revision rejection, depth/version limits at save time, deferred upgrade UI, temporary saves, acknowledgment that preserves concurrent edits, signed Stripe synthetic events, duplicate events, cancellation and live-event rejection.
- Extension and platform production builds pass. Database migration 002 applies on startup to existing SQLite files.
- The local API reports `authMode: clerk` and `billingMode: unavailable` without external credentials. Browser verification confirms the sign-in helper renders its missing-configuration state instead of failing blank.
- Actual Google OAuth and Stripe test-card checkout have NOT been verified: Clerk/Stripe keys and extension registration were not provided. A hosted API/database is still required for different computers to share saves. Two separate localhost databases are not synchronization.
- Native Chrome extension interaction still requires reloading the unpacked `dist` build. Clerk Sync Host adds the cookies permission.

## Interactive homepage playground

Homepage `/` now renders a self-contained interactive canvas without account/API dependencies. Browser-verified: pointer dragging, corner resizing, keyboard resizing, adding a button, double-click text editing, typed analytics transformation, risk workflow state preview, and Reset. Mobile layout stacks the tools below the canvas; desktop uses canvas + tools columns. The viewport override was reset after responsive inspection. Prompt transformations are explicitly labeled guided presets (wellness, analytics, risk workflow, add element), not live AI. Changes are tab-memory only. Platform production build passes.

## Automatic homepage demonstration

The homepage now plays a roughly 20-second guided loop: moves a card, resizes it, opens Add and inserts a button, types a wellness prompt, then changes the canvas theme and copy. A visible demo cursor and chapter/canvas captions explain each step. Pointer/keyboard interaction stops autoplay before visitor edits; Pause and Replay are available. The sequence suspends offscreen/background and defaults to manual play for reduced-motion preferences. A fake-clock regression test checks sequence order, automatic theme change, handover without subsequent overwrites, and replay. Platform build passes.

## Contextual flow authoring and behavior mirroring

- 99 tests pass; extension and platform production builds pass.
- Added DOM coverage for live-button mirroring only during replay, field setter/event forwarding without value persistence, serialized mirror restoration, host-button prototype transitions, scoped prompts and automatic local checkpoints.
- Added homepage coverage for the complete risk workflow and takeover from Details to Approval without subsequent autoplay overwriting the visitor's scene.
- Browser sandbox verified: selecting a nested label in the host Sign in button exposes On click; creating Risk Analysis selects the new panel; the contextual prompt inserts View Details. Visually inspected the breadcrumb, compact toolbar, plus points and resize handle.
- Native Chrome side-panel integration and real third-party application mirroring were not exercised in this verification. Input forwarding depends on the host application's standard DOM event handling.

## One-prompt flow generation

- 103 automated tests pass. Coverage includes generating a three-panel flow from one plan, local button color matching, atomic undo/redo, refining a generated heading, saving/reloading, clicking every transition, returning to a prior panel, and restoring the host page.
- Invalid intermediate actions are rejected without mutation. The authenticated AI endpoint returns and caches the full flow with a single usage debit. Both local and hosted providers use the same structured response contract.
- A live provider check with a synthetic Customers selection returned a valid four-screen Risk analysis → Customer details → Approval → Confirmation plan. No real page data or input values were sent.
- Native Chrome authentication and the deployed extension-to-API round trip still require end-to-end verification. The homepage demo remains a preset demonstration, not this live planner.

## Section redesign and installed extension auth diagnosis

- Confirmed Chrome loaded Wandel from `Documents/DesignX/dist`. Reloading replaced the missing-Clerk-key error with an actual development sign-in-session error. The compiled build contains the public key.
- Registered the installed extension's exact origin with Clerk, preserving the existing allowlist, and explicitly registered it for the local API. Production continues to require an environment allowlist.
- DOM regressions cover shift-selecting a div-based section, scoped replacement with editable fields/cards, preserving a neighboring footer, undo/redo, and selecting/moving a Notion-like editable block by its stable block ID without reading editor values.
- Native Chrome verification reached the public Notion page and extension account error. Further interaction was interrupted by Chrome window changes; authenticated Notion workspace editing is not claimed as verified.

## Guest AI and visible profile

- 114 tests pass; both builds pass. Guest tests cover anonymous HTTP access, untrusted origins, two-attempt enforcement, cached retries, invalid scope and oversized prompts, failed-attempt accounting, reset-identifier network limits and out-of-scope model output.
- Profile tests verify visible Guest/sign-in status without expanding a menu and identity refresh after returning from sign-in.
- Guest restrictions are server enforced. Anonymous identity is not proof of a unique person; daily network and server-wide reservations bound spending.

## Branching feature prototypes (October 6, 2026)

- The planner contract supports 2–8 connected screens with explicit actions, return links, bounded string data, bound prototype fields, metrics, cards, and tabular sample content. Legacy linear plans remain accepted.
- The compiler validates screen reachability, destinations, declared data keys, and table dimensions before committing. Navigation cycles are separate from acyclic visual ancestry. Each generated feature uses independent data keys.
- Replay applies declared assignments and carries typed prototype values between screens. Back restores the prior decision state; Restart resets sample values. Typed replay values are not stored in drafts, versions, or AI requests.
- Automated acceptance covers both branches, returning to an updated dashboard, data reset, save/load/replay, recursive editing, undo, and atomic rejection of malformed graphs. Save limits include navigation depth; return loops do not inflate depth.
- Browser acceptance at `/?fixture=feature`: built the scripted risk feature, opened details, entered a synthetic review note, approved, and returned to a dashboard displaying Approved. Visually inspected metrics, card, table, navigation controls and the separate screen layer. This fixture explicitly says it is scripted and sends no AI request.
- Live provider output for the revised graph contract and installed-Chrome acceptance on third-party sites remain unverified. This does not establish broad website compatibility or public-launch readiness.

## Check-in on October 16, 2026

- Reran `npm test`: 122 tests passed across 15 files.
- Standard and free extension builds passed (`npm run build`, `npm run build:free`).
- Results cover the current uncommitted working tree, not a released artifact.
- Installed-Chrome/user acceptance remains pending. The active sign-off card is [J1 in the current checkpoint](CURRENT_CHECKPOINT.md): manually create a three-step onboarding prototype on Maeris, save temporarily, refresh the page, load and replay in the same Chrome session.
- J1 explicitly excludes AI generation and persistence across Chrome exit. Those are separate acceptance journeys.
