import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const packagesRoot = "examples/packages/first-party-replacements";
const registry = JSON.parse(await readFile("src/platform/app-sdk/first-party-apps.json", "utf8"));
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const firstPartyById = new Map(registry.map((app) => [app.id, app]));
const builtInStorageKeys = builtInRegistryStorageKeys(registry);

const failures = [];
const notes = [];

const validPackageKinds = new Set(["app", "feature", "theme"]);
const validSurfaces = new Set(["tweet", "xArticle", "userCell", "notification", "directMessage", "profile", "route", "overlayApp"]);
const validLifecycleModes = new Set(["runtime", "invoked"]);
const validInvocationTriggers = new Set(["userAction"]);
const validLoadTriggers = new Set(["startup", "surface", "dockOpen", "idle", "userAction"]);
const validSites = new Set(["x", "remiliaNet", "remiliaWiki", "miladychan"]);
const validSiteIntegrations = new Set(["contentScript", "backgroundService", "embeddedFrame", "overlayApp"]);
const validSitePresentations = new Set(["sideRailOverlay", "hostRouteOverlay", "userAction"]);
const validRouteMatchTypes = new Set(["exact", "prefix"]);
const validSettingAreas = new Set(["local", "sync"]);
const validSettingScopes = new Set(["global", "app", "feature"]);
const validSettingLocations = new Set(["appearance", "appsAndFeatures", "appSurface", "advanced"]);
const validSettingRoles = new Set(["preference", "enablement", "open", "reset"]);
const validControlTypes = new Set(["toggle", "select", "segmented", "slider", "number", "text", "textarea", "action", "status"]);
const validResetBehaviors = new Set(["removeKey", "restoreDefault", "restoreAppDefault", "custom"]);
const validPresets = new Set(["lite", "balanced", "full"]);
const validSettingPresets = new Set(["visual", "audio", "performance", "firstRun", "profilePack"]);
const validPrivacyLabels = new Set(["local-only", "browser-session", "remote-api", "local-files", "diagnostics"]);
const validReviewStatuses = new Set(["local", "reviewed", "blocked"]);
const validAssetKinds = new Set(["icon", "image", "style", "font", "audio", "worker", "wasm", "html", "other"]);
const sensitiveGeneratedStorageNeedles = [
  "accesstoken",
  "auth",
  "apikey",
  "cache",
  "cookie",
  "credential",
  "diagnostic",
  "file",
  "folder",
  "localpath",
  "path",
  "private",
  "queue",
  "secret",
  "session",
  "token",
];
const currentSdkVersion = packageJson.appSdkVersion;
const forbiddenManifestFields = new Set([
  "available",
  "unavailableReason",
  "isEnabled",
  "setEnabled",
  "entryName",
  "entryPoint",
  "assets",
  "requiredOutputs",
]);
const forbiddenCssFields = new Set(["source", "target", "targetDir"]);
const requiredManifestFields = [
  "manifestVersion",
  "id",
  "name",
  "version",
  "description",
  "packageKind",
  "sdk",
  "contentEntry",
  "defaultEnabled",
  "storageKeys",
  "surfaces",
  "cost",
  "loadTriggers",
  "hub",
  "privacy",
  "package",
];

const packageDirs = existsSync(packagesRoot)
  ? readdirSync(packagesRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory())
  : [];

if (packageDirs.length < 2) fail("local package pilots must include at least two package roots");
if (typeof currentSdkVersion !== "string") fail("package.json must declare appSdkVersion for local app package SDK compatibility");

const seenIds = new Set();
const packageKinds = new Set();

for (const entry of packageDirs) {
  await verifyPackage(path.join(packagesRoot, entry.name), entry.name);
}

if (!packageKinds.has("feature")) fail("local package pilots must include at least one feature package");
if (!packageKinds.has("app")) fail("local package pilots must include at least one app package");

printResults();
if (failures.length > 0) process.exit(1);

