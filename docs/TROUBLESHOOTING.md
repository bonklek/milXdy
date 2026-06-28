# Troubleshooting

## Common Issues

- **Extension does not appear**: make sure `npm run build` completed and that you selected `dist/chromium` for Chromium or `dist/firefox/manifest.json` for Firefox, not the repository root.
- **Changes did not apply**: reload the extension on `chrome://extensions`, then refresh X/Twitter tabs.
- **Update status fails**: confirm `src/shared/updateCheck.ts` points to a real public GitHub repository with prereleases.
- **RemiNet connector badges missing**: confirm RemiNet connector badges are enabled and `https://api.remistats.net` is reachable.
- **Poke icon missing**: confirm **RemiNet connector icons** and **Poke icon** are enabled, reload the extension, then refresh the affected X/Twitter tab.
- **RemiNet Chat does not appear**: enable **Show RemiliaNET chat on X home**, confirm RemiNet login status, then refresh the X/Twitter tab. On X Messages, click the **RemiliaNET Chat** entry to open the larger RemiNet surface. The chat is off by default.
- **RemiNet Chat does not connect**: click **Open RemiliaNET**, click **Log in** on RemiliaNET, finish login in the RemiliaNET tab, return to milXdy, then click **Retry session**. milXdy will reuse the RemiliaNET browser session for connector auth; reload the X/Twitter tab after the session is detected.
- **Apps rail is missing**: refresh the X/Twitter tab after reloading the extension. If it still does not appear, open the popup Main tab, confirm the extension is enabled, and check whether Performance diagnostics records app runtime data after visiting X/Twitter.
- **Pinned app is missing from the rail**: open **Apps**, confirm the app is enabled, then click **Pin**. Enabled apps can be unpinned, so enablement alone does not guarantee a direct rail icon.
- **Wiki sidebar does not open a page**: confirm the Wiki app is enabled and that the URL starts with `https://wiki.remilia.org`. If the embedded view is blocked by the wiki page, use the panel's open-in-tab control.
- **Miladychan Portal does not load boards**: confirm `https://boards.miladychan.org` is reachable and that the Miladychan app is enabled. The portal depends on public board JSON and does not replace the native Miladychan site.
- **Music cannot add a folder**: use a Chromium browser with File System Access support. Firefox temporary add-ons can load milXdy, but local music folder handles are browser-limited. In Chromium, use **Settings > Music folders > Test** or **Rescan** to recover a revoked permission prompt.
- **Music shows missing files**: run **Settings > Missing files > Repair** or rescan the folder. milXdy marks missing indexed files unavailable; it does not delete or modify local audio.
- **Music shows duplicate tracks**: duplicates are flagged when files share an ISRC or strong title/artist/duration metadata. Keep the preferred local file and remove folders you do not want indexed.
- **Music enrichment finds no ISRCs**: confirm track metadata is readable, try MusicBrainz enrichment first, and add an AcoustID key only if you want optional acoustic lookup. Some local files or unofficial releases may not have reliable ISRC matches.
- **Playlist or radio QR import fails**: confirm the QR or JSON was exported by milXdy Music and contains playlist metadata. QR payloads do not include audio files, so tracks must exist locally and match by ISRC or by title, artist, album, and duration. Use **Match** beside unresolved playlist rows after adding or rescanning local files.
- **Maxxer seems inactive**: set mode to `Debug`, refresh X/Twitter, and check the Health tab for diagnostic details.
- **Legacy stats import failed**: validate the JSON file and confirm it contains legacy Miladymaxxer storage keys.
- **Post-reading OCR stuck at 5%**: rebuild and reload the unpacked extension, then confirm `dist/chromium/ocr.html` or `dist/firefox/ocr.html` and the matching `ocrHost.js` exist. The 5% stage means the hidden OCR host page is loading.
- **Post-reading OCR is intermittent**: OCR runs locally through Tesseract and can miss stylized, low-resolution, or low-contrast image text.

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
