# Wandel test tracker

Update this after every test. A test is only ticked when it was really run, and the result says how.

**Status:** ⬜ not tested · ✅ passed · ⚠️ works with a problem · ❌ failed · 🚧 fixed, needs a retest

**How:** Free = real clicks and drags, or stubbed plans · AI = real AI requests · Panel = needs the real Wandel panel (the owner, or a Chrome started with `--load-extension=dist`)

Test page unless stated: https://mirrortalk.ai/groups/102949?activityContainerId=254402

Record failures with their real cause. Keep testing cheap: free checks first, then at most 1–2 AI requests per fix.

## Stage 0 gate: before sending to a friend

Run these first, on the deployed hosted build, in the real panel, on a clean Chrome profile. The rest of this tracker can wait.

| ID | Test | Pass looks like | Status | Result |
|---|---|---|---|---|
| G1 | Rebuild the hosted zip | Friend's zip includes today's fixes, including the modal click block | ⚠️ | `releases/wandel-hosted-0.1.7.zip` built and its contents checked, with the same extension ID. Not yet installed or run; G2 covers that |
| G2 | Fresh install and sign in on a clean Chrome profile | Works from written steps with no help | ⬜ | Never tested this way |
| G3 | Five simple panel requests: change text, change a colour, hide something, add a card, undo | All five work first time, on two sites | ⬜ | Includes the second-site check (part of B18) |
| G4 | D13: new page from a dropdown, with reply and review | No false failure | ⬜ | |
| G5 | P7 and P8: follow-up on that page, save, reopen | The right page changes and comes back | ⬜ | |
| G6 | F6 and F7: a rejected request, and Cancel | Clear message, page stays consistent | ⬜ | |
| G7 | Two prototype data requests in the panel (B2, B9) | Work when clicked, review runs | ⬜ | |
| G8 | L4: watch a drag | Drop line and highlight make sense | ⬜ | |

## 1. Build requests

Each row is one request, typed as written. Pass means it works when clicked through, not just that it appears. Try each one in a single message; if that fails, note it, then try it in steps.