async function verifyPackage(packageDir, folderName) {
  const manifestPath = path.join(packageDir, "milxdy.app.json");
  if (!existsSync(manifestPath)) {
    fail(`${folderName}: missing milxdy.app.json`);
    return;
  }

  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    fail(`${folderName}: unable to parse manifest JSON: ${error.message}`);
    return;
  }

  const label = manifest.id || folderName;
  for (const field of requiredManifestFields) {
    if (!hasOwn(manifest, field)) fail(`${label}: missing required local package field ${field}`);
  }
  for (const field of Object.keys(manifest)) {
    if (forbiddenManifestFields.has(field)) fail(`${label}: local package manifest must not include first-party runtime/build field ${field}`);
  }
  if (manifest.id !== folderName) fail(`${label}: package folder name must match manifest id`);
  if (seenIds.has(manifest.id)) fail(`${label}: duplicate package id`);
  seenIds.add(manifest.id);

  const firstParty = firstPartyById.get(manifest.id);
  if (!firstParty) {
    fail(`${label}: pilot package id must map to an existing first-party registry app`);
  } else {
    if (manifest.packageKind !== firstParty.packageKind) fail(`${label}: packageKind must match first-party reference metadata`);
    const missingSettingIds = (manifest.settings || [])
      .map((setting) => setting.id)
      .filter((id) => !(firstParty.settings || []).some((setting) => setting.id === id));
    if (missingSettingIds.length > 0) fail(`${label}: package settings must map to first-party setting ids: ${missingSettingIds.join(", ")}`);
    notes.push(`${label}: maps to first-party ${firstParty.packageKind} reference metadata`);
  }

  if (manifest.manifestVersion !== 1) fail(`${label}: manifestVersion must be 1`);
  if (!validPackageKinds.has(manifest.packageKind)) fail(`${label}: unsupported packageKind ${manifest.packageKind}`);
  else packageKinds.add(manifest.packageKind);
  if (typeof manifest.defaultEnabled !== "boolean") fail(`${label}: defaultEnabled must be boolean`);
  verifySdk(label, manifest.sdk);
  verifyPaths(label, packageDir, manifest);
  verifyStorageAndSettings(label, manifest);
  await verifyLifecycleAndSites(label, packageDir, manifest);
  verifyKindRules(label, manifest);
  verifyHubAndPrivacy(label, manifest);
  verifyBackgroundCapabilities(label, manifest);
  verifyCost(label, manifest.cost);
  verifyReview(label, manifest.review);
}

function verifySdk(label, sdk) {
  if (!sdk || typeof sdk.minVersion !== "string") fail(`${label}: sdk.minVersion is required`);
  if (sdk?.targetVersion !== undefined && typeof sdk.targetVersion !== "string") fail(`${label}: sdk.targetVersion must be a string when declared`);
  if (typeof currentSdkVersion === "string") {
    if (sdk?.minVersion !== currentSdkVersion) fail(`${label}: sdk.minVersion must match package.json appSdkVersion ${currentSdkVersion}`);
    if (sdk?.targetVersion !== currentSdkVersion) fail(`${label}: sdk.targetVersion must match package.json appSdkVersion ${currentSdkVersion}`);
  }
}

function verifyPaths(label, packageDir, manifest) {
  if (!/\.m?js$/i.test(manifest.contentEntry || "")) {
    fail(`${label}: contentEntry must be an executable .js or .mjs module`);
  }
  verifyDeclaredFile(label, packageDir, manifest.contentEntry, "contentEntry");
  for (const sheet of manifest.css || []) {
    for (const field of Object.keys(sheet)) {
      if (forbiddenCssFields.has(field)) fail(`${label}: css entry must not include first-party build field ${field}`);
    }
    verifyDeclaredFile(label, packageDir, sheet.path, `css ${sheet.id || "<unknown>"}`);
  }
  for (const asset of manifest.package?.assets || []) {
    if (!validAssetKinds.has(asset.kind)) fail(`${label}: package asset ${asset.path} has unsupported kind ${asset.kind}`);
    verifyDeclaredFile(label, packageDir, asset.path, `asset ${asset.id || asset.path}`);
  }
  for (const assetPath of manifest.package?.webAccessibleAssets || []) {
    verifyDeclaredFile(label, packageDir, assetPath, `webAccessibleAsset ${assetPath}`);
  }
  for (const iconPath of dockIconPaths(manifest.dock?.icon)) {
    verifyDeclaredFile(label, packageDir, iconPath, "dock icon");
  }
}

