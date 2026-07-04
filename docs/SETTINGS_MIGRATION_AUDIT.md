# Settings Migration Audit

This audit maps current milXdy settings to owners and future homes before the Apps & Features migration moves controls out of broad popup tabs. It is a planning contract for #52, #55, #61, #64, and related App SDK work.

Global controls stay in the top-right extension popup. Full app settings belong in the app surface or app-owned settings surface. Non-app feature settings belong in Apps & Features once generated setting controls exist. Storage keys should remain compatible while controls are mirrored during migration.

## Legend

- **Popup**: keep in the top-right extension popup.
- **Apps & Features**: expose directly on the feature/app card or a generated feature settings panel.
- **App surface**: move into the windowed/docked app's own settings UI.
- **Advanced**: keep out of default flows; expose only under diagnostics, developer, or explicit advanced controls.
- **Mirror**: keep old and new UI locations temporarily writing the same storage key.

## Global And Suite Settings

| Current setting | Storage | Current UI | Owner | Future UI | Presets / packs | Migration notes | Mirror |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Popup theme mode | `local:milxdy.settings.theme` | Popup shell theme buttons | Suite | Popup | Profile pack later only if declared safe | Global popup theme, not app theme. Do not confuse with app chrome or RemiNet Chat sound settings that previously shared theme-ish naming. | No |
| Performance mode | `local:milxdy.performance.mode` | Main tab | Suite runtime | Popup | Performance, first-run, profile pack | Already exported/imported by profile packs. Keep global because it affects scheduler, scanner, and background network budgets. | No |
| Performance diagnostics | `local:milxdy.diagnostics.enabled` | Main tab / Health | Diagnostics | Advanced / Health | None | Developer/testing toggle. Do not place in Apps & Features cards except as runtime status output. | No |
| Update status | `local:milxdy.updateStatus` | Suite update card | Suite update flow | Popup / Suite | None | Status cache, not a user preference. Reset only through update troubleshooting. | No |
| Update assistant provider | `local:milxdy.update.llmProvider`, `local:milxdy.update.llmCustomUrl` | Update assistant controls | Suite update flow | Advanced / Suite | None | User-configured assistant endpoint can be privacy-sensitive; keep out of profile packs. | No |
| First-run setup status | `local:milxdy.apps.firstRun.status` | First-run Apps & Features prompt | Suite onboarding | Apps & Features setup prompt | First-run only | State marker, not an ordinary setting. Do not export. | No |
| Onboarding active / toolbar pinned | `local:milxdy.onboarding.active`, `local:milxdy.onboarding.toolbarPinned` | Popup onboarding | Suite onboarding | Popup / onboarding | None | Flow state only. Do not move into settings schema. | No |

## Appearance, Presets, And Profile Packs

