import { readFile } from "node:fs/promises";

const requireLive = process.argv.includes("--require-live");
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const evidencePath = "docs/evidence/remilia-api-migration/qa-results.json";
const evidence = JSON.parse(await readFile(evidencePath, "utf8"));

const currentGuides = [
  "README.md",
  "docs/INDEX.md",
  "docs/getting-started/INSTALL_AND_UPDATE.md",
  "docs/getting-started/PRIVACY_AND_PERMISSIONS.md",
  "docs/getting-started/REMILIA_ACCOUNT.md",
  "docs/getting-started/TROUBLESHOOTING.md",
  "docs/guides/README.md",
  "docs/guides/beetol.md",
  "docs/guides/remistats.md",
  "docs/guides/reminet-chat.md",
  "docs/guides/tweet-png.md",
  "docs/contributors/REMILIA_API_MIGRATION.md",
  "docs/contributors/REMILIA_API_QA.md",
  "docs/releases/RELEASE_NOTES_0.2.5.md",
  "docs/sdk/APP_SDK.md",
  "docs/sdk/APP_SDK_OVERVIEW.md",
  "sdk/README.md",
  "sdk/types/index.d.ts",
];

const files = new Map(await Promise.all(currentGuides.map(async (path) => [path, await readFile(path, "utf8")])));
const allCurrentGuides = Array.from(files, ([path, text]) => `\n--- ${path} ---\n${text}`).join("");
const [beetolContent, beetolBackground, reminetBeetleBridge, postReadingFullQuote] = await Promise.all([
  readFile("src/apps/beetol/content.js", "utf8"),
  readFile("src/apps/beetol/background.js", "utf8"),
  readFile("src/extension/frames/reminet-chat-bridge.ts", "utf8"),
  readFile("src/apps/post-reading/fullQuote.ts", "utf8"),
]);

const staleInstructions = [
  [/\bRetry session\b/i, "Retry session instruction"],
  [/\bOpen RemiliaNET\b[^.\n]*(?:reuse|adopt|restore|refresh)[^.\n]*(?:milXdy|connector|extension)[^.\n]*(?:session|login|connection)/i, "website-session connector restoration instruction"],
  [/reus(?:e|es|ing) the RemiliaNET browser session/i, "browser-session reuse instruction"],
  [/browser-session SSO/i, "browser-session SSO instruction"],
  [/RemiliaNET `authToken` cookie/i, "authToken-cookie instruction"],
  [/briefly open[^.]*inactive tab/i, "hidden-tab refresh instruction"],
  [/browser `cookies` permission[^.]*RemiliaNET/i, "RemiliaNET cookies-permission instruction"],
  [/uses the RemiNet connector login/i, "retired connector-login instruction"],
  [/assumes? a 24-hour poke cooldown/i, "invented fixed poke cooldown instruction"],
  [/session\/auth and socket bridges remain/i, "retired website-session auth bridge instruction"],
];

for (const [pattern, label] of staleInstructions) {
  const match = pattern.exec(allCurrentGuides);
  assert(!match, `${label} remains in current documentation near: ${context(allCurrentGuides, match?.index)}`);
}

