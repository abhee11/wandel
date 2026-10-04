# Workflow-first vertical slice

## 1. Architecture proposal

Wandel is a Manifest V3 Chrome extension with a React side panel, an isolated-world content script, and a small background worker. The product is a saved state machine over a live application. Element selection and prompts author that machine. No property-inspector framework, drag layout engine, or arbitrary HTML/code generation is part of this milestone.

The content script owns the current tab's authoring session, selection, undo/redo history, runtime state, and reversible DOM projection. The panel sends commands and receives snapshots. Storage saves the graph, not the page DOM. A storage adapter isolates chrome.storage.local from workflow logic. A browser demo uses the same engine and panel with an in-memory bridge and localStorage.

## 2. Modification-operation schema

All plans are runtime-validated discriminated unions:

- Insert: `{ id, kind: 'insert', target: Locator, position: 'before' | 'after' | 'inside' | 'below', node: { id, kind: 'button' | 'panel' | 'text', text } }`
- Text: `{ id, kind: 'text', target: Locator, text }`

No raw HTML, scripts, CSS, event handlers, network calls, or model-chosen selectors are accepted. A planner can propose only a small node spec, text change, and relative placement. The trusted application attaches the selected locator and IDs. Below uses a flow-layout wrapper; before/after/inside preserve the host container's layout. Text edits of host elements are restricted to leaves so their children and listeners are preserved. All created buttons have type=button and intercept clicks before host handlers.

## 3. Element-locator strategy

Created nodes have workflow-owned stable IDs and are resolved through a private registry. Host locators combine tag, role, accessible label, normalized visible text, stable id/data-test attributes, ancestor hints, and adjacent text. Exact stable attributes must be unique and semantically compatible. Otherwise candidates are scored and accepted only above a confidence threshold with a clear margin over the runner-up. Ambiguity is reported as unresolved. No nth-child fallback. Selection never reads input values, cookies, tokens, or hidden credentials. The initial scope is the top-level light DOM; iframe and closed-shadow targets are out of scope.

## 4. Prototype/state model

A workflow has id, name, origin, exact route (path/query/hash), timestamps, entry state, maximum state count (default 10), states, operations, and interactions. Each state has an optional parent, title, view kind (base/panel), and local operations. Its effective projection is its ancestor operation chain plus a panel for each active child. An edge binds a source node in a state to a destination state. A child state inherits its ancestry, allowing each inserted panel/control to be selected and edited with the same authoring mechanism. Only edges for the current state fire. Cycles to existing states are allowed; ancestry itself stays acyclic.

Editing state and replay state are independent from saved graph structure. Replay begins at entry; Back follows runtime visit history. Save writes a working draft and an immutable numbered snapshot. Save version appends; restore copies an old version into the working draft without rewriting historical snapshots. Reload starts at entry with interactions intact. Versions retain the complete graph and locators.

## 5. Navigation and rerenders

Document-load content injection restores the enabled draft for the exact origin and route. Background webNavigation history/fragment events signal pushState, replaceState, and hash changes; popstate is also observed. Route changes remove the previous projection before loading the next route's saved draft. Debounced MutationObserver reconciliation repairs only missing or detached inserts and changed text targets. The observer is disconnected during our own writes, then reattached. Unresolved targets remain visible in the panel and are retried after host mutations. Disabling or changing workflows rolls back owned inserts/text changes without replacing the host DOM. Host edits that supersede our text are preserved during rollback.

## 6. Implementation plan and review gate

1. Establish runtime schemas, graph transitions, immutable versions, and tests.
2. Build conservative locators and reversible, idempotent DOM projection.
3. Add selection, command bridge, navigation handling, and local persistence.
4. Build the side panel around prompt → insert → click behavior → next editable state.
5. Add an honest offline command planner and optional server-side AI planning adapter.
6. Exercise Customers → Risk Analysis → Details → Approve → Confirmation, including undo/redo, save, reload, replay, version restore, ambiguous locators, and rerenders.
7. Ship the unpacked build and demo with install/test instructions. Stop at this architecture review gate before expanding styling tools.

## Boundaries

Prototype controls are local simulations. No host authentication, form submission, backend requests, or permissions are changed. This milestone supports state transitions; triggering live application controls and navigating external URLs are intentionally deferred. The optional AI service receives only the prompt and a minimal selected-element description, after the user explicitly enables AI mode. API keys stay in server environment variables.

# Account platform foundation

## Proposed architecture and delivered slice