function verifyDeclaredFile(label, packageDir, value, fieldLabel) {
  if (!isSafeRelativePath(value)) {
    fail(`${label}: ${fieldLabel} must be a safe package-relative path`);
    return;
  }
  if (!existsSync(path.join(packageDir, value))) fail(`${label}: declared ${fieldLabel} does not exist: ${value}`);
}

function isSafeRelativePath(value) {
  if (typeof value !== "string" || value.length === 0) return false;
  if (path.isAbsolute(value)) return false;
  const normalized = path.normalize(value);
  return normalized === value.replaceAll("/", path.sep) && !normalized.startsWith("..") && !normalized.split(path.sep).includes("..");
}

function dockIconPaths(icon) {
  if (!icon) return [];
  if (typeof icon === "string") return [icon];
  return [icon.light, icon.dark].filter(Boolean);
}

function verifyStorageAndSettings(label, manifest) {
  const storageKeys = manifest.storageKeys || {};
  for (const [area, keys] of Object.entries(storageKeys)) {
    if (!validSettingAreas.has(area)) fail(`${label}: unsupported storageKeys area ${area}`);
    if (!Array.isArray(keys)) fail(`${label}: storageKeys.${area} must be an array`);
    if (!firstPartyById.has(manifest.id)) {
      for (const key of keys || []) {
        if (builtInStorageKeys.has(`${area}:${key}`)) fail(`${label}: storageKeys.${area} cannot claim built-in registry storage key ${key}`);
      }
    }
  }
  for (const setting of manifest.settings || []) {
    const settingLabel = `${label}:${setting.id || "<unknown setting>"}`;
    if (!setting.id || !setting.label || !setting.scope || !setting.location) fail(`${settingLabel}: missing id/label/scope/location`);
    if (!validSettingScopes.has(setting.scope)) fail(`${settingLabel}: invalid scope ${setting.scope}`);
    if (!validSettingLocations.has(setting.location)) fail(`${settingLabel}: invalid location ${setting.location}`);
    if (setting.role !== undefined && !validSettingRoles.has(setting.role)) fail(`${settingLabel}: invalid role ${setting.role}`);
    if (!setting.storage || !validSettingAreas.has(setting.storage.area) || !setting.storage.key) {
      fail(`${settingLabel}: invalid storage metadata`);
    } else if (!storageKeys[setting.storage.area]?.includes(setting.storage.key)) {
      fail(`${settingLabel}: setting storage key must be declared in storageKeys.${setting.storage.area}`);
    }
    const storageLabel = `${setting.id || ""}.${setting.storage?.key || ""}.${setting.storage?.property || ""}`;
    if (isSensitiveGeneratedStorageName(storageLabel)) {
      fail(`${settingLabel}: generated settings controls must not expose auth, session, token, cookie, API-key, private cache, diagnostic, queue, local file, folder, or path storage`);
    }
    if (!firstPartyById.has(manifest.id) && builtInStorageKeys.has(`${setting.storage?.area}:${setting.storage?.key}`)) {
      fail(`${settingLabel}: setting storage key collides with built-in registry storage`);
    }
    if (!setting.control || !validControlTypes.has(setting.control.type)) fail(`${settingLabel}: invalid control metadata`);
    if ((setting.control?.type === "select" || setting.control?.type === "segmented") && !Array.isArray(setting.control.options) && !setting.control.dynamicOptions) {
      fail(`${settingLabel}: select-like controls must declare static or dynamic options`);
    }
    if (!setting.reset || !validResetBehaviors.has(setting.reset.behavior)) fail(`${settingLabel}: invalid reset metadata`);
    for (const preset of setting.presets || []) {
      if (!validSettingPresets.has(preset)) fail(`${settingLabel}: invalid setting preset ${preset}`);
    }
  }
}

