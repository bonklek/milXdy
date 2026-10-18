# Post-reading User Guide

Post-reading reads X/Twitter posts aloud, can hand Remilia Wiki articles into the same reader, and provides docked playback surfaces for both flows.

## Where To Find It

- Open the extension popup.
- Use the **Reader** tab for read-aloud settings.
- Open **Post-reading** from the side rail for docked playback.
- Open the **Wiki** side rail app to use article read-aloud inside the Wiki sidebar.

## Common Tasks

- Enable **Post-reading controls** to show read buttons on posts.
- Open a supported X Article page and use the Post-reading control in the author controls to read long-form article text.
- Tune **Speech speed**, **Volume**, **Auto voice**, and **Voice URI**.
- Use the compact voice language and gender filters to narrow the browser voices that selection and test highlighting will consider.
- Use **Custom HTTP endpoint** only when you have a local TTS service running on `localhost`, `127.0.0.1`, or `[::1]`.
- Enable **Include quote posts**, **Image alt text**, **Image OCR**, or **Link previews** when you want richer spoken context. **Fetch full quotes** is off by default; when you enable it, Post-reading uses public X/Twitter embed (`publish.twitter.com`), syndication (`cdn.syndication.twimg.com`), or tweet HTML fallbacks without sending browser cookies or session tokens.
- Use **Skip OCR** to cancel pending image text or skip active image text.
- Use **Next post** to advance tweet playback.
- Use **Minimize** to hide the docked reader while playback continues, or **Quit** to stop playback and clear active OCR, quote preview, and highlight work.
- Use Wiki read-aloud controls to move to the previous or next article paragraph when reading inside the Wiki sidebar.
- Leave **Wiki auto-scroll** enabled when you want the Wiki sidebar to follow the active spoken line.

## Notes

Tweet reading and Wiki reading share the reader runtime but pause each other so only one read-aloud session speaks at a time.

Word and paragraph highlighting is most accurate with browser voices that report stable speech boundaries. milXdy probes voices and prefers known boundary-capable voices; other voices use an estimated smooth-highlight fallback for both feed posts and Wiki playback.

Custom HTTP TTS can return audio plus optional timing boundaries. Remote endpoints and returned remote audio URLs are rejected; use a loopback local service. When boundaries are provided, Post-reading can keep highlighting and seeking closer to the spoken audio.

OCR runs locally and can miss stylized, low-resolution, or low-contrast text. Image OCR is restricted to attached X/Twitter media from `https://pbs.twimg.com/media/...` and fetches those images without cookies. Voice availability depends on the browser and operating system.

## Review and download audio

On an X post or native article, select **MP3** beside its Read Aloud control.
On a visible long-form page, right-click the page and choose **Post-reading:
Review and download as MP3**. This uses an explicit active-tab action; ordinary
web pages do not gain a persistent background content script or host permission.

The review editor lets you clean up the text, title, and author before conversion.
Wiki, Substack, and Medium selectors are attempted before generic article/main
extraction. Navigation, signup forms, comments, recommendations, and controls
are excluded. Substack previews with a rendered paywall are identified as partial.
Only the visible browser document is used; nothing fetches subscriber-only text
or bypasses a paywall. If extraction cannot find a readable article, paste text
into the empty review editor and review it before conversion.

**Download as MP3** sends only the reviewed text and selected rate, volume, and
voice to the configured loopback HTTP TTS backend. Browser Web Speech supports
preview but cannot export files. The backend must return MP3, M4A, WAV, Ogg, or
WebM audio. MP3 downloads automatically with the reviewed title as its filename;
other formats expose a clearly labeled download without relabeling the bytes as
MP3. Returned audio can be previewed in the editor. **Cancel**, closing the
editor, or navigating away aborts an in-progress conversion.

Download the JSON metadata sidecar next to the audio result to retain the title,
author, source URL/site, extractor, capture date, partial status, estimated
duration, and TTS settings. Review text and generated audio live only for this
editor session; there is no persistent audio library in this version.

Private X conversations cannot use this export action. Their separate **Read
visible messages aloud** action reviews a snapshot and uses browser speech only.

Future scope remains: saved drafts and an audio library, RSS subscription queues,
cleanup presets, reviewed Miladychan file sharing, title/context images,
subtitles, MP4 generation, chapters/series, podcast exports, and source-extractor
plugins. The current implementation reads an RSS item only when its readable
page is opened by the user.

## Accessible progress and motion

The player announces preparation, reading, pause, and useful failures without
moving keyboard focus. OCR updates are coalesced into coarse progress milestones;
reading-line and OCR percentages remain available as numeric progress controls.
Word boundaries are not live announcements. Repeated identical failures are
announced once until recovery.

System **Reduce motion** always uses static word highlighting and instant
scrolling, even if **Smooth character fill** is selected. There is no override
that forces smooth animation over the system preference. Autoscroll and **Follow
current line** still follow text when enabled; turn them off in **Navigation**
to keep your reading position. Preview following moves only an offscreen line,
without recentering text that is already visible. Explicit Previous/Next actions
still navigate to the requested text.

## Read a direct-message conversation

Open a full supported X DM conversation and select **Read visible messages
aloud** near the upper-right of the page. Review the loaded message snapshot,
then choose **Read with browser voice**. Loading more messages requires a new
review. Use the playback panel to pause or stop. Highlighting preserves the
original message text and spacing.
