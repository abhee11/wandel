# Conversation continuity, additive-edit latency, floating workspace

## Changes

- Workflow definitions now carry a compact semantic assistant brief: goal, summary, agreed decisions, explicit preferences, pending work and current focus. It is supplied on every context capture, independently of transient element references and the last 24 turns. It travels with account saves. Chat settings expose the brief and a Forget control. This is workflow-scoped memory, not a global user profile.
- Conversation turns include a human-readable screen label. A free-text clarification continues the pending original request. Failed requests keep a pending intent; verified edits and discussion can update the brief without an extra summarization API call.
- The provider emits only changed style properties as property/value pairs, rather than filling a large nullable style object. The server converts this compact transport back to the existing validated executor contract.
- New buttons/text/fields/links and styling of those newly created elements use the additive executor checks. New buttons must be real, visible, usable controls with visible affordance and sufficient filled-background text contrast. Structural changes, changes to existing elements and reference-image requests keep screenshot review. This avoids a second model call for straightforward additions; it does not eliminate model planning latency.
- Successful edit plans may supply a natural completion reply, displayed only after execution passes. Answers and clarification remain separate from edits.
- Clicking the extension opens a movable/resizable extension popup bound to the source app tab, preserving the application's viewport. Dock/Float controls allow switching surfaces. The popup uses the same React UI, bridge, account and content session. Account, recording, screen and saved-workflow services recognise this same-origin extension surface. Minimize in the popup minimizes its window. A session-storage window mapping and pending-open guard prevent routine duplicate windows.

## Checks so far

No automated test suite was run. Extension TypeScript/build and server bundling passed.

Manual Chrome checks:

1. Floating workspace opened on MirrorTalk and the normal source application retained its full viewport. The first check exposed an account guard that assumed side-panel messages have no sender tab. That integration was corrected; the rebuilt floating UI displayed Account & saved flows and loaded the saved v3 workflow.
2. Submitted a discussion-only PM-demo brief: keep purple styling, avoid clutter, describe what was already built. In one 6.242-second provider call, Wandel correctly described the four-card grid, View feedback button, connected overview/Back/graph/footer, and saved the goal/preferences/decisions as semantic memory.
3. Navigated to Feedback overview through Your flow, then asked for a Share feedback button under the graph using “the look we agreed on”, without naming purple again. One 17.560-second provider call returned create/style actions using purple and retained the PM-demo goal/preferences. No visual verification API call was made for this additive plan. This establishes planning/context continuity and the shorter call path, not a visual pass yet.
4. Browser control timed out as Chrome switched to an active timed chess game. Further UI checks were paused to avoid interrupting it. The rendered button, persistence after save/reload, and Dock/Float round trip still require manual confirmation. These are not counted as passed.

## Completed follow-up checks

- The interrupted Share feedback request was marked Stopped; it was not counted as a completed edit.
- Saved semantic memory to account as Feedback demo v4. Dock → Float preserved the conversation and brief. A discussion-only recall correctly described the demo and purple, compact visual style.
- Full extension reload and source refresh, followed by loading the account v4, preserved the semantic brief (also confirmed in the saved definition) and conversation.
- The next attempt exposed a real synchronization bug: a session could retain a panel state while its renderer was inactive. Chat enabled projection without rendering, and reopening the current state returned early without rendering. Fixed both paths so context is collected from the rendered current screen.
- Reloaded the rebuilt extension and repeated: “Add a Share feedback button under the graph using our agreed style. Leave it unconnected.” The planner returned create + style in 14.296 seconds. Execution passed; manually inspected the source screenshot and accessibility tree: one readable purple rounded Share feedback button beneath the graph; the graph remained intact. Completion was natural prose and Chat stayed in Interact mode. No additional visual-model review call was used for this additive plan.
- Saved the verified result and updated brief as Feedback demo v5 (two screens, two connections; new button unconnected).
- The 440px floating window exposed transcript starvation when Your flow was expanded. Bounded that region, retained a minimum conversation workspace, and allowed overflow rather than overlap. Reloaded through Dock → Float and visually checked both collapsed and expanded flow states: the latest response and composer remained visible.
- Latest extension build and git diff whitespace check passed. Local API restarted with current server bundle. No automated suites, deployment, commit or push.

## Remaining limits

The successful button plan still took about 14 seconds at the provider. This is a measured improvement in call overhead, not instant interaction or a broad performance guarantee. Memory is per workflow; it is not global preference learning. Floating is a native movable Chrome popup and may inherit macOS full-screen behavior; tested it in a normal window as well. These checks cover this feedback scenario, not arbitrary layout operations on all apps.