function isSensitiveGeneratedStorageName(value) {
  const normalized = String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return sensitiveGeneratedStorageNeedles.some((needle) => normalized.includes(needle));
}

function builtInRegistryStorageKeys(apps) {
  const keys = new Set();
  for (const app of apps) {
    for (const [area, storageKeys] of Object.entries(app.storageKeys || {})) {
      for (const key of storageKeys || []) {
        if (typeof key === "string" && key.length > 0) keys.add(`${area}:${key}`);
      }
    }
    for (const setting of app.settings || []) {
      if (setting.storage?.area && setting.storage?.key) keys.add(`${setting.storage.area}:${setting.storage.key}`);
    }
  }
  return keys;
}

async function verifyLifecycleAndSites(label, packageDir, manifest) {
  const content = existsSync(path.join(packageDir, manifest.contentEntry))
    ? await readFile(path.join(packageDir, manifest.contentEntry), "utf8")
    : "";
  const exports = lifecycleExports(content);
  const lifecycle = manifest.lifecycle;

  for (const surface of manifest.surfaces || []) {
    if (!validSurfaces.has(surface)) fail(`${label}: unsupported surface ${surface}`);
  }
  for (const trigger of manifest.loadTriggers || []) {
    if (!validLoadTriggers.has(trigger)) fail(`${label}: unsupported load trigger ${trigger}`);
  }

  if (!lifecycle || !validLifecycleModes.has(lifecycle.mode)) {
    fail(`${label}: lifecycle.mode must be declared as runtime or invoked`);
  } else if (lifecycle.mode === "invoked") {
    if (lifecycle.invokedBy !== "userAction" || !validInvocationTriggers.has(lifecycle.invokedBy)) fail(`${label}: invoked lifecycle must declare invokedBy userAction`);
    if (!lifecycle.reason) fail(`${label}: invoked lifecycle must declare a platform load reason`);
    if (!manifest.loadTriggers?.every((trigger) => trigger === "userAction")) fail(`${label}: invoked packages must use only userAction load triggers`);
    if ((manifest.surfaces || []).length > 0) fail(`${label}: invoked packages must not declare runtime delivery surfaces`);
    if (exports.has("boot")) fail(`${label}: invoked package placeholder must not export boot()`);
  } else {
    if (!exports.has("boot")) fail(`${label}: runtime package content entry must export boot()`);
  }

  if ((manifest.surfaces || []).includes("overlayApp") || manifest.loadTriggers?.includes("dockOpen") || manifest.dock) {
    if (!exports.has("open") || !exports.has("close")) fail(`${label}: docked/overlay package content entry must export open() and close()`);
  }

  const scopes = manifest.siteScopes || [];
  if (!Array.isArray(scopes) || scopes.length === 0) fail(`${label}: siteScopes must declare at least one integration scope`);
  for (const scope of scopes) {
    if (!validSites.has(scope.site)) fail(`${label}: unsupported site ${scope.site}`);
    if (!validSiteIntegrations.has(scope.integration)) fail(`${label}: unsupported site integration ${scope.integration}`);
    if (!Array.isArray(scope.hosts) || scope.hosts.length === 0) {
      fail(`${label}: site scope must declare hosts`);
    } else {
      for (const host of scope.hosts) {
        if (!validSiteHostPattern(host)) fail(`${label}: invalid site host pattern ${host}`);
      }
    }
    if (!Array.isArray(scope.surfaces) || scope.surfaces.length === 0) {
      fail(`${label}: site scope must declare surfaces`);
    } else {
      for (const surface of scope.surfaces) {
        if (!validSurfaces.has(surface)) fail(`${label}: site scope declares unsupported surface ${surface}`);
      }
    }
    if (scope.presentation !== undefined && !validSitePresentations.has(scope.presentation)) fail(`${label}: invalid site presentation ${scope.presentation}`);
    for (const route of scope.routes || []) {
      if (!validRouteMatchTypes.has(route.type)) fail(`${label}: invalid route match type ${route.type}`);
      if (typeof route.path !== "string" || !route.path.startsWith("/")) fail(`${label}: route paths must start with /`);
      if (route.surface !== undefined && !scope.surfaces.includes(route.surface)) fail(`${label}: route surface must be included in scope surfaces`);
    }
  }

  for (const host of manifest.permissions?.hosts || []) {
    if (!scopes.some((scope) => scope.hosts?.includes(host))) {
      fail(`${label}: permission host ${host} must be represented by a matching site scope host`);
    }
  }
}

