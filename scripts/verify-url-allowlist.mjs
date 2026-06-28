import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile("src/shared/urlAllowlist.ts", "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(output.outputText).toString("base64")}`;
const { parseAllowedUrl, isAllowedUrl } = await import(moduleUrl);

verifySharedRuleSemantics();
await verifyBackgroundRuleContracts();

console.log("URL allowlist verification passed.");

function verifySharedRuleSemantics() {
  const originRule = [{ origin: "https://musicbrainz.org", pathPrefix: "/ws/2/" }];
  assert(parseAllowedUrl("https://musicbrainz.org/ws/2/recording?query=x", originRule)?.hostname === "musicbrainz.org", "origin + prefix rule should allow MusicBrainz ws/2 URLs");
  assert(!isAllowedUrl("https://musicbrainz.org/oauth2/authorize", originRule), "origin + prefix rule should reject unsupported paths");
  assert(!isAllowedUrl("http://musicbrainz.org/ws/2/recording", originRule), "origin rule should reject protocol downgrade");
  assert(!isAllowedUrl("https://evil.example/ws/2/recording", originRule), "origin rule should reject other hosts");

  const exactPathRule = [{ origin: "https://api.acoustid.org", pathPattern: /^\/v2\/lookup$/ }];
  assert(isAllowedUrl("https://api.acoustid.org/v2/lookup", exactPathRule), "path pattern should allow exact AcoustID lookup path");
  assert(!isAllowedUrl("https://api.acoustid.org/v2/lookup/extra", exactPathRule), "path pattern should reject nested lookup paths");

  const subdomainRule = [{ protocol: "https:", hostname: "www.remilia.net", includeSubdomains: true }];
  assert(isAllowedUrl("https://www.remilia.net/api/media/1", subdomainRule), "subdomain rule should allow exact host");
  assert(isAllowedUrl("https://cdn.www.remilia.net/file.png", subdomainRule), "subdomain rule should allow child subdomains");
  assert(!isAllowedUrl("https://www.remilia.net.evil.example/file.png", subdomainRule), "subdomain rule should reject suffix impersonation");
  assert(!isAllowedUrl("http://cdn.www.remilia.net/file.png", subdomainRule), "subdomain rule should reject protocol mismatch");

  assert(parseAllowedUrl("not a url", originRule) === null, "invalid URL strings should be rejected");
}

async function verifyBackgroundRuleContracts() {
  const [background, reminetBackground] = await Promise.all([
    readFile("src/background.ts", "utf8"),
    readFile("src/features/reminetChat/background.ts", "utf8"),
  ]);
  for (const expected of [
    'origin: "https://musicbrainz.org", pathPrefix: "/ws/2/"',
    'origin: "https://api.acoustid.org", pathPattern: /^\\/v2\\/lookup$/',
    'origin: "https://boards.miladychan.org", pathPrefix: "/json/"',
    'origin: "https://miladymaker.net", pathPattern: /^\\/banners\\/nft\\/\\d+\\.png$/',
    'parseAllowedUrl(url, MUSICBRAINZ_JSON_RULES)',
    'parseAllowedUrl(url, ACOUSTID_FORM_RULES)',
    'parseAllowedUrl(url, MILADYCHAN_JSON_RULES)',
    'parseAllowedUrl(url, MUSIC_IMAGE_RULES)',
    'parseAllowedUrl(url, MILADY_MAKER_BANNER_RULES)',
  ]) {
    assert(background.includes(expected), `central background missing allowlist contract: ${expected}`);
  }
  assert(reminetBackground.includes('protocol: "https:", hostname: "www.remilia.net", includeSubdomains: true'), "RemiNet media rules must require HTTPS remilia.net host/subdomains");
  assert(reminetBackground.includes("isAllowedUrl(value, REMILIA_MEDIA_RULES)"), "RemiNet media checks must use shared URL allowlist helper");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
