# RemiNet Chat User Guide

RemiNet Chat provides a docked RemiliaNET chat client and an X Messages integration.

## Where To Find It

- Enable **RemiNet Chat** from Apps & Features.
- Open **RemiNet Chat** from the side rail.
- On supported X Messages routes, use the **RemiliaNET Chat** entry for the larger chat surface.

## Common Tasks

- Confirm the official **Remilia account** status before opening chat.
- Use the docked panel for recent messages, live updates, reactions, pokes, allowlisted media and pfp.remilia.net avatar previews, and profile lookups.
- Reaction counts appear pressed when your account is included, and clicking the count continues to toggle that reaction.
- Scroll to the oldest loaded messages and click **Show more** to load another batch of older history.
- Use minimized mode when you want chat present without taking over the page.
- If chat does not connect, use **Connect** or **Reconnect** and confirm the
  `remilia:chat.read` and `remilia:chat.write` abilities, then refresh X/Twitter.

## Notes

Official API-v1 REST history and text/reply posting are the source of truth.
The WebSocket is a temporary legacy acceleration adapter: disabling or losing
it must not break REST history or text posting. Current official Chat scopes
support text and replies, not image or video uploads. The attachment control is
disabled and the panel links to the native RemiliaNET website for media sending.
Pasting an image shows an availability notice and preserves your text draft.
The retained legacy upload adapter is dormant: the background rejects upload
requests before token access or network work. Media and avatar previews are limited to allowlisted HTTPS
RemiliaNET media and `pfp.remilia.net` URLs.

On RemiliaNET global chat, hover or keyboard-focus **Last read** or **Jump to present** to reveal its dismissal control. Dismissing either removes only that marker kind for the current page document; it does not hide messages, change read history, send a request, or persist across a page navigation/reload.
