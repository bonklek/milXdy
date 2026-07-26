# Local Add-ons

milXdy builds trusted App SDK ZIP packages into a stable local Chromium extension. Packages are validated and composed at build time; downloaded JavaScript is never injected into a running extension.

## First setup

1. Install the repository dependencies with `npm install`.
2. Put trusted package ZIPs in `local-addons/manual/` at the repository root. The manager creates this folder on its first run.
3. Run `npm run addons:status` to validate the package set without changing the extension build.
4. Run `npm run addons:rebuild` to build and promote the validated package set to `dist/chromium-local-apps/`.
5. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `dist/chromium-local-apps/`.
6. Open X/Twitter and use milXdy **Settings → Apps & Features → Local Add-ons** to confirm the loaded package set.

The output folder is stable. Do not load the temporary build under `tmp/`.

## Settings handoff

**Settings → Apps & Features → Local Add-ons** is the local control panel for
this workflow:

1. **Get more add-ons** opens the configured GitHub catalog URL in a new tab.
   The 0.2.3 repository contains a zero-package catalog preview; publishing it
   is a separate maintainer action, so obtain trusted ZIPs directly until that
   catalog is available.
2. After Chrome downloads package ZIPs, **Load downloaded add-ons** opens a
   user-initiated multi-file picker. milXdy does not scan Downloads or request
   broad Downloads permission.
3. The queued list performs a browser preflight for archive safety and readable
   package metadata. Rejected files show a reason. The local composer remains
   the authoritative validator.
4. **Rebuild custom extension** becomes available when at least one ZIP passes
   preflight. Where Chromium supports a writable directory picker, choose the
   checkout's `local-addons/manual/` folder to place those ZIPs.
5. Run the command shown by Settings in the milXdy checkout. The separate local
   builder creates `dist/chromium-local-apps/`; the running extension never
   claims to rebuild itself.

After the first successful build, Settings shows the exact output folder and
the Chrome **Load unpacked** step. When Chrome already has that custom folder
loaded, later successful builds show the **Reload** handoff instead.

## Later package changes

1. Add, replace, or remove ZIPs in `local-addons/manual/`.
2. Run `npm run addons:status` if you want a validation-only check.
3. Run `npm run addons:rebuild`.
4. Return to `chrome://extensions` and click **Reload** on the existing milXdy card, then refresh X/Twitter.

Apps & Features reports when a newer successful build is waiting for that Chrome reload. If validation or compilation fails, the manager keeps the previous stable build and records the failure instead of replacing it.

## Status and troubleshooting

- Canonical manual package folder: `local-addons/manual/`
- Catalog-managed package folder: `local-addons/catalog/`
- Stable unpacked extension: `dist/chromium-local-apps/`
- Latest manager status: `tmp/local-addon-manager/status.json`
- Detailed validation report: `tmp/local-addon-manager/composition/composition-report.json`

Packages with `review.status: "reviewed"` build directly. A package marked for local review requires an explicit acknowledgement:

```powershell
npm run addons:rebuild -- --allow-local-review
```

The composer may require additional explicit consent flags for privileged surfaces or a reviewed first-party replacement. Follow the exact acknowledgement listed in the validation report; the manager forwards supported `--...` trust flags to the composer.

Local add-ons use the existing App SDK package schema, archive limits, path checks, file hashes, permission/privacy declarations, lifecycle checks, and sensitive-API scanner. These checks support review; they are not a JavaScript sandbox. Only build packages you trust.

The current manager targets Chromium. It does not watch a download folder, update packages automatically, remove packages from inside Chrome, or execute package code dynamically. Catalog downloads happen only when the user supplies a selection and runs Prepare. See the [App SDK guide](APP_SDK.md) for package authoring and trust requirements.

## Catalog selections

A catalog exports one `.milxdy-selection.json` instead of asking the browser to download several ZIPs. The selection pins each package ID, HTTPS ZIP URL, filename, SHA-256, review identity/date, and schema version. Its format is defined by [the selection schema](milxdy-selection.schema.json).

Prepare and review the exact package set:

```powershell
npm run addons:prepare -- --selection=path\to\.milxdy-selection.json
```

Prepare downloads only from checked-in allowed GitHub hosts, resumes from the content-addressed cache, verifies every pinned hash, validates the packages with the existing composer, places the exact catalog set transactionally, and prints one consolidated host/permission/storage/remote-service summary. It does not build.

Then apply the prepared selection using the acknowledgement flags printed by Prepare:

```powershell
npm run addons:apply -- --acknowledge-package-consent
```

The four stages have one owner each: the catalog creates **Select**; the local manager performs **Place ZIPs** and **Rebuild**; Apps & Features confirms **Reload**. Catalog review metadata is trusted only when the package ID, archive hash, reviewer, and review date match the checked-in review registry. Otherwise Apply additionally requires `--allow-local-review`.

`buildInstanceId` changes for every successful rebuild so Apps & Features can detect a pending Chrome reload. `compositionFingerprint` is deterministic for the SDK version and exact sorted package IDs, versions, and package hashes, so two equivalent package selections can be compared independently of rebuild time.
