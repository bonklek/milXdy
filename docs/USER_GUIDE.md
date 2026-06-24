# milXdy User Guide

milXdy is an unpacked Chromium extension for improving X/Twitter workflows around Remilia Wiki, Postreader, RemiNet/RemiStats, Beetol Game, and Maxxer. Open the extension icon to configure each feature tab.

## Updating The Extension

For beta builds, keep the same extension folder on disk.

1. Download or build the new version.
2. Replace the files in the existing extension folder.
3. Open `chrome://extensions`.
4. Press reload on the milXdy extension card.
5. Refresh open X/Twitter tabs.

Do not remove the extension or load a second unpacked folder unless you intend to reset local extension settings and RemiNet/Beetol login state.

The Suite tab provides a guided version of this flow:

- **Download** opens the latest GitHub prerelease zip when the update checker finds one.
- **Steps** copies the safe in-place update checklist.
- **Reload** calls Chrome's extension reload after you have replaced the files in the same folder.

## Suite

Use the Suite tab for whole-extension controls.

- **Update status** checks the configured GitHub release endpoint and exposes guided update buttons when needed.
- **Performance diagnostics** stores lightweight counters used by the Diag tab. Leave this off unless testing performance or preparing a bug report.

After changing major toggles, reload affected X/Twitter tabs so old content scripts and CSS are replaced.

## Remilia Wiki

The Wiki tab controls inline Remilia Wiki links and article-drafting helpers.

### Inline links

- **Remilia Wiki links** turns automatic concept links on or off.
- **Wiki previews** fetches Remilia Wiki summaries only when hovering links.
- **Debug mode** exposes matching diagnostics.
- **Max links per post** and **Max low-confidence links** prevent posts from becoming overloaded with links.
- **Link color** changes the inline link color.

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

## Postreader

The Reader tab controls post read-aloud behavior.

- Use **Postreader controls** to show read buttons on posts.
- Tune **Speech speed**, **Volume**, **Auto voice**, and **Voice URI** for local browser voices.
- Use **Custom HTTP endpoint** only when you have a local TTS service running.
- **Include quote posts**, **Fetch full quotes**, **Image alt text**, **Image OCR**, and **Link previews** add more context to spoken output.
- **Skip OCR** cancels pending OCR or skips active image text.
- **Next post** skips active image text to the parent caption before advancing.

OCR runs locally and can miss stylized, low-resolution, or low-contrast text.

## RemiNet Connector

The RemiNet connector shows RemiStats data and RemiliaNET actions on X/Twitter.

- **RemiNet connector badges** shows score badges.
- **Tooltips** shows detailed RemiStats information on hover.
- **Sounds** and **Sound volume** control RemiStats effects.
- **Score icon**, **Beetle icon**, and **Poke icon** can be enabled independently.
- Profile badges group the score badge and poke button together when possible.

### Pokes

The poke button uses the RemiNet connector login. It shakes while sending a poke and switches to a live cooldown timer when RemiliaNET returns a cooldown. If no explicit cooldown is returned, milXdy assumes a 24-hour poke cooldown.

If the poke icon is missing, confirm **RemiNet connector icons** and **Poke icon** are enabled, then refresh the X/Twitter tab.

During beta testing, the RemiNet connector tab may show the last poke diagnostic after a poke attempt so bug reports are easier to reproduce.

### Incoming pokes

When RemiNet connector auth is available, milXdy can show a small incoming poke flag for accounts that recently poked you. This is based on recent RemiliaNET notifications inside the active poke window, so it is a current-activity hint rather than a full all-time poke history.

### RemiNet Chat

Enable **Show RemiliaNET chat on X home** to mount the RemiNet Chat sidebar on supported X/Twitter routes.

- The chat uses the same RemiNet connector login as pokes and Beetol Game.
- It loads recent message history from RemiliaNET and connects to the RemiliaNET chat WebSocket for live updates.
- It supports reactions, pokes, attachments, media previews, profile lookups, and minimized mode.
- The setting is off by default while beta performance and auth behavior are validated.

If the chat does not connect, confirm RemiNet login status first, then refresh the X/Twitter tab. Accounts using 2FA may need the RemiliaNET SSO retry flow before chat APIs can authenticate.

## Beetol Game Login

The RemiNet connector login powers both RemiStats pokes and the Beetol Game hunter panel.

- Use **Username or email** and password for normal RemiliaNET login.
- Passwords are sent to RemiliaNET for login and are not stored by milXdy.
- RemiNet login state is stored in Chrome extension local storage.
- Login state should persist across browser restarts, extension reloads, and normal updates that keep the same extension identity.

For accounts with 2FA:

1. Click **Open RemiliaNET SSO**.
2. Finish login in the RemiliaNET tab.
3. Return to milXdy and click **Retry session**.

This browser-session fallback depends on RemiliaNET accepting the browser session for extension actions.

milXdy requests the browser `cookies` permission for RemiliaNET requests that require the user's RemiliaNET session.

## Beetol Hunter Panel

Enable **Show Beetol hunt panel** to mount the Beetol Game hover panel on X/Twitter.

- **Beetol color** controls the panel accent.
- **Beetol mode** controls dark/light styling.
- The panel uses the same RemiNet connector login as pokes.

## Maxxer

The Maxxer tab controls Miladymaxxer behavior.

- **Milady effects** applies the normal match experience.
- **Debug** shows detection markers and scores.
- **Off** disables Maxxer behavior.
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

- RemiStats calls `https://api.remistats.net`.
- Remilia Wiki previews call `https://wiki.remilia.org`.
- Grok prompts are pasted into X's native Grok interface.
- Beetol Game, RemiNet pokes, and RemiNet Chat call `https://www.remilia.net`; chat live updates use `wss://www.remilia.net`.
- GitHub update checks call `https://api.github.com`.
- Postreader OCR and Maxxer avatar inference run locally.
- RemiNet connector actions use the browser `cookies` permission for RemiliaNET requests that require the user's RemiliaNET session.

Settings and login state persist only while Chrome keeps the same extension identity. Removing the extension, loading a different unpacked folder, clearing extension storage, or browser profile cleanup can reset local state.
