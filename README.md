# milXdy

An integrated X/Twitter experience enhancer by consolidating multiple browser extensions.

milXdy is a beta Manifest V3 extension that brings several Remilia-oriented browser tools into one install pipeline, one manifest, one popup/settings menu, and one content bootstrap. It is intended for GitHub beta distribution and local unpacked-extension testing.

## Included Sub-Extensions

- **Remilia Wiki Hyperlink** links known Remilia Wiki concepts inside X/Twitter posts. Settings cover enablement, hover previews, debug mode, link limits, low-confidence link limits, and link color.
- **Postreader / Tweet Reader** adds read-aloud controls to posts. Settings cover speech speed and volume, voice choice, autoplay behavior, promoted-post skipping, quote handling, hyperlink/link-preview/image text inclusion, OCR, highlights, player placement, button placement, handle reading, and keyboard shortcuts.
- **RemiStats** shows RemiStats badges and hover details for users on X/Twitter. Settings cover badges, tooltips, sounds, and sound volume.
- **Miladymaxxer** applies avatar-based Milady detection, effects, badges, sounds, and manual handle controls. By default, users with RemiStats beetle stats are also treated as worthy of maximization.
- **beXtol Hunter** adds the Remilia beetle hunter panel for signed-in remilia.net users, including session status, panel color, theme mode, state refresh, and beetle actions.

## Beta Install

1. Run `npm install`.
2. Run `npm run build`.
3. Open Chrome or another Chromium browser to `chrome://extensions`.
4. Enable Developer Mode.
5. Choose **Load unpacked** and select the `dist` folder.

## Settings

Open the extension popup or options page to configure each sub-extension. The settings menu is organized into tabs:

- **Suite**: shared diagnostics.
- **Wiki**: Remilia Wiki hyperlink behavior.
- **Reader**: Postreader playback, extraction, OCR, display, and keyboard settings.
- **RemiStats**: badge, tooltip, and sound settings.
- **Maxxer**: Miladymaxxer mode, sounds, badges, RemiStats beetle-user inclusion, card theme, whitelist handles, and manual Milady handles.
- **beXtol**: panel enablement, remilia.net login/logout, panel color, and panel theme.
- **Diag**: beta counters for loaded bundles, scanner activity, cache hits, detection queue size, and wiki link counts.

## Postreader Custom TTS

Postreader can use the built-in browser Web Speech engine or a user-provided HTTP TTS endpoint. Configure this under Reader/Postreader playback settings.

Custom HTTP is intended for users who want to bring their own local TTS bridge, such as Piper, Kokoro, a native app, or another engine. milXdy does not ship those integrations; it only sends text chunks to the configured endpoint and plays the audio response.

The custom endpoint receives:

```json
{
  "text": "Text chunk to read",
  "rate": 1,
  "volume": 1,
  "voiceURI": null
}
```

It should return either an `audioUrl` or base64 audio. `audioUrl` may point to the same local service, for example:

```json
{
  "audioUrl": "http://localhost:8787/audio/abc.mp3",
  "boundaries": [
    { "charIndex": 0, "charLength": 4, "elapsedTime": 0.05 }
  ]
}
```

For base64 audio, return `audioBase64` and optionally `audioContentType`:

```json
{
  "audioBase64": "SUQz...",
  "audioContentType": "audio/mpeg"
}
```

Timing rules:

- `boundaries` are optional. Without them, custom TTS is audio-only.
- `charIndex` and `charLength` are relative to the exact `text` chunk in the request, not the whole post.
- `elapsedTime` is seconds from the start of the returned audio.
- Word/smooth body highlighting is enabled only when custom timing is set to endpoint boundaries and at least one valid boundary is returned.
- Active-post highlighting still works for audio-only custom engines.

Local service notes:

- The manifest allows custom endpoints on `http://localhost/*` and `http://127.0.0.1/*`.
- The endpoint must accept `POST` JSON.
- If the service returns an `audioUrl`, that URL must be reachable by the page context and should provide a browser-playable audio type such as MP3, WAV, OGG, or WebM.
- If CORS is enforced by the browser for the local service, allow the extension origin or use permissive local development headers.

## Security And Privacy Notes

- The extension runs only on `x.com`, `twitter.com`, localhost TTS endpoints, Remilia Wiki, RemiStats API, `pbs.twimg.com`, and `www.remilia.net` according to the manifest permissions.
- beXtol login sends credentials directly to `www.remilia.net` through its OIDC password flow. Passwords are never stored by milXdy and the popup clears the password field after each login attempt.
- beXtol access and refresh tokens are stored in local Chrome extension storage under namespaced keys: `bextol.accessToken` and `bextol.refreshToken`.
- 2FA is not supported by the current beXtol password-grant flow.
- Postreader OCR and Miladymaxxer avatar inference run locally in the browser extension context after their feature bundles are loaded.
- RemiStats and the Miladymaxxer beetle-user bridge call `https://api.remistats.net`.
- Build artifacts, vendored source clones, local agent metadata, logs, and dependency folders are excluded from Git by `.gitignore`.

## Development

```powershell
npm.cmd install
npm.cmd run build
npm.cmd run typecheck
```

The build emits:

- `dist/content.js`: small settings-aware bootstrap.
- `dist/features/wiki.js`
- `dist/features/postreader.js`
- `dist/features/remistats.js`
- `dist/features/miladymaxxer.js`
- `dist/features/bextol.js`

Disabled features should not download or parse their feature bundle on initial page load. The build script includes smoke checks to keep large feature implementation strings out of the bootstrap.

## License

VPL, inherited from bundled dependencies.
