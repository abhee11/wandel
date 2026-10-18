# Wandel user journeys and development checkpoints

Planning baseline: October 16, 2026. This is the proposed product and delivery contract, not a claim that every capability is implemented.

Wandel helps someone demonstrate a new feature on an existing application, refine its connected behavior, and optionally turn the approved prototype into working software. The first success is a saved, replayable feature created without assistance. The second is a tested application preview that the user can take away.

## Active acceptance journey — October 17, 2026

**J1: Risk Analysis Flow — v1.** Build and save a connected feature over a customer application: Customers → Risk Analysis → Details → Approve → Confirmation. Return to it later and replay every transition.

| Checkpoint | Status | Evidence / remaining action |
| --- | --- | --- |
| Select and edit existing text/buttons | Verified in local browser | Supplied Talk Time chip, modal focus trap, labels/divs/spans/paragraphs; latest real-app install still needs retest |
| Add UI and recursively connect three new states | Browser + automated pass | Created through ordinary on-page Ask and On click controls; 4 states / 3 edges |
| Replay every edge without firing host actions | Browser + automated pass | After reload: Risk Analysis → View Details → Approve reached Approved; installed package pending |
| Save v1, reopen and replay | Browser + automated pass | Named Risk Analysis Flow — v1, saved version 1, reloaded/restored/replayed; Chrome restart remains unverified |
| Export/import a colleague's workflow on matching page | Export browser-verified | Export retained in docs/acceptance/risk-analysis-flow-v1.wandel.json; cross-user import pending |
| Fresh beta install without localhost, account, AI or payment | Not verified | Test `dist-free`, not the account build |

J1 is complete only when a tester installs the candidate, builds this flow on an agreed real application, saves it, quits/reopens Chrome, reloads it and reaches Confirmation without assistance or lost edits. A passing sandbox demonstration does not close the installed-extension gate. New feature expansion should not displace this gate.

The first beta candidate is the local-only free build. Broad natural-language feature generation, hosted AI, cloud accounts and payments are separate later gates. Bounded offline prompts can add each step today; they are not an AI generation claim.

## Conditional connection checkpoint — October 17, 2026

Use case: Continue opens Account details only when Email is valid and Terms is checked. Select source → Connect → → choose/create destination → pick conditions → Connect views → Test connection. Open Edit destination view to continue building recursively.

