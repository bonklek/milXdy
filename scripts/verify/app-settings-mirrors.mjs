import { readFile } from "node:fs/promises";
import { ignoredProfilePackSections } from "../../src/platform/settings/profile-pack-sections.ts";

const registry = JSON.parse(await readFile("src/platform/app-sdk/first-party-apps.json", "utf8"));
const popupSource = await readFile("src/extension/popup/index.ts", "utf8");
const popupHtml = await readFile("assets/extension/popup/popup.html", "utf8");
const postReadingDefaults = await readFile("src/apps/post-reading/shared/defaults.ts", "utf8");
const firstPartyAppsSource = await readFile("src/platform/app-sdk/first-party-registry.ts", "utf8");
const contextualSettingSources = new Map([
  ["tweetPng", await readFile("examples/packages/first-party-replacements/tweetPng/src/content.ts", "utf8")],
]);

const failures = [];
const notes = [];

const popupBindings = parsePopupBindings(popupSource);
const popupControls = new Set(Array.from(popupHtml.matchAll(/data-control="([^"]+)"/g), (match) => match[1]));
const visualEditorProperties = parseVisualEditorProperties(popupSource);
const popupBindingAliases = new Map([
  ["remistats.sounds.enabled", "remistats.soundsEnabled"],
  ["remistats.sounds.volume", "remistats.soundVolume"],
]);

const generatedFeatureSettings = registry.flatMap((app) => {
  if (app.packageKind !== "feature") return [];
  return (app.settings || [])
    .filter((setting) => (
      setting.location === "appsAndFeatures"
      && setting.scope === "feature"
      && setting.advanced !== true
      && setting.control?.type !== "action"
      && setting.control?.type !== "status"
    ))
    .map((setting) => ({ app, setting }));
});

const popupEnablementControls = new Map([
  ["composerTools.enabled", "composerTools.enabled"],
  ["post-reading.enabled", "post-reading.enabled"],
  ["miladymaxxer.mode", "milady.mode"],
  ["beetol.enabled", "remistats.beetol.enabled"],
]);
const appEnablementOverrides = new Map([
  ["wikiSidebar.enabled", { propertyWrite: "sidebarEnabled", legacyFallbackProperty: "enabled" }],
  ["miladymaxxer.mode", { modeValues: ["milady", "off"] }],
]);
const appEnablementCases = registry.filter((app) => app.packageKind === "app").flatMap((app) => (app.settings || [])
  .filter((setting) => setting.role === "enablement")
  .map((setting) => ({
    appId: app.id,
    settingId: setting.id,
    popupControl: popupEnablementControls.get(setting.id),
    ...(appEnablementOverrides.get(setting.id) || {}),
  })));

const appSurfacePopupMirrorCases = [
  { settingId: "post-reading.voiceURI", popupControl: "post-reading.voiceURI" },
];

for (const { app, setting } of generatedFeatureSettings) {
  verifyGeneratedFeatureMirror(app, setting);
}

for (const entry of appEnablementCases) {
  verifyAppEnablement(entry);
}

for (const entry of appSurfacePopupMirrorCases) {
  verifyPopupMirror(entry);
}

verifyProfilePackUnsupportedSections();
verifyPostReadingFullQuoteOptInDefaults();

printResults();
if (failures.length > 0) process.exit(1);

function verifyGeneratedFeatureMirror(app, setting) {
  const popupBindingId = popupBindingAliases.get(setting.id) || setting.id;
  const binding = popupBindings.get(popupBindingId);
  if (binding) {
    compareStorage(setting, binding, `${app.id}:${setting.id} popup mirror`);
    requirePopupControl(popupBindingId, `${app.id}:${setting.id}`);
    return;
  }

  if (setting.role === "enablement") {
    requireSourceIncludes(firstPartyAppsSource, "genericEnablementAdapter", `${app.id}:${setting.id}: generic Apps & Features enablement adapter is missing`);
    notes.push(`${setting.id}: enablement is owned by the generated Apps & Features control.`);
    return;
  }

  if (setting.storage?.key === "milxdy.settings.visualTheme" && setting.storage?.property) {
    const elementId = visualEditorProperties.get(setting.storage.property);
    const contextualSource = contextualSettingSources.get(app.id) || "";
    if (!elementId && contextualSource.includes(`data-setting="${setting.storage.property}"`)) {
      notes.push(`${setting.id}: visual setting is mirrored by the package-owned contextual review dialog.`);
      return;
    }
    if (!elementId) {
      fail(`${app.id}:${setting.id}: visualTheme property ${setting.storage.property} has no popup visual-editor mirror`);
      return;
    }
    return;
  }

  fail(`${app.id}:${setting.id}: generated feature setting has no popup binding or visual-theme editor mirror`);
}

function verifyAppEnablement(entry) {
  const app = appById(entry.appId);
  const setting = settingById(entry.settingId);
  if (!app) {
    fail(`${entry.appId}: missing app registry row`);
    return;
  }
  if (!setting) {
    fail(`${entry.settingId}: missing setting metadata`);
    return;
  }
  if (app.packageKind !== "app" || setting.scope !== "app" || setting.location !== "appsAndFeatures") {
    fail(`${entry.settingId}: app enablement control is not declared as an app-owned Apps & Features setting`);
  }
  if (setting.role !== "enablement") {
    fail(`${entry.settingId}: app enablement control must declare role "enablement"`);
  }
  if (entry.popupControl) {
    const binding = popupBindings.get(entry.popupControl);
    if (!binding) fail(`${entry.settingId}: missing popup binding ${entry.popupControl}`);
    else compareStorage(setting, binding, `${entry.settingId} popup mirror`);
    requirePopupControl(entry.popupControl, entry.settingId);
  } else {
    if (popupBindings.has(entry.settingId)) fail(`${entry.settingId}: Apps & Features-only enablement must not have a popup binding`);
    if (popupControls.has(entry.settingId)) fail(`${entry.settingId}: Apps & Features-only enablement must not have a popup control`);
    notes.push(`${entry.settingId}: no popup mirror is expected; Apps & Features adapter/storage path was checked.`);
  }
  requireSetEnabledStorage(entry, setting);
  requireDistinctEnablementStorage(entry, setting);
}

function verifyPopupMirror(entry) {
  const setting = settingById(entry.settingId);
  if (!setting) {
    fail(`${entry.settingId}: missing setting metadata`);
    return;
  }
  const binding = popupBindings.get(entry.popupControl);
  if (!binding) {
    fail(`${entry.settingId}: missing popup binding ${entry.popupControl}`);
    return;
  }
  compareStorage(setting, binding, `${entry.settingId} popup mirror`);
  requirePopupControl(entry.popupControl, entry.settingId);
  notes.push(`${entry.settingId}: remains a popup/app-surface mirror and is intentionally not generated in Apps & Features yet.`);
}

function requireSetEnabledStorage(entry, setting) {
  const sourceNeedles = [setting.storage.key];
  if (setting.storage.property || entry.propertyWrite) sourceNeedles.push(setting.storage.property || entry.propertyWrite);
  for (const needle of sourceNeedles) {
    if (!needle || firstPartyAppsSource.includes(needle)) continue;
    fail(`${entry.settingId}: first-party enablement adapter does not reference ${needle}`);
  }
  if (entry.modeValues) {
    for (const value of entry.modeValues) {
      if (!firstPartyAppsSource.includes(`"${value}"`)) fail(`${entry.settingId}: enablement adapter does not preserve ${value} mode writes`);
    }
  }
  if (entry.legacyFallbackProperty) {
    const fallbackNeedle = `${setting.storage.property} ?? settings.${entry.legacyFallbackProperty}`;
    if (!firstPartyAppsSource.includes(fallbackNeedle)) {
      fail(`${entry.settingId}: enablement adapter must migrate by falling back from ${setting.storage.property} to legacy ${entry.legacyFallbackProperty}`);
    }
  }
}

function requireDistinctEnablementStorage(entry, setting) {
  if (entry.settingId !== "wikiSidebar.enabled") return;
  const wikiLinks = settingById("wiki.enabled");
  if (!wikiLinks) {
    fail("wiki.enabled: missing setting metadata");
    return;
  }
  if (storageId(setting.storage) === storageId(wikiLinks.storage)) {
    fail("wikiSidebar.enabled: must not share storage with wiki.enabled; sidebar and inline wiki links are independently controllable");
  }
}

function verifyProfilePackUnsupportedSections() {
  const ignored = ignoredProfilePackSections({ sections: ["appearance", "performance", "apps", "rail", "layout"] });
  if (ignored.join(",") !== "apps,rail,layout") fail(`profile packs must classify unsupported import sections; got ${ignored.join(",")}`);
  if (!popupSource.includes("ignoredProfilePackSections(pack)")) fail("profile pack import status must use the shared unsupported-section classifier");
}

function verifyPostReadingFullQuoteOptInDefaults() {
  requireSourceIncludes(postReadingDefaults, "fetchFullQuotes: false", "post-reading fetchFullQuotes shared default must stay opt-in");
  requireSourceIncludes(postReadingDefaults, "fullQuoteDisplay: \"hidden\"", "post-reading fullQuoteDisplay shared default must stay hidden");
  requireSourceIncludes(popupSource, "\"post-reading.fetchFullQuotes\": { area: \"sync\", key: \"fetchFullQuotes\", kind: \"boolean\", fallback: false }", "post-reading fetchFullQuotes popup fallback must stay off");
  requireSourceIncludes(popupSource, "\"post-reading.fullQuoteDisplay\": { area: \"sync\", key: \"fullQuoteDisplay\", kind: \"string\", fallback: \"hidden\" }", "post-reading fullQuoteDisplay popup fallback must stay hidden");
}

function requirePopupControl(controlId, label) {
  if (!popupControls.has(controlId)) fail(`${label}: popup.html lacks data-control="${controlId}"`);
}

function requireSourceIncludes(source, needle, message) {
  if (!source.includes(needle)) fail(message);
}

function compareStorage(setting, binding, label) {
  const actual = storageId(setting.storage);
  const expected = storageId(binding);
  if (actual !== expected) fail(`${label}: manifest storage ${actual} does not match popup storage ${expected}`);
}

function appById(id) {
  return registry.find((app) => app.id === id);
}

function settingById(id) {
  for (const app of registry) {
    const setting = (app.settings || []).find((entry) => entry.id === id);
    if (setting) return setting;
  }
  return null;
}

function storageId(storage) {
  return `${storage.area}:${storage.key}${storage.property ? `.${storage.property}` : ""}`;
}

function parsePopupBindings(source) {
  const constants = new Map(Array.from(
    source.matchAll(/const\s+([A-Z0-9_]+)\s*=\s*"([^"]+)"/g),
    (match) => [match[1], match[2]],
  ));
  const bindings = new Map();
  const bindingPattern = /^\s{2}(?:"([^"]+)"|([A-Za-z0-9_$]+)):\s*\{\s*area:\s*"([^"]+)",\s*key:\s*([^,}]+)(?:,\s*property:\s*"([^"]+)")?/gm;
  for (const match of source.matchAll(bindingPattern)) {
    const id = match[1] || match[2];
    const key = resolveBindingKey(match[4], constants);
    bindings.set(id, {
      area: match[3],
      key,
      property: match[5],
    });
  }
  return bindings;
}

