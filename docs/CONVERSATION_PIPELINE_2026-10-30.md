# Conversation pipeline revision — October 30, 2026

## Implemented

- Invalid optional selections are dropped during context collection instead of blocking the AI request. Private/unavailable nodes remain excluded from editing.
- Capture up to 160 prioritized elements within a 140 KB element budget, with parent/child structure, computed styles, regions, repeated groups, safe destination paths, recent changes and selection/copy memory. Inspection can expand eight containers at a time; initial planning supports six expansion rounds.
- Chrome captures the active application's viewport. Mask form controls, editable regions, marked private subtrees, frames and editor overlays locally. Check active tab and viewport before/after capture. Send compressed screenshots separately from user reference images. Capture failure falls back to DOM evidence and is disclosed; it does not interrupt chat.
- Send screenshots with DOM context to the planning model. The model chooses actions or requests inspection/clarification; local code does not require selecting a target to start a conversation.
- Include nodes created earlier in the same transaction when sizing a grid/row/stack. Check the rendered grid's actual children, including copies, rather than only pre-existing children.
- Existing DOM verification remains atomic. Before/after AI visual review can reject an applied preview. Rollback requires a matching request token AND unchanged workflow revision, restoring prior draft, screen and Undo/Redo history. Never overwrite newer work.
- A confirmed rejection can trigger up to two repair plans, including further DOM inspection. Repairs never repeat an uncertain or disconnected commit.
- Show normal assistant replies for connection, planning, execution and provider failures. Preserve diagnostic details in conversation metadata for subsequent reasoning; do not put raw exceptions in the user's message bubble. Technical failures are distinguished from genuine intent ambiguity and from uncertain delivery.
- Keep the composer usable and retain pending clarification turns in model history. Distinguish literal tooltip answers and icon-only presentation from production navigation and empty text replacement.
- Require content-script capability `designer-experience-v5` to avoid mixing the updated panel with an older page script.

## Verification status

TypeScript and extension bundling are checked. No automated test suite was run, as requested. Manual Chrome checking confirmed greeting delivery, composer clearing, conversation restoration after extension reload, and conversational recovery rather than raw error bubbles. The exact grid request exposed and led to fixes for cross-parent movement, missing positioning-wrapper identities, and an unbounded animation-frame wait. The final grid result is not visually accepted yet: Chrome reports image readback failed and native captures are blank. Do not describe this as commercially ready or assign a quality score from build results.

## Manual acceptance sequence

Use MirrorTalk with two visible cards. Begin without a selection.

1. Ask for a layout review. Verify it describes the actual page and makes no edits.
2. Ask to duplicate the two cards into a smaller 2×2 grid. Verify four complete readable cards, two rows and two columns, and no unrelated navigation changes.
3. Ask to increase spacing, then Undo. Verify follow-up context and reversible layout.
4. Add a Settings link with a gear and tooltip, then ask for only the icon. Verify no visible label, accessible name, preserved destination and tooltip.
5. Change theme and verify hierarchy, readable surfaces and contrast.
6. Edit after an application rerender or expired selection. Verify the request proceeds using fresh context or asks a named clarification rather than requiring a click.
7. Save/reload and repeat a follow-up. Verify patch replay and preserved connections.
8. Compare original and modified views; Undo/Redo the most recent transaction.

## Remaining limits

- Screenshot capture depends on Chrome permission, the active tab, and viewport stability. Frames are masked, not inspected. Redaction is best effort, not comprehensive sensitive-data detection.
- Visual review sees the viewport, not every offscreen region, and cannot establish hover behavior or navigation destinations. Those need DOM checks and manual acceptance.
- This is a browser prototype patch, not a production source-code implementation. Some dynamic applications may overwrite DOM changes or use inaccessible canvas/shadow/frame rendering.
- Provider outages can prevent an answer or edit. The UI must report that conversationally without claiming success or confusing a service failure with an unclear user request.

- Render verification waits are bounded when Chrome suspends animation frames. Positioning wrappers have registered owned identities so the planner can move/style/remove them. Cross-parent reordering is permitted; cycles remain rejected.
