# Wandel — Workflow Lab

Release planning: [Free launch checklist, with cloud and paid features deferred](docs/RELEASE_CHECKLIST.md#free-launch-checklist--do-this-first).

A Chrome extension for prototyping **multi-step product workflows on top of a live application**. Select an element, describe the UI to add, connect a prototype button to a new state, and keep building with the same tools in every state. Save the complete graph as an immutable version and replay it later.

## Run

Requires Node 20+ and Chrome 116+.

```sh
npm install
npm run build
npm test
npm run dev
```

The interactive sandbox opens at http://127.0.0.1:5173. In its Build mode, click any sample-app element directly to select it. Controls appear beside the selected element. Double-click text to edit it in place; the page does not scroll to the side panel. Use Replay flow to run button interactions. It uses the same React panel, locators, DOM renderer, workflow engine, and command handling as the extension. Its storage adapter uses localStorage instead of chrome.storage.local. The fictional application is an authoring fixture; its own navigation/filter controls are decorative.

## Install the extension

1. Run `npm run build`.
2. Open `chrome://extensions` and turn on Developer mode.
3. Choose **Load unpacked** and select this project's `dist` directory.
4. Open or reload a normal http(s) webpage. Click the Wandel toolbar action to open its Chrome Side Panel.
5. Selection starts automatically when the side panel opens. Click any anchor; selection remains active for subsequent clicks. Closing the side panel releases page clicks.

The manifest requests http(s) access so enabled saved workflows can restore after reload/navigation. Chrome internal pages, the Chrome Web Store, iframe contents, canvas internals, and closed shadow roots are not supported. The extension does not submit host forms or change host backend behavior.

## Acceptance walkthrough

Use the sandbox or any normal application with a distinctive Customers element.

1. Select **Customers**.
2. Enter **Add Risk Analysis beside this** and choose **Add UI**.
3. The inserted button is selected automatically. In its on-page toolbar, open **→ Click behavior**, type **Analysis Panel** in New state, then press Enter.
4. The new panel is selected automatically. Enter **Add View Details inside this**.
5. Connect that button to a new **Detail State**.
6. Enter **Add Approve inside this** and connect it to **Confirmation State**.
7. Enter **Add text called Approved inside this**.
8. Name the workflow **Risk Analysis Flow**, then **Save workflow**. This stores v1 of the complete experience.
9. Choose **Replay flow**, then click **Risk Analysis → View Details → Approve** on the page.
10. Reload the page. It starts clean. In Saved versions → Saved on this page, open Risk Analysis Flow, then Replay flow. All three interactions remain in the saved workflow.
11. Edit and **Save new version** for v2. Open **Saved versions** to restore v1 without overwriting either historical snapshot.

**Build** activates continuous selection. **Replay flow** executes prototype transitions. Esc pauses selection in the extension; click Build to resume. Replay starts at entry; Back follows the visited path. Existing host controls retain their native behavior outside selection mode. Authoring is local until explicitly saved. Unsaved drafts from SPA navigation remain recoverable in the current tab’s workflow list, but are not reapplied automatically and do not survive a full reload. A saved workflow is scoped to exact origin + path + query + hash. Returning to that route starts clean; explicitly load a saved workflow to reapply it. Versions and named workflows can be restored, duplicated, deleted, or disabled in the panel.

## Prompt modes

### Local commands — no service or API key

A small deterministic parser supports the milestone commands:

- `Add Risk Analysis beside this`
- `Add a button next to this called Analyze`
- `Add View Details inside this`
- `Add a panel called Analysis below this`
- `Add text called Approved inside this`
- `Rename this to Run evaluation`

This is explicitly labeled **Offline presets**, not presented as an AI model. Relative placement is anchored to the selected element. Select the intended anchor first; named third-party targets in prompts are not independently resolved. Unsupported requests report an error.

### AI planner — optional

Use your shell/environment to provide `OPENAI_API_KEY`, `OPENAI_MODEL` (a model supporting Structured Outputs), and optionally `DESIGNX_PLANNER_TOKEN`, then:

```sh
npm run ai
```

Choose **AI planner** in the panel and paste the local token printed by the server. The API key stays in the server environment. The server binds only to `127.0.0.1:4319`, requires its token, and permits requests only from extension origins and the local demo. The token is kept in panel memory. Explicitly submitted prompts and the selected element's label/tag are sent to the server and OpenAI; page HTML, input values, and credentials are not collected. No AI requests happen during replay.

The server uses the [Responses API with Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). Model responses pass a strict schema; the trusted client supplies the selected locator and IDs. Arbitrary HTML/CSS/JavaScript and live backend actions are not supported. Failed/refused/invalid responses do not apply changes. Configuring a model/API key is required for this optional path; it is not required for the acceptance walkthrough.

## Architecture and scope

See [the pre-implementation proposal](docs/ARCHITECTURE.md) for the schema, locator strategy, state model, navigation plan, and milestone review gate.

- `extension/prototype`: graph validation, ancestry, transitions, undo/redo.
- `extension/content`: conservative locator scoring, selection, reversible projection, tab session.
- `extension/ai`: local planner, validated AI plans, operation materialization.
- `extension/sidepanel`: React authoring/replay/version UI and tab bridge.
- `extension/storage`: adapters, complete graph snapshots, immutable numbered versions.
- `extension/background`: [Side Panel behavior](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) and [SPA navigation notifications](https://developer.chrome.com/docs/extensions/reference/api/webNavigation).
- `demo`: sample application connected to the production authoring engine.

Default limit: ten states per workflow, configurable in the data model (2–30). States form an acyclic ancestry tree; click edges can branch or loop to any valid state. Each state renders its ancestor changes plus its own editable panel. Only the current state's edges fire. No full page snapshots are stored. UI modifications are undone before switching projections; rerender reconciliation only repairs missing operations. Host nodes and their event listeners are retained.

Conservative locators prioritize stable attributes plus semantic consistency, then role/name/text and parent/neighbor context. Tied/low-confidence candidates are unresolved. This is deliberately limited to top-level light DOM and cannot guarantee matching arbitrary applications after major redesigns. Inserting beside/inside preserves the host's flow layout; arbitrary CSS systems may need a better anchor. Below uses a full-width flow wrapper, whose positioning remains subject to the host layout. Text edits require a leaf element.

Compact appearance controls and visual-offset dragging are included. Host-control triggering, external URL actions, cloud sync, and collaboration are deferred. Review the workflow engine and real-application compatibility before expanding those areas.

## Direct editing controls

Reload the unpacked extension in chrome://extensions and refresh the app page after each new build.

- Opening the side panel activates continuous element selection; no repeated picker clicks are needed.
- **Escape** exits selection and returns clicks to the page. **Escape again** checkpoints the draft locally, closes the panel and restores the original page. Reopen Wandel to continue the current draft, or load it from the local workflow list after a page reload. Checkpoints do not create saved versions or trigger an upgrade. Extension drafts use browser-session storage: save to your account before exiting the browser or reloading the extension. Escape during a drag or inline rename cancels that edit first.
- Select an element and open **◐ Appearance** beside it. Colors and dimensions apply as you change their values; there is no Apply button.
- Hold Option/Alt and drag the element to move it; hold S to resize. A drag is one undo step. This stores a visual translation: surrounding layout does not reflow or reorder.
- Select an element, then press **B** for a button, **T** for text, **F** for an input field, or **P** for a section. Alternatively, open **+ Add** and click a type. The new element appears immediately with its default name selected: type a name and press Enter, or press Escape to keep the default. New input fields use their name as their placeholder. Auto placement inserts inside containers and beside controls; placement pills let you override it. Shortcuts are inactive while typing or replaying. Use **Ask** for prompts; the side panel retains the optional AI planner.
- **⧉ Duplicate** or **Cmd/Ctrl+D** copies the selected item beside itself and selects the copy for editing. Simple labels open ready to rename; sections retain editable children. Copies keep basic computed styling, but omit scripts, host event handlers, form values, embedded content and SVG icons. Undo, workflow saving and replay retain copied elements.
- **⌫** beside the element removes it from the prototype, preserving host DOM and listeners for restoration.
- **Cmd+Z / Ctrl+Z** undoes one change; **Cmd+Shift+Z / Ctrl+Shift+Z** redoes. Inside text fields, native text undo is preserved. Toolbar Undo/Redo also works.
- **Restore original page** clears all states, interactions, and edits in the current draft. Saved versions remain. This reset itself is undoable. Save a new version to persist the cleared draft; otherwise reload restores the previously saved version.

These modifications use validated style/remove operations and are included in workflow versions. Prototype edits do not affect the application's backend.

### Hover shortcuts (Build mode)

No prior click or drag-mode toggle is needed:

| Gesture over an element | Result |
| --- | --- |
| Option/Alt + drag | Move visually |
| S + Option/Alt + drag | Resize width and height |
| Option/Alt + arrow key | Move by 1 pixel |
| S + Option/Alt + arrow key | Resize by 1 pixel |
| Esc during a gesture | Cancel the preview |
| Cmd/Ctrl + Z after a gesture | Undo the entire gesture |

The hover outline shows a shortcut hint; resizing shows live dimensions. Keyboard gestures do not override text-input editing or operate in Replay mode. Pointer cancellation or window focus loss rolls back the preview. Inline elements become inline-block when sized, allowing width and height to apply; Undo restores their original display. Save a workflow version to retain gestures across reloads. Movement uses visual translation and does not reorder siblings.

### Inline editing and minimal controls

Double-click a visible text label to edit it where it appears. Enter or clicking away commits; Escape cancels. There is a single text editor, with no duplicate sidebar label inputs or Rename button. The editor never makes the host app's forms editable or submits them. A single direct text run can be edited while keeping sibling icons, badges, child nodes, and listeners intact. For complex multi-label containers, double-click the specific label inside them.

The compact on-page toolbar exposes text editing, appearance, adding UI, click behavior for prototype buttons, removal, Undo/Redo, and Replay. **⋯ Workflow actions** holds workflow naming, state switching, saving, restoring versions, and restoring the original page. Text edits are one undo step; changes made during a focused appearance-field gesture are grouped into one undo step. The side panel now concentrates on prompts, the workflow graph, and the version library.

## Clean page lifecycle and quick prompts

Closing the extension side panel removes every applied insert, text/style change, hidden element, and gesture offset from the page. Host rerenders cannot bring them back while the panel is closed. Saved versions are not deleted. Reopening the panel can resume the current in-memory draft.

Navigating to another application route clears the old projection. A new document or returning route starts clean; select a saved workflow explicitly to load/replay it. Unsaved SPA drafts remain recoverable from the workflow list for the lifetime of that tab.

**Resize:** hold **S + Option/Alt**, then drag the element. Release S to return to ordinary Option/Alt movement. Keyboard resizing also uses S + Option/Alt + arrows. Shift is no longer the resize modifier.

**Add on the page:** click an anchor → **+ Add** → choose Button/Panel/Text and placement → type a label → Enter. The element appears beside or inside the anchor.

**Edit with a prompt:** click an element → **✧ Ask** → type a change → Enter. The side-panel prompt also accepts Enter (Shift+Enter makes a newline). Examples that work without an AI service:

- `Change this to Customers`
- `Rename this to Run analysis`
- `Make this red`
- `Set background to blue`
- `Set width to 200`
- `Set font size to 24`
- `Remove this`
- `Add Analyze beside this`

Local commands are bounded. Unsupported requests show examples instead of silently doing nothing; broader phrasing requires the optional configured AI planner in the side panel.


### Form prompts and multi-change plans

Select the Sign in button or its label, then submit: “change the sign in button and the page layout and make more fields and add more name and last name and address”. The offline form preset inserts First name, Last name, and Address before the submit button, changes the containing form to a vertical layout, and restyles the button purple/white. It preserves the button label unless a replacement is supplied in quotes. This is a bounded preset, not arbitrary page redesign or a connected language model.

All edits from one prompt share a single Undo step and are included in saved versions. Fields are local, unnamed controls; typed values are neither saved nor sent to the planner. In Replay they accept typing; Enter does not submit the host form. In Build, clicking a generated field selects it for editing.

The optional AI planner now returns up to 20 validated operations (insert, text, style, remove), scoped to the selection, its containing form, or that form's submit button. It supports field insertion and a small allowlist of layout styles. It still requires your server/API configuration; there is no bundled AI credential. The client rejects invalid plans and ambiguous targets.

A login fixture for testing is available at `http://127.0.0.1:5173/?fixture=login`. It does not connect to any sign-in service.

The extension defaults to **Wandel account** AI through the authenticated `/api/ai/plan` endpoint. Sign in under Account and configure the server's OpenAI key/model. To use a local companion instead, open AI connection settings, choose **Use local server**, paste its token and click **Connect AI**. This checks the server configuration without making a model request. A connected server may still report provider credential, model, or quota errors when you run a prompt. **Offline presets** remains an explicit fallback for bounded commands. The on-page contextual prompt runs supported quick edits locally and uses the panel’s configured AI connection for broader requests.

The AI server automatically loads the project-root `.env` file on startup (Node 20.12+). Set `OPENAI_API_KEY` and `OPENAI_MODEL` there; restart `npm run ai` after changing them. The `.env` file is excluded from version control.

### Opening on a specific tab

Click Wandel's toolbar button on the app you want to edit. Opening a new tab does not open Wandel or start selection there. Returning to a tab where you already opened its panel can show that panel again. Pages already open when the extension was installed get an on-demand content-script connection attempt; if site access is denied, use the panel's Retry connection after allowing access in Chrome. This recovery uses the `scripting` permission.

## Extension accounts, saving and Stripe test checkout

Wandel is extension-first. Click **Save workflow** after building a flow:

- **Save to my account** authenticates with Clerk, then stores the complete workflow and immutable version in the server database. Free limits (5-step depth, 3 workflows, 3 versions by default) are enforced at save time. A limit failure offers Stripe test checkout and keeps the draft unchanged.
- **Save temporarily · Free** uses `chrome.storage.session` through the background worker. It never uploads to the account database and is cleared when Chrome exits or the extension reloads. Old persistent Chrome-storage records remain available under Account → Previous local saves.
- **Account & saved workflows** lists account saves. On a matching application URL, Open restores the full state graph. Different devices must connect to the same deployed API/database; two localhost servers do not share a database.

The current database is SQLite at `.data/wandel.sqlite`. Migrations run at API startup. Clerk identities are mapped by verified Clerk user ID; existing password accounts are not silently linked by email. Clerk and Stripe credentials are not included in this repository.

### Configure the external services

1. Set `VITE_CLERK_PUBLISHABLE_KEY` (written by Clerk CLI; legacy `CLERK_PUBLISHABLE_KEY` also works), `CLERK_SECRET_KEY`, `CLERK_SYNC_HOST`, `WANDEL_APP_ORIGIN`, and `WANDEL_API_ORIGIN` in `.env` (see `.env.example`). Use the same Clerk instance for the extension and its sign-in page. Enable **Google** under Clerk social connections.
2. Build/load the extension and copy its Chrome extension ID. Add `chrome-extension://<ID>` to Clerk's allowed origins **without replacing existing origins**, and to `WANDEL_EXTENSION_ORIGINS`. Optionally provide a stable public `WANDEL_EXTENSION_KEY` before registering the final ID. The extension needs the cookies permission for Clerk Sync Host. Set syncHost to the web application host whose Clerk session should be synced; verify the production sign-in host and cookie behavior against the Clerk Chrome Extension SDK setup.
3. Set a Stripe **test** secret key (`STRIPE_SECRET_KEY`), active monthly USD recurring price (`STRIPE_PRICE_ID`), and signed webhook secret (`STRIPE_WEBHOOK_SECRET`). Live keys/events are rejected. No credentials means checkout reports unavailable; it never silently grants mock Pro.
4. Forward test events: `stripe listen --forward-to http://127.0.0.1:4320/api/billing/webhook`. Use the emitted webhook secret in `.env`. Required events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
5. Restart/rebuild after changing `.env`:

```sh
npm run build
npm run platform:build
npm run platform:server
# Separate terminal for the local sign-in/checkout-return page:
npm run platform:dev
```

Reload Wandel in `chrome://extensions`. Sign in from the panel, finish Google authentication in its browser tab, return to the application, and reopen the panel to sync Clerk. Click Save to my account. If a limit requires Pro, checkout opens from that save, and the draft remains in the original tab. On success or cancellation return there and retry saving; signed Stripe webhooks are the only way to grant paid access.

For successful Stripe test payments, use `4242 4242 4242 4242`, a future expiry, and any three-digit CVC in Stripe's test form. Never use a real card. Configure Stripe's test billing portal to manage/cancel subscriptions from Account. No payment information passes through Wandel.

The local account server listens on loopback; deployment and a hosted/shared database are separate setup steps. The extension's default AI path uses the account API and its usage limits. The local companion planner remains an optional connection.

### Validation and security

`npm test` covers the editor, account isolation, atomic saves, retry idempotency, stale-version conflicts, save-time limits, Clerk identity mapping, Stripe signature verification, cancellation and session-only saving. Service tests use a fake identity provider and signed synthetic Stripe events; actual Google login and test-card checkout require configured credentials and Chrome verification.

Public build configuration alone enters the extension. Clerk secret keys, Stripe keys, and webhook secrets stay on the server. Legacy password APIs are disabled by default (`WANDEL_AUTH_MODE=clerk`); legacy fixtures and mocks remain available only for regression tests. Cookie-based legacy sessions cannot authenticate to the Clerk API.

### Contextual editing and mirrored controls

Select a control to reveal the on-page prompt, insertion points and resize handle. Drag a selected item directly to move it; Option/Alt dragging remains available without selecting first. The prompt can target This element, This section or Whole page. Quick edits run locally; broader requests use the AI connection configured in the panel. The panel opens its AI settings when a connection is needed.

Use **On click…** on an existing application button or a prototype button to create a screen or connect an existing screen. Breadcrumbs return to earlier screens. **Try flow** follows prototype interactions; **Edit** returns to authoring.

To mirror a button or field, duplicate it, finish renaming, then choose **Behavior → Mirror original behavior**. In Try flow, button clicks are forwarded to the original control, and standard text/checkbox input and change events update the original input. This can execute real application actions; it is deliberately opt-in and disabled during editing. Mirroring needs the original control to remain available and unambiguous on the same page. Trusted-event-only actions, file pickers, closed shadow roots, embedded frames and proprietary widgets are not guaranteed. Typed field values are never included in workflow snapshots. New prototype transitions take priority over mirrored clicks.

Edits are checkpointed locally after a short idle period without creating a version or triggering a paid save. Reopen the page and choose **Resume local draft** to recover. Chrome drafts remain browser-session scoped; use account saving for durable storage.

The homepage demonstration now continues through Customers → Risk Analysis → Details → Approval. A visitor can take over the current scene and advance its workflow buttons. It remains a preset demonstration, not an AI call.

Clerk development setup was linked with the official CLI to the Wandel app on October 4, 2026. `clerk doctor` verified the app connection and development key configuration; Google and email sign-in are enabled. Production setup and the first end-to-end extension login/account save remain separate verification steps.

### One-prompt connected flows

Select a control and ask “Build a risk review flow with customer details, approval and confirmation.” The planner can create a launch button and 2–8 connected prototype panels in one undoable change. The last panel ends the flow; intermediate actions open the next panel. Use **Try flow** to replay, or select a generated element to refine it with the same editing tools. The compact on-page trail opens any generated step. Saves include all screens and connections.

Generated buttons borrow the selected control's colors and font size locally; this is basic appearance matching, not full component reconstruction. Only the explicit prompt and selection label/tag go to the provider. Plans are bounded structured data, never executable markup. Flow generation requires configured AI; offline commands do not generate arbitrary workflows.

### Section redesign and Chrome sign-in

Shift-click a page element to select its surrounding section, or use **↑ Section** and **↑ Parent** in the on-page toolbar. **Reimagine** fills a section-scoped prompt; press Enter to generate a replacement containing editable copy, cards, fields and an optional prototype button. The original section is hidden locally and restored by Undo, reset or closing the editor. It does not publish changes to the source application.

After rebuilding, reload Wandel at `chrome://extensions` and refresh the target tab. Sign in to the helper from the same Chrome profile as the installed extension; signing in through Codex's in-app browser does not establish the Chrome session. Development registration can be stored as an explicit array of `chrome-extension://<id>` origins in `.data/development-extension-origins.json`; the local server merges these with the environment allowlist. Production ignores this file and requires `WANDEL_EXTENSION_ORIGINS`. Register the same exact origin with Clerk. No wildcard origins are accepted in the local registration file.

### Guest AI previews

The extension shows a visible Guest/Sign in profile row and allows two AI attempts per anonymous installation identifier without Clerk login. Guest prompts are capped at 600 characters, selection labels at 160 characters and request bodies at 2.4 KB. A relevance filter rejects obviously unrelated or instruction-override requests before the provider call. Guest output is capped at 1,500 model tokens and validated as at most five edits to the selected target or one section with at most three cards and three fields. Connected flows require sign-in. Signed-in planner output is capped at 4,000 tokens.

SQLite reserves each guest attempt before calling AI, including failed attempts; duplicate successful request IDs replay their result without another call. Additional hard limits are 10 attempts per network address per UTC day and 50 guest attempts across this server per UTC day. Anonymous identifiers are resettable, so these are not verified-person quotas. Network limits use the direct peer address (forwarded headers are not trusted); deployments behind a proxy may share a conservative network cap. The relevance filter is heuristic; strict output validation and hard budgets provide the spend boundary. Profile identity refreshes when the extension regains focus. Local edits and temporary saves remain available after previews are exhausted.

## Branching feature creation

With the AI connection enabled, select an existing control and ask:

> Add a risk analysis feature: a dashboard with sample metrics, customer details with a review note, separate Approve and Reject confirmations, and a return to the dashboard showing the decision.

Generated flows support 2–8 screens per request, multiple actions per screen, return links, cards, metrics, and small tables. Edit any generated element, or use **On click → New state** to extend it. The existing 30-state engine limit still applies. Sample data assignments and bound fields are local simulation only; they do not call the application's backend. **Back** restores the preceding decision state; **Restart** resets all sample data. Replay input values are transient and excluded from saved workflows.

For a deterministic engine demonstration, run `npm run dev`, open `/?fixture=feature`, and click **Build sample branching feature**. The fixture is labelled as scripted; it does not invoke AI. Reload the unpacked extension and restart/redeploy the planner service after updating, so both use the new graph contract. The local-only free build can replay saved graphs and create manual steps but does not call hosted AI.


## Voice and conversational editing

Voice is included in the regular extension: `npm run build` → reload `dist/` in Chrome. In Edit mode choose **Voice assistant** beside **Imagine a feature** and **Edit this page**. Select an element, enable scoped voice/context sharing, then hold **Hold to speak** and release to send (20-second maximum). Typed local instructions work without cloud consent; denied microphone permission or unavailable cloud service leaves typing available. Switching back retains the multi-step feature prompt.

Server cloud interpretation/transcription uses the existing signed-in account and OpenAI configuration (`OPENAI_API_KEY`, `OPENAI_MODEL`, optional `OPENAI_TRANSCRIBE_MODEL`). Endpoints are enabled by default; set `WANDEL_ASSISTANT_ENABLED=false` to disable them. No microphone recording or provider request occurs merely by opening the interface. Never put secret API keys into the extension.

`npm run build:assistant` remains an alias of `npm run build` for old instructions. It no longer creates `dist-assistant/` or a separately named extension. Disable/remove any previously installed Assistant Beta to avoid two editors on one page. The optional local-only free build remains offline and does not include cloud voice.
