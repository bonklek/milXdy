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
const [beetolContent, beetolBackground, postReadingFullQuote] = await Promise.all([
  readFile("src/apps/beetol/content.js", "utf8"),
  readFile("src/apps/beetol/background.js", "utf8"),
  readFile("src/apps/post-reading/fullQuote.ts", "utf8"),
]);

const staleInstructions = [
  [/\bRetry session\b/i, "Retry session instruction"],
  [/\bOpen RemiliaNET\b/i, "Open RemiliaNET instruction"],
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
  [beetolBackground, /beetol:sessionStatus|beetol:logout|disconnectRemiliaAuth|clearRemiliaAuth/i, "retired Beetol background auth operation"],
]) {
  assert(!pattern.test(source), `${label} remains in source`);
}
for (const required of [
  "Open the milXdy extension popup, then use Remilia connection &rarr; Connect/Reconnect.",
  "type: 'beetol:authStatus'",
]) {
  assert(beetolContent.includes(required), `Beetol content must retain passive popup/auth-status boundary ${JSON.stringify(required)}`);
}
for (const required of [
  "if (result.status === 401 && retry)",
  "credentials: 'omit'",
  "redirect: 'error'",
  "referrerPolicy: 'no-referrer'",
  "isExactResponseUrl(response.url, endpoint)",
]) {
  assert(beetolBackground.includes(required), `Beetol legacy transport must include ${JSON.stringify(required)}`);
}
assert(!/result\.status\s*===\s*403[\s\S]{0,160}refreshAccessToken|refreshAccessToken[\s\S]{0,160}result\.status\s*===\s*403/.test(beetolBackground), "Beetol legacy transport must never refresh after 403");

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
  "Background injects the delegated token",
  "browser credentials are omitted",
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
  "Direct-message read-aloud is a stricter local boundary",
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
  "dist/chromium-beta",
  "keyless",
]) {
  assert(install.includes(required), `install guide must include beta identity boundary ${JSON.stringify(required)}`);
}

const accountGuide = files.get("docs/getting-started/REMILIA_ACCOUNT.md").replace(/\s+/g, " ");
for (const required of [
  "Official Remilia connection",
  "Connect through Remilia Login",
  "Delete old login data",
  "Connect with Remilia",
  "Revoke authorization",
  "Remilia connection is unavailable in Firefox",
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
  "a7b3caedf5d7f94d3a4fb8af45e0f6185a687e9f",
  "0b2376e66ac3a8f302ca71831dc871052165ae58",
  "1e4c9cae7551252c264addb5439f5be157d6e1aa56adc94faa5be33a86102245",
  "3e014f073d7d10c86392e901af6c1e262bbaf3a77d8e0416fd57a9d0105197e9",
  "8bff62a878e857dc1cfd25e80a292fd7790d0d41fc2236d033a51596868d86ed",
  "a6f64ffa2dd14ef460e591cbfaba129be69216c25e02a9c372fadb552a6976a8",
  "01ca79910d26266ca4b89681ea5998da454c140aa7e4e776ae008123bb2b9fa3",
  "99b316f54c2fb350f3a02dd5bea21b797b2f280afe6f6db2c1826ee54a8a8985",
  "9e4f54212af30502be6156c0cb3204f5d4e19bddb1b4d1078ac437c760e2c915",
  "| Reproducible Chromium archive | `08012dad1de7dff08f96077c83bdb41b48a83843a78f611e2ebb96b9c19a1768` |",
  "| Reproducible Firefox archive | `8f6371c43cd717d85872e63c8143a6fce5e603d1ca429d70195c84e82593db1a` |",
  "| Deterministic Remilia migration artifact report | `3ce5a5461abc4746093e0da763f785d7ba5228540f094f77ecfa028fc1baa725` |",
  "superseded",
  "`.pnpm` versus canonical `node_modules` module labels",
  "browser-local Web Speech only",
  "Public changelog, roadmap, and prior release notes remain",
  "does not convert an automated result into live acceptance",
]) {
  assert(candidateEvidence.includes(required), `candidate evidence must include ${JSON.stringify(required)}`);
}

const releaseMedia = files.get("docs/releases/RELEASE_NOTES_0.2.5.md").replace(/\s+/g, " ");
for (const required of [
  "This is candidate copy",
  "intentionally keyless",
  "Privacy-safe screenshot brief",
  "Never capture tokens",
  "Screenshots are release media, not evidence",
]) {
  assert(releaseMedia.includes(required), `release media brief must include ${JSON.stringify(required)}`);
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
