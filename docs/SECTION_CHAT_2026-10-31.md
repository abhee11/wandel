# Selection-anchored chat

Visual edit selection tools now include Chat here. It pins the selected element/section locator in the existing assistant collector and moves the existing tab-owned iframe beside that section, with a compact transcript/composer-only UI. This is the same AssistantPanel, workflow conversation history, memory, account AI client, executor and verification path as page chat. It does not use the older promptHere one-shot pipeline.

The focus locator remains independent of the UI selection after edits, so selecting a newly created control does not automatically switch the section being discussed. Context capture starts from the pinned section and explicitly instructs preservation of the rest of the page. This is intent/context scoping, not a security sandbox for arbitrary layout actions. An unavailable focus asks for a new section instead of silently editing the whole page.

Page chat in the anchored header returns to the full panel and clears focus. Closing/reopening via the extension icon also clears focus. Shared workflow conversation and semantic memory remain available. The initial anchor is viewport-clamped; it is draggable and resizable using the tab-owned panel controls.

Validation: extension TypeScript/build and git diff whitespace check passed. No automated test suites run. The selection-to-chat interaction, follow-up focus and Page chat transition have not yet been manually verified in Chrome.
