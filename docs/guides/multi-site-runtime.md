# Multi-Site Runtime

milXdy runs only on a small reviewed host set. The current extension manifest and the App SDK registry must both authorize a site before the shared content runtime loads there.

| Site | Runtime surface | Apps/features that can load | Native fallback |
| --- | --- | --- | --- |
| X/Twitter (`x.com`, `twitter.com`) | Full rail, Apps & Features, routes, composer hosts, and Twitter scanner | The complete X-scoped registry | X/Twitter remains usable when individual apps are disabled. |
| RemiliaNET (`www.remilia.net`) | Filtered app launcher and shared routes/scheduler/diagnostics | RemiNet Chat and Beetol, on user open | Native RemiliaNET chat, session, and game pages. |
| Remilia Wiki (`remilia.wiki`, `wiki.remilia.org`) | Direct document reader plus feature-only launcher | Post-reading | The native article is unchanged when Post-reading is disabled. |
| Miladychan (`boards.miladychan.org`) | Filtered app launcher | Miladychan Portal, on user open | Native boards for CAPTCHA, media, sessions, and full posting. |

The filtered launchers reuse the same app lifecycle, scheduler, storage facade, diagnostics, background-message authorization, Apps & Features cards, and overlay chrome as X. They do not start the Twitter scanner or install X composer, reply, share-menu, or media-action hosts.

An app appears only when its manifest has a matching `siteScopes` entry with `integration: "contentScript"` for the exact current HTTPS origin. Background-service and embedded-frame scopes do not authorize top-level injection. X-only apps therefore stay absent and unloaded on unrelated sites.

Related Remilia hosts are fail-closed: milXdy does not inject into them merely because they share a brand or parent domain. Adding a host requires an exact manifest match, site metadata, required permissions, privacy disclosure, load triggers, fallback behavior, sender validation for any routed messages, and cross-host QA.

For QA, refresh one tab on each approved host after reloading the extension. Confirm the runtime site marker, expected rail/reader surface, absence of X-only controls on non-X pages, the native fallback, and unchanged X timeline behavior.