Implemented and verified in the local browser, including failed/successful conditions and save → reload → restore. Click, change and Enter rules, an optional otherwise destination, undo and compatible saved edges have automated coverage. 236 tests passed. Evidence and exact scope: [current checkpoint](CURRENT_CHECKPOINT.md#visual-connections-and-conditional-navigation--october-17-2026). Candidate: releases/wandel-local-beta-0.2.1.zip.

Still open: install the exact beta in Chrome and repeat on the target application, restart Chrome and replay. Saved destinations represent Wandel prototype states; arbitrary visited application/browser states are not captured.

## Live destination browsing checkpoint — October 17, 2026

Journey: select a source control → Connect → choose a visited route thumbnail, or Browse live app → navigate in the companion window → Use this screen as destination → Connect → Test. The source stays pinned in its untouched tab. Connected destinations are editable prototype captures with saved route/thumbnail metadata; they do not copy backend behavior.

Local browser acceptance passed: Home and Settings were captured from live local fixture pages, Settings was connected to Terms, and after save/reload/restore the checkbox opened its captured Settings view. Chrome API coordination is automated-tested; installed Chrome and the actual target sites remain open acceptance gates. Capture limits and privacy/storage behavior are in the [current checkpoint](CURRENT_CHECKPOINT.md#visited-route-thumbnails-and-a-live-destination-browser--october-17-2026).

## Product boundaries

- A prototype simulates a feature over an existing page. It does not modify the application's backend.
- A generated application is a separate code artifact. Integrating it into an existing private application requires authorized repository or API access.
- Hosting a project in a Wandel workspace defers the user's GitHub connection. It does not provide access to another application's source.
- Prototype exploration starts locally. Hosted generation requires network access and a clearly stated allowance or account. Current guest AI previews exclude connected flows; show this before submission, not after a failed generation.
- A fee, build budget, and included deliverables must be shown before a paid build. Export must not become a surprise ownership paywall.
- Success means passing declared acceptance criteria. Do not promise universal site support, complete reconstruction from a page, or 100% functional accuracy.

## User journeys and the use cases they serve

| Journey | User's job | Path | Evidence that the use case is served |
|---|---|---|---|
| Imagine a feature | A product manager wants to demonstrate an idea in context | Open app → select anchor → describe screens and actions → generate → try each branch | A colleague can understand and click through the feature without a narrated explanation |
| Refine a feature | A designer wants to explore what happens next | Open any state → edit or generate another step → connect destinations → compare versions | A new step preserves earlier edits, branches and return behavior |
| Resume work | A user wants to continue tomorrow | Save → close Chrome → reopen matching app → open workflow → replay | The same graph and edits return; sample replay data resets intentionally |
| Compare ideas | A user wants to explore an alternative safely | Duplicate a version → rename alternative → change it → switch between workflows | Neither alternative overwrites the other; only the active workflow affects the page |
| Make a new app real | A founder wants a working implementation of the prototype | Choose Make it real → review specification and fee → build in a private workspace → test preview | Generated code implements the agreed screens, data behavior and acceptance checks |
| Extend an existing app | An app owner wants the feature inside their product | Connect authorized repo → inspect stack → map APIs/auth → implement on a branch → test preview | A reviewable change fits the existing application; missing integration details are explicit |
| Take the result | A user wants source code or a published app | Accept preview → download source, connect GitHub, or choose managed deployment | Export is reproducible; deployment and account ownership are clear |
| Leave safely | A user wants to stop without losing work or continuing costs | Stop generation, close editor, archive project, or discard project | Each action says what stops, what is retained and what is deleted |

For the login-page example, an appropriate feature is onboarding: a new entry button → profile → preferences → welcome. Use illustrative input and simulate authentication until a real authentication provider is explicitly connected. A risk-analysis journey is appropriate for a customer dashboard. Examples should follow the selected context.

## Separate product objects

| Object | Purpose | Checkpoint retained |
|---|---|---|
| Project | Groups an idea, its workflows and optional generated applications | Ownership, retention and service connections |
| Workflow | Connected prototype screens, actions, locators and sample data | Recoverable draft and immutable saved versions |
| Replay session | Temporary traversal and simulated user input | In-memory visit history; typed input is not a saved workflow |
| Generation job | Produces a candidate change for a specific workflow revision | Request identity, target context, status, candidate and usage outcome |
| Build | Generates code from an approved workflow version and specification | Source revision, dependency lockfile, test results and preview |
| Deployment | Publishes a particular build into a chosen environment | Provider, immutable build identity, status and rollback target |
| Handoff | Delivers a source archive or transfers a repository | Exact delivered artifact, recipient and completion status |

A workflow state is a screen in a user's feature. A job state describes processing progress. A development phase describes delivery readiness. These must have separate identifiers and UI labels.

## User visible state transitions

| Process | Normal path | Recovery paths |
|---|---|---|
| Authoring | Empty → awaiting selection → editing → saved version | Unsupported page, missing anchor, save failed; retain draft |
| Generation | Draft prompt → preflight → queued → generating → validating → candidate ready → applied | Needs sign-in, needs connection, cancelled, timed out, failed, or stale candidate |
| Replay | Entry → selected branch → next screen → return or finish | Back restores prior simulated state; Restart resets sample data; Edit returns to authoring |
| App build | Approved specification → provision workspace → generate code → install/build → test → preview ready → accepted | Build/test failure → bounded repair → retest; unresolved failures need user input or a specification change |
| Export | Requested → prepare archive → verify contents → ready → downloaded | Packaging failure, expired link, retry from the same accepted build |
| GitHub handoff | Destination selected → authorized → transfer requested → pending acceptance → completed | Permission denied, name conflict, transfer expired; retain the source and offer download |
| Deployment | Provider configured → preview deploying → preview ready → publication approved → production deploying → live | Missing configuration, failed deployment, rollback to last working build |
| Discard | Requested → consequences shown → confirmed → cleanup pending → completed | Partial cleanup is visible and retryable; never report deletion while resources remain |

Each processing view shows the stage, retained work, next action, and whether retry can incur additional usage. No indefinite spinner and no generic success message when only a preview or intermediate artifact exists.

## Switching workflows and nested generation

1. Before switching, checkpoint the active draft. If saving fails, retain it in memory and offer export, retry, or an explicit discard. Do not silently switch and lose it.
2. Remove the old workflow's page projection before applying the next one. Match origin, route and anchor; require reselection when ambiguous. Do not apply to the currently active tab merely because a background job finished.
3. Bind every job to project, workflow, revision, screen, selected anchor and scope. Client and server use the same request identity for retries.
4. If the user switches while a job runs, either cancel it or let it finish for its original workflow. A completion appears as a pending result there, never as edits on the new workflow.
5. If its source revision changed, retain the candidate as stale. Offer regeneration from the current revision or a separate alternative. Never silently merge over newer work.
6. Generating inside a generated screen follows the same path as generating from the live app. Attach new entry actions to that screen; preserve sibling branches and existing data. Explicitly map any shared variables; do not infer data sharing from similar labels.
7. Concurrent generation from one revision may produce multiple candidates, but only one can apply without a fresh revision check. Application is atomic and undoable.
8. Opening a workflow restores editing context. Replay always starts deliberately; it must not activate live host controls on load.

## Error boundaries and recovery contracts

| Boundary | What can fail | Required behavior |
|---|---|---|
| Page adapter | Protected URL, iframe/canvas, unstable DOM, missing or ambiguous target | Detect before generation where possible; explain the limitation; offer supported section selection or a separate prototype when capture is possible |
| Selection and scope | No selection, selection disappeared, whole page selected accidentally | Show exact target and intended scope; request selection; retain prompt; no provider spend for a known invalid target |
| Panel rendering | A component throws | React error boundary keeps recovery actions available; restart panel and restore draft without reloading the host app |
| Content runtime | Projection or event handler fails | Roll back the attempted operation, release interaction interception, retain draft and offer restore/retry |
| Authentication | Session expired, sign-in cancelled, server unavailable | Preserve prompt and draft; distinguish signed out from unavailable; resume after authentication without submitting twice |
| AI service | Timeout, invalid graph, refusal, budget exhausted | Validate before applying; no partial mutations; retain previous version; reconcile uncertain requests before retry; distinguish retry of one request from a new billed generation |
| Storage | Quota, write failure, corrupted record, conflicting revision | Preserve last good record and current draft; offer backup export; validate imports and migrate versioned formats |
| Build runner | Generated code loops, install fails, tests fail | Isolated disposable execution, resource/time/network limits, no platform secrets; bounded repair; preserve logs and last working build |
| Preview | Runtime crash or expired preview | Error screen with restart and build details; retain workflow/source; do not label failed tests as a working application |
| Billing | Payment cancelled, webhook delayed, response lost | Keep preview and deliverables; server-confirm entitlement; idempotent checkout/fulfillment; show pending instead of charging again |
| Vendor integration | Token revoked, quota exceeded, provider outage | Fail only the affected integration; keep code and preview; show reconnect/retry or another supported destination |
| Resource cleanup | Sandbox, deployment or repository deletion fails | Track cleanup per resource; stop new work; show remaining resources and retry safely |

Durable jobs, server-side idempotency, authorization checks and artifact validation are required in addition to UI error boundaries. The extension never receives Wandel's organization credentials or build-runner secrets.

## Development streams and checkpoints

| Stream | Parts | Journeys served | Exit checkpoint |
|---|---|---|---|
| A Real app editing | Capability detection, selection, section scope, projection, cleanup, accessible on-page controls | Imagine, refine | An installed extension can select, modify and restore supported targets on three named representative sites; unsupported targets fail clearly |
| B Feature engine | Branch generation, sample data, recursive steps, version-aware jobs, candidate validation, replay | Imagine, refine, compare | A generated four-screen feature with approve/reject branches can be extended two more levels, replayed and undone without breaking siblings |
| C Continuity | Persistent drafts, versions, library, workflow switching, export/import, account recovery | Resume, compare, leave | Create → quit Chrome → reopen → load → replay; failed save and switching during generation preserve every draft |
| D Working app builder | Approved specification, new-app versus existing-repo path, private workspace, source generation, tests, previews | Make real, extend app | A bounded prototype becomes a runnable preview; a fresh environment can reproduce the build; failed tests block the verified label |
| E Ownership and delivery | Pricing disclosure, payment entitlement, source archive, GitHub handoff, retention/cleanup | Take result, leave | Accepted source downloads without GitHub; replayed payment events cannot charge or fulfill twice; discard cleans up tracked resources |
| F Integrations and operations | Hosted auth/API, deployment adapters, credential storage, test-provider adapter, support and diagnostics | All hosted journeys | The chosen journey works with no developer laptop services; one provider outage does not erase or block unrelated work |

Begin with one implementation stack and one deployment target. Auth, database and testing integrations each need a defined capability contract and acceptance test before appearing as available choices. Maeris integration is an investigation item until its API and authorization flow are verified.

## Development phases

| Phase | Deliverable | Gate to advance |
|---|---|---|
| 0 Establish baseline | Named site matrix, current-build verification, known failures and reproducible test cases | Current behavior is recorded separately from proposals; old test results are not treated as a new release pass |
| 1 Reliable prototype beta | Streams A, B and C; hosted auth/API portion of F if offering hosted AI | Five target users each complete one feature creation and later reopening without developer guidance; no data-loss or wrong-workflow application defects |
| 2 Private working previews | Stream D with one stack and a bounded feature specification | New app preview passes declared navigation, data and failure-path checks; existing-repo integration is labelled separately and never implied |
| 3 Paid source handoff | Stream E, ZIP first | Price shown before paid build; accepted source, tests and setup instructions reproduce successfully outside Wandel |
| 4 Connected delivery | GitHub handoff, one deployment provider, then additional adapters in F | Ownership and service migration are explicit; transfer/deploy failure has a tested recovery path |

Phases are release gates, not calendar promises. Supporting parts can be developed concurrently, but a later feature does not compensate for failing the earlier user journey.

## Current baseline and next checkpoint

The repository contains a prototype graph engine, bounded AI graph contract, branching sample-data replay, editing, versions, layout alternatives and a free-build local storage adapter. The account-enabled build still selects session storage for local drafts. The most recent recorded validation was 122 tests and an extension build on October 6; this plan does not rerun or certify them.

Generation in private workspaces, deployable source generation, paid source export, repository transfer and production deployment adapters are proposed work. Existing payment and account scaffolding does not establish fulfillment of those journeys. Live AI graph generation and broad installed-extension compatibility still need acceptance evidence.

The next checkpoint is Phase 0 followed by a complete Phase 1 journey: on a named real app, select a starting point, generate a feature through the actual configured AI service, exercise both branches, extend one branch, save, restart Chrome, reopen, and replay. Repeat with a deliberately failed generation, an expired session, an unavailable save destination, and a workflow switch during generation.

For each checkpoint, retain the build/revision, site and environment, input specification, expected result, observed result, and unresolved defects. Track unassisted completion, time to first replay, generation failures by stage, successful reopen rate, and recovery success. Prototype completion and paid-export conversion are separate use-case signals.

## Scope decisions

- One workflow-first product, with optional implementation and delivery stages.
- Local prototype continuity before expanding vendor choice.
- Private managed workspace before requiring a user's GitHub connection.
- ZIP handoff before automatic repository transfer and managed production hosting.
- User edits, immutable versions, prototype runtime data and generated code remain separate.
- Never silently discard work, spend again on an ambiguous retry, publish a build, or apply a candidate to a different workflow.

This plan complements [the release checklist](RELEASE_CHECKLIST.md) and [validation record](VALIDATION.md). Those documents remain the packaging checklist and evidence log respectively.

### Live destination checkpoint — October 17, 2026

Journey: select a source control → choose an existing application page → save connection → Interact → real destination route → edit that page → save → Back → replay connection → reload. Implemented; local browser acceptance passed with native destination content and retained edits. Installed Chrome/MirrorTalk acceptance remains pending. Old captured prototype destinations require reconnecting once. See CURRENT_CHECKPOINT.md, “Existing app route → scoped edits → Back,” for evidence, limits and exact steps. Independent visual playback remains future work.
