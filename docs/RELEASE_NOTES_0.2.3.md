# milXdy 0.2.3 Release Notes

milXdy `0.2.3` is the reliability and accessibility follow-up to `0.2.2`. It incorporates the unpublished browser fixes that were briefly prepared as `0.2.2.1` and expands the release into a full cross-feature remediation pass.

## Included Fixes

- Isolate shared runtime failures so one app cannot strand cleanup, surface delivery, or idle work for other apps.
- Make startup, network, storage, worker, speech, and local-file workflows cancelable and recoverable.
- Restore reversible feature teardown and last-user-intent behavior across Maxxer, Music, Post-reading, Chat, Wiki, and Miladychan.
- Improve keyboard, focus, reduced-motion, live-region, and screen-reader behavior across the popup and in-page app surfaces.
- Keep Beetol hunts responsive by returning the mutation result before a separate background state reconciliation.
- Recover RemiNet Chat from stalled authentication or WebSocket opening instead of leaving the composer permanently disconnected on Connecting.
- Keep connector logout authoritative over cached/in-flight Chat authentication and abort background fetches when their shared deadline expires.
- Group Root Visual controls by their actual X/app ownership while preserving existing visual-theme storage and profile-pack compatibility.
- Show when more pinned apps are available above or below the visible side rail.
- Keep rail settings compact and separate from the Apps & Features catalog, with one-row ordering controls and advanced app presets collapsed by default.
- Preserve responsive native Like animation while keeping lightweight Maxxer catch and level-up feedback.
- Remove two suspected reliability-audit lag contributors: replace mutation-driven main-column button rescans with a disabled-aware, capped visible-page check every five seconds, and replace the dock's root-level relational dialog selector with a static left-rail safe area.
- Show the final Beetle Hunt reward before the red Done state and normal persisted 90-minute cooldown.
- Open supported Wiki tabs, details, and collapsible sections before read-aloud highlights and scrolls their text.
- Show poke controls only for accounts with a confirmed RemiliaNET identity while retaining independent score and beetle badges.
- Make active Chat reaction counts visibly pressed, keep dark Chat pop-outs free of bright outer edges, and use darker Post/Reply buttons in the dark default preset.
- Match the Remilia Wiki read-aloud control to the square Wiki button treatment.
- Preserve the Firefox/Waterfox compatibility, target-specific update download, fullscreen DM media, and Tweet PNG rendering improvements prepared after `0.2.2`.
- Localize the browser-provided extension name and description in Russian, falling back to English elsewhere. The in-app interface remains English in this release.
- Add an Appearance toggle for hiding X's dot-style hidden-message-request indicator without suppressing numbered unread badges.

## Reliability And Accessibility Fixes In Plain English

The broader reliability and accessibility work in this release addresses these user-visible failure modes:

### Shared runtime, startup, settings, and networking

1. One app failing during disable or disposal could prevent cleanup of every other app.
2. One rejected X-surface handler could strand the rest of that app's delivery queue.
3. One throwing idle task could pause already-queued shared work.
4. Starting before `document.body` existed could leave the shared X scanner uninstalled.
5. A bootstrap failure had no suite-level failure state, containment, or recovery path.
6. Resetting diagnostics could incorrectly report that the active scanner observer was gone.
7. Resetting an app could silently delete user-authored Wiki and Maxxer lists.
8. A failed settings write could leave a control showing a value that was never saved.
9. Popup Full setup could enable apps that its selected performance mode said were blocked.
10. Shared network work had no consistent deadline or way to cancel active requests.

### RemiNet Chat

11. Closing Chat during socket authentication could leave an orphan WebSocket.
12. Loading older history at the retention limit could discard the newest messages.
13. Live updates rebuilt message actions and dropped keyboard focus.
14. The media size cap was enforced only after buffering the full response.
15. An allowed large video could be duplicated into several simultaneous in-memory copies.

### Root visuals, Tweet PNG, and Wiki

16. Dynamic new-post pills were missing their enabled visual styling.
17. Tweet PNG bypassed the documented review-before-copy step.
18. Tweet PNG could report a successful copy when clipboard support was unavailable.
19. Disabling Wiki could leave preview globals and an open preview behind.
20. Keyboard focus could close a Wiki preview before its Read link was reachable.
21. Disabling Wiki or changing routes could not cancel Grok's multi-stage workflow.
22. Grok's completion action used invalid nested interactive controls.

### Music and Miladychan

23. Stopping a Music folder scan could mark unvisited tracks missing and continue into other folders.
24. A stale track-selection request could start playback after a newer choice or after disable.
25. Radio synchronization could produce different queues based on each participant's local matches.
26. One IndexedDB-open failure could break Music for the rest of the tab.
27. An older Miladychan thread response could replace the newer thread the user selected.

### Beetol, Maxxer, and RemiStats

28. Some Beetol server failures could submit the same action twice.
29. A rejected Beetol request could leave the game panel permanently busy.
30. The entire frequently updating Beetol panel acted as a disruptive live announcement region.
31. Disabling Maxxer could leave filtered posts hidden.
32. One Maxxer worker failure could stall all later avatar inference in the tab.
33. Expired RemiStats score entries remained in an unbounded long-session cache.
34. RemiStats score badges behaved like links but could not be focused or opened by keyboard.

### Post-reading and OCR

35. Switching between Wiki and tweet reading could deadlock the browser's shared speech queue.
36. A pending custom HTTP speech request could not be canceled after Quit, disable, or a source change.
37. One silent OCR-host startup failure could prevent every later OCR retry in the tab.
38. Disposing and re-enabling Post-reading could leave old hidden player trees mounted.

### Keyboard, motion, and dialogs

39. The popup Runtime mode selector had no accessible name.
40. Rail and app reordering was pointer-only.
41. Rail reorder animation ignored the user's reduced-motion preference.
42. Popup dialogs did not contain keyboard focus or restore it after closing.