`platform/server` is a small Node HTTP API backed by SQLite; `platform/web` is a React account application. They are separated by JSON APIs. The existing Chrome editor remains the primary authoring experience and continues using its local storage adapter. The platform does not silently sync local extension data or meter the legacy developer-only localhost planner. Account-backed AI requests use `/api/ai/plan`, which enforces authentication and usage on the server.

The platform UI covers landing, signup/login, forgot/reset password, `/app`, prototype details, `/pricing`, `/checkout/:id`, `/account`, and `/account/billing`. The prototype page can import/export the existing workflow JSON format, save draft definitions, duplicate, rename, delete, checkpoint, and restore. Its AI area is a plan preview; it does not apply UI changes to an external website. Wiring extension account login and automatic cloud sync is a subsequent integration, not implied by this milestone.

Implementation sequence: database migrations and policies → authentication/ownership APIs → prototype persistence and optimistic revisions → metered AI → billing provider/test checkout → account UI → fixtures and API/browser boundary tests.

## Database schema

The executable schema is `platform/migrations/001_initial.sql`. Migrations are recorded in `schema_migrations` and applied transactionally in filename order at startup. SQLite uses foreign keys, WAL, a busy timeout, and full synchronization. The database path is configurable. Keep the database and its WAL on persistent local disk; back them up together using SQLite-aware backup tooling before deployment. This is a single-service foundation, not a multi-region database design.

| Table | Purpose |
| --- | --- |
| users | ID, unique normalized email, optional name, salted password hash, timestamps |
| sessions | HMAC digest of opaque random token, user, web/extension type, expiry, creation |
| password_resets | One-use token digest, user, expiry |
| prototypes | Ownership, metadata/domain, monotonic version number, optimistic revision, timestamps |
| prototype_definitions | Current workflow graph/operations/locators as validated JSON, separate from metadata |
| prototype_versions | Immutable numbered workflow snapshots |
| subscriptions | User, provider/customer/subscription IDs, plan/status, period dates, scheduled cancellation |
| ai_actions | Idempotency key and request fingerprint, UTC monthly period, reservation/result/status; no raw prompt stored |
| checkouts | Owner, provider, price snapshot, pending/completed/expired status and expiry |
| analytics_events | Product event names and bounded application-owned properties; no passwords, prompts or tokens |
| rate_limits | Durable fixed-window counters for authentication, reset, AI and checkout requests |

Ownership is enforced with `WHERE id=? AND user_id=?` before every prototype operation, including versions, duplicate and restore. Inaccessible IDs return the same 404 as missing IDs. Client-supplied owner/subscription fields are rejected by strict schemas. Parameterized SQL is used throughout. Mutation counts and limits are evaluated within immediate transactions to avoid concurrent quota bypasses.

## Authentication and security approach

Passwords use asynchronous Node scrypt with a random 16-byte salt (N=32768, r=8, p=1) and timing-safe verification. Passwords are never logged or stored raw. Session tokens are 256 random bits; only HMAC digests are stored. Browser sessions last 30 days, persist across restarts, and use HttpOnly, SameSite=Lax cookies (Secure in production). Login creates a new session. Logout revokes it. Password reset expires after 30 minutes, is single-use, and revokes all of that user's sessions.

The local development session pepper is generated once into `.data/session-secret` with restricted permissions. Production requires an environment-provided `SESSION_PEPPER` and HTTPS `WANDEL_APP_ORIGIN`. The server checks request origins for cookie mutations (including login), uses an explicit extension origin allowlist, and never combines wildcard CORS with credentials. Extension bearer tokens are separately typed sessions: a web cookie token cannot be reused as an extension bearer token. Account settings can issue an extension token after password confirmation or revoke all extension tokens. Do not put these tokens into page DOM, URLs, content scripts, or analytics; keep them in the extension's trusted background/panel context.

Authentication endpoints, email-specific login/reset attempts, and authenticated AI/checkout requests have server-side rate limits. The server uses its socket peer address, not an untrusted forwarded-IP header; a deployment behind a proxy needs a carefully configured trusted-proxy policy to avoid sharing one IP limit across all clients. JSON request size is capped at 1 MB; secrets stay out of logs. API logs contain request ID, method, path and status. Static builds have a restrictive CSP. Production mock checkout is refused even if an environment flag attempts to enable it.

Reset delivery is injected through `MailProvider`. Development writes `.data/mailbox.jsonl` with restricted permissions and uses a URL-fragment token so it is not in HTTP request logs. Production startup requires an HTTPS mail webhook and bearer secret; the receiving mail service must render the password-reset template and deliver the email. A generic reset response avoids exposing whether an email is registered; delivery failures are logged without addresses/tokens. Email verification, OAuth, MFA, account deletion, session-device management and a background mail queue are deliberately outside this slice.

