# Post-reading User Guide

Post-reading reads X/Twitter posts aloud, can hand Remilia Wiki articles into the same reader, and provides docked playback surfaces for both flows.

## Where To Find It

- Open the extension popup.
- Use the **Reader** tab for read-aloud settings.
- Open **Post-reading** from the side rail for docked playback.
- Open the **Wiki** side rail app to use article read-aloud inside the Wiki sidebar.

## Common Tasks

- Enable **Post-reading controls** to show read buttons on posts.
- Open a supported X Article page and use the Post-reading control near the article body to read long-form article text.
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

Word and paragraph highlighting is most accurate with browser voices that report stable speech boundaries. milXdy probes voices and prefers known boundary-capable voices; other voices use an estimated smooth-highlight fallback for both feed posts and Wiki playback. If a boundary-capable voice stops reporting progress after playback begins, feed-post highlighting temporarily follows the same estimated clock and returns to exact timing when boundary events resume.

Custom HTTP TTS can return audio plus optional timing boundaries. Remote endpoints and returned remote audio URLs are rejected; use a loopback local service. When boundaries are provided, Post-reading can keep highlighting and seeking closer to the spoken audio.

OCR runs locally and can miss stylized, low-resolution, or low-contrast text. Image OCR is restricted to attached X/Twitter media from `https://pbs.twimg.com/media/...` and fetches those images without cookies. Voice availability depends on the browser and operating system.
