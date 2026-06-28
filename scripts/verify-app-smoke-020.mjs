import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const registry = JSON.parse(await readFile("src/shared/firstPartyApps.json", "utf8"));
const files = {
  miladychanSource: await readFile("src/features/miladychanSpotlight/content.ts", "utf8"),
  musicSource: await readFile("src/features/music/content.ts", "utf8"),
  background: await readFile("src/background.ts", "utf8"),
  docsQa: await readFile("docs/QA_0.2.0.md", "utf8"),
  docsReleaseNotes: await readFile("docs/RELEASE_NOTES_0.2.0.md", "utf8"),
};

verifyRegistryContracts();
verifyMiladychanPortalContract();
verifyMusicMvpContract();
await verifyFullBuildOutputs("chromium", "dist/chromium");
await verifyFullBuildOutputs("firefox", "dist/firefox");

console.log("0.2.0 app smoke verification passed.");

function verifyRegistryContracts() {
  const byId = new Map(registry.map((app) => [app.id, app]));
  const miladychan = byId.get("miladychanSpotlight");
  const music = byId.get("music");
  assert(miladychan?.name === "Miladychan Portal", "registry must expose Miladychan Portal user-facing metadata");
  assert(miladychan.version === "0.2.0", "Miladychan Portal registry version must be 0.2.0");
  assert(miladychan.description.includes("boards and threads"), "Miladychan Portal description must describe board/thread browsing");
  assert(miladychan.hub?.shortDescription.includes("boards and threads"), "Miladychan Portal Hub description must describe board/thread browsing");
  assert(miladychan.hub?.presets?.includes("full"), "Miladychan Portal must be included in the full preset");
  assert(miladychan.loadTriggers?.includes("dockOpen"), "Miladychan Portal must load on dock open");
  assert(!miladychan.loadTriggers?.includes("startup"), "Miladychan Portal must not load at startup");
  assert(miladychan.permissions?.hosts?.includes("https://boards.miladychan.org/*"), "Miladychan Portal must declare board host permission");
  assert(miladychan.background?.messageTypes?.includes("miladychan:fetchJson"), "Miladychan Portal must use background fetch routing");

  assert(music?.version === "0.2.0", "Music registry version must be 0.2.0");
  assert(music.hub?.presets?.includes("full"), "Music must be included in the full preset");
  assert(music.loadTriggers?.includes("dockOpen"), "Music must load on dock open");
  assert(!music.loadTriggers?.includes("startup"), "Music must not load at startup");
  assert(music.permissions?.hosts?.includes("https://musicbrainz.org/*"), "Music must declare MusicBrainz host permission");
  assert(music.permissions?.hosts?.includes("https://api.acoustid.org/*"), "Music must declare AcoustID host permission");
  assert(music.hub?.privacyLabels?.includes("local-files"), "Music must disclose local file access");
  assert(music.requiredOutputs?.includes("features/chromaprint.wasm"), "Music must require Chromaprint WASM output");
}

function verifyMiladychanPortalContract() {
  for (const needle of [
    'const API_ROOT = "https://boards.miladychan.org"',
    "/json/board-list",
    "/json/boards/${board.id}/catalog",
    "/json/boards/${boardId}/${threadId}",
    'type: "miladychan:fetchJson"',
    "DEFAULT_BOARDS",
    "BOARD_THEME_BY_BOARD",
    "sortThreads",
    "createThreadButton",
    "renderThread",
    "createMedia",
    'target = "_blank"',
    "Refresh",
  ]) {
    assert(files.miladychanSource.includes(needle), `Miladychan Portal source missing ${needle}`);
  }
  assert(files.background.includes("MILADYCHAN_JSON_RULES"), "background must define Miladychan JSON allowlist");
  assert(files.background.includes("Unsupported Miladychan URL"), "background must reject unsupported Miladychan URLs");
  assert(files.docsQa.includes("board summaries load") && files.docsQa.includes("thread ordering"), "QA checklist must cover Miladychan board/thread smoke");
  assert(files.docsReleaseNotes.includes("Miladychan Portal"), "release notes must document Miladychan Portal");
}

function verifyMusicMvpContract() {
  for (const needle of [
    "showDirectoryPicker",
    'const DB_NAME = "milxdy-music"',
    'for (const store of ["folders", "tracks", "playlists", "radio"])',
    "SUPPORTED_EXTENSIONS",
    "QRCode.toDataURL",
    "jsQR(",
    "parsePlaylistPayload",
    "playlistPayload",
    "createRadioSession",
    "currentRadioPosition",
    "joinRadio",
    "lookupMusicBrainzCandidates",
    "lookupAcoustIdCandidates",
    "reviewTrackCandidates",
    "manual",
    "Local folder access is not available in this browser",
  ]) {
    assert(files.musicSource.includes(needle), `Music source missing ${needle}`);
  }
  assert(files.background.includes("MUSICBRAINZ_JSON_RULES"), "background must define MusicBrainz allowlist");
  assert(files.background.includes("ACOUSTID_FORM_RULES"), "background must define AcoustID allowlist");
  assert(files.background.includes("Unsupported music lookup URL"), "background must reject unsupported music JSON URLs");
  assert(files.docsQa.includes("Start a radio session") && files.docsQa.includes("MusicBrainz ISRC enrichment"), "QA checklist must cover Music radio and enrichment smoke");
  assert(files.docsReleaseNotes.includes("Music MVP") || files.docsReleaseNotes.includes("Music"), "release notes must document Music MVP");
}

async function verifyFullBuildOutputs(target, root) {
  assert(existsSync(root), `${target}: full build directory missing`);
  const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
  const resources = manifest.web_accessible_resources?.flatMap((entry) => entry.resources ?? []) ?? [];
  const featuresDir = path.join(root, "features");
  assert(existsSync(path.join(featuresDir, "miladychanSpotlight.js")), `${target}: missing Miladychan Portal bundle`);
  assert(existsSync(path.join(featuresDir, "music.js")), `${target}: missing Music bundle`);
  assert(existsSync(path.join(root, "miladychanSpotlight", "content.css")), `${target}: missing Miladychan Portal CSS`);
  assert(existsSync(path.join(root, "music", "content.css")), `${target}: missing Music CSS`);
  assert(resources.includes("miladychanSpotlight/*"), `${target}: Miladychan Portal CSS assets must be web-accessible`);
  assert(resources.includes("music/*"), `${target}: Music CSS assets must be web-accessible`);
  assert(resources.includes("features/*.wasm"), `${target}: Music WASM assets must be web-accessible`);
  assert(manifest.host_permissions?.includes("https://boards.miladychan.org/*"), `${target}: missing Miladychan host permission`);
  assert(manifest.host_permissions?.includes("https://musicbrainz.org/*"), `${target}: missing MusicBrainz host permission`);
  assert(manifest.host_permissions?.includes("https://api.acoustid.org/*"), `${target}: missing AcoustID host permission`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
