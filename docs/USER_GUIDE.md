# milXdy User Guide

milXdy is an unpacked browser extension for improving X/Twitter workflows around Remilia Wiki, Post-reading, RemiNet/RemiStats, Beetol Game, Maxxer, Composer Tools, Miladychan, and local music. Open the extension icon for popup settings, and use the in-page side rail on X/Twitter for docked apps.

## Updating The Extension

For beta builds, keep the same extension folder on disk.

1. Download or build the new version.
2. Replace the files in the existing extension folder.
3. Open `chrome://extensions`.
4. Press reload on the milXdy extension card.
5. Refresh open X/Twitter tabs.

Do not remove the extension or load a second unpacked folder unless you intend to reset local extension settings and RemiNet/Beetol login state.

The Suite tab provides a guided version of this flow:

- **Download** opens the matching GitHub release zip for the current browser target when the update checker finds one. If the exact archive is missing, use the release page and choose the zip that matches the installed browser.
- **Steps** copies the safe in-place update checklist.
- **Open in LLM** opens your configured assistant target after copying the update checklist so you can ask for guided help without losing the safe update steps.
- **Reload** calls Chrome's extension reload after you have replaced the files in the same folder.

## Main, Apps, And Appearance

Use the Main tab for whole-extension controls, the in-page **Apps** rail item for Apps & Features, and the Appearance tab for visual presets.

- **Update status** checks the configured GitHub release endpoint and exposes guided update buttons when needed.
- **Performance mode** is separate from Appearance. Fast minimizes background work, Balanced is the default, Full preloads more app surfaces, and Developer records extra diagnostics.
- **Performance diagnostics** stores lightweight counters used by the Diag tab. Leave this off unless testing performance or preparing a bug report.

### Apps & Features And Side Rail

The shared side rail appears on X/Twitter and opens Apps & Features. This menu separates full app surfaces from smaller feature modules.

- Click **Apps** to open Apps & Features.
- Full apps include docked or windowed surfaces such as Post-reading, RemiNet Chat, Beetol, Miladychan, Music, Wiki, and Maxxer.
- Feature modules include smaller capabilities such as RemiStats, Tweet PNG, Composer Tools, wiki link highlighting, and page-level visual effects.
- Use **Enable** or **Disable** to control whether an app or feature can run.
- Use **Pin** or **Unpin** to control whether an enabled dock app appears directly on the side rail.
- Use the dock gear to move the rail left or right, reorder pinned app icons, or reset the dock order.
- On fresh installs, Apps & Features opens once with Lite, Balanced, and Full setup choices. These choices apply exact app enablement, default rail pins, and the matching Performance mode while keeping every first-party app available and toggleable. Apps excluded from the chosen setup are disabled, not removed. The same setup choices remain available from the Apps & Features settings menu later.

Enabled and pinned are different states: an app or feature can be enabled without being pinned, and unpinned apps can still load through relevant X/Twitter surfaces or direct user actions. Whole-extension controls, global presets, and Performance mode remain in the popup rather than Apps & Features.

### Preset Decisions

The Appearance presets set both visual treatment and ambient audio so each profile feels intentionally different.

- **Max** is the full Remilia client profile. It enables the strongest X chrome reskin, Remilia fonts, shaped PFPs, square media, RemiStats backing boxes, gold incoming-poke alerts, RemiNet Chat overlay, raised/beveled Maxxer cards, shimmer, full Tweet PNG borders, visual interaction sounds, RemiStats sounds, Milady Maxxer sounds, and the Post-reading completion ding.
- **Medium** is the daily-driver profile. It keeps X recognizable, uses readable tweet text with Remilia UI chrome, shapes feed PFPs only, keeps media close to X defaults, uses native action-row pokes, enables RemiStats backing boxes and gold incoming-poke alerts, uses marked Maxxer rows without shimmer, keeps Tweet PNG exports complete with a neutral border, and keeps RemiStats/Milady Maxxer sounds without extra chrome click sounds.
- **Minimal** is the quiet stock-X profile. It leaves fonts, PFPs, media, notifications, RemiStats backing boxes, gold poke styling, chat overlay, Maxxer shimmer, Tweet PNG borders, visual interaction sounds, RemiStats sounds, Milady Maxxer sounds, and Post-reading completion dings off. It keeps functional controls such as action-row pokes and complete Tweet PNG content available.