| ID | Request | Pass looks like | Stretches | How | Status | Result |
|---|---|---|---|---|---|---|
| B1 | Build an analytics dashboard page from the General dropdown: a KPI row, two charts, a table of students, and a date filter with mock data | Page opens from the dropdown, keeps the left panel, all parts visible, General returns | Many parts in one plan (12 action cap) | AI, Panel | ⚠️ | Retested with prototype data, 1 AI request each run. The date filter now really changes KPIs and the student table, and stays set across pages. Still open: charts stay on one period (a chart cannot use conditions yet); the KPI style differed between date groups; blank band when the plan removes the Activity row; false clipping warning |
| B2 | Clicking New Activity should open a 3-step wizard: name and date, pick a template, review. Include Next, Back, Cancel and a progress indicator | Steps go forward and back, Cancel closes, entered values show on the review step | Multi-screen modal, values carried across steps | AI, Panel | ✅ | Retested with prototype data. Real wizard, not static markup: Next stays disabled until filled, review shows the exact name, date and template, Back keeps entries, Cancel and X start fresh, and the real New Activity button was never reached (guard count 0). Note: no final Finish button yet; hooks only, no panel review |
| B3 | Add a search box above the transcript that filters the lines as I type, and shows a match count | Typing narrows lines live, count updates, clearing restores | Live behaviour tied to app content | AI, Panel | ⬜ | |
| B4 | Build a students page with a sortable, filterable table of 10 mock students. Clicking a row opens a details drawer with their scores and a chart | Sort and filter work, each row opens its own details, drawer closes | Tables with state, per-row data | AI, Panel | ⬜ | |
| B5 | Add a settings page from the left menu, with tabs General, Notifications and Privacy. Toggles should show or hide related options, and Save shows a confirmation | Tabs switch, toggles reveal options, Save confirms, left menu highlight moves | Tabs, toggles, nested reveal, new menu item | AI, Panel | ⬜ | |
| B6 | Make the bell open a notifications popover with 5 mock items and an unread badge. Clicking an item marks it read, and Mark all as read clears the badge | Badge count changes, items change state, popover closes | Popover, counts that change | AI, Panel | ⬜ | |
| B7 | Add a guided tour with 3 steps highlighting Takeaways, My Record and New Activity, with Next, Back and Skip | Spotlight follows each real element, Skip ends it, it survives a scroll | Overlays attached to real elements | AI, Panel | ⬜ | |
| B8 | Clicking Reflect should open a reflection flow: 3 questions, one per screen, then a summary screen, then back here with a new card showing my answers | Answers appear on the summary and on the final card | State carried across screens back to the page | AI, Panel | ⬜ | |
| B9 | Add a form to create a note. Submitting adds a new card to a list below, updates a count, and shows an empty state when there are none | Each submit adds a card with the typed text, count changes, delete works | Prototype data that grows | AI, Panel | ⬜ | |
| B10 | Add a Teacher / Student view switch at the top. Student view hides Reflect and New Activity and shows a simplified My Record | Switch changes many elements, and back restores them | One control changing many elements | AI, Panel | ⬜ | |
| B11 | Lock Participant Reflection behind a Pro badge. Clicking it opens an upgrade modal, and Upgrade unlocks the card | Locked, then modal, then unlocked with the badge gone | Conditional state | AI, Panel | ⬜ | |
| B12 | Build a kanban board page with To do, In progress and Done columns of activity cards I can drag between | Cards move between columns in preview mode | End-user drag, not Wandel's edit drag | AI, Panel | ⬜ | |
| B13 | Turn the left sidebar into a top navigation bar, and make the page content full width | Links still work, nothing overlaps, content reflows | Restructuring the app's own layout | AI, Panel | ⬜ | |
| B14 | Add a dark mode toggle that changes the whole page | Page, cards and text all readable, and it toggles back | Page-wide styling | AI, Panel | ⬜ | |
| B15 | Build a page comparing two activities side by side, with a chart for each and a table of differences | Two aligned columns, mock data labelled | Layout and data together | AI, Panel | ⬜ | |
| B16 | Add a chat drawer from the Chat with M2 button with a few canned questions that give canned answers | Drawer opens, each question gives its own answer | Replacing a real app control | AI, Panel | ⬜ | |
| B17 | Show the My Record card in its loading, empty and error states, with a switcher so I can review each | Each state renders, and the switcher moves between them | Design states of one component | AI, Panel | ⬜ | |
| B18 | On another site: run B1, B5 and B9 on a dashboard or form-heavy app that isn't MirrorTalk | Same pass rules | Whether the fixes are general | AI, Panel | ⬜ | |

## 2. Stacked edits

| ID | Scenario | Pass looks like | How | Status | Result |
|---|---|---|---|---|---|
| S1 | Drag a card, then in chat: "make that card wider" | The moved card changes | AI | ⬜ | |
| S2 | Rename, drag, delete, undo twice, redo once | Each step undoes alone | Free | ✅ | Each undo and redo moved exactly one step. Free run on MirrorTalk |
| S3 | Move a card into a panel, then add expand/collapse to that panel | The moved card hides and shows with it | AI | ⬜ | |
| S4 | Edit a card, then move the card before it | The older edit stays on the right card, also after a reload | Free | ✅ | Rename stayed attached through two moves and a reload |
| S5 | Build on a new page, go back, edit the original | The right edits appear on each page | AI | ⬜ | |

## 3. Multi-page flows

