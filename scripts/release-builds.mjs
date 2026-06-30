export const releaseBuilds = [
  { dir: "dist/chromium", target: "chromium", profile: "full" },
  { dir: "dist/firefox", target: "firefox", profile: "full" },
];

export const coreHostPermissions = [
  "https://api.github.com/*",
  "https://x.com/*",
  "https://twitter.com/*",
  "https://abs.twimg.com/*",
  "https://pbs.twimg.com/*",
  "http://localhost/*",
  "http://127.0.0.1/*",
  "https://remilia.wiki/*",
  "https://wiki.remilia.org/*",
];

export const contentScriptMatches = [
  "https://x.com/*",
  "https://twitter.com/*",
];

export const webAccessibleMatches = [
  ...contentScriptMatches,
  "https://remilia.wiki/*",
  "https://wiki.remilia.org/*",
];

export const commonAssetDirs = [
  "brand",
  "icons",
  "remilia-fonts",
];

export const generatedAssetRoots = [
  "ocr",
  "ort",
];
