# Wandel – handoff (2026-11-05)

Read this first. Everything below is committed and pushed to `main`.

## What Wandel is
A Chrome extension and server. The user types a design change in a panel ("duplicate this card 3 times in the row below"). The server asks an OpenAI model for a plan, and the extension applies it to the live page as a reversible preview. It doesn't change the real app.

- Extension: `extension/` (panel `assistant/AssistantPanel.tsx`, executor `assistant/execute.ts`, page runtime `content/`)
- Server: `platform/server/` (prompt assembly and OpenAI call in `platform/server/assistant.ts`; prompt text in `extension/assistant/providerSchema.ts`)
- Operation schema: `extension/shared/model.ts`
- Real test page: https://mirrortalk.ai/groups/102949?activityContainerId=254402

## Test tracker
All planned and finished tests, including the complex build requests, are in `docs/TEST-TRACKER.md`. Update it after every test.

## Rules from the owner
- Keep testing cheap: free checks first, then at most 1–2 real AI requests per fix. No big test suites.
- Fix things in general, not for one request. Never turn checks off to make something "pass".
- Explain failures honestly, with the real cause. Say plainly what was and wasn't tested.
- After every fix, the owner expects push + server restart + extension reload to happen without them. `dev:local` (below) does this.
- Don't hand the owner long step lists; do it, or ask one clear thing.

