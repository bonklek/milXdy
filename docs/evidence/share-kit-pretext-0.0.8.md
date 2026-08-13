# Share Kit Pretext 0.0.8 adoption evidence

Issue: [#224](https://github.com/bonklek/milXdy/issues/224)

## Reviewed dependency

Share Kit pins `@chenglou/pretext` exactly at `0.0.8`. It is the current and
only latest published version as of 2026-08-13, includes the `rich-inline`
entrypoint introduced in `0.0.5`, and includes the later CJK, punctuation,
long-run, and Unicode-symbol fixes through `0.0.8`.

- Source: <https://github.com/chenglou/pretext>
- Published git commit: `a79a6a595d7ea8a07874637b5234ee255b6a4a14`
- npm tarball SHA-1: `e8cac3533b7229816c3c8a11401d8e8b14bda9a5`
- npm integrity: `sha512-yqm2GMxnPI7VHcHwe84P8ZF0JK/2d2DMKPqMN+s95jQhwDMYYXKVFVJUMEaVWckQStdsjdLav/0Vu+d9YbtGxA==`
- License: MIT, Copyright (c) 2026 Pretext contributors
- Share Kit package/content SHA-256: `3e014f073d7d10c86392e901af6c1e262bbaf3a77d8e0416fd57a9d0105197e9`
- Share Kit manifest SHA-256: `8bff62a878e857dc1cfd25e80a292fd7790d0d41fc2236d033a51596868d86ed`
- Share Kit content-entry SHA-256: `1e4c9cae7551252c264addb5439f5be157d6e1aa56adc94faa5be33a86102245`
- Canonical release-candidate composition fingerprint: `a6f64ffa2dd14ef460e591cbfaba129be69216c25e02a9c372fadb552a6976a8`
  for `post-reading` (`01ca79910d26266ca4b89681ea5998da454c140aa7e4e776ae008123bb2b9fa3`),
  `tweet-composer-kit` (`99b316f54c2fb350f3a02dd5bea21b797b2f280afe6f6db2c1826ee54a8a8985`),
  and `tweetPng` (`3e014f073d7d10c86392e901af6c1e262bbaf3a77d8e0416fd57a9d0105197e9`)
- Bundled use: local multiline Canvas layout for Share Kit post, quoted-post,
  link-card, and future formatted-run text after explicit user invocation

The runtime still waits for `document.fonts.ready` and passes the same named
Canvas font strings used by `fillText()`. The configured family remains
`TwitterChirp, Arial, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
it does not use the Pretext-documented unsafe `system-ui` shorthand.

## Layout contracts and intentional changes

The Share Kit adapter retains the existing 16 px width reserve, CRLF-to-LF
normalization, ordinary whitespace collapse, explicit hard/blank lines,
maximum line counts, height calculations, media/footer reservation, and
three-dot truncation. Post, quoted-post, and link-card title text now share the
same positioned-line result instead of maintaining a second primary wrapper.

At a 360 px comparison width in Chromium 151, intentional changes include:

- CJK text chooses Unicode punctuation-aware boundaries rather than fixed
  emergency grapheme slices.
- Thai and Khmer no-space text breaks at language-aware opportunities rather
  than arbitrary measured grapheme capacity.
- Arabic/Latin mixed text retains Pretext's logical boundary spacing while a
  complete plain line is still painted in one Canvas `fillText()` call for
  browser shaping and bidirectional ordering.

The fixture matrix in `src/apps/share-kit-text-layout.test.ts` covers Latin,
hard breaks and repeated whitespace, URLs/hashtags/handles, combining marks,
emoji/ZWJ sequences, CJK punctuation, Thai/Khmer no-space text, Arabic/RTL,
and mixed bidirectional content. It asserts content preservation, safe-width
bounds, grapheme integrity, line caps, ellipsis, and formatted-run styles and
positions.

## Generated bundle delta

Measured from deterministic `npm run build:share-kit-package` output with
gzip level 9:

| Share Kit `dist/content.js` | Raw bytes | Gzip bytes |
| --- | ---: | ---: |
| Release 0.2.5 baseline (`a1a3733`) | 63,410 | 14,863 |
| Pretext 0.0.8 adapter | 168,013 | 35,544 |
| Delta | +104,603 | +20,681 |

The absolute compressed increase is 20.2 KiB and remains isolated to the
reviewed, user-invoked Share Kit package; it adds no background route, worker,
permission, remote service, or startup rail entry.

## Representative Chromium timing

`node scripts/benchmarks/share-kit-text-layout.mjs` bundles the production
adapter, launches installed Chrome headlessly, and measures layout plus the
corresponding Canvas `fillText()` calls across nine international fixtures.
On Windows 10 with Headless Chrome 151.0.0.0, 80 sample rounds produced:

| Text-layout/render slice | Median per text |
| --- | ---: |
| Previous wrapper | 0.022 ms |
| Pretext, warm shared caches | 0.044 ms |
| Pretext, caches cleared before each nine-case corpus | 0.106 ms |

The warm absolute delta was about 0.022 ms per representative text, well below
a frame and immaterial beside PNG media loading and Canvas export. A 990-code-
unit repeated Thai/Khmer no-space stress case took 0.4 ms with Pretext versus
7.5 ms in the previous grapheme-by-grapheme wrapper, produced 21 lines, and
kept the widest line at 780.56 px inside the 784 px safe width. Timings are
machine/browser observations, not cross-device guarantees; rerun the checked-in
benchmark when the dependency, browser target, font stack, or adapter changes.

## Formatted-run seam for #222

`text-layout.ts` exports `RichInlineRun`, `RichInlineRunStyle`,
`TweetPngRichInlineBlock`, `layoutTweetPngRichInlineRuns()`,
`layoutTweetPngRichInlineBlocks()`, and `tweetPngTextFont()`. The adapter accepts
ordered plain/bold/italic/strikethrough runs and optional bullet/hanging-indent
policy, then returns ordered lines with measured width and drawable fragments:
text, relative `x`, width, exact Canvas font, and resolved style. The adapter
owns whitespace, Unicode breaks, global line limits,
ellipsis, and height-consistent line counts; #222 does not need to measure or
break text again.
