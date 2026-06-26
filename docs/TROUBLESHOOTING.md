# Troubleshooting

## Common Issues

- **Extension does not appear**: make sure `npm run build` completed and that you selected `dist/chromium` for Chromium or `dist/firefox/manifest.json` for Firefox, not the repository root.
- **Changes did not apply**: reload the extension on `chrome://extensions`, then refresh X/Twitter tabs.
- **Update status fails**: confirm `src/shared/updateCheck.ts` points to a real public GitHub repository with prereleases.
- **RemiNet connector badges missing**: confirm RemiNet connector badges are enabled and `https://api.remistats.net` is reachable.
- **Poke icon missing**: confirm **RemiNet connector icons** and **Poke icon** are enabled, reload the extension, then refresh the affected X/Twitter tab.
- **RemiNet Chat does not appear**: enable **Show RemiliaNET chat on X home**, confirm RemiNet login status, then refresh the X/Twitter home timeline. The chat is off by default.
- **RemiNet Chat does not connect**: click **Open RemiliaNET**, click **Log in** on RemiliaNET, finish login in the RemiliaNET tab, return to milXdy, then click **Retry session**. milXdy will reuse the RemiliaNET browser session for connector auth; reload the X/Twitter tab after the session is detected.
- **Maxxer seems inactive**: set mode to `Debug`, refresh X/Twitter, and check the Health tab for diagnostic details.
- **Legacy stats import failed**: validate the JSON file and confirm it contains legacy Miladymaxxer storage keys.
- **Postreader OCR stuck at 5%**: rebuild and reload the unpacked extension, then confirm `dist/chromium/ocr.html` or `dist/firefox/ocr.html` and the matching `ocrHost.js` exist. The 5% stage means the hidden OCR host page is loading.
- **Postreader OCR is intermittent**: OCR runs locally through Tesseract and can miss stylized, low-resolution, or low-contrast image text.

## General Checks

Run:

```powershell
npm run typecheck
npm run build
Get-ChildItem dist\chromium
Get-Content public\manifest.json
```

Then check:

- Does `chrome://extensions` show milXdy loaded from the expected folder?
- Does the extension card show errors?
- Did you refresh X/Twitter after loading or reloading?
- Are desired features enabled in the popup?
- Does the Diag tab show loaded feature bundles after visiting X/Twitter?
