# Multi-Site Runtime

milXdy runs only on a small reviewed host set. The current extension manifest and the App SDK registry must both authorize a site before the shared content runtime loads there.

| Site | Runtime surface | Apps/features that can load | Native fallback |
| --- | --- | --- | --- |
| X/Twitter (`x.com`, `twitter.com`) | Full rail, Apps & Features, routes, composer hosts, and Twitter scanner | The complete X-scoped registry | X/Twitter remains usable when individual apps are disabled. |
| RemiliaNET (`www.remilia.net`) | Bridge-only exact-host runtime; no milXdy rail, hub, launcher, or overlay UI | The isolated RemiNet socket bridge and accepted native-site helpers only | Native RemiliaNET chat, session, and game pages remain visually authoritative. |
| Remilia Wiki (`remilia.wiki`, `wiki.remilia.org`) | Direct document reader plus feature-only launcher | Post-reading | The native article is unchanged when Post-reading is disabled. |
| Miladychan (`boards.miladychan.org`) | Filtered app launcher | Miladychan Portal, on user open | Native boards for CAPTCHA, media, sessions, and full posting. |

The Miladychan launcher reuses the shared app lifecycle, scheduler, storage facade, diagnostics, and background-message authorization without starting the Twitter scanner or installing X composer, reply, share-menu, or media-action hosts. RemiliaNET is deliberately different: the generic content entry records the reviewed `bridgeOnly` role, removes stale extension-owned rail roots after an extension reload, and never creates the milXdy UI runtime. Its dedicated exact-host bridge remains independently declared in the manifest.

An app appears only when its manifest has a matching `siteScopes` entry with `integration: "contentScript"` for the exact current HTTPS origin. Background-service, bridge-only, and embedded-frame scopes do not authorize top-level UI injection. X-only apps therefore stay absent and unloaded on unrelated sites; Beetol and RemiNet Chat retain their reviewed RemiliaNET background-service declarations without acquiring a RemiliaNET overlay surface.

Related Remilia hosts are fail-closed: milXdy does not inject into them merely because they share a brand or parent domain. Adding a host requires an exact manifest match, site metadata, required permissions, privacy disclosure, load triggers, fallback behavior, sender validation for any routed messages, and cross-host QA.

For QA, refresh one tab on each approved host after reloading the extension. Confirm the runtime site marker, expected X rail or site-specific feature surface, absence of the rail and all extension overlay roots on RemiliaNET, the native fallback, and unchanged X timeline behavior.