function verifyKindRules(label, manifest) {
  if (manifest.packageKind === "feature") {
    if (manifest.dock) fail(`${label}: feature packages must not declare dock metadata`);
    if (manifest.hub?.rail?.supported) fail(`${label}: feature packages must not support rail pinning`);
  }
  if (manifest.packageKind === "app") {
    if (manifest.hub?.rail?.supported && !manifest.dock?.label) fail(`${label}: rail-supported app packages must declare dock metadata`);
  }
  if (manifest.packageKind === "theme") {
    if ((manifest.surfaces || []).length > 0) fail(`${label}: theme packages must not declare runtime surfaces in the current package contract`);
    if (manifest.permissions?.hosts?.length > 0) fail(`${label}: theme packages must not request host permissions in the current package contract`);
    if (manifest.background) fail(`${label}: theme packages must not declare background services in the current package contract`);
  }
}

function verifyHubAndPrivacy(label, manifest) {
  const hub = manifest.hub || {};
  if (!hub.category || !hub.shortDescription) fail(`${label}: hub category and shortDescription are required`);
  if (!hub.rail || typeof hub.rail.supported !== "boolean" || typeof hub.rail.defaultPinned !== "boolean") fail(`${label}: hub rail metadata is required`);
  for (const preset of hub.presets || []) {
    if (!validPresets.has(preset)) fail(`${label}: invalid hub preset ${preset}`);
  }
  if (!Array.isArray(hub.presets) || hub.presets.length === 0) fail(`${label}: hub presets are required`);

  const privacy = manifest.privacy || {};
  for (const field of ["permissionNotes", "dataNotes", "localStorageNotes", "privacyLabels"]) {
    if (!Array.isArray(privacy[field])) fail(`${label}: privacy.${field} must be an array`);
  }
  for (const labelName of privacy.privacyLabels || []) {
    if (!validPrivacyLabels.has(labelName)) fail(`${label}: invalid privacy label ${labelName}`);
  }
  if (JSON.stringify(hub.dataNotes || []) !== JSON.stringify(privacy.dataNotes || [])) fail(`${label}: privacy.dataNotes must mirror hub.dataNotes for package review`);
  if (JSON.stringify(hub.localStorageNotes || []) !== JSON.stringify(privacy.localStorageNotes || [])) fail(`${label}: privacy.localStorageNotes must mirror hub.localStorageNotes for package review`);
  if (JSON.stringify(hub.privacyLabels || []) !== JSON.stringify(privacy.privacyLabels || [])) fail(`${label}: privacy.privacyLabels must mirror hub.privacyLabels for package review`);

  const remoteServices = new Set([...(hub.remoteServices || []), ...(privacy.remoteServices || [])]);
  const hosts = manifest.permissions?.hosts || [];
  if (remoteServices.size > 0 || hosts.length > 0 || manifest.cost?.network !== "none") {
    if (!Array.isArray(hub.permissionNotes) || hub.permissionNotes.length === 0) fail(`${label}: network/permission package must include hub.permissionNotes`);
    if (!Array.isArray(privacy.permissionNotes) || privacy.permissionNotes.length === 0) fail(`${label}: network/permission package must include privacy.permissionNotes`);
    if (!privacy.privacyLabels?.some((value) => value === "remote-api" || value === "browser-session" || value === "local-files")) {
      fail(`${label}: network/permission package must disclose matching privacy labels`);
    }
    if (privacy.consentRequired !== true) fail(`${label}: network/permission package must require consent before enablement`);
  }
}

