# Max profile benchmark

The Max visual profile can make X/Twitter feel laggier than Moderate or Min. This benchmark
gives contributors a repeatable way to measure that lag and compare profiles on the same
surface, so regressions and fixes can be backed by numbers instead of subjective reports.

It runs entirely locally, only when you start it, and writes nothing unless diagnostics are on.

## What it measures

A fixed 30-second sample, captured on the X/Twitter tab's main thread:

- **Avg FPS** over the window (rendered frames ÷ elapsed seconds).
- **Worst frame gap** — the longest gap between two animation frames (`requestAnimationFrame`).
- **Frames >50ms** and **frames >100ms** — counts of janky frames.
- **Long tasks** — main-thread tasks over 50ms via `PerformanceObserver`, with count, total, and worst.
- **Feature timings** — existing milXdy counters from `milxdy.diagnostics.featureTimings`, when present:
  `miladymaxxer.idleSurface`, `remistats.insertBadge`, `wiki.processTweet`,
  `post-reading.processTweet`.

Each run is tagged with the active Appearance profile (Max / Moderate / Min) and stored under
`milxdy.diagnostics.benchmark.<profile>` so two runs can be compared side by side.

## How to run

1. Open the milXdy popup → **Diagnostics**, and enable **Collect performance counters**.
   (Results are only saved while this is on.)
2. Open an X/Twitter timeline tab.
3. In the popup, click **Run Max vs Moderate**, then keep the X tab visible for about 65 seconds.
   The suite applies canonical Max and Moderate presets in sequence, waits briefly, and uses the same
   fixed timeline scroll cadence for each sample. Do not manually scroll during the run.
4. When it finishes, your prior Appearance profile and theme are restored. The Diagnostics panel now
   shows a compact **Max vs Moderate** comparison. Click **Copy report**
   to copy a plaintext summary for an issue or PR.

Use **Start 30s benchmark** only when you need to sample the current appearance profile by itself.

Re-running a profile overwrites that profile's stored result, so you always compare the latest runs.

## Reading the result

The comparison grid shows each metric per profile (`Max` / `Mod` / `Min`) and a
**verdict** line. The verdict reports the worst ratio of Max vs Moderate across worst frame gap,
inverse average FPS, frames >50ms, and long tasks, and flags when **Max is more than 2× worse** — the threshold the
benchmark exists to confirm.

From there, a follow-up optimization issue can use the feature-timing rows to narrow the bottleneck
(CSS paint/compositing vs DOM scanning vs Miladymaxxer detection vs another feature), then re-run the
same benchmark to confirm a before/after improvement.
