export const buildProfiles = [
  { dir: "dist/chromium", target: "chromium", profile: "full", channel: "production" },
  { dir: "dist/firefox", target: "firefox", profile: "full", channel: "production" },
];

export const releaseBuilds = buildProfiles;

export const coreHostPermissions = [
  "https://api.github.com/*",
  "https://x.com/*",
  "https://twitter.com/*",
  "https://abs.twimg.com/*",
  "https://pbs.twimg.com/*",
  "https://publish.twitter.com/*",
  "https://cdn.syndication.twimg.com/*",
  "http://localhost/*",
  "http://127.0.0.1/*",
  "http://[::1]/*",
  "https://remilia.wiki/*",
  "https://wiki.remilia.org/*",
];

export const contentScriptMatches = [
  "https://x.com/*",
  "https://twitter.com/*",
  "https://www.remilia.net/*",
  "https://remilia.net/*",
  "https://remilia.wiki/*",
  "https://wiki.remilia.org/*",
  "https://boards.miladychan.org/*",
];

export const webAccessibleMatches = [...contentScriptMatches];

export const commonAssetDirs = [
  "brand",
  "icons",
  "remilia-fonts",
];

export const generatedAssetRoots = [
  "generated",
  "ocr",
  "ort",
];

export const allowedMarkdownArchiveFiles = [
  "THIRD_PARTY_NOTICES.md",
  "ocr/core/README.md",
  "wiki-helper/remilia-wiki-article-writer/SKILL.md",
  "wiki-helper/remilia-wiki-article-writer/references/article-patterns.md",
  "wiki-helper/remilia-wiki-article-writer/references/interview-guide.md",
  "remilia-pet/remilia-maker-pet-import/SKILL.md",
];