function resolveBindingKey(raw, constants) {
  const value = raw.trim();
  if (value.startsWith("\"") && value.endsWith("\"")) return value.slice(1, -1);
  return constants.get(value) || value;
}

function parseVisualEditorProperties(source) {
  const normalizedSource = source.replace(/\r\n/g, "\n");
  const properties = new Map();
  const functionStart = normalizedSource.indexOf("function readVisualEditor(): VisualThemeSettings");
  const startToken = "return normalizeVisualTheme({";
  const bodyStart = functionStart >= 0 ? normalizedSource.indexOf(startToken, functionStart) : -1;
  const bodyEnd = bodyStart >= 0 ? normalizedSource.indexOf("\n  });", bodyStart) : -1;
  const body = bodyStart >= 0 && bodyEnd > bodyStart
    ? normalizedSource.slice(bodyStart + startToken.length, bodyEnd)
    : "";
  const propertyPattern = /^\s*([A-Za-z0-9_]+):\s*(?:checkedValue|selectValue|numberInputValue)\("([^"]+)"\)/gm;
  for (const match of body.matchAll(propertyPattern)) {
    properties.set(match[1], match[2]);
  }
  return properties;
}

function fail(message) {
  failures.push(message);
}

function printResults() {
  console.log("App settings mirror verification");
  console.log(`  generated feature settings checked: ${generatedFeatureSettings.length}`);
  console.log(`  app enablement settings checked: ${appEnablementCases.length}`);
  console.log(`  app-surface popup mirrors checked: ${appSurfacePopupMirrorCases.length}`);
  if (notes.length > 0) {
    console.log("  notes:");
    for (const note of notes) console.log(`  - ${note}`);
  }
  if (failures.length > 0) {
    console.error(`  failures: ${failures.length}`);
    for (const failure of failures) console.error(`  - ${failure}`);
    return;
  }
  console.log("  failures: none");
  console.log("App settings mirror verification passed.");
}
