# Release verification — October 18, 2026 (America/New_York)

Source: main, `0d0e47d`. This is a verification record, not a public-release approval. No production configuration, store upload or payment was changed. The deployed service URL is still needed to verify production; local `.env` is not evidence of deployed settings.

## Results

| Check | Result | Evidence / boundary |
| --- | --- | --- |
| Automated regression suite | PASS | 359 tests across 47 files rerun on main. Includes graph authoring/replay, ownership, stale revisions, Clerk verification, rollback, UI editing, URL and token boundaries. |
| Builds / TypeScript | PASS | Standard, free, assistant and platform builds pass. |
| Runtime dependency audit | PASS | `npm audit --omit=dev`: zero known advisories at this check. This is not a complete security audit. |
| Full dependency audit | OPEN | Three affected development/test packages: Vitest (critical), Tinypool (critical), @vitest/mocker (moderate). npm suggests Vitest 4.1.12, a major upgrade from the current 3.x; not changed during verification. |
| Package secret check | PASS, scoped | Compared configured secret variable values against all three generated extension packages: no matches. Public Clerk configuration is expected. This does not detect every possible credential. |
| Account/assistant manifest | OPEN for public release | Broad HTTP/HTTPS content access and cookies permission remain. CSP and public config target localhost plus Clerk development. Production build/configuration and permission justifications are required. |
| Local free manifest | PASS, static | No host_permissions, declarative content_scripts, cookies or external sign-in bridge; `connect-src 'none'`. ActiveTab/scripting/storage/sidePanel/webNavigation remain. Actual clean-profile restart acceptance remains open. |
| Local DB migrations/integrity | PASS | All six migrations present; integrity_check=ok and foreign_key_check empty. |
| Local DB backup/restore | PASS | SQLite online backup reopened with matching row counts. Ignored `.data/release-verification/verified-backup.sqlite` contains private local data and was not added to Git. Does not verify hosted volume, backup schedule or disaster recovery. |
| Installed Chrome shared replay | PASS, existing profile | Anonymous landing discovers installed Wandel; Open experience creates a new app tab. Synthetic Risk Analysis button opens its connected prototype state. Back/reload retains replay. Screenshot: `docs/acceptance/installed-shared-playback.png`. |
| Installed account save | PASS, local server | Edited save name to `Verification — local shared playback`; Save to my account reported v1. App reload retained v1, two screens and the generated entry control. This intentionally created one synthetic account workflow, retained for inspection. |
| Installed share publication / revocation | PASS, local server | Created a link through the extension UI; an independent in-app browser loaded its snapshot without a Wandel account. Revoke reported success; reloading the recipient link then reported expired/revoked/unavailable. No original workflow was deleted. |
| Cross-profile recipient replay | WAITING | Active Work Chrome profile has no Wandel installed, which explains the installation message. Approval to install the local unpacked build was requested; installation not performed. Independent landing-page access is verified, full recipient replay is not. |
| MirrorTalk manual editing | PASS, scoped | On profile page, double-click renamed native Connect button; Cmd+D duplicated; copy renamed independently; Backspace deleted; Cmd+Z restored. Restore original page returned original Connect and removed the copy. No application submission was triggered. |
| Maeris modal manual editing | PASS, scoped | In Settings → Advanced, double-click renamed Test timeout; Cmd+Z restored. +Add exposed field types; added/renamed a prototype checkbox; I shortcut entered Interact; clicking checked the inserted control. Restore removed it and retained original settings (20-second timeout, 2-second wait). No host setting or backend save was changed. |
| Real-site AI generation / native styling | PARTIAL | Existing automated and earlier synthetic evidence retained. This session verified manual editing only, not reliable AI category generation across all real applications. Not a promise that arbitrary site behavior can be cloned. |
| Production API / Clerk Google auth | WAITING | Public HTTPS URL and deployed configuration access needed. Existing local Clerk session resolved to the owner account and completed a local account save. Fresh Google login, production extension allowlists and session transfer were not verified. |
| Full Chrome restart/update durability | OPEN | Account save + page reload and local DB reopen pass. Did not quit all of the user's Chrome windows or install a new free build without permission. Standard temporary saves remain explicitly session-only. |
| Stripe | NOT LIVE | Local Stripe credentials empty; runtime rejects non-test keys. Automated Stripe tests pass, but no hosted test checkout was completed in this verification. Live payments remain unsupported. |
| Store readiness | OPEN | No public privacy/support pages or completed listing assets found in the repository. Chrome developer dashboard redirected to Google “Verify it’s you” and requires the user’s reauthentication. Listing contents and submission state could not be inspected. Permission explanations, reviewer walkthrough and final candidate acceptance still required. |

## Candidate and retained evidence

- Local-only free candidate ZIP: `.data/release-verification/wandel-local-free-candidate.zip` (ignored, not uploaded).
- SHA-256: `69be3cf9937fdd37d742d1c46c1e537fda5f4b777ea0977c0069bbfbc673ee5c`.
- Manifest is at ZIP root, version 0.2.1, 17 packaged files. No env/database/log files included.
- This ZIP is a candidate, not an installed/store-approved release. Standard/assistant builds remain version 0.1.0; the installed store version, if any, was not established.
- Local audit/test logs and backup result are in `/tmp/wandel-*-audit.json`, `/tmp/wandel-release-verification.log`, and `.data/release-verification/` respectively. No credentials or account dumps were added to this report.
- Existing Chrome Errors page contained an `Extension context invalidated` entry on a previously loaded MirrorTalk page after an extension reload. Fresh-page manual editing worked. Do not confuse that old-context event with verified update/recovery acceptance; stale-tab lifecycle handling remains a check.

## Before beta submission

1. Supply/verify the production HTTPS origin, deployed revision, SQLite volume/backups and Clerk production configuration, or deliberately choose the isolated local-only release.
2. Complete clean-profile install → multi-step flow → explicit save → Chrome restart → load/replay and cross-profile share playback.
3. Resolve the development-toolchain advisories and rerun tests/build/package verification.
4. Complete accurate permissions/data disclosures, privacy/support URLs, store listing and reviewer instructions for the exact selected artifact.

Private visibility still requires the same policy compliance and review as other distribution modes. Sources checked October 18: [Chrome distribution](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution), [privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy), [MV3 requirements](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements).

Advisories: [Vitest mocker](https://github.com/advisories/GHSA-82fw-gwwq-j7x9), [Tinypool worker options](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3), [Tinypool run options](https://github.com/advisories/GHSA-85c8-ppgw-ccpr).