| Current setting | Storage | Current UI | Owner | Future UI | Presets / packs | Migration notes | Mirror |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Appearance profile | `local:milxdy.settings.reskinProfile` | Appearance presets and custom theme base | Root Visuals / Suite appearance | Popup Appearance | Visual, first-run, profile pack | Global appearance intensity. Keep in popup, while Apps & Features can disclose package participation. | No |
| Visual theme object | `local:milxdy.settings.visualTheme` | Appearance custom editor | Root Visuals / Suite appearance | Popup Appearance | Visual, profile pack | Stores most Root Visual/X redesign controls; profile packs nest this as `milxdy.visualTheme`. | No |
| Custom visual themes | `local:milxdy.settings.visualCustomThemes` | Appearance saved theme selector | Suite appearance | Popup Appearance | Visual share/export; not imported by profile packs yet | User library. Do not auto-export all saved themes in profile packs unless explicitly requested. | No |
| Visual theme import/export/share string | File/share string payload, no persistent key until applied | Appearance export controls | Suite appearance | Popup Appearance | Visual | Existing visual-only flow stays compatible; profile packs are separate and nest one visual theme. | No |
| Profile pack export/import | File payload, writes `reskinProfile`, `visualTheme`, `performance.mode` | Appearance export controls | Suite profile packs | Popup Appearance | Profile pack | Current implementation supports appearance plus performance. Future app/rail/layout sections must opt in through schema. | No |
| App chrome style | `local:milxdy.settings.visualTheme.appWindowStyle` | Appearance custom editor | Suite appearance / app chrome | Popup Appearance, disclosed in Apps & Features | Visual, first-run, profile pack | Global default for supported app windows. Future per-app override should be app/profile-pack metadata, not ad hoc keys. | No |
| App shadows | `local:milxdy.settings.visualTheme.appShadows` | Appearance custom editor | Suite appearance / app chrome | Popup Appearance | Visual, profile pack | Global visual behavior for app windows. | No |
| Root Visual X redesign controls | `local:milxdy.settings.visualTheme.*` | Appearance custom editor | Root Visuals feature | Popup Appearance, some feature disclosures in Apps & Features | Visual, profile pack | Includes fonts, PFP shape/surfaces, page fade, square media, quote gap, max media height, post button, sidebar bevel, new-posts pill, notification tint. #64 should split fine-grained Root Visual controls without changing storage. | No |
| Tweet PNG visual/export controls | `local:milxdy.settings.visualTheme.tweetPng*` | Appearance PNG Exporter subgroup | Tweet PNG feature | Apps & Features feature settings or Tweet PNG export surface | Visual, profile pack | Feature-owned export behavior is currently stored inside the global visual theme. Move UI to Tweet PNG feature settings later, but preserve storage compatibility. | Yes |
| RemiStats/Poke appearance controls | `local:milxdy.settings.visualTheme.remistatsBox`, `incomingPokeGold`, `pokePlacement` | Appearance / visual theme | RemiStats + pokes feature | Apps & Features feature settings, with appearance mirror | Visual, profile pack | Crosses appearance and feature behavior. Mirror until users have a clear feature-settings home. | Yes |
| Maxxer visual controls | `local:milxdy.settings.visualTheme.disableMaxxer`, `disableSelfTracking`, `maxxerIntensity`, `maxxerSeparators`, `maxxerShimmer`, `miladyOnly` | Appearance custom editor | Milady Maxxer app | Maxxer app settings surface, with Appearance mirror for visual presets | Visual, first-run for mode-like behavior, profile pack | `disableMaxxer` affects runtime enablement, not only appearance. Do not silently move without compatibility copy. | Yes |

## Apps, Features, And Audio

