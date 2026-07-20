import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { ARTWORK_METADATA_VERSION, shouldReadEmbeddedArtwork } from "../../src/apps/music/artwork-cache.ts";

const targets = ["chromium", "firefox"];
const registry = JSON.parse(await readFile("src/platform/app-sdk/first-party-apps.json", "utf8"));
const musicApp = registry.find((app) => app.id === "music");
assert(musicApp, "music: missing first-party app metadata");
const requiredManifestHosts = musicApp.permissions?.hosts ?? [];

verifyArtworkCachePolicy();

for (const target of targets) {
  const root = `dist/${target}`;
  const manifest = JSON.parse(await readFile(`${root}/manifest.json`, "utf8"));
  const resources = manifest.web_accessible_resources?.flatMap((entry) => entry.resources ?? []) ?? [];
  const contentScripts = manifest.content_scripts ?? [];
  const musicBundle = `${root}/features/music.js`;
  const musicCss = `${root}/music/content.css`;
  assert(existsSync(musicBundle), `${target}: missing features/music.js`);
  assert(existsSync(musicCss), `${target}: missing music/content.css`);
  assert(resources.includes("features/*.js"), `${target}: features/*.js is not web-accessible`);
  assert(resources.includes("music/*"), `${target}: music/* is not web-accessible`);
  for (const host of requiredManifestHosts) {
    assert(manifest.host_permissions?.includes(host), `${target}: missing host permission ${host}`);
  }
  assert(
    contentScripts.some((entry) => entry.js?.includes("content.js") && entry.matches?.includes("https://x.com/*")),
    `${target}: content.js is not registered for x.com`,
  );

  const bundle = await readFile(musicBundle, "utf8");
  assert(bundle.includes("milxdy-music-root"), `${target}: music panel root id missing from bundle`);
  assert(bundle.includes("milxdy-overlay-dock-root"), `${target}: overlay dock code missing from music bundle`);
  assert(!bundle.includes("chromaprint.wasm"), `${target}: removed Chromaprint WASM locator returned to music bundle`);
  assert(!bundle.includes("api.acoustid.org"), `${target}: removed AcoustID endpoint returned to music bundle`);
  assert(bundle.includes("musicbrainz.org/ws/2/recording"), `${target}: MusicBrainz lookup path missing from music bundle`);
  assert(bundle.includes("markRemovedTracks"), `${target}: music missing removed-file rescan handling`);
  assert(bundle.includes("duplicateGroupSize"), `${target}: music missing duplicate detection state`);
  assert(bundle.includes("matchingTrackCandidates"), `${target}: music missing playlist metadata matching`);
  assert(bundle.includes("supportsDirectoryPicker"), `${target}: music missing Firefox/local-folder limitation path`);
  assert(bundle.includes("activeRadioSessionId"), `${target}: music missing active radio-session state`);
}

console.log("Music build verification passed.");

function verifyArtworkCachePolicy() {
  const file = { lastModified: 200, size: 1_024 };
  assert(shouldReadEmbeddedArtwork({}, file), "music: unchecked files must be read for embedded artwork");
  assert(shouldReadEmbeddedArtwork({
    artworkMetadataVersion: ARTWORK_METADATA_VERSION - 1,
    artworkFileLastModified: file.lastModified,
    artworkFileSize: file.size,
  }, file), "music: stale artwork parser results must be retried");
  assert(shouldReadEmbeddedArtwork({
    artworkMetadataVersion: ARTWORK_METADATA_VERSION,
    artworkFileLastModified: file.lastModified,
    artworkFileSize: file.size + 1,
  }, file), "music: changed files must be reread for embedded artwork");
  assert(!shouldReadEmbeddedArtwork({
    artworkMetadataVersion: ARTWORK_METADATA_VERSION,
    artworkFileLastModified: file.lastModified,
    artworkFileSize: file.size,
  }, file), "music: unchanged files checked by the current parser should not be reread");
  assert(!shouldReadEmbeddedArtwork({ artworkDataUrl: "data:image/png;base64,AA==" }, file), "music: cached artwork must not be reread");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
