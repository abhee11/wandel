# Conversational assistant checkpoint — October 18, 2026

Branch: `codex/context-aware-assistant`. Base: `30c810d`. This is an isolated working slice, not a public-release sign-off. Main, existing beta builds, deployment and environment files were not changed.

## What is implemented

The assistant uses the real selection, renderer, history, workflow graph, persistence and export/import paths. A bounded context collector combines explicit selection (preferred over hover), nearby semantic elements, actual computed styles, recent created elements, a pinned style reference and known views. Short-lived handles are revalidated against semantic locators; navigation or a changed workflow invalidates a pending plan. Accessible open shadow roots are supported. Hidden/disabled/private targets are excluded.

Typed commands and push-to-talk transcripts enter the same interpretation, grounding and execution pipeline. Common explicit instructions run locally. Other phrasing uses authenticated OpenAI structured output after the user enables scoped sharing. Plans have a strict allowlist and compile into ordinary reversible workflow operations; arbitrary HTML, scripts and real host handlers are not accepted. A failed transaction restores the preceding workflow and DOM. Missing labels, destinations or ambiguous styles produce clarification rather than invented controls or a guessed target.

Supported actions in this slice: create button/text/simple field/panel, matching single-select pills, text, styles, delta movement, removal, default selection, connect a control to an existing prototype view or an explicitly requested blank view, undo/redo and opening the existing save chooser. Every new view can be edited using the same assistant. Existing visual tools remain accessible from a compact on-page toolbar.

## Test the isolated build

