import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile("src/platform/browser/url-allowlist.ts", "utf8");
const remiliaMediaSource = await readFile("src/platform/media/remilia-media-allowlist.ts", "utf8");
const postReadingUrlPolicySource = await readFile("src/apps/post-reading/urlPolicy.ts", "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const remiliaMediaOutput = ts.transpileModule(remiliaMediaSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const postReadingUrlPolicyOutput = ts.transpileModule(postReadingUrlPolicySource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(output.outputText).toString("base64")}`;
const remiliaMediaModuleUrl = `data:text/javascript;base64,${Buffer.from(remiliaMediaOutput.outputText).toString("base64")}`;
const postReadingUrlPolicyModuleUrl = `data:text/javascript;base64,${Buffer.from(postReadingUrlPolicyOutput.outputText).toString("base64")}`;
const { parseAllowedUrl, isAllowedUrl } = await import(moduleUrl);
const { absoluteRemiliaMediaUrl, isRemiliaMediaUrl } = await import(remiliaMediaModuleUrl);
const { normalizeXStatusUrl, findXStatusHrefInText, isAllowedPublishTwitterOembedUrl } = await import(postReadingUrlPolicyModuleUrl);

verifySharedRuleSemantics();
verifyRemiliaMediaFixtures();
verifyPostReadingOembedFixtures();
await verifyBackgroundRuleContracts();
await verifyManifestDisclosureContracts();

console.log("URL allowlist verification passed.");

function verifySharedRuleSemantics() {
  const originRule = [{ origin: "https://musicbrainz.org", pathPrefix: "/ws/2/" }];
  assert(parseAllowedUrl("https://musicbrainz.org/ws/2/recording?query=x", originRule)?.hostname === "musicbrainz.org", "origin + prefix rule should allow MusicBrainz ws/2 URLs");
  assert(!isAllowedUrl("https://musicbrainz.org/oauth2/authorize", originRule), "origin + prefix rule should reject unsupported paths");
  assert(!isAllowedUrl("http://musicbrainz.org/ws/2/recording", originRule), "origin rule should reject protocol downgrade");
  assert(!isAllowedUrl("https://evil.example/ws/2/recording", originRule), "origin rule should reject other hosts");

  const exactPathRule = [{ origin: "https://miladymaker.net", pathPattern: /^\/banners\/nft\/\d+\.png$/ }];
  assert(isAllowedUrl("https://miladymaker.net/banners/nft/123.png", exactPathRule), "path pattern should allow an exact Milady Maker banner path");
  assert(!isAllowedUrl("https://miladymaker.net/banners/nft/123.png/extra", exactPathRule), "path pattern should reject a nested banner path");

  const subdomainRule = [{ protocol: "https:", hostname: "www.remilia.net", includeSubdomains: true }];
  assert(isAllowedUrl("https://www.remilia.net/api/media/1", subdomainRule), "subdomain rule should allow exact host");
  assert(isAllowedUrl("https://cdn.www.remilia.net/file.png", subdomainRule), "subdomain rule should allow child subdomains");
  assert(!isAllowedUrl("https://www.remilia.net.evil.example/file.png", subdomainRule), "subdomain rule should reject suffix impersonation");
  assert(!isAllowedUrl("http://cdn.www.remilia.net/file.png", subdomainRule), "subdomain rule should reject protocol mismatch");

  assert(parseAllowedUrl("not a url", originRule) === null, "invalid URL strings should be rejected");
}

function verifyRemiliaMediaFixtures() {
  const allowed = [
    "https://www.remilia.net/media/chat/1.png",
    "https://www.remilia.net/api/media/1",
    "https://pfp.remilia.net/pfp/123.png",
    "/media/chat/relative.webp",
  ];
  const denied = [
    "data:image/png;base64,abc",
    "http://www.remilia.net/media/chat/1.png",
    "//evil.example/media/chat/1.png",
    "https://[::1",
    "https://evil.example/media/chat/1.png",
    "https://pfp.remilia.net.evil.example/pfp/123.png",
    "https://evil-pfp.remilia.net/pfp/123.png",
    "https://cdn.www.remilia.net/media/chat/1.png",
    "https://www.remilia.net.evil.example/media/chat/1.png",
    "https://notremilia.net/https://www.remilia.net/media/chat/1.png",
    "javascript:alert(1)",
  ];

  for (const fixture of allowed) {
    const absolute = absoluteRemiliaMediaUrl(fixture);
    assert(absolute, `RemiNet media fixture should normalize to an allowed HTTPS URL: ${fixture}`);
    assert(isRemiliaMediaUrl(absolute), `RemiNet media fixture should be allowed: ${fixture}`);
  }
  for (const fixture of denied) {
    assert(!absoluteRemiliaMediaUrl(fixture), `RemiNet media fixture should not normalize hostile URL: ${fixture}`);
    assert(!isRemiliaMediaUrl(fixture), `RemiNet media fixture should be rejected: ${fixture}`);
  }
}

function verifyPostReadingOembedFixtures() {
  const allowedStatusUrls = [
    "https://x.com/user/status/123",
    "https://twitter.com/user/status/123?ref=share",
    "/user/status/123",
  ];
  const deniedStatusUrls = [
    "http://x.com/user/status/123",
    "https://evil.example/user/status/123",
    "https://x.com.evil.example/user/status/123",
    "https://x.com/user/not-status/123",
    "https://x.com/user/status/not-a-number",
  ];

  for (const fixture of allowedStatusUrls) {
    const normalized = normalizeXStatusUrl(fixture, "https://x.com/home");
    assert(normalized?.startsWith("https://x.com/"), `Post-reading status URL fixture should normalize to x.com: ${fixture}`);
    assert(normalized?.includes("/status/123"), `Post-reading status URL fixture should preserve status id: ${fixture}`);
  }

  for (const fixture of deniedStatusUrls) {
    assert(!normalizeXStatusUrl(fixture, "https://x.com/home"), `Post-reading status URL fixture should reject hostile URL: ${fixture}`);
  }

  const extractionBase = "https://x.com/home";
  const hostileExtractionFixtures = [
    ["text", "Quoted post https://evil.example/user/status/123"],
    ["data-href", "https://evil.example/user/status/123"],
    ["aria-label", "Open post https://evil.example/user/status/123"],
    ["title", "https://evil.example/user/status/123"],
  ];
  const allowedExtractionFixtures = [
    ["relative path", "/user/status/123"],
    ["relative path in text", "Open /user/status/123"],
    ["x.com absolute", "https://x.com/user/status/123"],
    ["twitter.com absolute", "Open https://twitter.com/user/status/123"],
  ];

  for (const [channel, fixture] of hostileExtractionFixtures) {
    assert(
      !findXStatusHrefInText(fixture, extractionBase),
      `Post-reading ${channel} extraction must reject hostile absolute status URL substrings: ${fixture}`,
    );
  }

  for (const [channel, fixture] of allowedExtractionFixtures) {
    const href = findXStatusHrefInText(fixture, extractionBase);
    assert(href, `Post-reading ${channel} extraction must find allowed status URL: ${fixture}`);
    assert(normalizeXStatusUrl(href, extractionBase)?.includes("/status/123"), `Post-reading ${channel} extraction must normalize allowed status URL: ${fixture}`);
  }

  assert(
    !isAllowedPublishTwitterOembedUrl(new URL("https://publish.twitter.com/oembed?url=https%3A%2F%2Fevil.example%2Fuser%2Fstatus%2F123")),
    "Post-reading oEmbed allowlist must reject hostile nested status URL hosts",
  );
  assert(
    !isAllowedPublishTwitterOembedUrl(new URL("https://publish.twitter.com/oembed?url=%2Fuser%2Fstatus%2F123")),
    "Post-reading oEmbed allowlist must reject relative nested status URLs",
  );
  assert(
    isAllowedPublishTwitterOembedUrl(new URL("https://publish.twitter.com/oembed?url=https%3A%2F%2Fx.com%2Fuser%2Fstatus%2F123&omit_script=1")),
    "Post-reading oEmbed allowlist must accept nested x.com status URLs",
  );
  assert(
    isAllowedPublishTwitterOembedUrl(new URL("https://publish.twitter.com/oembed?url=https%3A%2F%2Ftwitter.com%2Fuser%2Fstatus%2F123")),
    "Post-reading oEmbed allowlist must accept nested twitter.com status URLs",
  );
}

async function verifyBackgroundRuleContracts() {
  const [background, reminetBackground, reminetContent] = await Promise.all([
    readFile("src/extension/background/index.ts", "utf8"),
    readFile("src/apps/reminet-chat/background.ts", "utf8"),
    readFile("src/apps/reminet-chat/content.ts", "utf8"),
  ]);
  for (const expected of [
    'origin: "https://musicbrainz.org", pathPrefix: "/ws/2/"',
    'origin: "https://boards.miladychan.org", pathPrefix: "/json/"',
    'origin: "https://miladymaker.net", pathPattern: /^\\/banners\\/nft\\/\\d+\\.png$/',
    'parseAllowedUrl(url, MUSICBRAINZ_JSON_RULES)',
    'parseAllowedUrl(url, MILADYCHAN_JSON_RULES)',
    'parseAllowedUrl(url, MUSIC_IMAGE_RULES)',
    'parseAllowedUrl(url, MILADY_MAKER_BANNER_RULES)',
  ]) {
    assert(background.includes(expected), `central background missing allowlist contract: ${expected}`);
  }
  assert(reminetBackground.includes('from "../../platform/media/remilia-media-allowlist"'), "RemiNet background must use the shared Remilia media allowlist");
  assert(reminetContent.includes('from "../../platform/media/remilia-media-allowlist"'), "RemiNet content must use the shared Remilia media allowlist");
  assert(remiliaMediaSource.includes('"www.remilia.net"') && remiliaMediaSource.includes('"pfp.remilia.net"'), "RemiNet media allowlist must include intended exact media hosts");
  assert(reminetBackground.includes("MAX_INLINE_MEDIA_BYTES"), "RemiNet media bridge must cap inline media response size");
  assert(reminetBackground.includes("UNSUPPORTED_MEDIA_TYPE"), "RemiNet media bridge must reject unsupported media content types");
  assert(reminetBackground.includes('credentials: shouldSendRemiliaMediaCredentials(url) ? "include" : "omit"'), "RemiNet media bridge must keep non-www media hosts credentialless");
  assert(reminetBackground.includes('hostname.toLowerCase() === "www.remilia.net"'), "RemiNet media bridge must send credentials only to the RemiliaNET app host");
  assert(reminetContent.includes("renderUnsupportedMediaLink"), "RemiNet content must render unsupported remote media through a dedicated fallback");
  assert(reminetContent.includes("absoluteRemiliaMediaUrl(media.url)"), "RemiNet image attachments must normalize through the shared media allowlist");
  assert(reminetContent.includes('if (!url) return renderUnsupportedMediaLink("Unsupported media");'), "RemiNet image fallback must not pass rejected raw media URLs to the renderer");
  assert(reminetContent.includes('if (rawVideoUrl && !videoUrl) return renderUnsupportedMediaLink("Unsupported video");'), "RemiNet video fallback must not pass rejected raw video URLs to the renderer");
  assert(!reminetContent.includes("renderUnsupportedMediaLink(media.url"), "RemiNet image fallback must not expose rejected raw media URLs");
  assert(!reminetContent.includes("renderUnsupportedMediaLink(rawVideoUrl"), "RemiNet video fallback must not expose rejected raw media URLs");
  assert(!reminetContent.includes("renderUnsupportedMediaLink(rawPosterUrl"), "RemiNet poster fallback must not expose rejected raw media URLs");
  const unsupportedMediaFallback = functionBody(reminetContent, "renderUnsupportedMediaLink");
  assert(unsupportedMediaFallback.includes("<span"), "RemiNet unsupported media fallback must be inert text");
  assert(!/href\s*=/.test(unsupportedMediaFallback), "RemiNet unsupported media fallback must not render any href for rejected URLs");
  assert(reminetContent.includes("function renderAvatarImage(user: ApiUser | null): string"), "RemiNet avatars must use a dedicated allowlisted renderer");
  assert(reminetContent.includes("const avatar = renderAvatarImage(user)"), "RemiNet message groups must render avatars through the allowlisted avatar renderer");
  assert(reminetContent.includes("absoluteRemiliaMediaUrl(avatarUrl(user))"), "RemiNet avatar renderer must reject protocol downgrades and hostile hosts through the shared media allowlist");
  assert(!reminetContent.includes('<img src="${escapeHtml(absoluteRemiliaUrl(avatar))}"'), "RemiNet avatars must not render arbitrary profile URLs directly into img src");
  const [manifest, releaseBuilds] = await Promise.all([
    readFile("assets/extension/manifest.json", "utf8"),
    readFile("scripts/release/release-builds.mjs", "utf8"),
  ]);
  for (const permission of ["http://localhost/*", "http://127.0.0.1/*", "http://[::1]/*", "https://publish.twitter.com/*", "https://cdn.syndication.twimg.com/*"]) {
    assert(manifest.includes(permission), `manifest must allow custom TTS loopback permission ${permission}`);
    assert(releaseBuilds.includes(permission), `release builds must keep host permission ${permission}`);
  }
}

async function verifyManifestDisclosureContracts() {
  const [manifest, registry, privacyDocs, userGuide] = await Promise.all([
    readJson("assets/extension/manifest.json"),
    readJson("src/platform/app-sdk/first-party-apps.json"),
    readFile("docs/PRIVACY_AND_PERMISSIONS.md", "utf8"),
    readFile("docs/USER_GUIDE.md", "utf8"),
  ]);
  const manifestHosts = manifest.host_permissions || [];
  const metadataHosts = new Set();
  const metadataRemoteServices = new Set();

  for (const app of registry) {
    for (const host of app.permissions?.hosts || []) metadataHosts.add(host);
    for (const scope of app.siteScopes || []) {
      for (const host of scope.hosts || []) metadataHosts.add(host);
    }
    for (const service of app.hub?.remoteServices || []) metadataRemoteServices.add(service);
  }

  const metadataExemptions = new Map([
    ["https://api.github.com/*", "platform update checks are extension-level, documented in public privacy/user docs, and not owned by a first-party app"],
    ["https://abs.twimg.com/*", "X/Twitter page asset host used by the content runtime on X surfaces"],
    ["https://pbs.twimg.com/*", "X/Twitter media host used for user-visible media and OCR/image workflows"],
    ["http://localhost/*", "user-configured local custom TTS loopback"],
    ["http://127.0.0.1/*", "user-configured local custom TTS loopback"],
    ["http://[::1]/*", "user-configured local custom TTS loopback"],
  ]);

  const docsExemptions = new Map([
    ["https://x.com/*", "site runtime scope is disclosed as X/Twitter"],
    ["https://twitter.com/*", "site runtime scope is disclosed as X/Twitter"],
    ["https://abs.twimg.com/*", "X/Twitter asset host is covered by the X/Twitter runtime disclosure"],
  ]);

  for (const host of manifestHosts) {
    assert(host !== "wss://boards.miladychan.org/*", "Miladychan WebSocket permission is stale; runtime/docs only support HTTPS board and thread JSON");
    const representedInMetadata = metadataHosts.has(host) || metadataExemptions.has(host);
    assert(representedInMetadata, `manifest host permission lacks first-party metadata ownership or an explicit verifier exemption: ${host}`);

    if (docsExemptions.has(host)) continue;
    const { hostname, pathPrefix } = hostPermissionParts(host);
    assert(includesToken(privacyDocs, hostname), `privacy docs must disclose manifest host permission ${host}`);
    assert(includesToken(userGuide, hostname), `user guide must disclose manifest host permission ${host}`);
    if (pathPrefix && pathPrefix !== "/") {
      assert(includesToken(privacyDocs, pathPrefix), `privacy docs must disclose path-scoped manifest host permission ${host}`);
      assert(includesToken(userGuide, pathPrefix), `user guide must disclose path-scoped manifest host permission ${host}`);
    }
  }

  for (const required of [
    ["https://pfp.remilia.net/*", "pfp.remilia.net"],
    ["https://miladymaker.net/banners/nft/*", "miladymaker.net"],
    ["https://publish.twitter.com/*", "publish.twitter.com"],
    ["https://cdn.syndication.twimg.com/*", "cdn.syndication.twimg.com"],
  ]) {
    const [host, service] = required;
    if (!manifestHosts.includes(host)) continue;
    assert(metadataHosts.has(host), `first-party metadata must own active RemiStats image host permission ${host}`);
    assert(metadataRemoteServices.has(service), `first-party metadata must disclose remote service ${service}`);
    assert(includesToken(privacyDocs, service), `privacy docs must disclose active RemiStats image service ${service}`);
    assert(includesToken(userGuide, service), `user guide must disclose active RemiStats image service ${service}`);
  }
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

function hostPermissionParts(hostPermission) {
  const url = new URL(hostPermission.replace(/\*$/, ""));
  const pathPrefix = url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
  return { hostname: url.hostname, pathPrefix };
}

function includesToken(source, token) {
  return source.toLowerCase().includes(token.toLowerCase());
}

function functionBody(source, name) {
  const pattern = new RegExp(`function\\s+${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\(`, "m");
  const match = pattern.exec(source);
  assert(match, `missing function body: ${name}`);
  const braceStart = source.indexOf("{", match.index);
  assert(braceStart >= 0, `missing opening brace for: ${name}`);
  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(braceStart, index + 1);
    }
  }
  throw new Error(`missing closing brace for: ${name}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