| Current setting | Storage | Current UI | Owner | Future UI | Presets / packs | Migration notes | Mirror |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Post-reading enablement | `sync:enabled` | Reader tab / Apps & Features card | Post-reading app | Apps & Features card plus app surface | Audio, first-run, profile pack | Existing key is generic. Preserve for compatibility; schema should keep app ownership explicit. | Yes |
| Post-reading speech basics | `sync:speed`, `volume`, `voiceURI`, `autoVoice`, `ttsEngine`, `customTtsEndpoint`, `customTtsTimingMode` | Reader tab | Post-reading app | Post-reading app surface | Audio, profile pack for safe non-endpoint values | Custom endpoint is advanced and should not join profile packs by default. | Yes |
| Post-reading playback flow | `sync:autoplayNext`, `autoplayMode`, `skipPromotedPosts`, `endOfTweetDing` | Reader tab | Post-reading app | Post-reading app surface | Audio/profile pack for ding and safe playback prefs | `endOfTweetDing` participates in appearance audio presets today. | Yes |
| Post-reading content sources | `sync:includeQuotes`, `fetchFullQuotes`, `fullQuoteDisplay`, `includeHyperlinks`, `includeImageAltText`, `includeImageOcr`, `includeLinkPreviews`, `expandShowMore` | Reader tab | Post-reading app | Post-reading app surface | Profile pack where safe | OCR/fetch behavior should disclose local worker/network behavior in app details. | Yes |
| Post-reading display and shortcuts | `sync:activeTweetHighlight`, `bodyHighlightMode`, `playerPosition`, `buttonPlacement`, `useHandles`, `keyNextTweet`, `keyPreviousTweet`, `keyNextChunk`, `keyPreviousChunk`, `keySkipOcr`, `keyPlayPause` | Reader tab | Post-reading app | Post-reading app surface | Profile pack for safe layout/shortcut prefs | Keyboard shortcuts are app-owned advanced controls. | Yes |
| Global audio preset targets | `sync:soundEnabled`, `soundsEnabled`, `soundVolume`, `endOfTweetDing` | Appearance preset application and Audio tab | Milady Maxxer, RemiStats, Post-reading | Owning app/feature settings with popup preset controls | Audio, visual preset side effect | Presets currently write multiple feature keys. Keep preset action in popup, but route editable controls to owners. | Yes |
| RemiStats enablement/display | `sync:milxdy.remistats.enabled`, `showTooltips`, `milxdy.remistats.icons.*` | RemiStats/Poke sections | RemiStats feature | Apps & Features feature settings | First-run, profile pack | Non-app feature module. Do not force into app bucket. | Yes |
| Poke behavior | `sync:milxdy.remistats.likeAutoPoke`, `milxdy.remistats.pokeAutoLike` | RemiStats/Poke section | Pokes / RemiStats feature | Apps & Features feature settings | Profile pack only with explicit user consent | Behavior can trigger remote RemiliaNET actions after user actions; keep clear disclosure. | Yes |
| RemiStats sounds | `sync:soundsEnabled`, `soundVolume` | Audio tab | RemiStats feature | Apps & Features feature settings or Audio advanced | Audio, profile pack | Generic keys are legacy. Preserve storage while naming schema IDs explicitly. | Yes |
| RemiNet Chat enablement | `local:milxdy.reminetChat.enabled` | RemiStats/Poke section / Apps & Features card | RemiNet Chat app | Apps & Features card plus app surface | First-run, profile pack | App enablement belongs in Apps & Features; detailed chat settings belong in app surface. | Yes |
| RemiNet Chat sounds | `sync:milxdy.reminetChat.sounds.*` | Audio tab | RemiNet Chat app | RemiNet Chat app surface | Audio, profile pack | Keep in generated app settings later; current popup can mirror during migration. | Yes |
| Beetol enablement | `local:milxdy.remistats.beetol.enabled`, legacy `local:milxdy.bextol.enabled` | RemiStats/Poke section / Apps & Features card | Beetol app | Apps & Features card plus Beetol app surface | First-run, profile pack | Legacy key is duplicate/deprecated; migration already reads old value into new key. | Yes |
| Beetol color/mode | `local:beetolColor`, `local:beetolMode` | Beetol session panel | Beetol app | Beetol app surface | Visual/profile pack for color only if declared | App-owned. Keep local controls inside Beetol panel. | No |
| Milady Maxxer mode and behavior | `sync:mode`, `soundEnabled`, `showLevelBadge`, `includeRemiStatsBeetles`, `hideNonMiladyOrBeetlePosts`, `cardTheme`, `whitelistHandles`, `miladyListHandles` | Appearance tab Maxxer sections | Milady Maxxer app | Apps & Features for legacy `mode` enablement; Maxxer app settings surface for detailed behavior | Visual/audio/profile pack for safe display/audio; handles are not profile-pack defaults | `mode` is a legacy combined mode/on-off key, so Apps & Features may classify it as enablement while detailed behavior stays in the app surface. Handles are user-authored lists and should not join broad profile packs without explicit export scope. | Yes |
| Remilia Wiki link settings | `local:remiliaWikiHyperlink.settings.*` | Wiki tab | Remilia Wiki app + wiki-link feature | Feature controls in Apps & Features, with popup mirrors during migration | First-run/profile pack for safe toggles | `enabled` controls inline Wiki links. `sidebarEnabled` controls the Remilia Wiki sidebar and falls back to legacy `enabled` only when unset, so existing profiles migrate without coupling future toggles. Generated Wiki feature controls, including previews and draft workflow mode, keep the same object storage while popup mirrors remain. | Yes |
| Wiki Link Later queue | `local:remiliaWikiHyperlink.laterItems` | Wiki tab list | Remilia Wiki workflow | Wiki app surface | None | User content queue, not a setting. Do not export through profile packs. | No |
| Grok draft mode | `local:remiliaWikiHyperlink.settings.grokWorkflowMode` | Wiki tab | Wiki drafting workflow | Wiki app/settings surface | Profile pack maybe | User workflow preference; not global. | Yes |
| Wiki diagnostics / link limits | `local:remiliaWikiHyperlink.settings.debugMode`, `maxLinksPerPostEnabled`, `maxLinksPerPost`, `maxLowConfidenceLinksPerPost`, `linkColor` | Wiki tab | Wiki link feature | Apps & Features feature settings / advanced for diagnostics | Profile pack for limits/color; diagnostics excluded | `debugMode` is advanced/developer-only. | Yes |
| Music player/library settings | `local:milxdy.music.enabled`, app-local library/layout/volume keys | Music app surface | Music app | Music app surface plus Apps & Features enablement | First-run/profile pack for enablement/layout later | Do not move library handles or local file paths into profile packs. | No |
| Miladychan Portal settings | `local:milxdy.miladychan.enabled`, app-local layout/theme keys | Miladychan app surface | Miladychan Portal app | Miladychan app surface plus Apps & Features enablement | First-run/profile pack for enablement/layout later | Keep board/thread browsing state app-owned. | No |