| ID | Scenario | Pass looks like | How | Status | Result |
|---|---|---|---|---|---|
| P1 | General → Test → new option on Test → third page | Every option returns to the right place | AI | ⬜ | |
| P2 | Pages from both the Activity and General dropdowns, then cross between them | Each switcher shows the right label | AI | ⬜ | |
| P3 | Add a button on the base page, then open each clone | Decide and record: inherited or not | AI | ⬜ | |
| P4 | Reload while on a new page | Decide and record: stay there or return to the original | Free | ✅ | Bug fixed: after a reload the page was Insights but the dropdown said Decimal Concepts Review, because the saved label was the menu’s open-state name. Now stays on the page with the right label |
| P5 | Build a page, navigate away, undo | The page and its option go, with a notice | Free | ✅ | Undo from the original page removes the page and its option; redo restores both. Same page, so no notice is needed |
| P6 | Try flow through a multi-page prototype | Runs start to end | Free | ✅ | Two bugs fixed: Wandel’s own fake Escape ended Try flow, and the menu stayed open after a copied option. Full round trip now stays in Try flow |
| P7 | Follow-up on a new page: "Add a graph with mock data to that page" | The right page changes, not the original | AI, Panel | ⬜ | |
| P8 | Save, reload, then open the saved page | Page and graph return | AI, Panel | ⬜ | |

## 4. The app changes underneath

| ID | Scenario | Pass looks like | How | Status | Result |
|---|---|---|---|---|---|
| C1 | Switch to Activity 2 and back | Edits survive the page rebuilding | Free | ✅ | Switched to Activity 2 and back with real clicks; edit returned |
| C2 | Make an edit, then open Activity 2 | Decide and record: applies there or not | Free | ✅ | Decision to confirm: each activity is its own workflow, so edits do not carry over |
| C3 | Page content regenerates after an edit | Edits stay attached, or fail with a clear message | Free | ✅ | MirrorTalk regenerated Takeaways during a test and edits stayed attached. One natural case only |
| C4 | Open the transcript with edits on the page | Inserted cards stay in place, nothing overlaps | Free | ✅ | Inserted card moved down with the page, no overlap |

## 5. Repeating content

| ID | Scenario | Pass looks like | How | Status | Result |
|---|---|---|---|---|---|
| R1 | "Each item" with several checklist items | Every item gets the edit | AI, Panel | ⬜ | Needs an activity with several items |
| R2 | Items added after the edit | New items also get it, or the limit is clear | AI | ⬜ | |
| R3 | "The second card" among identical cards | The right card changes | AI | ⬜ | |

## 6. Conversation and failure

| ID | Scenario | Pass looks like | How | Status | Result |
|---|---|---|---|---|---|
| F1 | A long request with several parts | All parts built, or says what was left out | AI, Panel | ⬜ | |
| F2 | "Make it look more like the other one", "undo the last two things", "put it back" | Understood, or asks one clear question | AI, Panel | ⬜ | |
| F3 | Hide something, then ask to move it | Sensible result or a clear explanation | AI, Panel | ⬜ | |
| F4 | A design reference image | The page follows the image | AI, Panel | ⬜ | |
| F5 | "Connect this to real data" | Honest refusal, nothing faked | AI, Panel | ⬜ | |
| F6 | A rejected plan | Rule shown in chat, replanning recovers | AI, Panel | ⬜ | |
| F7 | Cancel during a request | Stops cleanly, page consistent | AI, Panel | ⬜ | |
| F8 | A request fails partway | Reply never claims what wasn't built | AI, Panel | ⬜ | |

## 7. Layout and environment

| ID | Scenario | Pass looks like | How | Status | Result |
|---|---|---|---|---|---|
| L1 | Shrink the window after building | Inserted content adapts | Free | ⬜ | Not run: the automated window ignored resize requests, so it needs a manual resize |
| L2 | Drag within or into the scrolling transcript | Drops land where shown | Free | ✅ | Lines swapped in the scrolling transcript, scroll held, Undo restored |
| L3 | Drag a card to the sticky header or sidebar | Sensible drop, or snaps back | Free | ✅ | Bug fixed: large cards were crammed into the sidebar and sticky header. They now snap back; small controls still can move there |
| L4 | Watch the drop line and panel highlight during a drag | Clear, and matches where it lands | Panel | ⬜ | Nobody has seen this yet |
| L5 | Drop a wide card into a narrow panel | Fits without overflow | Free | ✅ | Takeaways (1,270px) fitted a 437px panel, readable, no overflow |
| L6 | Review near the panel | Review can see controls the panel would cover | AI, Panel | ⬜ | Review said "uncertain" in the owner's run |

