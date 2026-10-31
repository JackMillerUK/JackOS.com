# JackOS Browser 2.0

The local browser service runs a separate Microsoft Edge engine and streams its pages into the JackOS Browser window. Public websites are not embedded directly. The default home page is https://apple.com/uk. The old Purple Mash default is migrated automatically; other saved custom homepages are retained.

## Start or update

Requires Node.js 22 or later and Microsoft Edge in Applications. No npm installation is needed.

1. Extract the update into the existing JackOS-macOS folder, replacing matching files.
2. In the Terminal window running the old service, press Control-C. This ends temporary website sessions, so finish any website forms first.
3. Run START-JACKOS.command from the updated folder.
4. Refresh http://localhost:8092/JackOS-System-Files/JackOS.html in Edge.

A page refresh alone does not update the server process. If the page shows a yellow restart notice, it is still connected to the old server. Keep the service Terminal open while using JackOS.

For a manual launch, run `node browser-service/server.mjs` from this folder. Use the same hostname and port as your existing installation to retain JackOS account and file storage. Changing the port creates a different browser-storage origin.

## Changes in 2.0

- Live page-frame streaming replaces screenshot polling on the updated service.
- Wheel events are normalized, combined per animation frame and sent with one request in flight. Reversing direction drops unsent movement from the old direction.
- The latest frame is retained when scrolling stops, and images are decoded before display.
- Browser navigation, back/forward/reload, keyboard input, plain-text paste, popup tabs, JavaScript dialogs, copy-selection and download controls.
- Website file selection supports up to 20 MB per operation.
- Tab and connection cleanup, reconnect controls, and pause while hidden.
- Per-client temporary contexts, per-port connection cookies, same-origin command checks and session ownership checks.

The service binds to 127.0.0.1. Do not expose it publicly. It does not disable browser sandboxing, certificate validation or website security headers. Browser sessions use temporary profiles and are discarded when the service stops. Contexts are isolated by local browser connection, not by JackOS username.

## Validation and limits

`node --test browser-service/tests/regression.test.mjs` covers homepage migration, wheel normalization/coalescing/reversal, final-frame delivery, URL validation, HTTP command guards and session ownership. All five groups pass.

Live Edge checks during development verified page rendering, typing, clicking, navigation, back/forward, resize, popup rendering and a completed download appearing in the download drawer. Apple UK rendered through the streaming service. The final subjective scrolling comparison is not complete; the live JackOS session was still using the older server. A successful frame regression test does not establish native-smooth performance.

File chooser display and cancellation were checked. File submission and saving a completed download to the host have not been verified end to end. The popup address correction and clipboard fallback need further live regression coverage. Audio/video forwarding, remote-page accessibility, DRM, WebAuthn and browser permission prompts are not a complete desktop-browser implementation. CAPTCHA and site-specific compatibility remain controlled by the website. This release should not be described as a fully validated production browser.

Set JACKOS_BROWSER to the path of another compatible Chromium executable if needed. START-JACKOS.command reports startup errors; Node and the service must run on the same computer as Edge.
