# Tab-owned floating workspace

Replaces the detached Chrome popup with a resizable, draggable workspace inside the source application tab. The top bar names the app domain. The panel is a fixed overlay, so application viewport width is unchanged. Collapse retains the iframe/session; close removes it and preserves the draft through the existing disconnect checkpoint. Switching tabs leaves the embedded bridge connected to its original tab. Refresh/navigation can restore the workspace using a per-tab session key.

The existing extension React UI runs in an extension-origin iframe, isolated by a shadow root from host styling. No host HTML is injected into the extension UI. The manifest exposes the required UI resources. Embedded service requests are constrained to the sender's containing tab; the bridge also checks its containing tab. Existing account and workflow storage is reused. No account workflow definitions are migrated or rewritten.

Screenshot capture temporarily hides the workspace and restores it in a finally block. The overlay host is marked as Wandel UI and is outside the body editing surface. Existing field/private-content redaction remains in place.

The toolbar and connection launcher now open the in-tab workspace. A legacy popup associated with that exact tab is retired only when its verified URL is the Wandel popup URL. No new companion window is created. Dock remains available only to older standalone/docked UI surfaces; the embedded workspace has its own drag/collapse/close bar.

Validation: TypeScript and extension build passed; git diff whitespace check passed. No automated tests were run. Manual Chrome reload was attempted. Chrome returned blank screenshots for both MirrorTalk and the extensions page, and some AX actions failed with elementHasNoFrame. The in-tab panel, drag, resize, collapse, tab isolation, account load and screenshot capture are not yet counted as manual passes. User was asked whether the real screen is visible and whether the panel opens.

Follow-up: user confirmed MirrorTalk and the in-tab panel are visible. A fresh native screenshot and AX tree also show the embedded panel inside Group Onboarding with the mirrortalk.ai label, chat composer, account control and resize grip, while the source page retains its full width. Native drag and coordinate-click attempts failed with noWindowsAvailable; AX collapse click produced no observable change. Drag, resize, collapse/reopen, tab switching and account load remain unverified, not failed functionality claims.
