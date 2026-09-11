// Validate declared package capabilities without reading files or deciding build trust.
const remiliaCapabilityContracts = new Map([
  ["remilia.profile.public", { operations: ["getUserProfile"], scopes: [], consent: "enablement" }],
  ["remilia.profile.me", { operations: ["getMe"], scopes: [], consent: "enablement" }],
  ["remilia.directory.read", { operations: ["resolveDirectory", "listDirectoryUsers"], scopes: ["remilia:directory.read"], consent: "enablement" }],
  ["remilia.stats.read", { operations: ["getMyStats"], scopes: ["remilia:stats.read"], consent: "enablement" }],
  ["remilia.notifications.read", { operations: ["listMyNotifications"], scopes: ["remilia:notifications.read"], consent: "enablement" }],
  ["remilia.pokes.write", { operations: ["pokeUser"], scopes: ["remilia:pokes.write"], consent: "perInvocation" }],
  ["remilia.beetle.read", { operations: ["getMyBeetle", "getMyBeetleCards"], scopes: ["remilia:beetle.read"], consent: "enablement" }],
  ["remilia.chat.read", { operations: ["listGlobalChatMessages"], scopes: ["remilia:chat.read"], consent: "enablement" }],
  ["remilia.chat.write", { operations: ["postGlobalChatMessage"], scopes: ["remilia:chat.write"], consent: "perInvocation" }],
]);

export function verifyBackgroundCapabilities(label, manifest, fail) {
  verifyHostActions(label, manifest, fail);
  verifyStorageResources(label, manifest, fail);
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

/** Validate closed public host-action and retention-policy declarations. */
export function verifyHostActions(label, manifest, fail) {
  if (manifest.hostActions === undefined) return;
  if (!Array.isArray(manifest.hostActions) || manifest.hostActions.length > 1) {
    fail(`${label}: hostActions must contain at most one reviewed host action`);
    return;
  }
  if (new Set(manifest.hostActions).size !== manifest.hostActions.length) fail(`${label}: duplicate host action declaration`);
  for (const action of manifest.hostActions) {
    if (action !== "wiki.openPage") fail(`${label}: unsupported host action ${String(action)}`);
  }
}

/** A resource policy cannot grant access to a key that storageKeys did not declare. */
export function verifyStorageResources(label, manifest, fail) {
  if (manifest.storageResources === undefined) return;
  if (!Array.isArray(manifest.storageResources)) {
    fail(`${label}: storageResources must be an array`);
    return;
  }
  const seen = new Set();
  for (const resource of manifest.storageResources) {
    if (!resource || typeof resource !== "object" || Array.isArray(resource)) {
      fail(`${label}: each storage resource must be an object`);
      continue;
    }
    const { area, key, kind, reset } = resource;
    if ((area !== "local" && area !== "sync") || typeof key !== "string" || !key) {
      fail(`${label}: storage resource requires a declared local or sync key`);
      continue;
    }
    if (!["settings", "cache", "authoredData", "sensitiveData"].includes(kind)) {
      fail(`${label}: storage resource ${area}.${key} has an unsupported kind`);
    }
    if (reset !== undefined && reset !== "reset" && reset !== "preserve") {
      fail(`${label}: storage resource ${area}.${key} has an unsupported reset policy`);
    }
    const identity = `${area}:${key}`;
    if (seen.has(identity)) fail(`${label}: duplicate storage resource ${area}.${key}`);
    seen.add(identity);
    if (!(manifest.storageKeys?.[area] || []).includes(key)) {
      fail(`${label}: storage resource ${area}.${key} must also appear in storageKeys.${area}`);
    }
  }
}

export function verifyRemiliaCapabilities(label, manifest, fail) {
  const declarations = manifest.remiliaCapabilities;
  if (declarations === undefined) return;
  if (!Array.isArray(declarations) || declarations.length < 1 || declarations.length > remiliaCapabilityContracts.size) {
    fail(`${label}: remiliaCapabilities must contain between one and ${remiliaCapabilityContracts.size} declarations`);
    return;
  }
  if (manifest.review?.status !== "reviewed") fail(`${label}: Remilia capabilities require review.status reviewed`);
  if (manifest.privacy?.consentRequired !== true) fail(`${label}: Remilia capabilities require privacy.consentRequired true`);
  if (!manifest.privacy?.privacyLabels?.includes("remote-api")) fail(`${label}: Remilia capabilities require the remote-api privacy label`);
  const disclosure = [...(manifest.privacy?.permissionNotes || []), ...(manifest.privacy?.dataNotes || []), ...(manifest.privacy?.remoteServices || []), ...(manifest.hub?.permissionNotes || []), ...(manifest.hub?.dataNotes || []), ...(manifest.hub?.remoteServices || [])].join(" ").toLowerCase();
  if (!/credential|token|cookie|authorization/.test(disclosure) || !/remilia/.test(disclosure)) fail(`${label}: Remilia capabilities require explicit Remilia credential-isolation privacy disclosure`);
  const ids = new Set();
  for (const declaration of declarations) {
    if (!declaration || typeof declaration !== "object" || Array.isArray(declaration)) {
      fail(`${label}: each Remilia capability declaration must be an object`);
      continue;
    }
    for (const field of Object.keys(declaration)) {
      if (!["id", "operations", "scopes", "consent", "reason"].includes(field)) fail(`${label}: Remilia capability ${declaration.id || "<unknown>"} includes unsupported field ${field}`);
    }
    const contract = remiliaCapabilityContracts.get(declaration.id);
    if (!contract) {
      fail(`${label}: unsupported Remilia capability ${declaration.id}`);
      continue;
    }
    if (ids.has(declaration.id)) fail(`${label}: duplicate Remilia capability ${declaration.id}`);
    ids.add(declaration.id);
    if (!Array.isArray(declaration.operations) || declaration.operations.length === 0 || new Set(declaration.operations).size !== declaration.operations.length
      || !declaration.operations.every((operation) => contract.operations.includes(operation))) {
      fail(`${label}: Remilia capability ${declaration.id} must declare only its exact reviewed operations`);
    }
    if (!sameStringSet(declaration.scopes, contract.scopes)) fail(`${label}: Remilia capability ${declaration.id} must declare its exact official scopes`);
    if (declaration.consent !== contract.consent) fail(`${label}: Remilia capability ${declaration.id} consent must be ${contract.consent}`);
    if (typeof declaration.reason !== "string" || declaration.reason.trim().length < 8 || declaration.reason.length > 280) fail(`${label}: Remilia capability ${declaration.id} requires a bounded review reason`);
  }
}

function sameStringSet(value, expected) {
  return Array.isArray(value) && value.length === expected.length && new Set(value).size === value.length && value.every((item) => expected.includes(item));
}

function validBackgroundMessagePattern(value) {
  return typeof value === "string" && /^[a-z][A-Za-z0-9-]*:(?:[A-Za-z0-9._-]+|\*)$/.test(value);
}

function backgroundMessageOwnedByPackage(packageId, value) {
  return typeof value === "string" && value.startsWith(`${packageId}:`);
}