for (const [source, pattern, label] of [
  [beetolContent, /beetol-retry-session|beetol:sessionStatus|beetol:logout|remilia-auth:/i, "retired Beetol content auth operation"],
  [beetolContent, /Sign in[\s\S]{0,120}RemiliaNET[\s\S]{0,120}(?:return|retry)|RemiliaNET[\s\S]{0,120}(?:return|retry)[\s\S]{0,120}Beetol/i, "website-sign-in/return/retry Beetol instruction"],
  [beetolContent, /type:\s*["']beetol:(?:action|crunchJunk)["']|data-action|Use the visible RemiliaNET Beetle control/i, "action-looking or circular Beetol content interaction"],
  [beetolBackground, /beetol:sessionStatus|beetol:logout|disconnectRemiliaAuth|clearRemiliaAuth/i, "retired Beetol background auth operation"],
]) {
  assert(!pattern.test(source), `${label} remains in source`);
}
for (const required of [
  "Open the milXdy extension popup, then use Remilia connection &rarr; Connect/Reconnect.",
  "type: 'beetol:authStatus'",
  "Official read-only status",
  "Actions run in RemiliaNET's visible Beetle game.",
  "Play Beetle on RemiliaNET",
  "?cartridge=beetle",
  'target="_blank" rel="noopener noreferrer"',
]) {
  assert(beetolContent.includes(required), `Beetol content must retain passive popup/auth-status boundary ${JSON.stringify(required)}`);
}
for (const required of [
  "nativeBeetleActionResponse(action)",
  "NATIVE_ACTION_REQUIRED",
  "actionMode: 'native-remilianet'",
  "readOfficialBeetleSnapshot(officialBeetleReads)",
]) {
  assert(beetolBackground.includes(required), `Beetol native/official boundary must include ${JSON.stringify(required)}`);
}
for (const forbidden of [
  "/api/beetle/action/",
  "Authorization",
  "fetch(",
  "prepareRemiliaAccess",
  "refreshRemiliaAccess",
  "credentials: 'include'",
  "chrome.tabs.create",
  "chrome.windows.create",
]) {
  assert(!beetolBackground.includes(forbidden), `Beetol background must not retain native-action transport ${JSON.stringify(forbidden)}`);
}
for (const required of [
  "trustedNativeBeetleActionFor(event, instantResultsEnabled)",
  "observeNativeBeetleAction(action)",
  "data-milxdy-reminet-beetle-native-acceleration",
  "The trusted click continues to RemiliaNET's native handler",
]) {
  assert(reminetBeetleBridge.includes(required), `RemiliaNET native Beetle pass-through must include ${JSON.stringify(required)}`);
}
for (const forbidden of [
  '{ type: "beetol:action", action }',
  "event.preventDefault()",
  "event.stopImmediatePropagation()",
  "remilia-auth:",
]) {
  assert(!reminetBeetleBridge.includes(forbidden), `RemiliaNET native Beetle pass-through must not include ${JSON.stringify(forbidden)}`);
}

const directFullQuoteContract = `const response = await fetch(url, {
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
    signal,
  });
  if (!response.ok) throw new Error(\`Text fetch failed: \${response.status}\`);
  return await response.text();`;
assert(postReadingFullQuote.includes(directFullQuoteContract), "Post-reading direct full-quote fallback must omit credentials, reject redirects, suppress referrers, honor abort, check status, and return text");

const migration = files.get("docs/contributors/REMILIA_API_MIGRATION.md");
const normalizedMigration = migration.replace(/\s+/g, " ");
for (const required of [
  "https://www.remilia.net/api/v1",
  "remilia:stats.read",
  "remilia:notifications.read",
  "remilia:pokes.write",
  "remilia:beetle.read",
  "remilia:chat.read",
  "remilia:chat.write",
  "remilia:directory.read",
  "RemiNet WebSocket acceleration",
  "RemiNet media upload/confirm",
  "`catchBeetle`, `beetleHunt`, `claimUBC`, and `junkFaucet`",
  "equivalent user-delegated craft including per-recipe failures",
  "documented public shelf asset/read",
  "limit=50",
  "100-page bound",
  "500 opaque keys",
  "90-day retention",
  "429 poke_cooldown",
  "offline-fallback",
  "https://api.remistats.net/user/{x-handle}",
  "at most 50 identifiers",
  "six hours",
  "15 minutes",
  "300 public-profile misses",
  "conflicting duplicates are never negative cached",
  "authoritative handle rebind",
  "Browser-session adoption, cookie mutation, hidden-tab refresh",
  "App SDK Capability Broker",
  "sole production Remilia API path for content and package principals",
  "must not call `remiliaApi:request` directly",
  "remilia.profile.public",
  "remilia.pokes.write",
  "Per invocation with active user gesture",
  "opaque 32-hex values",
  "expire within 12 hours",
  "Production registration installs the capability broker",
  "credential_isolation",
  "unacknowledgeable errors",
  "rejected before status lookup",
  "never connected identity, granted/missing scopes",
  "reject redirects",
  "send no referrer",
  "Official API-v1 REST is the only chat history authority",
  "`/api/chats/1/messages`",
  "body-free reconciliation hints",
  "current official scopes do not authorize these endpoints",
  "Attachment requests fail closed before token access or network work",
  "no-cookie/no-redirect/no-referrer boundary",
  "revalidate the final URL",
]) {
  assert(normalizedMigration.includes(required), `migration contract must include ${JSON.stringify(required)}`);
}

const privacy = files.get("docs/getting-started/PRIVACY_AND_PERMISSIONS.md");
const normalizedPrivacy = privacy.replace(/\s+/g, " ");
for (const required of [
  "OIDC Authorization Code with PKCE",
  "trusted extension background",
  "remilia:stats.read",
  "remilia:chat.write",
  "temporary legacy adapters",
  "does not use the browser `cookies` permission for Remilia authentication",
  "Post-reading provides direct-message read-aloud",
  "does not establish an on-device speech guarantee",
  "DM text is excluded from custom TTS, audio export, OCR, full-quote retrieval",
  "message references are transient",
]) {
  assert(normalizedPrivacy.includes(required), `privacy guide must include ${JSON.stringify(required)}`);
}

const sdk = files.get("docs/sdk/APP_SDK.md");
const normalizedSdk = sdk.replace(/\s+/g, " ");
for (const required of [
  "Remilia capability broker",
  "authenticated arbitrary fetch",
  "bearer or refresh token",
  "sole production Remilia API path for content and package principals",
  "must not call the internal `remiliaApi:request` route",
  "require consent per invocation plus an active user gesture",
  "expire within 12 hours",
  "cannot be acknowledged through",
]) {
  assert(normalizedSdk.includes(required), `App SDK reference must include ${JSON.stringify(required)}`);
}

const install = files.get("docs/getting-started/INSTALL_AND_UPDATE.md").replace(/\s+/g, " ");
for (const required of [
  "tpa-milxdy",
  "idlmhjcedjkmbkndigbiobfjadhlmgki",
  "https://idlmhjcedjkmbkndigbiobfjadhlmgki.chromiumapp.org/remilia-oauth",
  "dist/chromium",
  "keyless",
]) {
  assert(install.includes(required), `install guide must include release identity boundary ${JSON.stringify(required)}`);
}

const accountGuide = files.get("docs/getting-started/REMILIA_ACCOUNT.md").replace(/\s+/g, " ");
for (const required of [
  "RemiliaNET connection",
  "Connect through Remilia Login",
  "Delete old login data",
  "Log in with RemiliaNET",
  "Revoke authorization",
  "Remilia connection is unavailable in this build",
  "Popup close/reopen and an MV3 worker restart",
  "extension reload or a full browser restart",
  "completed migration remains durable",
]) {
  assert(accountGuide.includes(required), `account guide must include final connection UI contract ${JSON.stringify(required)}`);
}

const userGuide = files.get("docs/guides/README.md").replace(/\s+/g, " ");
for (const required of [
  "successful poke invents no cooldown",
  "Official REST owns history, polling, text, and reply posting",
  "DM reading always uses browser Web Speech",
]) {
  assert(userGuide.includes(required), `user guide must include ${JSON.stringify(required)}`);
}

const firefoxGuide = await readFile("docs/contributors/FIREFOX_QA.md", "utf8");
for (const required of ["keyless", "UNSUPPORTED", "no identity client/callback claim", "cookie/session", "non-auth"]) {
  assert(firefoxGuide.includes(required), `Firefox guide must include compatibility boundary ${JSON.stringify(required)}`);
}

const requiredCaseIds = [
  "migration-prompt",
  "connect-pkce",
  "connect-fail-closed",
  "scope-status",
  "disconnect-revoke",
  "restart-refresh",
  "public-profile",
  "connected-profile",
  "directory-resolution",
  "stats",
  "notifications",
  "poke-cooldown",
  "beetle-reads",
  "beetle-legacy-actions",
  "chat-history-post",
  "chat-reconnect",
  "chat-legacy-realtime",
  "chat-legacy-media",
  "post-factory-isolation",
  "error-separation",
  "keyboard-screen-reader",
  "dm-read-aloud-privacy",
];
const requiredFirefoxCaseIds = [
  "firefox-no-client",
  "firefox-unsupported-ui",
  "firefox-no-fallback",
  "firefox-no-token-leakage",
  "firefox-public-profile",
  "firefox-non-auth",
  "firefox-build",
];

const candidateEvidence = files.get("docs/contributors/REMILIA_API_QA.md").replace(/\s+/g, " ");
for (const required of [
  "browser-local Web Speech only",
  "does not convert a manual row into live acceptance",
  "checksums",
  "private browser observations",
]) {
  assert(candidateEvidence.toLowerCase().includes(required.toLowerCase()), `QA guide must include ${JSON.stringify(required)}`);
}

const releaseMedia = files.get("docs/releases/RELEASE_NOTES_0.2.5.md").replace(/\s+/g, " ");
for (const required of ["experimental prerelease", "Firefox", "dual-auth", "separate", "sign-in"]) {
  assert(releaseMedia.includes(required), `release notes must include ${JSON.stringify(required)}`);
}

assert(evidence.schemaVersion === 1, `${evidencePath}: schemaVersion must be 1`);
assert(evidence.release === packageJson.version, `${evidencePath}: release must match package version`);
assert(Array.isArray(evidence.results), `${evidencePath}: results must be an array`);
assertEqualList(evidence.results.map((result) => result.id).sort(), [...requiredCaseIds].sort(), `${evidencePath}: case IDs`);
assert(Array.isArray(evidence.firefoxCompatibility), `${evidencePath}: firefoxCompatibility must be an array`);
assertEqualList(evidence.firefoxCompatibility.map((result) => result.id).sort(), [...requiredFirefoxCaseIds].sort(), `${evidencePath}: Firefox compatibility case IDs`);

for (const result of evidence.results) {
  assert(["pending", "pass", "fail", "blocked"].includes(result.chromium), `${result.id}: invalid Chromium status`);
  assert(result.note === null || isRedactedNote(result.note), `${result.id}: note must be null or a short redacted string`);
}
for (const result of evidence.firefoxCompatibility) {
  assert(["pending", "pass", "fail"].includes(result.status), `${result.id}: invalid Firefox compatibility status`);
  assert(result.note === null || isRedactedNote(result.note), `${result.id}: note must be null or a short redacted string`);
}

if (requireLive) {
  assert(/^[a-f0-9]{40}$/.test(String(evidence.sourceCommit || "")), `${evidencePath}: live evidence requires a full source commit`);
  for (const browser of ["chromium", "firefoxCompatibility"]) {
    const identity = evidence.browsers?.[browser];
    for (const field of ["browserVersion", "buildId", "testedAt", "tester"]) {
      assert(typeof identity?.[field] === "string" && identity[field].trim(), `${evidencePath}: ${browser}.${field} is required for live evidence`);
    }
    assert(!containsSensitiveEvidence(identity), `${evidencePath}: ${browser} identity contains prohibited private data`);
  }
  for (const result of evidence.results) {
    assert(result.chromium === "pass", `${result.id}: Chromium live acceptance is ${result.chromium}, expected pass`);
  }
  for (const result of evidence.firefoxCompatibility) {
    assert(result.status === "pass", `${result.id}: Firefox compatibility acceptance is ${result.status}, expected pass`);
  }
  console.log(`Remilia migration live evidence passed for ${evidence.sourceCommit}.`);
} else {
  const pending = evidence.results.reduce((count, result) => count + Number(result.chromium !== "pass"), 0)
    + evidence.firefoxCompatibility.reduce((count, result) => count + Number(result.status !== "pass"), 0);
  console.log(`Remilia migration static contracts passed (${pending} manual browser result(s) not yet recorded as pass).`);
}

function containsSensitiveEvidence(value) {
  const text = JSON.stringify(value);
  return /(?:[A-Za-z]:[\\/](?:Users|Documents)[\\/]|\/(?:Users|home)\/|Bearer\s+[A-Za-z0-9._~-]{12,}|eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}\.)/i.test(text);
}

function isRedactedNote(value) {
  return typeof value === "string" && value.length <= 500 && !containsSensitiveEvidence(value);
}

function context(text, index) {
  if (!Number.isInteger(index)) return "unknown location";
  return JSON.stringify(text.slice(Math.max(0, index - 50), index + 120).replace(/\s+/g, " "));
}

function assertEqualList(actual, expected, label) {
  assert(actual.join("\n") === expected.join("\n"), `${label} mismatch\nexpected: ${expected.join(", ")}\nactual: ${actual.join(", ")}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
