# Firefox Build QA

Run this checklist before advertising Firefox support.

## Automated

```powershell
npm.cmd run typecheck
npm.cmd run build:firefox
npm.cmd run lint:firefox
```

`web-ext` warnings from bundled OCR, ONNX, or existing UI code need review, but lint errors should block release.

## Load

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on**.
3. Select `dist/firefox/manifest.json`.
4. Open the extension console and confirm there are no startup errors.

## Smoke Tests

- Popup opens and all tabs render.
- `https://x.com` loads with no content bootstrap errors.
- Remilia Wiki link previews still render.
- Postreader can read a post, and OCR progresses past the hidden-host loading stage.
- RemiStats badges and RemiNet poke state render.
- RemiNet Chat connects when enabled.
- Beetol auth/session status works.
- Maxxer avatar detection runs and updates diagnostics in Debug mode.
