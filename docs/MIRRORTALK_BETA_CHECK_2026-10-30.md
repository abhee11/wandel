# MirrorTalk beta check — 2026-10-30

Manual Chrome checks on `https://mirrortalk.ai/group-onboarding`, using the local Wandel API and an isolated account workflow named **Wandel beta audit — MirrorTalk**. Other user workflows were not modified. No automated test suite was run. TypeScript/build and `git diff --check` are separate code checks, not evidence of UI success.

| Requested capability | Observed result |
| --- | --- |
| Duplicate existing elements | Passed the named Select Group → Recently Deleted copy after correcting the provider's treatment of disabled controls. Icon, heading and both original controls remained. |
| Add elements in current space | Required email field and Send feedback button appeared on the Feedback prototype page. Blank-page canvas opacity and default control styling needed fixes. |
| Connect to another screen | Passed: named General button inside Recently Deleted → existing `/feedback`, without selecting first. Returned to source and activated the actual button to verify. |
| Layout and spacing | Passed: named cards stacked vertically with requested 24 CSS pixel gap. |
| Theme | Passed the warm orange request: cream page, white cards, dark text; original disabled controls remained subdued. This is one theme on one page, not broad application coverage. |
| Manual movement | Passed: dragged Recently Deleted heading 120 screenshot pixels horizontally, observed movement, then Undo restored it. |
| Split view | Implemented and opened original/current side by side. Static sanitized visual previews, not two independently interactive app sessions. Layout/scaling improved; some text/control fidelity differs. |
| Three similar section layouts | Split, Stacked and Editorial previews opened; icon size bug fixed. Applying alternatives now styles original nodes to preserve connections. Passed final recheck: applied Stacked, returned to interaction, clicked the same General button, and Feedback opened. Undo was also exercised during variant checks. |
| Tag visited pages | Named entry “MirrorTalk beta — Group selection”; name survived account save/reopen. Unnamed current pages prompt “Name this page?” under Page tools. |
| New page via `/route` | Created `/feedback` with Page tools and `/support` by sending the path in chat. Both appear in Your flow. These are local workflow screens, not routes deployed in MirrorTalk. |
| Replicate image | Attachment/thumbnail and Responses API image input implemented. Early attempts timed out or chose an incompatible duplication plan; fixed timing and new-panel compilation/instructions. Passed after the fixes on `/support`: white rounded editable card, correct image-derived heading/description, orange Contact us control. Opened the description in the inline editor to confirm it is editable DOM, not a screenshot. |
| Original toggle | Passed: Show original removed preview edits; Return to changes restored copied cards, layout and theme. Changes were retained. |

## Evidence

- `acceptance/beta-mirrortalk-duplicate-layout.png`
- `acceptance/beta-mirrortalk-theme.png`
- `acceptance/beta-mirrortalk-manual-move.png`
- `acceptance/beta-mirrortalk-connection.png`
- `acceptance/beta-mirrortalk-split-view.png`
- `acceptance/beta-mirrortalk-three-layouts.png`
- `acceptance/beta-mirrortalk-image-reference.png`

## Scope and limits

The reference-image fixture contains synthetic Feedback & Support content, not private app data. Attached images are compressed locally and sent only with an explicit chat submission; they are not stored in workflow definitions or conversation history. No automatic page screenshot is sent to AI.

Canvas, embedded frames, video, inaccessible shadow content and very large sections remain limited. Layout alternatives are local compositions, not three independent AI design generations. Split view excludes live handlers and entered field values. A new `/route` needs implementation/export to become a real source-app route.

The server supports image input through the Responses API's `input_image` data URL contract; interactive reasoning effort is low for supported reasoning models. See [OpenAI vision documentation](https://developers.openai.com/api/docs/guides/images-vision?api-mode=responses) and [reasoning documentation](https://developers.openai.com/api/docs/guides/reasoning).

## Final check summary

All twelve requested areas were exercised manually. Eleven passed their narrow MirrorTalk acceptance case; split view remains a partial pass because it is a static comparison with some visual fidelity differences. This does not establish support across all apps, responsive widths or complex multi-step requests. New-page default field styling was improved after the first field check, but that visual fallback was not independently rechecked on every field type. AI image requests required corrections and can still take tens of seconds. No blanket “never fails” guarantee is justified.

The saved audit contains three screens, one tested connection, the card duplication/layout/theme and the editable image-derived card. Code checks: extension TypeScript/build, platform server bundle, and whitespace/diff validation. No automated tests, deployment, commit or push were performed for this audit.
