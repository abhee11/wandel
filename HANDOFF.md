# Wandel – handoff (2026-11-05)

Read this first. Everything below is committed and pushed to `main`.

## What Wandel is
A Chrome extension and server. The user types a design change in a panel ("duplicate this card 3 times in the row below"). The server asks an OpenAI model for a plan, and the extension applies it to the live page as a reversible preview. It doesn't change the real app.

- Extension: `extension/` (panel `assistant/AssistantPanel.tsx`, executor `assistant/execute.ts`, page runtime `content/`)
- Server: `platform/server/` (prompt assembly and OpenAI call in `platform/server/assistant.ts`; prompt text in `extension/assistant/providerSchema.ts`)
- Operation schema: `extension/shared/model.ts`
- Real test page: https://mirrortalk.ai/groups/102949?activityContainerId=254402

## Rules from the owner
- Keep testing cheap: free checks first, then at most 1–2 real AI requests per fix. No big test suites.
- Fix things in general, not for one request. Never turn checks off to make something "pass".
- Explain failures honestly, with the real cause. Say plainly what was and wasn't tested.
- After every fix, the owner expects push + server restart + extension reload to happen without them. `dev:local` (below) does this.
- Don't hand the owner long step lists; do it, or ask one clear thing.

## Running locally
- **`Start Wandel.command`** (double-click in Finder) or `npm run dev:local`: stops any old server on port 4320, builds the extension and the server, starts the server, then keeps running. It polls `extension/` and `platform/` for changes, rebuilds, restarts the server (and restarts it if it crashes), and pushes new commits on `main` every ~10 s. Its log (and the server's output) is in **`.data/dev-local.log`**.
- After each extension rebuild it writes `dist/dev-reload.json`. In local builds (API on 127.0.0.1) the extension's background watches that stamp and reloads itself, then reloads tabs on sites where Wandel was opened (`extension/sidepanel/devReload.ts`). This is not fully reliable: if Chrome keeps old content-script code, reload Wandel once in `chrome://extensions` and refresh the page.
- Type check: `npx tsc --noEmit -p .`
- The repo's `node_modules` are macOS builds; run builds on the Mac.

## Free checks (no AI)
`npx vite --port 5180 --host 127.0.0.1`, then open `http://127.0.0.1:5180/demo/fixtures/visibility-check.html`. Seven cases, each in a fresh frame through the real context → compile → render → verify path. All pass as of `3c6ca1d`:
1. Card hidden until a click, shown below on click, removed by Undo
2. Toggle
3. Hidden at load with nothing that shows it → reported (rolled back)
4. A container the page hides still reports the new card
5. New menu item with no destination shows a hidden card
6. Copy of an icon-only sidebar item named X (label visible, no borrowed icon)
7. New menu option opens its own page; the original option ("General") returns
Older fixture: `demo/fixtures/mirrortalk-group.html` (globals `context()` and `apply(actions)`).

## Diagnosing without asking the owner
- `.data/wandel.sqlite`, table `ai_actions`: every AI request with its plan or verdict. Failed requests now store `{error, rejectedPlan}` in `result`.
- Table `analytics_events`, name `edit_failed`: every failed or warned edit the panel reported (detail, instruction, plan, page).
- `.data/dev-local.log`: build errors, restarts, pushes, server output.

## Local-dev test hooks (only when the API is on 127.0.0.1)
Page events handled by Wandel's content script (`extension/content/index.ts`), for browser automation:
- `wandel:dev-open` opens the Wandel panel in that tab.
- `wandel:dev-chat` with `detail = JSON.stringify({instruction})` runs context → plan (via background `WANDEL_DEV_PLAN`) → apply. Result arrives as `wandel:dev-chat-result` (JSON string: `plan`, `applied`, `unresolved`, or `error`). No visual review or replanning.
- `wandel:dev-state` → `wandel:dev-state-result`: current workflow, state, mode and problems.
Note: Claude in Chrome blocks other extensions' iframes in tabs it controls, so Wandel's panel cannot load there; use these hooks instead, or a Chrome you launch yourself with `--load-extension=dist`.

## Done (2026-11-04/05)
- **Shared intended visibility** (`extension/content/visibility.ts`): the renderer records what the prototype hides on purpose (until a click/hover, on request, deferred in a closed menu or screen). Layout inspection (`nativeDesign.ts inspectLayout`) and the plan's checks (`visualVerification.ts`, `controlVerification.ts`, `execute.ts verify`) skip it; content hidden by accident still fails and names the hiding container; a load-time hide nothing reverses is reported. Revealed content is re-checked once shown (`Behaviors.onReveal` → `Renderer.checkRevealed` → `Session.revealed`, issues prefixed "After it was shown:"). The visual review is told click/hover-revealed content is expected to be absent (`revealNote` in AssistantPanel).
- **Diagnostics** (`extension/shared/diagnostics.ts`): grouped, actionable warnings replace "N edits aren't showing". Hidden while the panel asks whether the page belongs to the workflow.
- **Progress** beside Cancel above the composer, from real stages, never in the conversation.
- **Navigation persists** (`session.ts lead()`): a menu/tab/switcher still shown on a screen it opened keeps going to its other screens; an option with no connection of its own (the original "General", or a block option) returns to the screen it was picked from.
- **Menu copies**: copied pick-one options get choice behavior (`choice` op, `behavior.ts addChoice`). Links without a destination are allowed as prototype items. Copies of icon-only items get a visible label of their own and drop the source's icon (`content/duplicateHeading.ts`).
- Rejected plans show their rule in chat; the panel/notice no longer overlap the composer.

## Open issues (not yet resolved)
1. **Tests 2 and 3 have not been re-run on MirrorTalk after the latest fixes.**
   - Test 2: "Add a left menu option X and then Clicking X should append a full-width card below the current section called "Home Options", with some text." Expect: X as a plain unselected item with a visible label, card hidden, click X → card below, Undo removes both.
   - Test 3: "Clicking the "My Record" title should show or hide a full-width card below the current section called "Quick Notes", with some text. Start with it hidden." Expect: hidden; clicks show/hide/show; Undo.
2. **"3 edits couldn't find their elements"** on the Decimal Concepts Review activity: the Quick Notes insert and its two behaviors (from a 05:24 run) no longer resolve their targets. Cause not found yet. Check with `wandel:dev-state`.
3. At 05:25 three plans ran that were not the user's request ("Expand contents" toggle hiding the transcript); all rolled back. Trigger unknown (possibly a Fix it / Retry).
4. Owner asked: on a menu item click, the highlight should move to the clicked item (and back), like a real sidebar. Not built; owner hasn't confirmed.
5. Older gaps: nearest-style rule unconfirmed on a real page; neighbour check compares only size/position; core instructions not reviewed for contradictions; copies of tabs/toggles in their "on" state may copy the active look; not deployed (Railway runs old code; hosted zip needs rebuilding — see `scripts/` and env vars `WANDEL_APP_ORIGIN`, `API_ORIGIN`, `CLERK_SYNC_HOST`, `WANDEL_EXTENSION_KEY`).
