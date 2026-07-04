import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const builder = await readFile("scripts/build/build-post-reading-distribution.mjs", "utf8");
const releaseGate = await readFile("scripts/release/verify-release-gates.mjs", "utf8");
const fullQuoteSource = await readFile("src/apps/post-reading/fullQuote.ts", "utf8");
const postReadingBackgroundSource = await readFile("src/apps/post-reading/background.ts", "utf8");
const postReadingUrlPolicySource = await readFile("src/apps/post-reading/urlPolicy.ts", "utf8");
const chromiumOutput = path.join("dist", "post-reading-chromium");

assert(typeof packageJson.scripts?.["build:post-reading"] === "string", "package scripts must include build:post-reading");
assert(typeof packageJson.scripts?.["verify:post-reading:distribution"] === "string", "package scripts must include verify:post-reading:distribution");
assert(typeof packageJson.scripts?.["verify:post-reading:standalone"] === "string", "package scripts must include verify:post-reading:standalone");
assert(packageJson.scripts["verify:post-reading:standalone"] === packageJson.scripts["verify:post-reading:distribution"], "verify:post-reading:standalone must remain a compatibility alias for verify:post-reading:distribution");
assert(releaseGate.includes("scripts/verify/post-reading-distribution.mjs"), "current release gate must verify the Post-reading distribution contract");
assert(builder.includes("MILXDY_BUILD_PROFILE: JSON.stringify(\"post-reading\")"), "Post-reading distribution build must define the Post-reading build profile");
assert(builder.includes("MILXDY_VERSION: JSON.stringify(packageJson.version)"), "Post-reading distribution build must use package.json version");
assert(!/\bct0\b/.test(fullQuoteSource), "Post-reading full quotes must not read X/Twitter ct0 session cookies");
assert(!/TweetResultByRestId|\/i\/api\/graphql|queryId\s*:|x-csrf-token|x-twitter-auth-type|OAuth2Session/.test(fullQuoteSource), "Post-reading full quotes must not reconstruct authenticated X GraphQL requests");
assert(!/extractBearerToken|authorization:\s*`?Bearer|Bearer\s+\[/.test(fullQuoteSource), "Post-reading full quotes must not extract or reuse X/Twitter bearer material");
assert(!/getLikelyXScriptUrls|fetchSameOriginText|responsive-web\/client-web/.test(fullQuoteSource), "Post-reading full quotes must not scan X/Twitter app scripts for session API material");
assert(!/createElement\(["']iframe["']\)|frame\.src\s*=/.test(fullQuoteSource), "Post-reading full quotes must not load hidden X/Twitter frames with browser session state");
assert(!/credentials:\s*"include"/.test(fullQuoteSource), "Post-reading full quote content fetches must not include ambient browser credentials");
assert(!/fetch\s*\(\s*endpoint\.toString\(\)/.test(fullQuoteSource), "Post-reading oEmbed fallback must not fetch publish.twitter.com directly from content code");
assert(fullQuoteSource.includes("const data = await fetchJson(endpoint.toString(), signal)"), "Post-reading oEmbed fallback must use the background JSON bridge");
assert(!/credentials:\s*message\.type\s*===\s*"post-reading:fetchText"\s*\?\s*"include"/.test(postReadingBackgroundSource), "Post-reading background text fetches must not include ambient browser credentials");
assert(!/credentials:\s*"include"/.test(postReadingBackgroundSource), "Post-reading background fetches must not include ambient browser credentials");
assert(!/url\.pathname\s*===\s*"\/home"|responsive-web\/client-web/.test(postReadingBackgroundSource), "Post-reading background fetch allowlist must not expose X shell or app script fetches");
assert(postReadingBackgroundSource.includes('url.hostname === "publish.twitter.com"'), "Post-reading background JSON bridge must allow the public oEmbed host");
assert(postReadingBackgroundSource.includes("isAllowedPublishTwitterOembedUrl(url)"), "Post-reading background JSON bridge must validate the public oEmbed endpoint");
assert(postReadingUrlPolicySource.includes('url.pathname !== "/oembed"'), "Post-reading oEmbed policy must pin the public oEmbed path");
assert(postReadingUrlPolicySource.includes('url.searchParams.get("url")'), "Post-reading oEmbed policy must inspect the nested status URL");
assert(postReadingUrlPolicySource.includes("normalizeXStatusUrl"), "Post-reading oEmbed policy must use host-strict X/Twitter status URL normalization");

for (const permission of [
  "https://x.com/*",
  "https://twitter.com/*",
  "https://abs.twimg.com/*",
  "https://pbs.twimg.com/*",
  "https://publish.twitter.com/*",
  "https://cdn.syndication.twimg.com/*",
  "http://localhost/*",
  "http://127.0.0.1/*",
  "http://[::1]/*",
]) {
  assert(builder.includes(`"${permission}"`), `Post-reading distribution manifest builder missing host permission ${permission}`);
}

if (existsSync(chromiumOutput)) {
  const manifest = JSON.parse(await readFile(path.join(chromiumOutput, "manifest.json"), "utf8"));
  assert(manifest.version === packageJson.version, "Post-reading distribution manifest version must match package.json version");
  assert(manifest.name === "Post-reading", "Post-reading distribution manifest must keep the Post-reading product name");
  assert(manifest.permissions?.includes("storage"), "Post-reading distribution manifest must include storage permission");
  assert(manifest.permissions?.includes("unlimitedStorage"), "Post-reading distribution manifest must include unlimitedStorage permission");
  for (const permission of ["http://localhost/*", "http://127.0.0.1/*", "http://[::1]/*", "https://publish.twitter.com/*", "https://cdn.syndication.twimg.com/*"]) {
    assert(manifest.host_permissions?.includes(permission), `Post-reading distribution output missing host permission ${permission}`);
  }
}

console.log(`Post-reading distribution contract verification passed for ${packageJson.version}.`);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
