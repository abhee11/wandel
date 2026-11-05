# Wandel – handoff (2026-11-03)

## What Wandel is
A Chrome extension and server. The user types a design change in a side panel ("duplicate this card 3 times in the row below"). The server asks an OpenAI model for a plan, and the extension applies it to the live page as a reversible preview. It doesn't change the real app.

- Extension: `extension/` (panel `assistant/AssistantPanel.tsx`, executor `assistant/execute.ts`, page runtime `content/`)
- Server: `platform/server/` (prompt assembly and OpenAI call in `platform/server/assistant.ts`; prompt text in `extension/assistant/providerSchema.ts`)
- Operation schema: `extension/shared/model.ts`

## Build and run
- Extension: `node scripts/build.mjs` → `dist/`
- Server: `node scripts/platform-build.mjs`, then `node dist-platform/server/main.js`
- Type check: `npx tsc --noEmit -p .`
- Free test page (no AI cost): `npx vite --port 5180 --host 127.0.0.1`, then open `http://127.0.0.1:5180/demo/fixtures/mirrortalk-group.html`. It exposes the globals `context()` and `apply(actions)`, so you can run plans without the AI.
- Real test page: https://mirrortalk.ai/groups/102949?activityContainerId=254402

## Rules from the owner
- Keep testing cheap: free test-page checks first, then at most 1–2 real AI requests. No big test suites.
- Fix things in general, not for one request. Never turn checks off to make something "pass".
- Explain failures honestly, with the real cause.
- Commit or push only when the owner says so.