## 8. Saving and sharing

| ID | Scenario | Pass looks like | How | Status | Result |
|---|---|---|---|---|---|
| V1 | Save, close Chrome, reopen | Prototype and history return | Panel | ⬜ | |
| V2 | Two tabs on one workflow | Edits don't collide | Free | ✅ | Fixed: a tab no longer overwrites newer work. It shows a banner with Reload this tab and blocks edits until reloaded. Tested with two real tabs and the free fixture |
| V3 | Share with someone else | They see the same prototype | Panel | ⚠️ | Partly. Local run in one Chrome profile: link created through the real API, recipient page and Open experience work, and the form’s logic is kept in the stored link. Not confirmed: the opened tab was outside the automated group, so nobody has used a shared prototype yet, and no second person or computer has tried it. Recipients need Wandel and their own app access |
| V4 | Reach the 30-screen limit and the AI limit | Clear messages | Free | ⚠️ | Screen limit stops at 30 with a clear message. AI limit not tested |

## Prototype data

Block parts can read and write named values with `logic` (bind, when, set, requires, repeat, add, remove). B3, B4, B8, B9, B10 and B11 should be retried with this in mind; none of them has run yet. Data lasts for the preview session and is lost on reload. Charts and `custom` parts cannot use it.

## Safety rule for testing

Prototypes run on the real application. Before clicking a real control that a prototype takes over (New Activity, Delete, Send), confirm it is wired, and add a guard listener on that button that stops the event, so a missed intercept can never change real data.

## Sharing and export

| ID | Feature | Status | Result |
|---|---|---|---|
| E1 | File export and import (`.wandel.json`) | ✅ | Export, wipe, import on MirrorTalk: the form worked after import. Ran through the session command, not the panel buttons |
| E2 | Coding-agent prompt and bundle | ✅ | Include changes, text and logic. Content not checked by a coding agent |
| E3 | Recorded walkthrough video | ⬜ | Needs tab capture, which automation cannot do. The only option for people without Wandel |
| E4 | Implement in GitHub | ⬜ | Not tested |

Anyone on the Nov 2 zip (0.1.1) cannot read prototypes that use `logic`, so testers need 0.1.2 or later (0.1.7 is current).

## Duplicating

| ID | Scenario | Status | Result |
|---|---|---|---|
| D15 | Toolbar Duplicate, then drag the copy into place | ✅ | Bug fixed: copies lost text clipping, so text ran over buttons. Copy, drag, reload and undo pass on MirrorTalk |
| D16 | Chat: duplicate a card twice beside it | ⚠️ | Exact placement, survives reload, one Undo removes all. But the plan wired the copies to the card's real click, and prototypes with those mirrored actions cannot be shared |

## Headers and footers

| ID | Scenario | Status | Result |
|---|---|---|---|
| D17 | Add a full-width header through chat | ✅ | Page moves down, nothing overlaps, survives reload, Undo removes it |
| D18 | Add a footer with links through chat | ✅ | Bug fixed: the AI stopped to ask for URLs and a copyright name, and now uses placeholders and says so. The Help link was wired to the real Help control, so that prototype cannot be shared |

## Link for anyone (no Wandel needed)

