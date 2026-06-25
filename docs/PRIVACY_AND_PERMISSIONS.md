# Privacy And Permissions

milXdy is a beta unpacked extension. Its permissions should remain explainable and limited to real runtime needs.

## Network Calls

- GitHub update checks call `https://api.github.com`.
- RemiStats calls `https://api.remistats.net` for public reputation data.
- Remilia Wiki previews call `https://wiki.remilia.org`.
- Grok wiki prompts are pasted into X's native Grok interface from the current X/Twitter page.
- Beetol Game, RemiNet pokes, and RemiNet Chat call `https://www.remilia.net`.
- RemiNet Chat live updates use `wss://www.remilia.net` when the chat setting is enabled.
- Postreader OCR and Maxxer avatar inference run locally in the extension context.

## RemiNet And Beetol Login

- Passwords entered in the Beetol Game login form are sent to RemiliaNET for login and are not stored by milXdy.
- RemiNet login state is stored in Chrome extension local storage.
- Login state should persist across browser restarts, extension reloads, and ordinary updates that keep the same extension identity.
- Browser-session SSO depends on RemiliaNET cookies in the user's browser profile.

## Cookies Permission

The RemiNet connector uses the browser `cookies` permission only for RemiliaNET requests that require the user's RemiliaNET session.

## Incoming Poke Flags

The incoming "poked you!" flag reads recent RemiliaNET notifications through the same connector login. It is based on notification sender handles with timestamps inside the active poke window, not all-time poke history.

## RemiNet Chat

RemiNet Chat is off by default. When enabled, it fetches recent chat messages, opens a RemiliaNET WebSocket, fetches RemiliaNET-hosted media for previews, and uploads attachments only after the user selects a file in the chat composer.

## Local Persistence

Settings and login state persist only while Chrome keeps the same extension identity. Removing the extension, loading a different unpacked folder, clearing extension storage, or browser profile cleanup can reset local state.

## 2FA Limit

Accounts with RemiliaNET 2FA should use **Open RemiliaNET SSO** and **Retry session** instead of the popup password login form. After the user finishes RemiliaNET login and 2FA in the browser tab, milXdy checks that browser session and may reuse the RemiliaNET `authToken` cookie for Beetol, RemiStats pokes, and RemiNet Chat connector requests.
