# milXdy 0.2.3 Release Notes

milXdy `0.2.3` is the reliability and accessibility follow-up to `0.2.2`. It incorporates the unpublished browser fixes that were briefly prepared as `0.2.2.1` and expands the release into a full cross-feature remediation pass.

Status: in development.

## Included Fixes

- Isolate shared runtime failures so one app cannot strand cleanup, surface delivery, or idle work for other apps.
- Make startup, network, storage, worker, speech, and local-file workflows cancelable and recoverable.
- Restore reversible feature teardown and last-user-intent behavior across Maxxer, Music, Post-reading, Chat, Wiki, and Miladychan.
- Improve keyboard, focus, reduced-motion, live-region, and screen-reader behavior across the popup and in-page app surfaces.
- Keep Beetol hunts responsive by returning the mutation result before a separate background state reconciliation.
- Recover RemiNet Chat when an authenticated message send closes the socket: invalidate the cached write credential, renew it once, and stop at a retry state if renewal fails instead of looping on Connecting.
- Keep connector logout authoritative over cached/in-flight Chat authentication and abort background fetches when their shared deadline expires.
- Clear Chrome's stranded Web Speech pause state before queueing playback so read-aloud cannot remain silent while displaying the first-word highlight.
- Restore continuous paragraph-level smooth highlighting and keep its fill rate calibrated throughout speech rather than filling isolated token ranges with a fixed early cadence.
- Continue the paragraph scan when Chrome speaks without delivering another native boundary, and return to native timing as soon as boundary delivery resumes.
- Restore the distinction between small paragraph navigation and large post navigation by splitting long readings into compact, ordered speech chunks again.
- Derive Beetle Hunt availability from the API's hunt count and last-hunt timestamp, so cooldown responses display the actual remainder of the 90-minute cycle.
- Group Root Visual controls by their actual X/app ownership while preserving existing visual-theme storage and profile-pack compatibility.
- Show when more pinned apps are available above or below the visible side rail.
- Keep rail settings compact and separate from the Apps & Features catalog, with one-row ordering controls and advanced app presets collapsed by default.
- Preserve responsive native Like animation while keeping lightweight Maxxer catch and level-up feedback.
- Remove two suspected reliability-audit lag contributors: replace mutation-driven main-column button rescans with a disabled-aware, capped visible-page check every five seconds, and replace the dock's root-level relational dialog selector with a static left-rail safe area.
- Show the final Beetle Hunt reward before the red Done state and normal persisted 90-minute cooldown.
- Open supported Wiki tabs, details, and collapsible sections before read-aloud highlights and scrolls their text.
- Show poke controls only for accounts with a confirmed RemiliaNET identity while retaining independent score and beetle badges.
- Reserve the RemiStats action-row poke position before lazy loading completes so post controls do not shift between otherwise identical tweets.
- Let tweet names and handles use the available header row before truncating under the Moderate and Max visual profiles.
- Allocate tweet-header width by intrinsic display-name size and remaining metadata space, preventing premature display-name ellipses.
- Recover embedded Music cover art from the selected local audio file, retry stale artwork metadata when the parser or file changes, and persist restored art for later popout renders.
- Keep RemiNet Chat enablement in Apps & Features instead of exposing a duplicate popup setting.
- Rename the updater assistant handoff button from **LLM** to **Open in LLM** so its action is explicit.
- Enable RemiStats poke-on-Like as part of the Medium and Max preset behavior bundle; Minimal keeps it off.
- Make active Chat reaction counts visibly pressed, keep dark Chat pop-outs free of bright outer edges, and use darker Post/Reply buttons in the dark default preset.
- Match the Remilia Wiki read-aloud control to the square Wiki button treatment.
- Preserve the Firefox/Waterfox compatibility, target-specific update download, fullscreen DM media, and Tweet PNG rendering improvements prepared after `0.2.2`.
- Strengthen regression coverage with registry-derived app checks and shared production-policy tests instead of one-off implementation-string assertions.
- Remove Chromaprint WASM and AcoustID acoustic lookup from Music; metadata inference, MusicBrainz enrichment, candidate review, and manual ISRC editing remain available.

## Release Gate

The canonical non-live release gate passed on 2026-07-10 after the reliability and RemiliaNET recovery fixes were integrated. This includes strict TypeScript, Chromium and Firefox builds, platform and messaging contracts, local-package trust tests, Firefox lint classification, extension/app smoke, release packaging, checksums, and reproducibility.

This release is not ready for publication until manual authenticated X/RemiliaNET QA covers the changed runtime, Beetol Hunt, RemiNet Chat live connection and sending, Post-reading, Wiki, rail/settings, and representative feed/notification surfaces.

Expected release assets are `milXdy-0.2.3-chromium.zip` and `milXdy-0.2.3-firefox.zip`.