Read-aloud itself stays independent of presets because it is a utility/accessibility feature rather than part of the aesthetic intensity.

### App Chrome Style

**App chrome style** controls the frame around milXdy app windows: borders, bevels, shadows, headers, panel surfaces, and window buttons. It does not change the content theme inside X/Twitter posts, and it is separate from Performance mode.

- **Use app defaults** keeps each app's authored look.
- **RemiliaNet** applies the shared soft retro internet frame where supported.
- **Classic bevel** applies the late-90s utility-window frame where supported.

Some apps keep app-specific controls for their content area, such as Beetol color/mode or wiki page dark-mode behavior. Those settings can coexist with the shared app chrome style.

Use **Export pack** to save Appearance plus the current Performance mode as a shareable profile pack. **Import pack** previews the sections that will change and lets you cancel before any settings are written. The older Appearance **Export**, **Import**, **Copy string**, and **Paste string** controls still handle visual themes only.

Custom Appearance groups separate Root X controls from mirrors. Root X controls cover page fade, typography, PFP surfaces, media/card treatment, notifications, navigation, post buttons, and show-new-posts bars. App chrome, Tweet PNG, RemiStats/poke, and Maxxer controls are still preserved in the same visual theme object for compatibility, but remain labeled as app or feature mirrors.

After changing major toggles, reload affected X/Twitter tabs so old content scripts and CSS are replaced.

## Composer Tools

Composer Tools is a lightweight feature module for X/Twitter post composers. When enabled from Apps & Features, or from the Main tab popup mirror during settings migration, typing `--` in a supported post composer is converted locally into an em dash.

The helper ignores DMs, search fields, native inputs, textareas, and extension settings inputs. It reads only the active composer text around the caret and does not send composer text to a remote service.

## Platform Performance Modes

Performance mode controls runtime budgets for scanning, lazy app imports, idle work, and background network concurrency.

- **Fast**: smallest visible-surface window, no idle preloads, low network concurrency, no periodic safety scan.
- **Balanced**: default mode with moderate surface budgets and no periodic safety scan.
- **Full**: larger surface budgets and idle preload for richer app availability.
- **Developer**: broad budgets plus long-task and layout-shift diagnostics for debugging.

Use Fast when X/Twitter responsiveness matters most. Use Developer only while gathering diagnostics because it intentionally records more runtime data.

## Remilia Wiki

The Wiki tab controls inline Remilia Wiki links, the docked Wiki sidebar app, and article-drafting helpers.

### Inline links

- **Remilia Wiki links** turns automatic concept links on or off.
- **Wiki previews** fetches Remilia Wiki summaries only when hovering links.
- **Debug mode** exposes matching diagnostics.
- **Max links per post** and **Max low-confidence links** prevent posts from becoming overloaded with links.
- **Link color** changes the inline link color.

### Remilia Wiki Sidebar

**Wiki** in the Apps rail opens a docked Remilia Wiki sidebar. Normal clicks on inline wiki links and preview read-more links open this sidebar by default; modifier-clicks keep the browser's normal new-tab behavior. The sidebar accepts `https://wiki.remilia.org` and `https://remilia.wiki` URLs, canonicalizes `remilia.wiki` into the embeddable wiki host, and includes an open-in-tab control for the full wiki page.

**Wiki browser follows dark mode** is enabled by default. When milXdy is using a dark or dim theme, the embedded Remilia Wiki page receives a dark sidebar theme. Turn this off in the Wiki tab if you prefer the native wiki page colors inside the docked sidebar.

### Link later

Use **Link later** from the X/Twitter context menu to save selected phrases. In the Wiki tab, saved phrases can open:

- a templated new Remilia Wiki page
- a section editor for an existing Remilia Wiki page

### Create Wiki entry with Grok

On X/Twitter, right-click a post, profile, page, link, or selected text and choose **Create Wiki entry with Grok**. The submenu has three modes:

- **Use this post as a jumping off point**: treats the current post as the seed source.
- **Create a generic article prompt**: treats the selected topic as broader research.
- **Create a profile article prompt**: checks whether an X profile is notable enough for a Remilia Wiki article.

The extension opens X's native Grok actions panel, copies or seeds a Remilia Wiki research prompt, and shows a draggable Remilia Wiki shortcut. The shortcut names the inferred page, avoids overlapping the Beetol hunter widget, snaps to a viewport edge, and opens a templated new-page editor after you vet Grok's output.

Grok output should include a commit-summary line and a clean fenced `mediawiki` block. Remove unsupported Grok render artifacts before saving to the wiki.

### Grok workflow modes

The **Grok workflow** setting controls how much prompting milXdy does:

- **One-shot draft** pastes a single complete Remilia Wiki research and drafting prompt.
- **Socratic research** opens Grok's full conversation view, waits for the first response to settle, then sends staged prompts for scouting, source discovery, article planning, and final MediaWiki drafting.

Socratic mode is better for harder articles because it forces Grok to gather sources and plan before drafting. It is slower and depends more heavily on X/Grok UI stability.

## Post-reading

The Reader tab controls post and Wiki read-aloud behavior.

- Use **Post-reading controls** to show read buttons on posts.
- On supported X Article pages, Post-reading can read the article body from the page instead of only timeline posts.
- Tune **Speech speed**, **Volume**, **Auto voice**, and **Voice URI** for local browser voices.
- Use the compact voice language and gender filters to narrow browser voices before selecting or testing one.
- Use **Custom HTTP endpoint** only when you have a local TTS service running on `localhost`, `127.0.0.1`, or `[::1]`.
- **Include quote posts**, **Image alt text**, **Image OCR**, and **Link previews** add more context to spoken output. **Fetch full quotes** is off by default; when you enable it, Post-reading uses public X/Twitter embed (`publish.twitter.com`), syndication (`cdn.syndication.twimg.com`), or tweet HTML fallbacks without sending browser cookies or session tokens.
- **Skip OCR** cancels pending OCR or skips active image text.
- **Next post** skips active image text to the parent caption before advancing.
- Minimize hides the docked reader without stopping playback. Quit/stop ends active playback, OCR, quote previews, and highlighting cleanup.
- Use the Wiki sidebar read-aloud controls to read articles, move between paragraphs, and optionally auto-scroll the current spoken line into view.

Tweet reading and Wiki reading pause each other so only one reader session speaks at a time. Highlight timing is best with browser voices that report speech boundaries; unsupported voices use a smooth estimated highlight fallback, and loopback-only custom HTTP TTS can provide timing boundaries for synced playback.

OCR runs locally and can miss stylized, low-resolution, or low-contrast text. Image OCR is limited to attached X/Twitter media URLs from `pbs.twimg.com/media` and does not send cookies with those image fetches.

## RemiNet Connector

The RemiNet connector shows RemiStats data and RemiliaNET actions on X/Twitter.

- **RemiNet connector badges** shows score badges.
- **Tooltips** shows detailed RemiStats information on hover.
- **Sounds** and **Sound volume** control RemiStats effects.
- **Score icon**, **Beetle icon**, and **Poke icon** can be enabled independently.
- Profile badges group the score badge and poke button together when possible.

### Pokes

The poke button uses the RemiNet connector login. It plays a short poke sound, shakes while sending a poke, and switches to a live cooldown timer when RemiliaNET returns a cooldown. If no explicit cooldown is returned, milXdy assumes a 24-hour poke cooldown. Active poke cooldowns are stored locally so the poked state is restored after refreshing X/Twitter. When the same account appears multiple times on screen, visible poke buttons for that account update to the same cooldown state after a successful poke.

**Like tweets when poking** is off by default. When enabled, a successful tweet poke also clicks X's Like button for that tweet if it is not already liked.

**Poke users when liking** is off by default. When enabled, clicking X's Like button on a tweet also tries to poke that tweet's RemiliaNET user if a visible, eligible poke button is present.