## Subscription and entitlement model

`platform/server/config.ts` centralizes prices and limits; `Entitlements` is authoritative for capabilities and remaining usage. Public pricing and account UI derive their values from the API. Default Free: 3 saved workflows, 20 monthly AI actions, depth 5 beyond the original view, 3 checkpoints. Default Pro: no commercial workflow/depth/version count limit, 500 monthly AI actions, version-history browsing/restoration. Private sharing is false for both plans until implemented. The existing editor/schema still has technical bounds (currently up to 30 states); an unlimited allowance is not a promise of infinite document size.

Depth currently means the longest state-inheritance chain, excluding the original view. Siblings do not consume each other's depth. Replay cycles do not create new inherited views and are not counted as unbounded depth. Draft saves never consume checkpoint slots. Free users can save checkpoints; browsing/restoring version history is a Pro capability. A canceled or expired subscription does not delete data. Over-limit users can read/export/rename/save existing drafts and delete workflows, but cannot create/duplicate more. Existing deeper definitions can be saved without increasing their depth. Historical versions are retained on downgrade even when history access is gated.

A subscription grants Pro only for active/trialing status with an unexpired period. Past-due, incomplete, free, canceled or expired subscriptions grant Free capabilities. Cancel-at-period-end preserves Pro until the stored end date. The mock provider does not renew or charge; its period expires naturally even if cancellation was not requested. Production renewal will come from Stripe events. AI allowances use UTC calendar months independently of billing anniversary dates; the API supplies the exact reset timestamp. Upgrades raise the current month's allowance without resetting usage.

## AI accounting

`POST /api/ai/plan` authenticates, rate-limits, validates the request, checks capabilities, and reserves one allowance slot in a database transaction before calling the provider. Concurrent reservations count against usage. A successful validated plan converts the reservation to a consumed action. Failure releases it. Pending reservations expire from the allowance after two minutes, recovering from a crashed worker; provider calls time out earlier. The stored result supports idempotent successful retries. Reusing a request ID for different input returns 409. Failed/pending request IDs cannot be reused; a deliberate retry uses a new ID. Limits return structured `AI_LIMIT_REACHED` responses and an upgrade URL, rather than silently ignoring a click.

`WANDEL_AI_MODE=mock` is development-only and visibly labeled in the UI. It returns a simple structured sample without an external call. Otherwise `OPENAI_API_KEY` and `OPENAI_MODEL` configure the provider. Only explicit prompt and selected element label/tag are sent. The original localhost planner is a standalone development tool, not a public platform endpoint and must not be exposed as a way around platform entitlements.

## Extension/backend API contract

All requests/responses are JSON. Browser clients send cookies with credentials. Extension clients send `Authorization: Bearer <account-token>` from an origin listed in `WANDEL_EXTENSION_ORIGINS`. API errors are `{error:{code,message,upgradeUrl?,resetsAt?,fields?},requestId}`. HTTP 401 means login is needed; 403 can mean an entitlement limit; 409 means revision/idempotency conflict; 429 is rate limiting with Retry-After. No route trusts client plan/status/owner fields.

| Method | Route | Request / result |
| --- | --- | --- |
| POST | /api/auth/signup | email, password, optional name → user + session cookie |
| POST | /api/auth/login | email, password → user + session cookie |
| POST | /api/auth/logout | revoke current session |
| POST | /api/auth/forgot-password | email → generic delivery response |
| POST | /api/auth/reset-password | token, password → revoke sessions, consume token |
| POST | /api/auth/token | authenticated password confirmation → extension token (shown once) |
| DELETE | /api/auth/tokens | revoke all account extension tokens |
| GET | /api/me | user + entitlements |
| GET | /api/plans | public limits, configurable price, test-mode flags |
| GET | /api/entitlements | effective plan, limits, capability booleans, usage |
| GET | /api/usage | used, allowance, remaining, periodStart, resetsAt |
| GET | /api/prototypes | caller's metadata list |
| POST | /api/prototypes | name, targetDomain, description?, definition? → new owned prototype |
| GET | /api/prototypes/:id | metadata + full definition + revision |
| PUT | /api/prototypes/:id | revision, name?, description?, definition? → saved draft |
| DELETE | /api/prototypes/:id | delete owned prototype and its snapshots |
| POST | /api/prototypes/:id/duplicate | copy draft with new IDs; checks workflow allowance |
| POST | /api/prototypes/:id/versions | revision → immutable checkpoint |
| GET | /api/prototypes/:id/versions | Pro-gated version metadata |
| POST | /api/prototypes/:id/restore/:version | revision → restore into working draft |
| POST | /api/ai/plan | requestId, prompt, selection:{tag,label} → plan + usage |
| GET | /api/billing | subscription, effective entitlements and price |
| POST | /api/billing/checkout | create owned checkout → id + redirect URL |
| GET | /api/billing/checkout/:id | owned checkout summary |
| POST | /api/billing/checkout/:id/complete | confirmTestPurchase:true → test subscription activation |
| POST | /api/billing/portal | provider-managed billing URL |
| POST | /api/billing/cancel | cancel at period end |