1. Run `npm run build:assistant`. Load **dist-assistant/** as an unpacked Chrome extension. Its name is **Wandel — Assistant Beta** and it does not reuse the main extension key. Do not replace the main beta's dist/ installation.
2. Disable the other Wandel extension on the test page to avoid two editors capturing the same clicks. Reload the page, then open Assistant Beta from Chrome's toolbar.
3. Local text commands work without an API. For cloud interpretation/voice, run the branch's platform build with `WANDEL_ASSISTANT_ENABLED=true`, existing `OPENAI_API_KEY` and `OPENAI_MODEL`, and optionally `OPENAI_TRANSCRIBE_MODEL` (default gpt-4o-mini-transcribe). Existing API origin, Clerk and quota configuration still apply. Sign in using this extension; add its distinct extension origin to the existing auth allowlist if required. Never put secret keys into extension/browser environment variables.
4. No environment values were changed here. The default server keeps these new endpoints disabled. A deployed main server does not gain them until this branch's server is deliberately deployed/enabled.
5. A synthetic browser fixture is available at `/demo/fixtures/assistant.html` on the Vite server. It uses the real Session and AssistantPanel, not a mocked editor. Its Save locally control is a test shortcut; the installed panel uses the existing save chooser.

### Acceptance journey

Open the source application's dialog, activate Edit and select a heading above native controls. Example labels below are acceptance inputs, not application-specific logic:

1. Select Metrics: **Add a Feedback length option below this.**
2. Select an existing pill: **Match this style. Give me Concise, Normal, and Elaborated.**
3. **Make Normal selected by default.**
4. **When someone selects Elaborated, show a detail view.** If no destination exists, answer **Create a blank detail view.**
5. **Change the detail view heading to Advanced Feedback.**
6. **Undo that last change.** Only the heading change should reverse.
7. Save using the existing chooser. Try flow, select Elaborated, then restore the saved workflow and repeat.
8. Export the .wandel.json file. A recipient needs this assistant branch's runtime, their own access to the original application, the matching page/dialog, and Import → Try flow. No creator credentials are included.

For buttons: select a heading, ask **Add two buttons below this heading**, then supply **Continue and Back** when asked for labels. Follow with **Make the second one green**, **Make both smaller** and **Move them right 12 pixels**.

For voice, first enable scoped sharing, then hold **Hold to speak** with the pointer or Space/Enter, speak one instruction, and release. Microphone use is explicit, capped at 20 seconds and visibly indicated; Cancel discards a pending recording/request. Permission failure leaves text usable. Actual microphone acceptance on installed Chrome is still pending.

## Validation and evidence

Final validation: **334 tests across 41 files passed**. TypeScript, isolated assistant extension build, platform build and whitespace checks passed.

- Automated coverage exercises the native category/default/detail/undo/save/export/fresh-session replay journey and a differently structured pricing page, plus selection ambiguity, style ambiguity, missing labels/targets, re-rendering, navigation, shadow roots, hidden/disabled controls, iframe limitations, malicious page text, atomic rollback, auth/quota/idempotency, payload/audio limits, cancellation and UI clarification.
- Browser fixture acceptance exercised category placement and native pill styling, default selection, destination clarification, detail-view editing, undo, local save, playback transition and restore. Screenshot: `docs/acceptance/assistant-native-category.png`.
- Real configured-provider checks succeeded with a synthetic heading/edit request and synthetic audio saying “Make the second button green.” These verify the Responses structured-output and audio transcription contracts. No production page data was sent.
- Production MirrorTalk and Maeris, a second human's installed extension, cross-viewport real-site replay and a real microphone have **not** been verified in this checkpoint. Fixture/provider success does not establish those acceptance results.

## Privacy, storage and cost

By default this feature sends nothing to an AI provider. With the panel's explicit sharing checkbox and a cloud request, Wandel's server/OpenAI receive the instruction and up to 32 relevant element descriptions (labels, roles, filtered attributes/classes, bounding boxes, selected computed styles and view names). It does not send complete HTML, screenshots, cookies, query strings or typed field values. Explicit recordings send mono 16 kHz audio, up to 20 seconds. Review context before using confidential applications: automatic text redaction and private-field exclusions are heuristics, not a guarantee that every confidential label is detected.

Audio is not persisted by Wandel. Sanitized transcription text and validated plans are cached in the existing ai_actions table for request idempotency; they inherit that database's retention and deletion behavior (no new automatic expiry is introduced here). OpenAI Responses requests set store:false; provider policy and any account-specific retention terms still apply. Ordinary workflow saves retain the UI text/styles/graph required for replay as before. This slice does not persist a raw conversation or raw DOM snapshot.

Each successful cloud plan or transcription consumes an existing AI action. A voice command requiring cloud interpretation can consume two actions. Failed provider/validation requests are marked failed and excluded from billed action usage. Rate, instruction, context, output and audio bounds prevent unbounded requests. Cancel prevents a late edit but cannot guarantee cancellation/refund of a provider request already accepted by the server.

## Boundaries and remaining work

- This is DOM/style grounding with speech transcription, not screenshot vision or an autonomous browser agent. Frames (including same-origin) and closed shadow roots are not inspected. Unusual framework portals and complex custom controls require real-site testing.
- Appearance is copied selectively; arbitrary custom hover animations and host business behavior are not replicated. Generated choices run prototype-only selection/navigation, not application saves or backend operations. Arbitrary show/hide, route creation from conversational URLs and complex layout rearrangement are outside this slice; use existing visual Connections where supported.
- Free-form language outside local shortcuts requires configured cloud service and auth. There is no guest voice endpoint or offline speech recognition.
- Selection handles, conversation memory, transaction labels and undo history are session state. Resulting ordinary workflow definitions and versions use existing persistence. This does not change the standard build's temporary-save lifetime.
- No persisted workflow schema was changed. Derived choice control IDs are now recognized as graph sources; older main runtimes/servers do not recognize those new connection sources. Share these new flows only with matching assistant runtimes until this validator support is deliberately merged/released. Existing saved workflows continue to validate.
- Broad existing extension permission and store/privacy review remains a release task; this branch adds no Chrome permission or remote executable-code loading. The separate build's changed extension ID needs normal Clerk/API-origin setup.
- Before merging: installed-Chrome MirrorTalk category journey, actual microphone test, recipient replay with missing targets/another viewport, and review of privacy disclosures and rollout configuration. The final attachment ends at “STAGE F: JOURNEY INTEGR”; no omitted requirements were inferred.