Successful pokes count toward Miladymaxxer XP the same way likes do when milXdy can map the poked RemiNet account to a tracked Milady X/Twitter handle.

The idle poke icon is an outline hand icon. It changes state only while sending or showing a cooldown.

If the poke icon is missing, confirm **RemiNet connector icons** and **Poke icon** are enabled, then refresh the X/Twitter tab.

During beta testing, the RemiNet connector tab may show the last poke diagnostic after a poke attempt so bug reports are easier to reproduce.

### Incoming pokes

When RemiNet connector auth is available, milXdy can show a small incoming poke flag for accounts that recently poked you. This is based on recent RemiliaNET notifications inside the active poke window, so it is a current-activity hint rather than a full all-time poke history. **Gold poke alerts** in Appearance gives these flags a shiny gold finish.

### RemiNet Chat

Enable **RemiNet Chat** from Apps & Features to mount it on supported X/Twitter routes and add a RemiNet entry to X Messages. Apps & Features is the single enable/disable control for the app; the extension popup contains only Chat preferences such as sounds.

- The chat uses the same RemiNet connector login as pokes and Beetol Game.
- It loads recent message history from RemiliaNET and connects to the RemiliaNET chat WebSocket for live updates.
- When you scroll to the oldest loaded messages, use **Show more** to load another batch of older chat history.
- It supports reactions, pokes, attachments, allowlisted media and pfp.remilia.net avatar previews, profile lookups, and minimized mode.
- In X Messages, the **RemiliaNET Chat** entry opens a larger milXdy RemiNet surface in the conversation area.
- The app is off by default while beta performance and auth behavior are validated.

Chat reuses a signed-in RemiliaNET browser session directly. If an authenticated send causes the WebSocket to reject its cached write credential, milXdy refreshes the browser session and renews that credential once before reconnecting. If renewal fails, Chat stops at **Retry session** instead of repeatedly reconnecting. Confirm RemiNet login status first, then use **Retry session** or refresh the X/Twitter tab. Accounts using 2FA may need the RemiliaNET SSO retry flow before chat APIs can authenticate.

## Beetol Game Login

The RemiNet connector login powers both RemiStats pokes and the Beetol Game hunter panel.

- Click **Open RemiliaNET** to open remilia.net.
- Click **Log in** on RemiliaNET so the site can start its current OIDC login flow.
- Finish RemiliaNET login in the opened tab, including any 2FA step.
- Return to milXdy and click **Retry session**.
- RemiNet connector state and the short-lived RemiliaNET access token are stored in Chrome extension local storage. Rotating OIDC refresh tokens are kept in extension background memory when available and are not intentionally persisted.
- Login state should persist across browser restarts, extension reloads, and normal updates that keep the same extension identity.

After **Retry session**, milXdy checks the RemiliaNET browser session and reuses or silently renews the RemiliaNET `authToken` cookie for connector actions. Direct username/password login is no longer supported by RemiliaNET for this extension path.

When a poke request fails because the stored connector auth appears stale, milXdy may briefly open RemiliaNET in an inactive tab, wait for the site session to settle, close that tab, and retry using the refreshed browser session.

Clicking **Log out** disconnects milXdy from the RemiNet connector session. It does not necessarily sign the browser out of remilia.net; click **Retry session** again when you want milXdy to reuse the browser session.

milXdy requests the browser `cookies` permission for RemiliaNET requests that require the user's RemiliaNET session.

## Beetol Hunter Panel

Enable **Show Beetol hunt panel** to mount the Beetol Game hover panel on X/Twitter.

- **Beetol color** controls the panel accent.
- **Beetol mode** controls dark/light styling.
- The panel uses the same RemiNet connector login as pokes.

## Miladychan Portal

Enable and pin **Miladychan** from Apps & Features to browse live Miladychan boards from the shared side rail.

- The portal shows active board summaries for the configured Miladychan boards.
- Open a board to browse its thread list, sorted by sticky status, activity, connected users, posts, and update time.
- Open a thread to read posts and media previews.
- Thread headers and media links open the native Miladychan site, which remains the primary posting and full-board surface.
- The portal stores panel layout and theme locally.