The prototype JSON definition uses the existing `WorkflowSchema` and graph validator. POST creates a valid empty base state if no definition is supplied. PUT requires the last revision received by GET: never overwrite a 409 without loading the newer draft first. `currentVersion` is the highest checkpoint number; restoring an old checkpoint updates the draft/revision but never rewinds or reuses checkpoint numbers.

## Mock → Stripe migration boundary

`BillingProvider` owns checkout creation, management and scheduled cancellation. `MockBillingProvider` owns the development-only completion transaction. There are no pretend Stripe calls, card fields, PAN/CVV storage or client-controlled plan updates.

To connect Stripe later:

1. Add a real Stripe provider using server-held API keys and configured recurring Price IDs. Map prices to plans only on the server.
2. Return the real Stripe Checkout URL from `start`. The frontend already navigates to the returned URL.
3. Return a Customer Portal URL from `manage`; implement cancellation through the real provider.
4. Disable/remove the mock completion route in the Stripe provider. A success redirect must only display status; it must never grant Pro.
5. Add a raw-body webhook endpoint, verify its Stripe signature, persist a unique provider-event ID, and transactionally update the existing subscription fields. Handle duplicate/out-of-order events and use provider subscription state as the authority.
6. Handle checkout completion, subscription updates/deletion, paid invoices and failed payments; map them to the already-supported status vocabulary and period dates. Test real Stripe behavior in test mode before enabling charges.

No live Stripe integration or deployment was performed. Production billing is intentionally unavailable until the real provider and verified webhook path are implemented.

## Analytics hooks

`Analytics.track` records signup/login, prototype create/save, AI requested/limit reached, upgrade clicked, checkout started, subscription started and subscription canceled. `LocalAnalytics` writes to SQLite. Swap the injected implementation for a later provider without changing product routes. Payloads contain application-owned flags, not raw requests or user content.

## Extension-first Clerk / Stripe integration (supersedes the earlier account-platform auth design)

The normal server uses Clerk JWT authentication; custom password endpoints return 410. The official Clerk Chrome Extension client obtains fresh tokens in the background using Sync Host. A side-panel-only message handler delivers tokens to the extension UI; content scripts cannot access tokens. Google OAuth completes on `/extension/sign-in`, then the user returns to the originating app panel. Clerk needs matching keys, Google enabled, and the specific extension origin allowlisted. Existing password users are not automatically merged by matching email.

`002_clerk_sync_stripe.sql` adds Clerk identity IDs, per-user workflow IDs, save idempotency receipts, and processed Stripe event IDs. The same SQLite database is used; deployment to a shared service is not part of the local connection. POST `/api/workflows` atomically checks the plan, revision and request fingerprint, and commits both definition and version. GET `/api/workflows` and `/api/workflows/:id` are owner-scoped. Unknown revision is a conflict for an existing workflow, never permission to overwrite it. A failed entitlement check writes nothing.

Chrome content sessions now use session storage via a background RPC restricted to `dx:` keys. A normal on-page Save requests the side-panel save chooser; `saveTemporary` explicitly writes only session storage. Prior persistent local records remain readable from the panel. Account saves are explicit network actions, with full workflow definitions and no form values. `acknowledgeSave` does not clear the dirty flag if the page changed while saving.

The main process uses the Stripe test provider when all required Stripe settings exist, otherwise an unavailable provider. The old in-memory/mock purchase flow is only retained for regression tests. Test Checkout sessions use a configured recurring price and idempotency; pending sessions are reused. Webhooks verify raw-body signatures and reject live-mode events, retrieve current Stripe subscription state to tolerate delayed events, and update entitlements transactionally with event receipts. Checkout success redirects never grant Pro. The API permits this webhook route without cookie CSRF validation because the Stripe signature authenticates it.

Upgrade is offered after a save entitlement denial. It opens hosted Stripe test checkout; the original draft remains in its application tab. After returning, a fresh save fetches the current token and server entitlements. Unfinished/rejected/canceled payments do not erase the draft. The original editor technical cap is 30 states, independent of commercial save depth.
