import { readFile } from "node:fs/promises";

const fullQuote = await readFile("src/apps/post-reading/fullQuote.ts", "utf8");
const background = await readFile("src/apps/post-reading/background.ts", "utf8");
const urlPolicy = await readFile("src/apps/post-reading/urlPolicy.ts", "utf8");
const player = await readFile("src/apps/post-reading/player.ts", "utf8");
const popupHtml = await readFile("assets/extension/popup/popup.html", "utf8");
const manifest = JSON.parse(await readFile("assets/extension/manifest.json", "utf8"));
const registry = await readFile("src/platform/app-sdk/first-party-apps.json", "utf8");
const releaseBuilds = await readFile("scripts/release/release-builds.mjs", "utf8");
const standaloneBuilder = await readFile("scripts/build/build-post-reading-distribution.mjs", "utf8");
const privacyDocs = await readFile("docs/getting-started/PRIVACY_AND_PERMISSIONS.md", "utf8");
const userGuide = await readFile("docs/guides/README.md", "utf8");
const postReadingGuide = await readFile("docs/guides/post-reading.md", "utf8");

const failures = [];

forbid(fullQuote, /\bdocument\.cookie\b/, "fullQuote must not read page cookies");
forbid(fullQuote, /\bct0\b/i, "fullQuote must not reference X/Twitter CSRF cookie material");
forbid(fullQuote, /\bBearer\b/i, "fullQuote must not discover or reuse bearer tokens");
forbid(fullQuote, /\bx-csrf-token\b/i, "fullQuote must not send CSRF headers");
forbid(fullQuote, /\bauthorization\b/i, "fullQuote must not send authorization headers");
forbid(fullQuote, /\bTweetResultByRestId\b/, "fullQuote must not target X GraphQL TweetResultByRestId");
forbid(fullQuote, /\/i\/api\/graphql\//, "fullQuote must not call X GraphQL endpoints");
forbid(fullQuote, /\bqueryId\b/, "fullQuote must not discover X GraphQL query IDs");
forbid(fullQuote, /\bfetchGraphQl|\bdiscoverGraphQl|\bextractGraphQl|\bgraphQlFeatures\b|\bgraphQlFieldToggles\b/i, "fullQuote must not keep the credentialed GraphQL fetch path");
forbid(fullQuote, /credentials:\s*["']include["']/, "fullQuote direct fetches must not include browser credentials");
forbid(fullQuote, /createElement\(["']iframe["']\)|frame\.src\s*=/, "fullQuote must not load hidden X/Twitter frames that can carry ambient browser credentials");
requireIncludes(fullQuote, 'credentials: "omit"', "fullQuote public HTML/oEmbed fetches must omit credentials");
requireIncludes(fullQuote, 'type: "post-reading:fetchJson"', "fullQuote should keep public syndication JSON fallback");
requireIncludes(fullQuote, 'type: "post-reading:fetchText"', "fullQuote should keep public text fallback through the background bridge");
requireIncludes(fullQuote, 'const data = await fetchJson(endpoint.toString(), signal)', "fullQuote oEmbed fallback must use the background JSON bridge");
requireIncludes(fullQuote, 'cache.set(normalizedUrl, null);', "fullQuote should cache graceful public-source misses instead of retrying uncaught HTML fetches");
requireIncludes(fullQuote, 'return { text: null, status: "no-text", attempts };', "fullQuote should return a structured no-text result when public sources miss");
forbid(fullQuote, /const\s+text\s*=\s*await\s+fetchHtmlText\(normalizedUrl,\s*signal\);\s*cache\.set\(normalizedUrl,\s*text\);/s, "fullQuote must not repeat an uncaught HTML fetch after handled public-source misses");
forbid(fullQuote, /fetch\s*\(\s*endpoint\.toString\(\)/, "fullQuote must not fetch publish.twitter.com/oembed directly from content code");
requireIncludes(fullQuote, "https://publish.twitter.com/oembed", "fullQuote should fetch public oEmbed from publish.twitter.com");
requireIncludes(fullQuote, "https://cdn.syndication.twimg.com/tweet-result", "fullQuote should fetch public syndication JSON from cdn.syndication.twimg.com");

requireIncludes(background, 'credentials: "omit"', "post-reading background fetch bridge must omit credentials for all resource fetches");
requireIncludes(background, "AbortSignal.any([signal, createBackgroundNetworkDeadlineSignal()])", "post-reading background fetch bridge must cancel queued fetches and stalled response reads");
requireIncludes(background, 'url.hostname === "cdn.syndication.twimg.com"', "post-reading background bridge must allow the public syndication JSON endpoint");
requireIncludes(background, 'url.pathname === "/tweet-result"', "post-reading background bridge must pin the public syndication JSON path");
requireIncludes(background, 'url.hostname === "publish.twitter.com"', "post-reading background bridge must allow the public oEmbed JSON endpoint");
requireIncludes(background, 'isAllowedPublishTwitterOembedUrl(url)', "post-reading background bridge must validate the public oEmbed JSON endpoint");
requireIncludes(urlPolicy, 'url.pathname !== "/oembed"', "post-reading oEmbed policy must pin the public oEmbed JSON path");
requireIncludes(urlPolicy, 'url.searchParams.get("url")', "post-reading oEmbed policy must inspect the nested status URL");
requireIncludes(urlPolicy, 'normalizeXStatusUrl', "post-reading oEmbed policy must use host-strict X/Twitter status URL normalization");
requireIncludes(urlPolicy, 'if (!X_STATUS_HOSTS.has(url.hostname)) return null;', "post-reading status URL normalization must reject hostile status hosts");
requireIncludes(background, 'if (message.type === "post-reading:fetchJson") return MAX_JSON_RESPONSE_BYTES;', "post-reading background bridge must cap oEmbed JSON responses through the JSON byte ceiling");
requireIncludes(background, 'normalized.startsWith("application/json") || normalized.startsWith("text/javascript")', "post-reading background bridge must require JSON-compatible content types for oEmbed");
forbid(background, /credentials:\s*message\.type\s*===\s*["']post-reading:fetchText["']/, "post-reading text bridge must not special-case credentialed fetches");
forbid(background, /url\.pathname\s*===\s*["']\/home["']/, "post-reading text bridge must not fetch the active X home shell");
forbid(background, /abs\.twimg\.com/, "post-reading text bridge must not fetch X/Twitter script bundles");
forbid(background, /endsWith\(["']\.twimg\.com["']\)/, "post-reading text bridge must not fetch X/Twitter script bundles");
forbid(background, /responsive-web\/client-web/, "post-reading text bridge must not fetch X/Twitter client script bundles");

requireIncludes(player, "Fetch full quoted posts from public sources", "Post-reading settings label must not claim active-session fetching");
forbid(player, /Fetch full quoted posts using active X\/Twitter session/, "Post-reading settings label must not offer active-session full quote fetching");
requireIncludes(popupHtml, "without browser cookies or session tokens", "Popup Post-reading full-quote copy must disclose credentialless fetching");
forbid(popupHtml, /active X\/Twitter session/i, "Popup Post-reading full-quote copy must not claim active-session fetching");

for (const [name, source] of [
  ["firstPartyApps", registry],
  ["release builds", releaseBuilds],
  ["standalone builder", standaloneBuilder],
  ["privacy docs", privacyDocs],
  ["user guide", userGuide],
  ["post-reading guide", postReadingGuide],
]) {
  forbid(source, /full-quote fetching may use the active X\/Twitter session/i, `${name} must not claim full-quote active-session use`);
  forbid(source, /Fetch full quotes[^.\n]+active X\/Twitter session/i, `${name} must not claim full-quote active-session use`);
}

for (const [name, source] of [
  ["firstPartyApps", registry],
  ["privacy docs", privacyDocs],
  ["user guide", userGuide],
  ["post-reading guide", postReadingGuide],
]) {
  if (!/without [^\n.]*browser cookies/i.test(source)) failures.push(`${name} must document credentialless full-quote behavior`);
}

for (const host of ["https://publish.twitter.com/*", "https://cdn.syndication.twimg.com/*"]) {
  if (!manifest.host_permissions?.includes(host)) failures.push(`public manifest missing Post-reading public full-quote host ${host}`);
  requireIncludes(releaseBuilds, `"${host}"`, `release builds missing Post-reading public full-quote host ${host}`);
  requireIncludes(standaloneBuilder, `"${host}"`, `standalone builder missing Post-reading public full-quote host ${host}`);
  requireIncludes(registry, `"${host}"`, `first-party metadata missing Post-reading public full-quote host ${host}`);
}

for (const service of ["publish.twitter.com", "cdn.syndication.twimg.com"]) {
  for (const [name, source] of [
    ["firstPartyApps", registry],
    ["privacy docs", privacyDocs],
    ["user guide", userGuide],
    ["post-reading guide", postReadingGuide],
  ]) {
    requireIncludes(source, service, `${name} must disclose Post-reading public full-quote service ${service}`);
  }
}

if (failures.length > 0) {
  console.error("Post-reading full-quote privacy verification failed:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("Post-reading full-quote privacy verification passed.");

function requireIncludes(source, needle, message) {
  if (!source.includes(needle)) failures.push(message);
}

function forbid(source, pattern, message) {
  if (pattern.test(source)) failures.push(message);
}
