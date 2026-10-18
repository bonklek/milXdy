# milXdy 0.2.5 Experimental

This experimental prerelease includes the new Remilia account connection,
reorganized settings, and reader and interface improvements. Version 0.2.4
remains the latest stable release.

## Downloads

- **Chrome, Brave, and Edge:** download `milXdy-0.2.5-chromium.zip`, extract it,
  and load the folder from the browser's extensions page with Developer mode enabled.
- **Firefox and Waterfox:** use `milXdy-0.2.5-firefox.zip` with temporary add-on
  loading. Authenticated Remilia Login is available in the Chromium build;
  Firefox supports public and non-authenticated features.
- Verify downloads against `milXdy-0.2.5-checksums.sha256`.

Update the existing milXdy extension in place. The Chromium build retains the
registered extension identity and login callback; there is no separate beta build.

## What changed

- Official Remilia Login with PKCE, visible connection and permission states,
  and explicit reconnect and disconnect controls.
- Reorganized popup settings, clearer account status, improved navigation,
  and controls for audio and interface preferences.
- A temporary dual-auth holdover: milXdy uses Remilia Login for supported API
  features; native Hunt, Claim, and Craft use the separate RemiliaNET website
  sign-in. Connecting or disconnecting milXdy does not sign the website in or out.
- Updated RemiStats, pokes, Beetle reads, and RemiNet Chat integration with
  scoped API access and clearer service responses.
- Article reader control placement, paragraph navigation, playback status,
  and word tracking improvements.
- An explicit **Read visible messages aloud** action for supported DM
  conversations, with text review before browser-voice playback. Highlighting
  preserves the original message text, spaces, and links. Private messages
  bypass custom HTTP speech services; browser voices may use a remote service.
- Review-first audio export through a configured local speech backend.
- Share Kit text layout, rich-text and drawing controls, reviewed export,
  and composer integration improvements.
- Non-followed GIF filtering, author badge layout improvements, and native
  cheese claim streak feedback.
- Tighter package permissions and trust checks, reproducible release archives,
  and refreshed installation and account documentation.

## Experimental compatibility

Features and browser integration may change during experimental testing.
Browser speech depends on the selected browser voice. Audio file export needs
an audio-producing backend; native browser speech cannot export MP3.

Reloading or disabling the extension, or ending the browser session, clears
its Remilia connection and requires an explicit reconnect. Native website
sessions remain separate.

See [installation and updates](https://github.com/bonklek/milXdy/blob/experimental/0.2.5/docs/getting-started/INSTALL_AND_UPDATE.md)
and [the Remilia account guide](https://github.com/bonklek/milXdy/blob/experimental/0.2.5/docs/getting-started/REMILIA_ACCOUNT.md).

## Previews

Captured from the application with sample content; no private conversations
or connected account data are shown.

![Remilia settings](https://raw.githubusercontent.com/bonklek/milXdy/v0.2.5-experimental/docs/releases/previews/0.2.5/account.png)

![Audio review](https://raw.githubusercontent.com/bonklek/milXdy/v0.2.5-experimental/docs/releases/previews/0.2.5/audio-review.png)

![Share Kit](https://raw.githubusercontent.com/bonklek/milXdy/v0.2.5-experimental/docs/releases/previews/0.2.5/share-kit.png)
