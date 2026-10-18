# Share Kit international layout checks

The controlled Chromium fixture in
`scripts/verify/share-kit-international-browser.ts` exercises the production
Share Kit action, renderer, preview, clipboard and download callbacks. It makes
no network requests to external services: post and quote media are synthetic
local PNGs, and clipboard/download are captured inside the fixture.

## Coverage and correction

Nine cases cover repeated whitespace and explicit blank lines, long URLs and
handles, combining marks, emoji families/skin tones/flags/keycaps, CJK
punctuation, Thai/Khmer without spaces, Arabic, mixed Arabic/Hebrew/Latin, and
very long main/quoted text. The adapter runs 54 combinations across plain/rich
inline layout and the configured stack, Arial and Helvetica. Checks cover text
preservation, grapheme integrity, safe widths, line limits and ellipsis.

The actual renderer checks each case's main text, quote and two-line link title,
painted glyph boundaries, post and quote media pixels, text/media separation,
footer boundary, copied preview pixel equality and downloaded/copied byte
equality. Explicit hard breaks retain blank lines; ordinary whitespace collapses.
Complete unformatted lines remain single Canvas draw calls so the browser shapes
Arabic and orders bidirectional text. These checks do not constitute a native
speaker's review of every linguistic line-break or formatted bidi combination.

The long-quote regression initially dropped the selected post's text, media and
link card because uncapped quoted text consumed the entire height reservation.
The renderer now limits the quote's text allocation before reserving its card,
preserving space for the main text and following content. Quote text drawing
also reserves its image height. Truncation uses the existing grapheme-safe
ellipsis adapter. The generated bundle increases by 743 raw bytes and 115 gzip
bytes compared with the preceding reviewed package.

## Browser and font limits

On the checked host, Chromium 155 passes all nine actual-renderer cases and 54
adapter combinations. Local `FontFace` loading confirms Arial and Helvetica are
available and TwitterChirp is unavailable. The production stack therefore uses
its named Arial fallback; separately passing explicit Helvetica to the adapter
checks another available named font. This is not evidence for the licensed
TwitterChirp font, and no substitute font is registered under that name.

Firefox executables were not found in the standard system/user Applications
locations or on PATH. Firefox rendering remains unverified. No browser was
installed, existing user profile opened, or font downloaded to fill that gap.
Full Chromium/Firefox extension builds and package trust approval belong to the
release integration checks; the fixture alone does not certify those gates.

The existing benchmark runs its nine cases with an isolated temporary browser
profile. One Chromium 155 run reported warm/cold Pretext medians of roughly
0.044/0.056 ms per text, versus 0.011 ms for the legacy wrapper. The 990-character
no-space sample took about 0.5 ms and stayed within its 784 px safe width. These
are local measurements, not portable performance guarantees. Actual renderer
fixture durations include media, PNG encoding and clipboard/download comparison.

Run with the project's Node runtime:

```sh
SHARE_KIT_FIXTURE=scripts/verify/share-kit-international-browser.ts node scripts/verify/share-kit-annotations-browser.mjs
```

Set `SCREENSHOT_CASE=Arabic` (or another fixture label) and `SCREENSHOT_PATH` to
capture a scrolled gallery view for visual inspection. Gallery images use the
actual immutable preview PNG; the renderer and export retain their native pixel
size. A long card requires scrolling at readable size.