| ID | Test | Status | Result |
|---|---|---|---|
| N1 | Opens with no extension and no login | ✅ | Built-in browser, local server. Not yet tried on production or another computer |
| N2 | Prototype works there: form, required field, list, screen switch | ✅ | Real clicks and typing in that browser |
| N3 | Masking leaves no real text in the page or embedded data | ✅ | Search found real text in the data twice; both fixed, and a fixture now fails if it returns. One copied date fix is confirmed by reading the code and the fixture, not by a fresh MirrorTalk search |
| N4 | Sandbox: no origin, cookies, storage or network | ✅ | Measured from inside the page |
| N5 | Removed link stops working | ✅ | Row deleted directly; 404 afterwards. The panel's Remove button is untested |
| N6 | Review and publish in the real panel | ⬜ | Built, and never seen rendered. Automation cannot load the panel |
| N7 | Dropdowns inside the shared page | ❌ | The app's own dropdowns don't open in the copy, so copied options are unreachable. Use the screen bar |

## Image reference

| ID | Test | Status | Result |
|---|---|---|---|
| I1 | Attach an image: composer stays usable | ✅ | Bug fixed: Your flow covered the composer by up to 334px. 0 at all heights in a layout test page; not yet seen in the real panel |
| I2 | "Replicate this card" from an image builds without asking | ✅ | Both of the owner's wordings built with no question, using their real image, through the hooks. Very close match. The first run lost the card outline while its reply claimed the lavender surface; the run naming a place had it |

## Talk mode (hands-free conversation)

| ID | Test | Status | Result |
|---|---|---|---|
| T1 | Silence and short noise send nothing | ✅ | Real audio path with simulated sound; transcription and planning stubbed |
| T2 | Pause ends a turn; filler words are ignored | ✅ | Same |
| T3 | Talking over an edit queues the next turn | ✅ | Same |
| T4 | "Stop" cancels, "stop listening" turns it off | ✅ | Same |
| T5 | Real voice, in the real panel | ⬜ | Needs a person and a microphone. Not tried with room noise, or with a real spoken reply |

## Warnings

| ID | Test | Status | Result |
|---|---|---|---|
| W1 | Message box never covered | ✅ | Up to 271px of overlap with a chat history and a notice, now 0 at all heights, even with details open. Test page, not yet seen in the real panel |
| W2 | One calm line, no page toast while the panel is open | ⬜ | Built; needs a look in the real panel |
| W3 | Why 11 edits were not found | ⬜ | Likely carousel edits, unconfirmed: the owner's draft isn't visible from a test tab |

## Already tested

Most ran through page hooks, not the real panel, so visual review and replanning were not exercised unless stated.

| ID | Scenario | Status | Result |
|---|---|---|---|
| D1 | Add left menu option X that reveals a card | ✅ | Label colour fixed; card and Undo pass (`293bdd6`) |
| D2 | My Record title toggles Quick Notes | ✅ | Show, hide, show and reload pass (`293bdd6`) |
| D3 | Target survives rotating content | ✅ | Reproduced and fixed (`293bdd6`) |
| D4 | Activity dropdown option opens a built page | ✅ | Page, navigation both ways (`792deea`) |
| D5 | General dropdown option opens a built page | ⚠️ | Works, but the plan removed the Activity row, leaving a blank band; false clipping warning |
| D6 | Expand/collapse on the My Record item | ⚠️ | Works in hooks and the panel, review passed; control looks rough; only one item tested |
| D7 | Manual rename and delete | ✅ | Survive reload, undo cleanly |
| D8 | Move a panel by chat | ✅ | Real reorder |
| D9 | Drag a panel beside another | ✅ | Reflows, survives reload (`691136f`) |
| D10 | Drag a panel into a panel | ✅ | Retested with real drags on the final build (S4, L5) |
| D11 | Drag a button into another panel | ✅ | Lands where dropped (`691136f`) |
| D12 | Open-then-replan for a closed dropdown | ✅ | Owner's panel run |
| D13 | New-page request finishes normally in the panel | 🚧 | Fixed in `b0563bd` with a stubbed plan; retest in the real panel with review |
| D14 | Moving Decimal Concepts Review and New Activity right | ⚠️ | Applied; review "uncertain" (see L6) |
