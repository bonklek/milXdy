import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const APPROVED_RUNTIME_MATCHES = [
  "https://x.com/*",
  "https://twitter.com/*",
  "https://www.remilia.net/*",
  "https://remilia.wiki/*",
  "https://wiki.remilia.org/*",
  "https://boards.miladychan.org/*",
];

export function verifyManifestHostRoles(manifest) {
  const scripts = manifest.content_scripts || [];
  const runtime = scripts.find((entry) => entry.js?.includes("content.js"));
  const bridge = scripts.find((entry) => entry.js?.includes("reminetChatBridge.js"));
  const fastPath = scripts.find((entry) => entry.js?.includes("reminetCraftFastPath.js"));
  assert.deepEqual(runtime?.matches, APPROVED_RUNTIME_MATCHES, "shared content entry must retain the reviewed host matrix");
  assert.deepEqual(bridge?.matches, ["https://www.remilia.net/*"], "RemiliaNET socket bridge must remain exact-host-only");
  assert.deepEqual(fastPath?.matches, ["https://www.remilia.net/*"], "RemiliaNET native-site helper must remain exact-host-only");
}

export function verifyBundledUiBoundary(content) {
  assert.match(content, /mode\s*!==\s*["']bridgeOnly["']/, "built content must exclude bridge-only sites from UI runtime creation");
  assert.match(content, /mode\s*===\s*["']bridgeOnly["']/, "built content must keep an explicit bridge-only branch");
  assert.match(content, /milxdyRuntimeState\s*=\s*["']bridge-only["']/, "built content must expose the bridge-only runtime state");
  for (const rootId of [
    "milxdy-overlay-dock-root",
    "milxdy-overlay-app-guides",
    "milxdy-app-hub-panel",
    "milxdy-reminet-chat-root",
    "beetol-hunter-root",
  ]) {
    assert.ok(content.includes(rootId), `built bridge-only cleanup missing ${rootId}`);
  }
  const bridgeBranch = content.search(/mode\s*===\s*["']bridgeOnly["']/);
  const runtimeBoot = content.indexOf("bootFeaturesWithRecovery");
  assert.ok(bridgeBranch >= 0 && runtimeBoot > bridgeBranch, "bridge-only boundary must be evaluated before UI runtime boot");
}

export function verifyMultiSiteRuntimeUi({ manifest, content }) {
  verifyManifestHostRoles(manifest);
  verifyBundledUiBoundary(content);
}

function selfTest() {
  const manifest = {
    content_scripts: [
      { matches: APPROVED_RUNTIME_MATCHES, js: ["content.js"] },
      { matches: ["https://www.remilia.net/*"], js: ["reminetChatBridge.js"] },
      { matches: ["https://www.remilia.net/*"], js: ["reminetCraftFastPath.js"] },
    ],
  };
  const goodContent = `
    const runtimeApps = runtimeSite && runtimeSite.mode !== "bridgeOnly" ? appsForRuntimeSite(FIRST_PARTY_APPS, runtimeSite) : [];
    if (runtimeSite?.mode === "bridgeOnly") {
      document.documentElement.dataset.milxdyRuntimeState = "bridge-only";
      for (const id of ["milxdy-overlay-dock-root", "milxdy-overlay-app-guides", "milxdy-app-hub-panel", "milxdy-reminet-chat-root", "beetol-hunter-root"]) document.getElementById(id)?.remove();
    } else { bootFeaturesWithRecovery(); }
  `;
  verifyMultiSiteRuntimeUi({ manifest, content: goodContent });
  assert.throws(() => verifyBundledUiBoundary(goodContent.replace('mode !== "bridgeOnly"', "true")), /exclude bridge-only/);
  assert.throws(() => verifyBundledUiBoundary(goodContent.replace('mode === "bridgeOnly"', "false")), /explicit bridge-only branch/);
  assert.throws(() => verifyBundledUiBoundary(goodContent.replace("milxdy-overlay-dock-root", "missing-dock-root")), /missing milxdy-overlay-dock-root/);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--self-test")) {
    selfTest();
    console.log("Multi-site runtime UI verifier self-test passed.");
  } else {
    const outputArg = process.argv.find((arg) => arg.startsWith("--build-output="));
    const output = resolve(outputArg?.slice("--build-output=".length) || "dist/chromium");
    const manifestPath = resolve(output, "manifest.json");
    const contentPath = resolve(output, "content.js");
    assert.ok(existsSync(manifestPath) && existsSync(contentPath), `Build output is incomplete: ${output}`);
    verifyMultiSiteRuntimeUi({
      manifest: JSON.parse(readFileSync(manifestPath, "utf8")),
      content: readFileSync(contentPath, "utf8"),
    });
    console.log(`Multi-site runtime UI verification passed for ${output}.`);
  }
}