## Running locally
- **`Start Wandel.command`** (double-click in Finder) or `npm run dev:local`: stops any old server on port 4320, builds the extension and the server, starts the server, then keeps running. It polls `extension/` and `platform/` for changes, rebuilds, restarts the server (and restarts it if it crashes), and pushes new commits on `main` every ~10 s. Its log (and the server's output) is in **`.data/dev-local.log`**.
- After each extension rebuild it writes `dist/dev-reload.json`. In local builds (API on 127.0.0.1) the extension's background watches that stamp and reloads itself, then reloads tabs on sites where Wandel was opened (`extension/sidepanel/devReload.ts`). The last loaded stamp is kept in storage, so a worker that slept through a build still notices it when it wakes. If Chrome still runs old content-script code, reload Wandel once in `chrome://extensions` and refresh the page.
- Type check: `npx tsc --noEmit -p .`
- The repo's `node_modules` are macOS builds; run builds on the Mac.

## Plan format compatibility
From 0.3.5 the panel sends `steps:true` with each plan request. Only then does the server add `stepInstructions`, return `next` (the follow-up step the panel runs by itself, up to 4 in a row) and allow up to 24 targets per action. Older panels, including any build still in store review, parse plans strictly, so for them the server removes `next` and splits actions into groups of 8 targets (test: "sends step plans only to panels that run steps"). Keep this until no pre-0.3.5 build is in use.

## Chrome Web Store reviews
The store reviewer signs in as `host+review@studio447.ai` (password with the owner, never in the repo). Clerk's new-device check (Client Trust) emails a code the reviewer cannot read, so turn it off in the production Clerk dashboard before each store submission and back on after approval. The store item ID is `lnmebcccoalcpdcfkggmcmjmnblihbmi`; listing and privacy answers are in `releases/STORE-LISTING.md`.

## Hosted extension zip
Pushing to `main` deploys the server and web page, not the extension. Since 2026-11-08 the live server is `https://wandel.studio447.ai` with production Clerk on `clerk.studio447.ai`. To release a zip, bump `version` in `extension/manifest.json`, then build into `dist-hosted` (never `dist`, which is the live local extension) with these set in the shell, where they override `.env`: `WANDEL_API_ORIGIN` and `WANDEL_APP_ORIGIN` as `https://wandel.studio447.ai`, `CLERK_SYNC_HOST` as `https://clerk.studio447.ai` (Clerk's own address: the app address leaves the panel signed out), `VITE_CLERK_PUBLISHABLE_KEY` and `CLERK_PUBLISHABLE_KEY` as the production `pk_live_` key (`.env` still holds the development key), plus `WANDEL_EXTENSION_KEY` taken from the previous `dist-hosted/manifest.json` so the extension ID stays `aiobahipnbhcomnbdjdjplonfjlfobni`. That ID is registered in Clerk's `allowed_origins`; the Chrome Web Store item has ID `lnmebcccoalcpdcfkggmcmjmnblihbmi` (store builds have no key; the store signs them), and both IDs must be in Clerk's `allowed_origins` and `WANDEL_EXTENSION_ORIGINS`. A PATCH of `allowed_origins` replaces the whole list, so always send both. Export the variables first: in zsh a variable holding several `NAME=value` pairs is not split, so `env $VARS` silently builds with development settings. Run `node scripts/build.mjs --out=dist-hosted` (testers) and `node scripts/build.mjs --out=dist-store --store` (Chrome Web Store: no fixed ID key), then zip the folder's contents, without `dev-reload.json`, into `releases/wandel-hosted-<version>.zip`. Current: 0.3.2 (`releases/wandel-hosted-0.3.2.zip` for testers, `releases/wandel-STORE-UPLOAD-0.3.2.zip` for the store; listing text in `releases/STORE-LISTING.md`). After signing in, the panel needs closing and reopening to notice.

## Free checks (no AI)
`npx vite --port 5180 --host 127.0.0.1`, then open `http://127.0.0.1:5180/demo/fixtures/visibility-check.html`. Twelve cases, each in a fresh frame through the real context → compile → render → verify path. Storage is cleared at the start of each run. All pass:
1. Card hidden until a click, shown below on click, removed by Undo
2. Toggle
3. Hidden at load with nothing that shows it → reported (rolled back)
4. A container the page hides still reports the new card
5. New menu item with no destination shows a hidden card
6. Copy of an icon-only sidebar item named X (label visible, no borrowed icon)
7. New menu option opens its own page; the original option ("General") returns
8. Dragging a card: beside, into a panel, Shift for free offset, sidebar and no slot save nothing, Undo returns it
9. A save from another tab is not overwritten; banner shown, edits blocked
10. A click behind a prototype modal never reaches the page; a closed modal reopens empty
11. Prototype data: values cross steps, filters switch, required fields hold, lists grow and shrink
12. A public copy keeps prototype text and leaks no real page text
Older fixture: `demo/fixtures/mirrortalk-group.html` (globals `context()` and `apply(actions)`).

Real panel with no AI: open `demo/fixtures/assistant.html?stub=new-page`, clear storage, then call `sendToPanel(text)` from a timer and read the result in a second call (long awaits can detach Claude in Chrome). The plan call is stubbed. This fixture has no screenshot capture, so visual review does not run there.

## Diagnosing without asking the owner
- `.data/wandel.sqlite`, table `ai_actions`: every AI request with its plan or verdict. Failed requests now store `{error, rejectedPlan}` in `result`.
- Table `analytics_events`, name `edit_failed`: every failed or warned edit the panel reported (detail, instruction, plan, page).
- `.data/dev-local.log`: build errors, restarts, pushes, server output.

## Local-dev test hooks (only when the API is on 127.0.0.1)
Page events handled by Wandel's content script (`extension/content/index.ts`), for browser automation:
- `wandel:dev-open` opens the Wandel panel in that tab.
- `wandel:dev-chat` with `detail = JSON.stringify({instruction})` runs context → plan (via background `WANDEL_DEV_PLAN`) → apply. Result arrives as `wandel:dev-chat-result` (JSON string: `plan`, `applied`, `unresolved`, or `error`). No visual review or replanning.
- `wandel:dev-command` also returns `context` after `assistantContext`, so a hand-written plan can go through `assistantApply` on a real page with no AI.
- `wandel:dev-state` → `wandel:dev-state-result`: current workflow, state, mode and problems.
- `wandel:dev-command` with `detail = JSON.stringify(command)` runs one session command (`interact`, `undo`, `redo`, `reset`…). Result arrives as `wandel:dev-command-result`. The page starts in mode `closed`: send `interact` first. Do not fire `wandel:dev-open`: its iframe stops Claude in Chrome running scripts in that tab.
Note: Claude in Chrome cannot work in tabs holding another extension's iframe, so Wandel's panel cannot be used there; use these hooks instead, or a Chrome you launch yourself with `--load-extension=dist`.

## Done (2026-11-04/05)
- **Shared intended visibility** (`extension/content/visibility.ts`): the renderer records what the prototype hides on purpose (until a click/hover, on request, deferred in a closed menu or screen). Layout inspection (`nativeDesign.ts inspectLayout`) and the plan's checks (`visualVerification.ts`, `controlVerification.ts`, `execute.ts verify`) skip it; content hidden by accident still fails and names the hiding container; a load-time hide nothing reverses is reported. Revealed content is re-checked once shown (`Behaviors.onReveal` → `Renderer.checkRevealed` → `Session.revealed`, issues prefixed "After it was shown:"). The visual review is told click/hover-revealed content is expected to be absent (`revealNote` in AssistantPanel).
- **Diagnostics** (`extension/shared/diagnostics.ts`): grouped, actionable warnings replace "N edits aren't showing". Hidden while the panel asks whether the page belongs to the workflow.
- **Progress** beside Cancel above the composer, from real stages, never in the conversation.
- **Navigation persists** (`session.ts lead()`): a menu/tab/switcher still shown on a screen it opened keeps going to its other screens; an option with no connection of its own (the original "General", or a block option) returns to the screen it was picked from.
- **Menu copies**: copied pick-one options get choice behavior (`choice` op, `behavior.ts addChoice`). Links without a destination are allowed as prototype items. Copies of icon-only items get a visible label of their own and drop the source's icon (`content/duplicateHeading.ts`).
- Rejected plans show their rule in chat; the panel/notice no longer overlap the composer.
- **Tests 2 and 3 run on MirrorTalk** (through the page hooks, so no panel, visual review or replanning): both pass clicks and Undo.
- **Targets survive changing content** (`locator.ts`): MirrorTalk's two grids share a generated class, and the carousel inside changes between loads. That was the "3 edits couldn't find their elements" failure. Class matches are now told apart by recorded address.
- **Icon-only copies** take the icon's colour, not the link's browser-default blue (`duplicateHeading.ts`).
- **New pages with content** (Test 4, both dropdowns): the prompt requires the plan to build what it promises, keeping left panel, top bar, floating helpers and the switcher. Charts can sit below a section made in the same plan, or at the end/inside of a container, in order (`execute.ts sectionSource`). A rename of the switcher's own label is skipped.
- **Popups no longer break targets** (`locator.ts`, `nativeDesign.ts visible`): an open menu marks the page aria-hidden, which made outside targets "missing" and showed "N elements can't be seen". Addresses also ignore Wandel's own inserted elements. `remove “name”: target missing` now names its target.
- **`reset` clears `assistantMemory`.**
- **Test 5:** expand/collapse on the My Record item, and manual rename, delete and chat move, all work with Undo and survive reload.
- **Drag is a real move** (`content/dropTarget.ts`, `session.ts dragEnd`, command `move`): dropping saves a `reorder`, so the page reflows. Over a panel, the outer quarter drops beside it and the middle drops inside. Gaps use the nearest neighbour within 120px; smaller elements join the content around them. Wrapper cells holding one element move with it, and full-cover click overlays are ignored. No slot = snaps back, saving nothing. Shift, or an absolute/fixed element, keeps the old x/y offset. Before committing, both saved locators must resolve to the exact elements.
- **False "Not completed" on new pages** (`AssistantPanel.tsx stillHere`): a request that built a page moved the workflow to it, so the panel treated its own move as the user leaving, cancelled itself and skipped the review. Moves inside the workflow during an apply no longer cancel.
- **Free test round** (see the tracker): switcher labels survive state-based names (`atStructure`), Try flow no longer ends on Wandel's own fake Escape (`session.escape` ignores untrusted keys), menus that ignore Escape close through their own button, and large panels cannot drop into page frames (`dropTarget.ts pageFrame`).
- **Two tabs no longer overwrite each other** (`session.ts changedElsewhere`, `warnStale`): before saving, a tab checks that storage still holds the version it last read or wrote. If not, it does not save, shows its own banner with Reload this tab, and blocks edits. The check also runs when a tab regains focus.
- **Prototype modals block the page behind them** (`session.ts modalGuard`): the dimming is only a box-shadow, so clicks used to reach the real app through it. Prototype screen changes also save their position, so a closed modal does not return on reload.
- **Prototype data** (`content/blockData.ts`, `logic` and `data` in `shared/block.ts`): block parts can bind fields, show `{{name}}` and `{{list.count}}`, show on a condition, set values on click, require values, and repeat, add and remove list items. It builds on `replayData`, and values are shared across screens. Cancel or X on a modal discards that modal's values; moving on through a connection keeps them. The prompt tells the planner to use this and never `custom` for anything that changes.
- **Link for anyone** (`content/publicSnapshot.ts`, `extension/public/player.ts`, `platform/server/publicViews.ts`, `/view/<token>`): publishes a sanitized copy of the page with the real runtime on top, so no extension or login is needed. References are rewritten to stamped `data-testid` values, so edits land even with text masked. Masking is on by default and covers the page, references, copied content and group keys. The page is served with `CSP: sandbox allow-scripts`, no network, and an embedded nonce player, because a sandboxed page's script requests can be blocked. Treat stored pages as untrusted.
- **Talk mode** (`assistant/handsFree.ts`, Talk button in the panel): a local sound-level gate finds speech and pauses, and only finished utterances are transcribed. Turns run through the normal `submit`, later ones queue, and "stop" and "stop listening" act at once. Short replies use the browser's own voice, and the mic pauses meanwhile. It ends after 3 quiet minutes. Test without a mic at `assistant.html?stub=new-page` with `window.voice(true)` and `window.heard`.
- The 05:25 plans were one turn with retries of a real request ("add an option to expand… the checkbox contents in the My record"), not a mystery.

## Open issues (not yet resolved)
1. **Card placement differs between requests.** "Below the current section" put Home Options at the very bottom but Quick Notes between Participant Reflection and Plan and Setup. Home Options also sat about 12px inside the cards above it.
2. **Revealed content can be off screen.** Quick Notes opens about 1,190px down the page, so on a laptop-sized window clicking My Record seems to do nothing unless you scroll.
3. **Drag indicator not seen by eye.** The drop line and panel highlight are painted during the drag; automation only sees the result, so nobody has looked at them mid-drag yet.
4. **The old-workflow click is unexplained.** Before the locator fix, clicking My Record on the 05:24 workflow opened the transcript instead of toggling. That workflow is gone; not seen on new runs.
5. **Toggle first click after reload: cause not proven.** It failed once, and passed 3 of 3 after the locator fix. Likely the same cause, but not shown directly. Watch for it.
6. **Test 4 rough edges.** The General run removed the Activity row, leaving a blank band at the top; the Activity run kept it, so the model decides. A copied dropdown option keeps its source's date. A false "extends beyond a clipping container" warning appeared on General though nothing is clipped (page measured, no clipping ancestor).
7. **Test 5 rough edges.** The expand/collapse control is small text on a pale ellipse. This transcript has one checklist item, so "each item" is untested with several.
8. **`status: open` plans.** `wandel:dev-chat` stops at them; the panel opens the control and replans. For a closed dropdown, open it with a real click and resend. The panel's own flow was not exercised.
9. **MirrorTalk data moved during testing.** The quote carousel beside My Record disappeared (with zero Wandel edits on the page) and Takeaways regenerated, so saved targets there can change between runs.
10. **Unit tests are stale.** `tests/assistant-panel.test.tsx` (27 failures, a mock lacks `reportFailure`) and `tests/open-workflow.test.ts` (3) already fail without today's changes.
11. **Link for anyone limits.** The app's own dropdowns don't open in the copy (a screen bar stands in for them), screens on other URLs aren't included, app fonts may fall back, and the review step in the panel has never been seen rendered. Unmasked links publish real content.
12. **Mirrored actions block sharing.** Chat often wires copies and links to real controls (`mirror`), and `shareRecord` rejects those prototypes. Seen on duplicated cards and a footer Help link. Not fixed.
13. **Prototype data limits.** Charts and `custom` parts cannot use it, values are lost on reload, and there is no sort or text filtering of a list yet (B3, B4).
14. **Tabs warn but do not sync.** A stale tab keeps its unsaved edit on screen until reloaded, and that edit is lost. Live sync between tabs was not built.
15. **Review after a new page is unconfirmed.** The false cancel is fixed in the fixture, but only the real panel can show the review running on the new page. In the owner's panel run, review also answered "uncertain" when the panel covered the changed controls.
16. **Next panel test not run yet:** repeat the General request, follow-up "Add a graph with mock data to that page", switch back and forth, Undo from the panel, then save and reopen. Also untested in the panel: failure recovery. Conversation mode (hands-free turns on top of push-to-talk) is proposed for after that.
17. Owner asked: on a menu item click, the highlight should move to the clicked item (and back), like a real sidebar. Not built; owner hasn't confirmed.
18. Older gaps: nearest-style rule unconfirmed on a real page; neighbour check compares only size/position; core instructions not reviewed for contradictions; copies of tabs/toggles in their "on" state may copy the active look; pushing to `main` auto-deploys the server and web page to Railway, but the hosted extension zip is built separately.

- Talk: types words live, replies with OpenAI voice Marin (`/api/assistant/speak`, no AI action) in one short `spoken` line. Prototypes can take over a click conditionally and show a toast that learns the app's look from any real toast. Earlier edits on a closed view no longer block new changes.
- Talk turn-taking: the microphone stays open while Wandel speaks, a clear voice interrupts it, replies wait until the person stops, commands said during work show at once and queue. Own speech coming back is ignored by `echoOf`.
- Hosted zip: `.env` has an empty `CLERK_PUBLISHABLE_KEY=` above the real `VITE_CLERK_PUBLISHABLE_KEY`, so read the VITE one. 0.1.8 and 0.1.9 went out with no sign-in key this way. `scripts/build.mjs` now refuses a live-server build without a key.
