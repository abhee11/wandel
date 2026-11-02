# Prototype → application implementation

Checkpoint: 2026-10-19. Implemented locally; live GitHub App authorization and a real repository PR still require configuration and acceptance testing.

Validated: 422 tests passed across 57 files; standard extension, free extension and platform builds passed; `git diff --check` passed. Browser verification confirmed a duplicate + text edit in the copied specification. The rebuilt local API started successfully and its GitHub endpoint correctly returned 401 without authentication. [Browser evidence](acceptance/implementation-handoff.png).

## User journey

1. Make UI changes and connect views in Wandel.
2. Click **Build this flow →** in the extension footer.
3. **Copy implementation prompt** to hand the current prototype to a coding agent that has the application source. This works without an account or server. **Download reference bundle** saves a JSON document containing the brief, specification, and available screen thumbnails.
4. For the integrated route, choose **Choose GitHub repository**, sign in to Wandel, and connect GitHub. Install the Wandel GitHub App on the selected repository, return, and refresh the list.
5. Select the application repository, base branch and optional project folder such as `apps/web`. Add component locations, backend expectations, or test commands in the notes. Explicitly consent to sending the selected source and brief to Wandel and OpenAI.
6. Generate a proposal. Inspect every file diff and unresolved question. An insufficient-context result asks questions and cannot create a PR.
7. Confirm review and click **Create draft PR**. Wandel creates a new `wandel/implement-*` branch and a draft PR. It never merges or force-pushes the base branch.
8. Review GitHub CI results for that exact commit. No checks, inaccessible checks, or skipped-only checks are unverified. Passing reported checks does not prove visual or complete functional equivalence.

Changing the prototype after generation disables publication until a new proposal is generated. The latest job can be reopened during the browser session with Refresh GitHub; server records survive service restarts. Jobs interrupted while generating require regeneration; reviewed proposals can be retried. After losing the browser session's job ID, the server record is retained but no job-history picker is provided yet.

## Server setup

Keep existing Clerk, database, origin and OpenAI configuration. Add these server variables; never put the secret in a `VITE_*` variable or the extension:

```dotenv
GITHUB_APP_CLIENT_ID=
GITHUB_APP_CLIENT_SECRET=
GITHUB_APP_SLUG=
WANDEL_IMPLEMENTATION_ENABLED=true
OPENAI_IMPLEMENTATION_MODEL=
```

The model defaults to the existing `OPENAI_MODEL` when the implementation model is blank. Both a configured model and `OPENAI_API_KEY` are required. The feature is disabled by default in `.env.example`.

Register a GitHub App with:

- Callback URL: `https://wandel-production.up.railway.app/api/github/callback` for the current deployment. This must match `WANDEL_API_ORIGIN` (or the app origin if API origin is absent). For a separate local test App use `http://127.0.0.1:4320/api/github/callback`.
- Expiring user authorization tokens and OAuth authorization enabled. Wandel uses the App's client ID and client secret, with PKCE and single-use state. It does not need an App private key for this flow.
- Repository permissions: Contents read/write, Pull requests read/write, Checks read, Commit statuses read, Metadata read.
- Installation restricted to the repositories the tester chooses. No webhook is needed; status is polled.

Use one API process/replica with the existing persistent SQLite volume. Migration `007_github_implementation.sql` applies at startup. Keep `SESSION_PEPPER` stable: GitHub credentials, job records and source context use authenticated encryption derived from this secret. Rotating it makes existing encrypted records unreadable and requires reconnecting/regenerating. Back up the database/secret using the existing deployment procedure.

User tokens are server-only and expire after at most eight hours; reconnect when expired. Disconnect removes Wandel's credential and pending OAuth state. To revoke the App installation itself, use GitHub's Installed GitHub Apps settings. Disconnect does not delete already-created branches or PRs.

## Data and execution boundaries

The prompt describes the recorded changes, routes, native styles, conditions, effects, and implementation acceptance criteria. It removes runtime prototype variable values, common credential/email patterns, and URL query strings/fragments. This is not comprehensive personal-data anonymization: page labels and route paths may still contain private information. Review the prompt before sharing it. The reference bundle contains actual captured images; review those separately.

The integrated generation request removes captured screen thumbnails, replaces uploaded image bytes with a placeholder, and clears runtime prototype variables. The coding model receives the brief and bounded application source, not screenshots or the GitHub access token. OpenAI provider storage is disabled for the request. Repository text is treated as untrusted reference data.

Source context is limited to sixteen supported text files, forty KB each and 160 KB total. Selection prioritizes root documentation/package manifests and app/route/style files. Set a project folder for monorepos. The model must report missing context instead of inventing source. Existing files not fully read cannot be overwritten. The beta accepts at most twenty installations and one hundred repositories per installation; larger installations should select fewer repositories.

Generation permits at most twelve changed/new source files, 200 KB total, with a 12,000-output-token cap. Protected paths, common credential files, dotfiles, CI, lockfiles, deployment configuration, and detected credentials are blocked. File deletions and binary assets are not supported. Each successful proposal consumes an existing monthly AI action; failed generation refunds that reservation. Additionally, generation is limited to five requests per user per day and one active job per user. Code generation can cost more than a normal edit; these are beta limits, not a full cost-based billing system.

Generated repository code is **not executed on the Wandel server**. Verification uses the repository's existing GitHub CI. Private-repository CI policy may require a maintainer to authorize a run. Wandel does not add or change CI workflows. Use a sandboxed runner in a later phase if pre-PR command execution or automatic visual comparison is required.

Browser DOM edits cannot reveal backend implementation, authorization policy, production schemas or original handlers. Those gaps remain explicit in the brief and proposal. This feature does not guarantee automatic implementation of arbitrary sites without their source.

## Verification

Automated coverage includes export redaction, native style references, OAuth/PKCE ownership and replay protection, encrypted records, proposal review gating, idempotency, revoked access, forbidden/unread files, insufficient context, failed-provider refunds, monthly quotas, exact-commit CI aggregation, and recovery when a branch exists after PR creation failed. UI tests cover the copy fallback, absent configuration, source-sharing consent, and publication blocked after prototype changes.

Manual local check: duplicate an element, edit its label, open Build this flow, and copy/review the prompt. Confirm the structured specification includes both the insertion and the label change. Save the JSON bundle and inspect available screen references.

Before enabling the integration for testers, verify with a disposable repository:

- OAuth returns to the correct account; only installed repositories appear.
- A small real app change produces an accurate proposal and diff.
- Rejecting review publishes nothing; accepting creates a draft PR on a new branch.
- Base branch movement and branch policies fail clearly without overwriting work.
- Retrying a partial publication reuses the validated branch.
- CI pending, success, failure and absent checks match GitHub for the exact head commit.
- Review the actual UI and behavior; close the draft if the result is unsuitable.

Reference contracts: [GitHub App user authorization](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app), [Git database API](https://docs.github.com/en/rest/guides/using-the-rest-api-to-interact-with-your-git-database), [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).
