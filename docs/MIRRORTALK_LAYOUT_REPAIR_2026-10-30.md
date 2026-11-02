# MirrorTalk card arrangement repair

Scope: the user's two failed follow-ups on `/group-onboarding`: put Select Group and Feedback side by side, then duplicate both into a 2×2 grid. These results establish these cases at the observed desktop viewport, not general support across applications.

## Cause and changes

The previous compiler normalized only the pre-edit direct children. Below-placement wrappers retained full-row sizing and offsets, static copies retained captured pixel widths, and new copies could miss the layout pass. Equal-width wrapper boxes did not establish equal-width visible cards. The ordering verifier also incorrectly rejected a physical DOM move when both siblings had the same CSS order.

Horizontal/vertical/grid actions now persist a typed arrangement on a style operation. The renderer applies it after the request's other operations against the actual rendered children. Below wrappers become transparent layout containers, existing CSS ordering is preserved, and full-width internal surfaces follow card widths. Card positioning contexts and internal heights are retained. Descendant style changes have individual before/after values and restore in reverse order. Verification checks actual card widths, row/column placement, gaps, and content bounds. Header/sidebar conversion remains on its separate existing path.

Provider validation diagnostics now log schema paths/messages, without request text or DOM payloads, when a model plan exhausts validation repair.

## Manual results

- Side by side: submitted the user's equal-width/24px request through installed Wandel chat without selecting a card. Final result showed two complete cards in one row. The model's before/after review returned `pass`, explicitly confirming equal widths, approximately 24px spacing, intact content, and no clipping/overlap. This successful plan used explicit style/reorder actions.
- Grid: restored the account's two-card checkpoint, then submitted: “Duplicate both cards once, then arrange all four cards in a compact 2×2 grid with equal widths and 24px gaps. Preserve their contents and styling.” The plan duplicated each source once and used the new typed grid arrangement. Four complete cards appeared in two columns/two rows, with 24px gaps and the sidebar clear. Before/after review returned `pass`.
- Persistence: saved the grid to the account as v2 of `Group Onboarding — two-card checkpoint`; v1 retains the starting two-card state.
- Direct workflow Undo: restored both complete starting cards in the stacked arrangement. Direct Redo: restored all four grid cards. Both inspected visually in Chrome.
- Conversational Undo is not counted as verified: an earlier chat Undo ended in a one-card view during interrupted browser access, and the baseline was subsequently restored from the saved account version.

Intermediate attempts were rejected during this work: wrong CSS ordering check, collapsed original-card content, and two provider plan-validation failures. They are not counted as passes. Subsequent successful requests are the results above; provider latency/reliability remains a separate limitation.

No automated test suite was run. Extension TypeScript/build, platform bundling, and diff whitespace checks were used. The updated extension is loaded locally and the updated local service is running. No deployment, commit, or push was performed.