The portal is a reader/browser surface. Deeper board deck, board-inspired radio, and advanced Miladychan expansion are tracked as future roadmap work.

## Music

Enable and pin **Music** from Apps & Features to open the docked local music app.

- **Library** indexes user-selected local folders in Chromium browsers that support persistent folder handles. Rescans ask for permission again when needed, mark removed files as missing, normalize basic filename metadata, and flag likely duplicates without touching local audio files.
- Embedded cover art is read from the selected local audio file and cached with the indexed track. Missing art is retried when the metadata parser changes or the underlying file size or modification time changes.
- **Queue** controls local playback order, including reorder, shuffle, repeat, progress seek, and volume.
- **Playlists** lets you create, add visible library tracks, reorder, remove, retry matching, play, export, import, and QR-share metadata playlists.
- **Radio** creates metadata-based sessions from playlists. Joining or importing a session computes the current track and offset locally from the shared start time and marks the active joined session.
- **Settings** controls local folders, MusicBrainz ISRC enrichment, and auto-match behavior.

ISRC enrichment is local-first. milXdy can infer candidates from file metadata and query MusicBrainz. Playlist and radio QR payloads share title, artist, album, ISRC, duration, playlist name, and start time metadata, not audio files. Imports match local files by ISRC first and then by title, artist, album, and duration.

Firefox support for local music folders is limited by browser folder-handle support; use Chromium for the full local library workflow.

The docked Music panel remembers layout state. Compact mode can be made narrower but has a capped height; switch back to the full player when you need the larger layout.

## Maxxer

The Maxxer tab controls Miladymaxxer behavior.

- **Milady effects** applies the normal match experience.
- **Debug** shows detection markers and scores.
- **Off** disables Maxxer behavior.
- The Suite tab's **Reskin profile** also changes Maxxer intensity: Max uses the richest card/profile treatment, Moderate keeps balanced static cards, and Min reduces matches to lighter markers.
- **RemiStats beetle users** treats accounts with RemiStats beetle data as Maxxer matches.
- **Card theme** controls tier styling.
- **Whitelist handles** excludes accounts from normal scoring/XP behavior.
- **Manual Milady handles** forces accounts into the Milady list.

Avatar inference runs locally in the extension context.

## Diag And Feedback

Use the Health tab when testing or reporting issues. It shows diagnostic information that can help reproduce bugs.

Feedback actions:

- **Report via GitHub** opens a prefilled bug issue.
- **Report via X** opens a short bug-report reply to the public feedback post.
- **LLM assisted** copies a Socratic bug-report prompt, opens the selected destination, and shows a notification. Paste the prompt into a chat model, answer its questions, then use the final report text in GitHub or X.

For performance reports, enable **Performance diagnostics**, reproduce briefly, then include the Health tab details.

## Privacy And Persistence

- RemiStats calls `https://api.remistats.net`, loads tooltip profile images from `https://pfp.remilia.net`, and may background-fetch image-only Milady Maker banner files from `https://miladymaker.net/banners/nft` without account credentials or cookies.
- RemiNet identity checks may call `https://ethereum.publicnode.com` to resolve verified PFP ownership.
- Remilia Wiki previews and the Wiki sidebar call `https://wiki.remilia.org` and `https://remilia.wiki`.
- Grok prompts are pasted into X's native Grok interface.
- Beetol Game, RemiNet pokes, and RemiNet Chat call `https://www.remilia.net`; RemiNet Chat may load avatars from `https://pfp.remilia.net`; chat live updates use `wss://www.remilia.net`.
- Miladychan Portal fetches public board and thread JSON from `https://boards.miladychan.org`.
- Music enrichment may call `https://musicbrainz.org` when the user starts enrichment. Local library indexing reads only folders the user selects.
- GitHub update checks call `https://api.github.com`.
- Post-reading OCR and Maxxer avatar inference run locally.
- RemiNet connector actions use the browser `cookies` permission for RemiliaNET requests that require the user's RemiliaNET session.

Settings and login state persist only while Chrome keeps the same extension identity. Removing the extension, loading a different unpacked folder, clearing extension storage, or browser profile cleanup can reset local state.