## Done and pushed (main: `34381f1`, `61e38cb`, `d69943e`)
- Layout map (the page's lists, rows and grids, named) and one placement resolver for copies, sections and new elements (`execute.ts` `resolvePlacement` / `placeAt`, `assistant/layoutMap.ts`).
- New elements copy the style of the nearest similar element (`content/nativeDesign.ts` `captureDesign`).
- New items in a list, row or grid are checked against their neighbours (size, alignment, squeezed text). A mismatch rolls the edit back and the AI replans with the reason (`execute.ts` end of the plan; `neighbourMismatch` in `assistant/applyVerified.ts`; `content/session.ts`).
- Only the instruction blocks a request needs are sent. Simple edits (rename, restyle, move, hide, duplicate) get about 4,200 words instead of 6,500; everything else gets the full set (`relevantInstructions` in `platform/server/assistant.ts`).
- Warnings on finished edits are logged to the server.
- The clipping warning is checked again after a menu or dialog finishes opening, so it no longer fires falsely.
- Copied menu rows keep full width, and don't copy the "selected" highlight or checkmark.

## In progress (NOT committed, builds and type-checks, NOT tested)
**Problem:** options added to a menu (e.g. Grade 7 and Grade 8 under "General") look right, but clicking them does nothing.

**What's written:**
- `extension/assistant/execute.ts`: in the duplicate branch, before `if(action.resultRef)`. When the copied item is the selected option of a pick-one group (listbox, menu, tablist, radiogroup), it adds an operation `kind:'choice'` with the group key, original option, copy carrier, selected background, title labels, and the copy and original texts.
- `extension/shared/model.ts`: schema for the `choice` operation.
- `extension/content/renderer.ts`: applies `choice` by calling `behaviors.addChoice(...)`.
- `extension/content/behavior.ts`: `addChoice`, `choose` and `showChoice`. A click on any option (copies and the original) moves the highlight and checkmark to it, changes the title text (e.g. the H1 "General") to the chosen option, then closes the menu. It tries Escape first; Escape does NOT close MirrorTalk's menu. It then sends a click to the fixed overlay; a real click outside the panel DID close it.

**Next steps:**
1. Test on the free test page: build a copy of MirrorTalk's menu (`ul[role=listbox] > li > button[role=option][aria-label="Group General, selected"]` with a grey background and a check `svg`), run `apply([{kind:'duplicate',targets:[ref],position:'end',text:'Grade 7'}])`, then click Grade 7 in interact mode. Expect: Grade 7 grey with a check, General plain, title "Grade 7", menu closed. Click General to switch back.
2. Check that the synthetic overlay click really closes MirrorTalk's menu. If it doesn't, click a point inside the overlay but outside the menu panel (`elementFromPoint`).
3. Check the choice survives closing and reopening the menu (state is kept in `Behaviors.chosen`). The title may go back to "General" after a full re-render while the menu is closed; the labels are only reapplied when the copies render.
4. One real request on MirrorTalk ("add Grade 7 and Grade 8 options to the General menu"), then click through.
5. Only the case where the copied item is the selected one is covered. Copying an unselected option isn't handled yet.

## Other known gaps
- The nearest-style rule has not been confirmed on a real page where a real button sits next to the new one.
- After a rolled-back mismatch, nobody has checked with a real AI call whether the AI's second plan is better.
- The neighbour check compares only size and position, not colour or font.
- The core instructions (about 2,800 words, sent every time) haven't been reviewed for contradictions.
- Copies of tabs or toggles in their "on" state may still copy the active look.
- Not deployed: Railway still runs old code, and the hosted zip (`releases/wandel-hosted-0.1.1.zip`) needs rebuilding (see `scripts/` and the env vars `WANDEL_APP_ORIGIN`, `API_ORIGIN`, `CLERK_SYNC_HOST`, `WANDEL_EXTENSION_KEY`).

## 2026-11-04 – Shared visibility + navigation back (NOT committed, type-checks, bundles build, NOT browser-tested)
**Root cause fixed:** execution hid content until a click; verification expected it visible and rolled back.
- `content/visibility.ts` (new): one registry of intended visibility. `interaction` (a click/hover shows or toggles it), `hidden` (hidden on request), `unrevealed` (hidden at load with nothing that shows it — reported, it's a planning mistake), `deferred` (closed menu / unopened screen / closed disclosure). `expectation(el)` only counts an element or ancestor that execution itself hid, so an unrelated hidden container still fails.
- `renderer.ts` `recordExpectations()` fills it after each reconcile (behavior effects + display:none styles); closed-popup inserts are `deferOwned`; behaviors whose effect target is deferred are skipped instead of "missing". `reset()` clears it.
- `nativeDesign.ts` `inspectLayout` skips intended-hidden content and names the hiding container in real failures.
- `visualVerification.ts` / `controlVerification.ts` skip placement checks while intentionally hidden; `execute.ts` verify ignores "missing" for deferred content.
- Reveal re-check: `Behaviors.onReveal` → `Renderer.checkRevealed` (after layout) → `Session.revealed` runs inspectLayout + the last plan's checks; problems show as "After it was shown: …" in `unresolved`.
- Visual AI review is told content shown only on click/hover is expected to be absent (`revealNote` in AssistantPanel).
- Diagnostics: `shared/diagnostics.ts` groups issues (couldn't find element / can't be seen / problem when shown / other) with what to do; used by the page warning and the side panel. No more "N edits aren't showing" for diagnostics.
- Progress: stage text (`progress` state) is shown beside Cancel above the composer, never in the conversation; cleared when busy ends.
- Navigation back (`session.ts` `lead()`): a menu/tab/switcher still shown on a screen it opened keeps going to its other screens (edge inherited from an ancestor screen), and an option with no connection of its own (the original "General", or a block option) returns to the screen it was picked from. Works for page variants and panel screens.

**Manual checks to do together:** MirrorTalk "Home Options" card (hidden, no rollback; Home reveals it below); hide/show/toggle; Undo; a card put in a hidden container still reports; progress stays visible; General ↔ Test on a new page.
- **Free check (no AI), 2026-11-05: all 5 pass.** `npx vite --port 5180 --host 127.0.0.1`, then open `http://127.0.0.1:5180/demo/fixtures/visibility-check.html`. Covers: hidden card → no rollback → Home reveals it below → Undo; toggle; hidden-at-load with no reveal is reported; a container the page hides still reports; new menu option → its page → General returns. Run it before any paid request. (`dist/wandel-test/` holds a throwaway bundle of it; safe to delete.)