## Rail, Overlay, Auth, And Runtime State

| Current setting | Storage | Current UI | Owner | Future UI | Presets / packs | Migration notes | Mirror |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rail pins | `local:milxdy.apps.railPinned`, deprecated `local:milxdy.apps.railUnpinned` | Apps & Features / first-run | Apps & Features | Apps & Features dock settings | First-run, profile pack later | `railUnpinned` is compatibility state and should be deprecated once migration is complete. | No |
| Rail side and order | `local:milxdy.overlayDock.side`, `local:milxdy.overlayDock.order` | Dock settings | Overlay dock | Apps & Features dock settings | Layout/profile pack later | Layout setting, not app setting. Safe profile-pack participation after preview/cancel support. | No |
| Overlay app layouts | `local:milxdy.overlayApps.layouts.v1` | Drag/resize persistence | Overlay platform | Apps & Features reset/layout controls | Layout/profile pack later | May include per-app geometry. Import should preview and allow cancel. | No |
| RemiliaNET session tokens | `local:beetol.accessToken`, legacy token keys, memory refresh token, `local:beetol.disconnected` | Beetol/RemiNet auth status and logout | RemiliaNET auth | Account/security surface only | Never | Secrets/session state. Never include in presets/profile packs or generated settings. | No |
| Last poke diagnostic | `local:milxdy.remistats.lastPokeDiagnostic` | Beetol auth diagnostic | RemiStats/Pokes diagnostics | Advanced diagnostics | Never | Diagnostic payload, not a setting. | No |

## Deprecated Or Duplicate Keys

| Key | Owner | Status | Migration note |
| --- | --- | --- | --- |
| `local:milxdy.bextol.enabled` | Beetol | Deprecated duplicate | Migrate to `milxdy.remistats.beetol.enabled`; keep read fallback until at least one public release after migration. |
| `local:milxdy.apps.railUnpinned` | Overlay dock / Apps & Features | Legacy compatibility | Prefer explicit `milxdy.apps.railPinned`; remove only with a compatibility pass. |
| Generic sync keys `enabled`, `mode`, `soundEnabled`, `soundsEnabled`, `soundVolume` | Post-reading, Maxxer, RemiStats | Legacy broad names | Keep storage for compatibility; manifest schema must use namespaced setting IDs so generated UI does not confuse owners. |
| `local:milxdy.settings.theme` | Suite / legacy theme-like storage | Ambiguous naming | Keep as popup theme mode. Do not reuse for app chrome, RemiNet Chat sounds, or visual theme data. |

## Migration Order

1. Keep global suite, appearance, performance, diagnostics, update, and onboarding controls in the popup.
2. Generate Apps & Features controls first for non-app feature modules: RemiStats, pokes, Tweet PNG, wiki link highlighting, Root Visual feature toggles, and diagnostics disclosures.
3. Add app-owned settings entry points for Post-reading, Maxxer, RemiNet Chat, Beetol, Music, Miladychan, and Wiki before removing mirrored popup controls.
4. Preserve storage keys and write paths while old and new UI locations are mirrored.
5. Only after migration telemetry/QA passes should deprecated duplicate keys be removed or hidden from reset/export flows.

## Open Follow-Ups

- #52 should implement generated Apps & Features controls from the schema and this audit.
- #55 should simplify the popup around global suite controls and presets after app/feature controls have homes.
- #61 should verify old and new UI locations write identical storage and reset behavior during mirroring.
- #64 should split Root Visual X redesign controls without changing `milxdy.settings.visualTheme` compatibility.
- #65 should decide which rail/layout keys join profile packs.
