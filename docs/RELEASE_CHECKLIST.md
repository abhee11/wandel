# Wandel release checklist

Updated October 17, 2026. Release direction: publish a useful free extension first; add paid features later. The free-launch checklist below is the immediate plan. The detailed cloud/account/billing checklist retained afterward is reference for a later release, not a prerequisite for a local-only free launch.


## Current beta decision

Target J1: Customers → Risk Analysis → Details → Approve → Confirmation → save v1 → restart Chrome → load/replay. Current validation: 220 tests passed and standard/free builds passed. Core editing and individual save/reload journeys have local browser evidence. The exact packaged free extension has not completed the full installed-Chrome journey, so this is a beta candidate rather than a release approval.

Chrome distribution: **Private** limits installation to designated Google-account trusted testers or a Google Group you own/manage. **Unlisted** allows anyone with the listing URL to install; it is not access restricted. Both visibility settings require review and the usual policies/disclosures. For a separate parallel beta listing, label the name BETA and identify its beta-testing purpose. Prefer Private for the first controlled cohort. See [Chrome distribution documentation](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution) and [submission steps](https://developer.chrome.com/docs/webstore/publish/).

Remaining before submission: installed free-candidate J1 evidence; permission/package review; developer account; store screenshots and reviewer instructions; accurate privacy policy and support contact. Upload/submission has not been performed. Local-only editing/replay requires no hosted API, database, Clerk or Stripe; hosted AI does.

## Free launch checklist — do this first

Recommended scope: local editing, workflow creation, replay and durable local saves, without sign-in or a payment requirement. A dedicated `dist-free` build implements this scope in code; installed-candidate acceptance remains open. Hosted AI, account sync and subscriptions can follow once the free version is useful and stable.

### 1. Define the free release

- [ ] Confirm the initial free feature set: select, rename, add/remove/duplicate, appearance, move/resize, undo/redo, workflow states, replay and saved versions.
- [ ] Keep bounded offline prompts, clearly labeled as presets. Remove AI connection setup from the public free experience; a new user must not need Node, an API key or a localhost server.
- [ ] Remove sign-in requirements, Upgrade/Pro prompts, checkout, billing management and account-only saving from the free build. Retain the existing account/billing implementation for future work.
- [ ] Set clear technical limits for workflow size and storage. Do not promise unlimited use or impose a limit whose only recovery is an unavailable upgrade.
- [ ] Defer mirrored host actions from the first public build to keep the initial experience focused on prototyping; ensure existing mirrored workflows cannot silently execute live actions when loaded. If retained, complete the mirrored-action safety and acceptance checks below before shipping.

### 2. Make saving dependable — installed verification remains open

The account build still has session-only temporary saves. The separate free build now uses background-mediated `chrome.storage.local`, has a local library and export/import, and removes account saving. Verify that exact free candidate through Chrome restart and update before closing the durability gate.

- [ ] Add durable local workflow/version saving using `chrome.storage.local`; make it the default Save action in the free build.
- [ ] Keep temporary drafts distinct from explicit saved versions. Explain what is saved, what survives a restart, and that local data does not sync across devices and is removed on uninstall.
- [ ] Preserve existing local records and provide a safe transition for available session drafts. Do not delete or silently overwrite previous saves.
- [ ] Provide local list/open/rename/duplicate/delete controls and clear storage-full errors that preserve the current draft.
- [ ] Add workflow export/import for backup, with schema validation and useful errors for invalid or incompatible files.
- [ ] Verify saved flows survive page reload, Chrome restart and extension update; test export/import round trips and restoration on the matching URL.

### 3. Produce a self-contained free package

`npm run build:free` now produces `dist-free` with no cookies permission, declarative host access or externally-connectable sign-in bridge, and a `connect-src none` policy. The standard account build retains service connections. Audit and test the generated free candidate; a build alone is not store acceptance.

- [ ] Add an explicit free build configuration that excludes unused auth, billing and AI connections and their runtime entry points.
- [ ] Remove `cookies` and unused connection origins from the generated free manifest. Review every remaining permission and broad HTTP/HTTPS access; document the need or reduce it.
- [ ] Confirm installed editing, saving and replay make no requests to Clerk, Stripe, the account API or the planner. Audit the packaged code for remote executable code and secrets.
- [ ] Build from a clean output directory with a recorded source revision and manifest version. Inspect the generated manifest and ZIP, not just source configuration.

### 4. Validate the actual user experience

- [ ] Run `npm ci`, `npm test` and `npm run build` using the free build configuration once implemented; add focused regression coverage for durable storage, migration and disabled service paths.
- [ ] Install the candidate in a clean Chrome profile with no local services running. Complete select → edit → build a multi-step flow → save → restart Chrome → open → replay.
- [ ] Verify undo/redo, Restore original page, panel close, tab switching and SPA navigation leave the original application usable.
- [ ] Test on at least three representative sites, including an SPA and a form-heavy page, using synthetic data. Check denied site access, missing anchors and unsupported pages produce useful messages.
- [ ] Check keyboard use, small windows, zoom, long editing sessions and the oldest supported Chrome version. Fix data-loss, broken-save and page-interference defects before submission.
- [ ] Update onboarding and README to describe the free experience, offline preset limits, local storage and unsupported page types accurately.

### 5. Prepare and submit the Chrome Web Store listing

- [ ] Register/secure the developer account and complete its registration requirements. A free product still requires the developer registration fee; see [developer registration](https://developer.chrome.com/docs/webstore/register/).
- [ ] Prepare the name, concise description, icons, screenshots of the shipped free build, support contact and a short first-workflow walkthrough.
- [ ] Publish a privacy policy matching the free artifact. Describe locally stored workflow text, selectors and URLs, deletion/export behavior and any actual network traffic; do not infer “no data handled” from “no account.”
- [ ] Complete the single-purpose statement, permission explanations and data-use disclosures according to [Chrome privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy).
- [ ] ZIP only the release output contents with `manifest.json` at the root; exclude environment files, databases, logs and unrelated project files. Record the ZIP checksum and test this candidate.
- [ ] Upload the ZIP, complete listing/distribution/test instructions, and submit for review using [Chrome's publishing steps](https://developer.chrome.com/docs/webstore/publish). Reviewer instructions must work without credentials or developer services.
- [ ] Start with a small tester cohort, resolve reported blockers, then publish publicly. Keep a support channel and a procedure for shipping a corrected higher-version package.

**Free launch gate:** a new user can install, create, save, restart Chrome and replay a workflow without an account, payment, API key or local server; the listing and privacy disclosures match that tested package. All required items above remain open until evidence is recorded. This planning update does not certify a build or submit anything to the store.

### 6. Add paid features later — not free-launch blockers

- [ ] Choose paid features from user feedback; candidates include cloud sync, hosted AI, collaboration and higher service quotas. Pricing and entitlements remain undecided.
- [ ] Keep the same store extension identity and preserve free users' local workflows through updates. Offer explicit opt-in migration/copying to an account rather than automatic upload.
- [ ] Implement and verify production hosting, authentication, database backups, account deletion and service quotas before enabling cloud features.
- [ ] Complete the existing billing checklist below before enabling paid checkout. Current Stripe integration is test-only; live payments require deliberate implementation and validation.
- [ ] Add pricing, usage limits, billing support and cancellation flows; test upgrades, failed payments, cancellations and downgrades without losing access to saved data.
- [ ] Update privacy disclosures and store copy for new network services, and test the upgrade from the published free version before release.

## Detailed cloud and paid-release reference

The sections below retain the previous broader release plan. Apply shared packaging, security and editor checks to the free build where relevant. Hosted-beta, Clerk, server, AI-service and Stripe requirements become release gates only when those features are included.

**Current conclusion: ready for focused internal testing, not yet verified for a public paid launch.** The latest recorded run has 99 passing automated tests and successful extension and platform builds. Those checks do not establish that production Google login, installed Chrome behavior, real payments or arbitrary application mirroring work.

Unchecked items remain open. “Implemented” means code exists, not that an external service is configured. No secrets or external dashboard settings were inspected for this document. Owners below are suggested roles to assign before release.

## Release gates and priorities

| Gate | Scope | Exit evidence | Suggested owner |
| --- | --- | --- | --- |
| P0 Internal acceptance | Real Chrome and a test application | Complete a flow, mirror controls, recover a draft, save and replay without data loss | Engineering and product |
| P0 Hosted beta | Hosted API, durable database, Clerk Google login, usable AI setup | A new user installs and completes a flow without developer tools or a localhost dependency | Engineering |
| P0 Store submission | Package, permission review, privacy disclosures and reviewer access | Exact candidate ZIP passes installed-extension testing and store review | Engineering and product |
| P0 Paid launch | Real billing integration and operational readiness | Test billing acceptance complete, deliberate live-mode implementation, recovery and support procedures ready | Engineering and operations |
| P1 Expansion | More applications, richer flows, collaboration | Measured demand and regression coverage | Product |

Do not market hosted AI, unlimited flows or live subscriptions before the relevant gate passes. A clearly labeled internal beta can continue with local services and test billing.

## Chrome deployment checklist

- [ ] Register and secure the Chrome Web Store developer account, including two-step verification. Assign a release owner and a backup. See [Chrome program policies](https://developer.chrome.com/docs/webstore/program-policies/policies).
- [ ] Establish the final store extension ID before configuring production Clerk and API origin allowlists. Keep development and published IDs explicit. `WANDEL_EXTENSION_KEY` accepts a public CRX key, never a private signing key.
- [ ] Choose an initial private or unlisted beta distribution appropriate to the testers. Prepare a short description, icon assets, screenshots, support contact and reviewer instructions showing a complete workflow.
- [ ] Review every permission in the **built** `dist/manifest.json`. The build adds `cookies` for Clerk sync; the source manifest alone is not the release artifact.
- [ ] Justify or reduce broad HTTP/HTTPS host access, declarative content-script injection, `webNavigation`, `scripting`, `activeTab`, `storage`, `sidePanel` and cookies access. Decide whether optional per-site access can replace broad access without breaking the product.
- [ ] Audit packaged dependencies for remote executable code, dynamic script loading and evaluation. Keep extension logic bundled; model responses must remain validated data. Review [Manifest V3 remote code guidance](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code).
- [ ] Validate the final CSP against actual Clerk and API traffic. Remove development localhost connections from the public build unless a documented local-connection feature intentionally needs them.
- [ ] Increment the manifest version, record the source revision and lockfile, and create a reproducible release build. Start from a clean output directory so stale assets cannot enter the ZIP.
- [ ] Run the commands below, load the exact `dist` directory in a clean Chrome profile, then test an update over the previous installed version.
- [ ] ZIP the **contents** of `dist`, with `manifest.json` at the archive root. Exclude `.env`, databases, logs, source attachments, signing secrets and unrelated workspace files. Inspect the ZIP before uploading.
- [ ] Complete store listing, privacy declarations, permission explanations and test instructions. Use a dedicated test account with synthetic data. Submit for review and choose a controlled publication date. See [Chrome publishing instructions](https://developer.chrome.com/docs/webstore/publish) and [privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy).
- [ ] Confirm fresh install, extension update, service-worker restart, browser restart and uninstall behavior. Chrome 116 is the declared minimum; test that version or raise the minimum to the oldest version actually supported.

```sh
npm ci
npm test
npm run build
npm run platform:build
```

These commands build and test locally. They do not deploy, configure external accounts or publish the extension.

## Security and privacy checklist

### Data and credentials

- [ ] Document each data flow: local drafts in `chrome.storage.session`; account workflows in SQLite; explicit prompts and selected labels sent to the planner/provider; Clerk authentication; Stripe-hosted payment entry.
- [ ] Review/redact sensitive page content before saving or sending it. Typed input values are deliberately excluded, but labels, copied text, workflow titles, selectors and URL query strings/fragments may still contain personal or confidential information. Do not claim “no page data collected.”
- [ ] Define retention and deletion for drafts, saved workflows, versions, account records, logs and backups. Provide account deletion and data export procedures before public launch; verify what happens when a Clerk account is deleted.
- [ ] Keep Clerk secret keys, AI credentials, Stripe secrets, webhook secrets and `SESSION_PEPPER` server-side. Scan both generated bundles and release archives for secrets. Store deployed secrets outside source control and establish rotation procedures.
- [ ] Re-test the token bridge: only the intended extension panel can request Clerk tokens; content scripts and host-page JavaScript cannot access them. Validate sender ID, tab ownership and frame for every sensitive runtime message.
- [ ] Ensure logs and error reporting omit tokens, prompts, page text, full sensitive URLs and field values by default. Review what third-party monitoring would collect before enabling it.
- [ ] Publish a privacy policy that matches actual behavior and Web Store disclosures, including optional cloud saves, AI providers and mirrored live actions. Complete an appropriate legal review for the intended users and regions.

### Boundaries and abuse protection

- [ ] Validate auth issuer, session expiry and authorized parties; test expired tokens, sign-out, account switching and cross-account access attempts. CORS is not a replacement for authentication.
- [ ] Enforce production origin allowlists and ownership checks on every workflow/version/billing endpoint. Disable development wildcard extension-origin acceptance and legacy/mock authentication paths in production.
- [ ] Preserve schema validation and safe DOM construction. Reject arbitrary HTML, scripts, event attributes, executable URLs, malformed graphs and oversized plans or snapshots. Treat website text and AI output as untrusted data.
- [ ] Audit save, AI and checkout rate limits, concurrency, body limits and per-account quotas. Behind a reverse proxy, configure client-IP handling deliberately; do not trust arbitrary forwarded headers.
- [ ] Review dependency advisories, lockfile integrity, licenses and native database dependency compatibility. Add these checks to CI and define a patching schedule.
- [ ] Require HTTPS for hosted endpoints, restricted cookies where applicable, appropriate CSP and security headers. Test cross-origin requests and raw webhook handling through the deployed proxy.

### Mirrored actions

- [ ] Keep mirroring explicit and inactive during editing. Explain that Try flow can run the original application's real action, including submission or navigation.
- [ ] Test that a prototype transition overrides a mirrored click, missing/ambiguous sources fail clearly, and repeated clicks do not unexpectedly submit twice.
- [ ] Use synthetic test accounts for mirroring acceptance tests. Decide whether destructive or financial source actions need an additional product safeguard before broad release.
- [ ] State supported behavior accurately: standard click/input/change forwarding is implemented; trusted-event-only actions and custom widgets are not universally reproducible. Undo restores prototype changes, not backend effects caused by a mirrored action.

This checklist is a release review plan, not a completed security audit.

## Hosting and database deployment

**Current implementation:** the Node server defaults to `127.0.0.1:4320` locally and `0.0.0.0` in production; port precedence is `WANDEL_PORT`, hosting-provided `PORT`, then `4320`. `WANDEL_HOST` overrides the bind address. It serves `dist-platform/web`, and uses `better-sqlite3` at `WANDEL_DB` (default `.data/wandel.sqlite`). SQL migrations run at startup from `platform/migrations`. There is no verified shared production deployment.

Recommended initial topology: HTTPS reverse proxy → one Node API instance → SQLite on a persistent local volume. The same deployment can serve the homepage and browser auth/checkout-return helpers. If choosing a managed SQL service or multiple writers, plan a database adapter/migration project; the current code is not a drop-in PostgreSQL client.

- [ ] Choose domains and hosting; separate development, staging and production data, credentials and webhook destinations.
- [ ] Deploy compiled server code, web assets, migrations and required runtime dependencies. Verify supported Node version and the `better-sqlite3` native binary on the target platform.
- [ ] If using a same-host reverse proxy, retain the loopback listener. If using container networking, use the production default `0.0.0.0` or explicitly set `WANDEL_HOST=0.0.0.0`, and keep public access behind HTTPS. For a same-host reverse proxy, set `WANDEL_HOST=127.0.0.1` when needed.
- [ ] Verify the database parent directory is writable; startup creates missing parent directories with restricted permissions. Persist database files across redeploys. Do not run SQLite on ephemeral storage or assume independent replicas share data.
- [ ] Take transactionally consistent SQLite backups, including correct WAL handling. Encrypt/restrict backups and test restoration into an isolated environment. Set recovery-time and acceptable-data-loss targets.
- [ ] Rehearse migrations on a production-like copy. Back up before migration and document app/schema compatibility for rollback.
- [ ] Add deployment health/readiness checks, uptime/error alerts, storage monitoring and webhook/AI failure alerts. Test a controlled restart and interrupted save.
- [ ] Ensure auth and checkout helper deep links work on a direct reload. Verify deployed CSP allows required Clerk flows without broadening it unnecessarily.

## Environment and authentication setup

| Configuration | Location | Required work |
| --- | --- | --- |
| `WANDEL_APP_ORIGIN` | Build and server | HTTPS origin serving homepage and auth/checkout helpers |
| `WANDEL_API_ORIGIN` | Extension build | Hosted API origin reachable from the installed extension |
| `VITE_CLERK_PUBLISHABLE_KEY` or legacy `CLERK_PUBLISHABLE_KEY` | Build and server | Matching public key; CLI name takes precedence |
| `CLERK_SECRET_KEY` | Server only | Secret for identity verification and server-side user lookup |
| `CLERK_SYNC_HOST` | Extension build | Host of the web app whose Clerk session is synced; verify against the installed SDK and real cookie behavior |
| `WANDEL_EXTENSION_ORIGINS` | Server | Exact `chrome-extension://…` origins for approved builds |
| `WANDEL_EXTENSION_KEY` | Build, optional | Stable public CRX key where needed |
| `WANDEL_AUTH_MODE` | Server | `clerk`; leave legacy auth out of the production flow |
| `NODE_ENV`, `SESSION_PEPPER` | Server | Production mode; stable random pepper of at least 32 characters, kept secret |
| `WANDEL_DB`, `WANDEL_PORT` | Server | Persistent database path and internal port |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Planner/API server | Valid provider access and supported model; never bundled |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` | Server | Matching test credentials for the current integration |
| `WANDEL_PLAN_LIMITS` | Server, optional | Explicit approved free/paid limits, aligned with UI copy |

- [ ] Create/configure the Clerk production instance and domain. Confirm the Native API requirement for the Chrome Extension SDK and review its bot-protection implications. See [Clerk extension deployment](https://clerk.com/docs/guides/development/deployment/chrome-extension).
- [ ] Enable Google sign-in and complete its production OAuth client, consent and redirect setup as required by Clerk. “Google login” does not mean Gmail inbox access; Wandel does not need Gmail scopes for authentication.
- [ ] Add the final extension origin to Clerk's allowed origins and the API allowlist without deleting unrelated entries. Set allowed redirects for the hosted sign-in helpers. Confirm production configuration using [Clerk's deployment guide](https://clerk.com/docs/guides/development/deployment/production).
- [ ] Test extension → browser Google sign-in → extension session sync, sign-out, expiration and a second Google account. The implemented Google OAuth flow uses a browser helper tab, not an entirely embedded side-panel flow.
- [ ] Test the same account saving and loading from two browser profiles against the same deployed database. Confirm another account cannot access those records.
- [ ] Rebuild the extension after changing public build variables. Rebuild/restart the hosted components as appropriate; changing `.env` alone does not update installed bundles.

The custom build reads the project `.env` and process environment; do not assume another framework's `.env.production` convention applies automatically. Production `syncHost` should be verified as the sign-in web application's host, not blindly copied from the Clerk API domain.

## Stripe setup and paid release

**Implemented:** extension-initiated hosted test Checkout, signed webhook processing, event deduplication, subscription updates and a billing portal route. **Not ready for live payments:** startup rejects non-test secret keys, and the webhook integration rejects live events. Adding live keys alone will not work.

- [ ] Configure a test recurring monthly USD price and the test billing portal. Confirm displayed pricing and plan labels match the actual Stripe price.
- [ ] Register `/api/billing/webhook` on the hosted API. Subscribe to the currently handled checkout completion and subscription create/update/delete events. Use that endpoint's signing secret, not the local CLI secret.
- [ ] Preserve the raw body for signature verification. Test invalid signatures, duplicate deliveries, delayed events, cancellations and subscription replacement. See [Stripe webhooks](https://docs.stripe.com/webhooks).
- [ ] Complete successful, declined and authentication-required payments using Stripe test data. Confirm canceled checkout keeps the draft, retries do not create duplicate subscriptions, and redirects alone never grant Pro. See [Stripe testing](https://docs.stripe.com/testing).
- [ ] Verify upgrade appears only when account saving exceeds entitlements. Building a flow and keeping a temporary draft must remain available without checkout.
- [ ] Add a clear way to refresh payment status and retry the save while webhook delivery is pending; retain the exact draft throughout.
- [ ] Before paid launch, implement explicit test/live mode support with separate price IDs, webhook secrets and deployment safeguards. Verify failed renewals, cancellation timing, refunds and chargebacks against a written entitlement policy.
- [ ] Assign billing support, refund/cancellation policies and receipt/tax responsibilities. Do not advertise a paid live subscription while test-only enforcement remains.

## AI deployment and connections

- [ ] Verify the extension's default authenticated `/api/ai/plan` route on the deployed service with a signed-in Chrome user. The local `http://127.0.0.1:4319` planner is now an optional fallback connection.
- [ ] Wire hosted AI to Clerk auth, server-side usage limits, retry/idempotency behavior, cost monitoring and clear model/provider errors. Validate plans on both sides.
- [ ] Decide what “bring your own connection” means: a local companion, a hosted provider connection or another supported option. A developer-managed `.env` is not a finished user-facing BYOK product.
- [ ] Publish accurate disclosure of what is sent to the model. Selected labels and prompts can contain private information; avoid silently expanding collection to the whole DOM.
- [ ] Test unavailable provider, timeout, invalid plan, quota exhaustion and selection/navigation changes while planning. Keep the draft unchanged on failure.
- [ ] Keep the homepage labeled as a preset demonstration. Its scripted transformations are not evidence that arbitrary AI requests will work.

## Missing functionality and known limits

| Gap or limit | Current state | Priority or decision |
| --- | --- | --- |
| Installed Chrome acceptance | Sandbox browser checks and automated tests exist; real-app coverage remains incomplete | P0 beta gate |
| Public AI onboarding | Hosted account route implemented; deployed sign-in, model configuration and full Chrome round trip still need verification | P0 public beta |
| External service verification | Production Clerk/Google, shared saves and Stripe test checkout need end-to-end evidence | P0 hosted beta |
| Live payments | Explicitly blocked by implementation | P0 paid launch |
| Data controls | Account deletion, export and retention need product/operations completion | P0 public launch |
| Draft durability | Local drafts disappear when the browser session ends or extension reloads | Explain clearly; consider export or durable local opt-in |
| Paid “unlimited” flows | Commercial limits can be null, but schema caps remain: 30 states, 200 operations per state; copied trees are bounded and API bodies capped at 1 MB | Define honest limits; engineer higher limits before promising them |
| Rich screen generation | Child states are editable panels; “On click” alone does not generate an arbitrary finished screen | Improve templates and AI-assisted multi-step creation |
| Complex app support | Frames, closed shadow roots, canvas UIs, virtualized/replaced DOM and trusted-event widgets are not universally supported | Publish support boundaries; prioritize observed failures |
| Exact duplication | Basic text/layout/control copies work; embeds, images and SVG fidelity are incomplete | P1 based on beta usage |
| Robust mirroring | Standard DOM events supported; custom app state and permissions may prevent equivalent behavior | P0 clear failure states; P1 broader compatibility |
| Sharing and collaboration | Private sharing is not enabled; no verified collaborative review experience | P1 product decision |
| Version/conflict UX | Revision checks exist; polished visual comparison, merge and conflict recovery need validation or development | P1, with no-data-loss handling required for beta |
| Accessibility and keyboard UX | Shortcuts exist; focus order, screen readers, zoom and app shortcut conflicts need review | P0 usability gate |
| Automated release operations | CI packaging, signed release provenance, monitoring and rollback are not established by local builds | P0 release operations |

## Acceptance test and launch record

Run this against the **installed candidate extension**, first on a controlled fixture and then a real test account in MirrorTalk or another target application. Record Chrome/OS version, extension version/ID, API environment and evidence. Do not test real submissions using production customer data.

- [ ] Fresh install: open Wandel on one tab; another tab stays untouched. Denied site access has a useful recovery path.
- [ ] Select a nested button label; rename, drag, resize and undo. Confirm host listeners and layout restore correctly.
- [ ] Add a control using both a shortcut and an insertion point; change its default name immediately.
- [ ] Duplicate a button and a field; edit the copy independently. Opt into mirroring and verify it runs only in Try flow. Test a removed source and a host rerender.
- [ ] Build Customers → Risk Analysis → Details → Approval. Move backward through breadcrumbs, edit a child state, then replay from entry.
- [ ] Test element/section/page prompts, failed AI requests and stale selections. One prompt should undo as one change.
- [ ] First Escape releases editing; second Escape checkpoints and collapses. Reopen and recover; test reload, browser restart and extension update against the documented durability limits.
- [ ] Save to an account, reload on the matching page and replay. Test URL mismatch, two-account isolation and stale revisions from two profiles.
- [ ] Exceed free depth/version/workflow limits only at account save. Confirm temporary saving remains available. Complete/cancel test checkout and retry the same save without duplicate versions.
- [ ] Restore the original page, close the panel and navigate away. Confirm no overlays, listeners or prototype changes interfere with ordinary application interaction.
- [ ] Exercise long pages, small windows, 200% zoom, keyboard-only use and reduced motion. Record unsupported app behavior clearly.
- [ ] Run sustained editing/replay to check memory, observer activity, storage growth and latency on a representative large application.

For every release, record: named owner, candidate build/ZIP checksum, test evidence, open defects, known limitations, backup timestamp, deployment time and rollback procedure. A Chrome rollback usually requires publishing a corrected package with a newer version; retain the last known-good source and compatible server build. Start with a small invited cohort and collect concrete friction reports before expanding.

## Code and evidence references

- `extension/manifest.json`, `scripts/build.mjs`: permissions, CSP, packaging and public configuration.
- `extension/content/session.ts`, `renderer.ts`, `pageEditor.ts`: edit lifecycle, mirroring, recovery and contextual controls.
- `extension/ai/planner.ts`, `scripts/ai-server.mjs`: current local AI connection.
- `extension/background/account.ts`, `platform/server/clerk.ts`: token isolation and Clerk identity mapping.
- `platform/server/main.ts`, `db.ts`, `config.ts`, `workflows.ts`, `stripe.ts`: deployment, limits, persistence and billing.
- `.env.example`: configuration names only; never put actual credentials in this checklist.
- [Validation record](VALIDATION.md) and [architecture notes](ARCHITECTURE.md): supporting project documentation.

### Development Clerk setup update

October 4, 2026: official CLI linked the existing Wandel app and pulled development configuration without scaffolding over the existing integration. Doctor passes; Google and email sign-in are enabled; the browser helper renders Google, email/password and sign-up controls. Production is not configured. First user sign-in, installed-extension session sync and an authenticated account save still require end-to-end verification.
