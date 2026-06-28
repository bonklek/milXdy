import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";

const targets = ["chromium", "firefox"];
const requiredManifestHosts = [
  "https://musicbrainz.org/*",
  "https://api.acoustid.org/*",
  "https://pbs.twimg.com/*",
  "https://boards.miladychan.org/*",
];
const forbiddenMusicNeedles = [
  "spotify",
  "soulseek",
  "streaming fallback",
  "external_ids",
  "oauth",
];

for (const target of targets) {
  const root = `dist/${target}`;
  const manifest = JSON.parse(await readFile(`${root}/manifest.json`, "utf8"));
  const resources = manifest.web_accessible_resources?.flatMap((entry) => entry.resources ?? []) ?? [];
  const contentScripts = manifest.content_scripts ?? [];
  const musicBundle = `${root}/features/music.js`;
  const musicCss = `${root}/music/content.css`;
  const chromaprintWasm = `${root}/features/chromaprint.wasm`;

  assert(existsSync(musicBundle), `${target}: missing features/music.js`);
  assert(existsSync(musicCss), `${target}: missing music/content.css`);
  assert(existsSync(chromaprintWasm), `${target}: missing features/chromaprint.wasm`);
  assert((await stat(chromaprintWasm)).size > 100_000, `${target}: chromaprint.wasm looks truncated`);
  assert(resources.includes("features/*.js"), `${target}: features/*.js is not web-accessible`);
  assert(resources.includes("features/*.wasm"), `${target}: features/*.wasm is not web-accessible`);
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
  assert(bundle.includes("chromaprint.wasm"), `${target}: Chromaprint WASM locator missing from music bundle`);
  assert(bundle.includes("api.acoustid.org/v2/lookup"), `${target}: AcoustID lookup path missing from music bundle`);
  assert(bundle.includes("musicbrainz.org/ws/2/recording"), `${target}: MusicBrainz lookup path missing from music bundle`);
  assert(bundle.includes("markRemovedTracks"), `${target}: music missing removed-file rescan handling`);
  assert(bundle.includes("duplicateGroupSize"), `${target}: music missing duplicate detection state`);
  assert(bundle.includes("matchingTrackCandidates"), `${target}: music missing playlist metadata matching`);
  assert(bundle.includes("supportsDirectoryPicker"), `${target}: music missing Firefox/local-folder limitation path`);
  assert(bundle.includes("activeRadioSessionId"), `${target}: music missing active radio-session state`);
  for (const needle of forbiddenMusicNeedles) {
    assert(!bundle.toLowerCase().includes(needle), `${target}: phase-9 needle present in music bundle: ${needle}`);
  }
}

console.log("Music build verification passed.");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