function verifyBackgroundCapabilities(label, manifest) {
  const messageTypes = manifest.background?.messageTypes || [];
  const services = manifest.background?.services || [];
  for (const field of Object.keys(manifest.background || {})) {
    if (field !== "messageTypes" && field !== "services") {
      fail(`${label}: background.${field} is unsupported for local packages; background declarations are metadata-only and do not create handlers`);
    }
  }
  for (const type of messageTypes) {
    if (!validBackgroundMessagePattern(type)) fail(`${label}: background message type must be exact namespace:action or trailing namespace:* wildcard: ${type}`);
    else if (!backgroundMessageOwnedByPackage(label, type)) fail(`${label}: background message type ${type} must use the package-owned namespace ${label}:*`);
  }
  if (new Set(messageTypes).size !== messageTypes.length) fail(`${label}: duplicate background message type declaration`);
  if (services.length > 0) {
    fail(`${label}: background.services is not supported for local packages yet; declare no services until package-owned background handlers are implemented`);
  }
  if (messageTypes.length === 0 && services.length === 0) return;
  if (!Array.isArray(manifest.privacy?.permissionNotes) || manifest.privacy.permissionNotes.length === 0) {
    fail(`${label}: background capabilities require privacy.permissionNotes review disclosure`);
  }
  if (manifest.privacy?.consentRequired !== true) {
    fail(`${label}: background capabilities require consent before enablement`);
  }
}

function validBackgroundMessagePattern(value) {
  return typeof value === "string" && /^[a-z][A-Za-z0-9-]*:(?:[A-Za-z0-9._-]+|\*)$/.test(value);
}

function backgroundMessageOwnedByPackage(packageId, value) {
  return typeof value === "string" && value.startsWith(`${packageId}:`);
}

function verifyCost(label, cost) {
  for (const field of ["startup", "perSurface", "network", "worker", "domWrite"]) {
    if (!cost?.[field]) fail(`${label}: cost.${field} is required`);
  }
}

function verifyReview(label, review) {
  if (!review) return;
  if (!validReviewStatuses.has(review.status)) fail(`${label}: invalid review status ${review.status}`);
}

function validSiteHostPattern(value) {
  if (typeof value !== "string" || !/^(https?|wss):\/\/[^/*\s/?#@:]+(?::[0-9]+)?\/\*$/.test(value)) return false;
  const originText = value.slice(0, -2);
  let parsed;
  try {
    parsed = new URL(originText);
  } catch {
    return false;
  }
  if (!["http:", "https:", "wss:"].includes(parsed.protocol)) return false;
  if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) return false;
  if (!parsed.hostname || parsed.hostname.includes("*")) return false;
  return parsed.origin === originText;
}

function lifecycleExports(source) {
  const names = new Set();
  const regex = /export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g;
  for (const match of source.matchAll(regex)) names.add(match[1]);
  return names;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function fail(message) {
  failures.push(message);
}

function printResults() {
  console.log("Local app package pilot verification");
  console.log(`  package roots checked: ${packageDirs.length}`);
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
  console.log("Local app package pilot verification passed.");
}
