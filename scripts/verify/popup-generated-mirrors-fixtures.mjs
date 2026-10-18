import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { generatedPopupMirrors } from "./popup-generated-mirrors.mjs";
const registry = JSON.parse(await readFile("src/platform/app-sdk/first-party-apps.json", "utf8"));
const sources = {
  popupSource: await readFile("src/extension/popup/index.ts", "utf8"),
  popupHtml: await readFile("assets/extension/popup/popup.html", "utf8"),
  bundledSource: await readFile("src/extension/popup/bundled-app-settings.ts", "utf8"),
};
const actual = generatedPopupMirrors(registry, sources);
for (const id of ["composerTools.enabled", "remistats.sounds.enabled", "remistats.sounds.volume"]) assert(actual.has(id), id);
for (const [field, from, to, missing] of [
  ["popupSource", "setupBundledAppSettings(FIRST_PARTY_APPS);", "", "composerTools.enabled"],
  ["popupSource", "setupBundledAppSettings(FIRST_PARTY_APPS, true);", "", "remistats.sounds.enabled"],
  ["popupHtml", 'id="bundledAppsList"', 'id="missingBundledAppsList"', "composerTools.enabled"],
  ["popupHtml", 'id="appSoundGroups"', 'id="missingSoundGroups"', "remistats.sounds.volume"],
  ["bundledSource", 'getElementById(soundsOnly ? "appSoundGroups" : "bundledAppsList")', 'getElementById("absent")', "composerTools.enabled"],
  ["bundledSource", "control.dataset.bundledSetting = setting.id", "control.dataset.unboundSetting = setting.id", "composerTools.enabled"],
  ["bundledSource", "[setting.storage.property]: value", "unrelated: value", "composerTools.enabled"],
  ["bundledSource", "storage.set({ [setting.storage.key]: bundledSettingPatch", "storage.set({ unrelated: bundledSettingPatch", "composerTools.enabled"],
]) {
  assert(sources[field].includes(from), `fixture target exists: ${from}`);
  assert(!generatedPopupMirrors(registry, { ...sources, [field]: sources[field].replace(from, to) }).has(missing), missing);
}
assert.deepEqual(actual.get("remistats.sounds.volume"), registry.find(app => app.id === "remistats").settings.find(setting => setting.id === "remistats.sounds.volume").storage);
console.log("Generated popup mirror fixtures passed: actual contracts and eight missing-wiring/storage negatives.");
