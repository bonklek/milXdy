type Area = "local" | "sync";
type ControlKind = "boolean" | "number" | "string" | "nullableString" | "handleList";
type ThemeMode = "light" | "dark" | "system";

type ControlBinding = {
  area: Area;
  key: string;
  property?: string;
  kind: ControlKind;
  fallback: boolean | number | string | null | string[];
};

const WIKI_SETTINGS_KEY = "remiliaWikiHyperlink.settings";
const WIKI_LATER_KEY = "remiliaWikiHyperlink.laterItems";
const WIKI_API = "https://wiki.remilia.org/api.php";
const WIKI_PRELOAD_TEMPLATE = "Template:New page preload";
const WIKI_AI_HELP_ZIP = "wiki-helper/remilia-wiki-article-writer.zip";
const WIKITOOL_LATEST_RELEASE_API = "https://api.github.com/repos/remiliacorporation/remilia-wikitool/releases/latest";
const WIKITOOL_RELEASES_URL = "https://github.com/remiliacorporation/remilia-wikitool/releases/latest";
const UPDATE_STATUS_KEY = "milxdy.updateStatus";
const LEGACY_BEETOL_PREFIX = "bex" + "tol";
const GITHUB_ISSUES_NEW_URL = "https://github.com/bonklek/milXdy/issues/new";
const X_FEEDBACK_REPLY_URL = "https://x.com/intent/tweet";
const X_FEEDBACK_POST_ID = "2069113443664220227";
const X_FEEDBACK_COLLECTOR_URL = `https://x.com/MiladyBonkle/status/${X_FEEDBACK_POST_ID}`;
const REMILIA_NET_LOGIN_URL = "https://www.remilia.net/login";
const LAST_POKE_DIAGNOSTIC_KEY = "milxdy.remistats.lastPokeDiagnostic";
const SETTINGS_THEME_KEY = "milxdy.settings.theme";

type UpdateStatus = {
  checkedAt: number;
  currentVersion: string;
  latestVersion: string | null;
  latestUrl: string | null;
  latestAssetUrl?: string | null;
  latestAssetName?: string | null;
  updateAvailable: boolean;
  error?: string;
};

type WikiLaterItem = {
  id: string;
  text: string;
  pageUrl?: string;
  createdAt: number;
};

type WikiSearchResult = {
  title: string;
  wordcount?: number;
};

type GitHubRelease = {
  html_url?: string;
  assets?: GitHubReleaseAsset[];
};

type GitHubReleaseAsset = {
  name?: string;
  browser_download_url?: string;
};

let activeWikiLaterSearchId: string | null = null;

const bindings: Record<string, ControlBinding> = {
  diagnosticsEnabled: { area: "local", key: "milxdy.diagnostics.enabled", kind: "boolean", fallback: false },
  "wiki.enabled": { area: "local", key: WIKI_SETTINGS_KEY, property: "enabled", kind: "boolean", fallback: true },
  "wiki.previewsEnabled": { area: "local", key: WIKI_SETTINGS_KEY, property: "previewsEnabled", kind: "boolean", fallback: true },
  "wiki.debugMode": { area: "local", key: WIKI_SETTINGS_KEY, property: "debugMode", kind: "boolean", fallback: false },
  "wiki.grokWorkflowMode": { area: "local", key: WIKI_SETTINGS_KEY, property: "grokWorkflowMode", kind: "string", fallback: "one-shot" },
  "wiki.maxLinksPerPostEnabled": { area: "local", key: WIKI_SETTINGS_KEY, property: "maxLinksPerPostEnabled", kind: "boolean", fallback: false },
  "wiki.maxLinksPerPost": { area: "local", key: WIKI_SETTINGS_KEY, property: "maxLinksPerPost", kind: "number", fallback: 4 },
  "wiki.maxLowConfidenceLinksPerPost": { area: "local", key: WIKI_SETTINGS_KEY, property: "maxLowConfidenceLinksPerPost", kind: "number", fallback: 1 },
  "wiki.linkColor": { area: "local", key: WIKI_SETTINGS_KEY, property: "linkColor", kind: "string", fallback: "#ff4fbf" },
  "postreader.enabled": { area: "sync", key: "enabled", kind: "boolean", fallback: true },
  "postreader.speed": { area: "sync", key: "speed", kind: "number", fallback: 1 },
  "postreader.volume": { area: "sync", key: "volume", kind: "number", fallback: 1 },
  "postreader.voiceURI": { area: "sync", key: "voiceURI", kind: "nullableString", fallback: null },
  "postreader.autoVoice": { area: "sync", key: "autoVoice", kind: "boolean", fallback: true },
  "postreader.ttsEngine": { area: "sync", key: "ttsEngine", kind: "string", fallback: "web-speech" },
  "postreader.customTtsEndpoint": { area: "sync", key: "customTtsEndpoint", kind: "nullableString", fallback: null },
  "postreader.customTtsTimingMode": { area: "sync", key: "customTtsTimingMode", kind: "string", fallback: "engine" },
  "postreader.autoplayNext": { area: "sync", key: "autoplayNext", kind: "boolean", fallback: false },
  "postreader.autoplayMode": { area: "sync", key: "autoplayMode", kind: "string", fallback: "visible" },
  "postreader.skipPromotedPosts": { area: "sync", key: "skipPromotedPosts", kind: "boolean", fallback: true },
  "postreader.endOfTweetDing": { area: "sync", key: "endOfTweetDing", kind: "boolean", fallback: false },
  "postreader.includeQuotes": { area: "sync", key: "includeQuotes", kind: "boolean", fallback: true },
  "postreader.fetchFullQuotes": { area: "sync", key: "fetchFullQuotes", kind: "boolean", fallback: false },
  "postreader.fullQuoteDisplay": { area: "sync", key: "fullQuoteDisplay", kind: "string", fallback: "scroll" },
  "postreader.includeHyperlinks": { area: "sync", key: "includeHyperlinks", kind: "boolean", fallback: false },
  "postreader.includeImageAltText": { area: "sync", key: "includeImageAltText", kind: "boolean", fallback: true },
  "postreader.includeImageOcr": { area: "sync", key: "includeImageOcr", kind: "boolean", fallback: false },
  "postreader.includeLinkPreviews": { area: "sync", key: "includeLinkPreviews", kind: "boolean", fallback: true },
  "postreader.expandShowMore": { area: "sync", key: "expandShowMore", kind: "boolean", fallback: true },
  "postreader.activeTweetHighlight": { area: "sync", key: "activeTweetHighlight", kind: "boolean", fallback: true },
  "postreader.bodyHighlightMode": { area: "sync", key: "bodyHighlightMode", kind: "string", fallback: "smooth" },
  "postreader.playerPosition": { area: "sync", key: "playerPosition", kind: "string", fallback: "top-right" },
  "postreader.buttonPlacement": { area: "sync", key: "buttonPlacement", kind: "string", fallback: "auto" },
  "postreader.useHandles": { area: "sync", key: "useHandles", kind: "boolean", fallback: false },
  "postreader.keyNextTweet": { area: "sync", key: "keyNextTweet", kind: "string", fallback: "Ctrl+Alt+ArrowDown" },
  "postreader.keyPreviousTweet": { area: "sync", key: "keyPreviousTweet", kind: "string", fallback: "Ctrl+Alt+ArrowUp" },
  "postreader.keyNextChunk": { area: "sync", key: "keyNextChunk", kind: "string", fallback: "Ctrl+Alt+ArrowRight" },
  "postreader.keyPreviousChunk": { area: "sync", key: "keyPreviousChunk", kind: "string", fallback: "Ctrl+Alt+ArrowLeft" },
  "postreader.keySkipOcr": { area: "sync", key: "keySkipOcr", kind: "string", fallback: "Ctrl+Alt+S" },
  "postreader.keyPlayPause": { area: "sync", key: "keyPlayPause", kind: "string", fallback: "Ctrl+Alt+\\" },
  "remistats.enabled": { area: "sync", key: "milxdy.remistats.enabled", kind: "boolean", fallback: true },
  "remistats.showTooltips": { area: "sync", key: "showTooltips", kind: "boolean", fallback: true },
  "remistats.soundsEnabled": { area: "sync", key: "soundsEnabled", kind: "boolean", fallback: true },
  "remistats.soundVolume": { area: "sync", key: "soundVolume", kind: "number", fallback: 0.6 },
  "remistats.icons.enabled": { area: "sync", key: "milxdy.remistats.icons.enabled", kind: "boolean", fallback: true },
  "remistats.icons.score": { area: "sync", key: "milxdy.remistats.icons.score", kind: "boolean", fallback: true },
  "remistats.icons.beetle": { area: "sync", key: "milxdy.remistats.icons.beetle", kind: "boolean", fallback: true },
  "remistats.icons.poke": { area: "sync", key: "milxdy.remistats.icons.poke", kind: "boolean", fallback: true },
  "milady.mode": { area: "sync", key: "mode", kind: "string", fallback: "milady" },
  "milady.soundEnabled": { area: "sync", key: "soundEnabled", kind: "boolean", fallback: true },
  "milady.showLevelBadge": { area: "sync", key: "showLevelBadge", kind: "boolean", fallback: true },
  "milady.includeRemiStatsBeetles": { area: "sync", key: "includeRemiStatsBeetles", kind: "boolean", fallback: true },
  "milady.cardTheme": { area: "sync", key: "cardTheme", kind: "string", fallback: "full" },
  "milady.whitelistHandles": { area: "sync", key: "whitelistHandles", kind: "handleList", fallback: [] },
  "milady.miladyListHandles": { area: "sync", key: "miladyListHandles", kind: "handleList", fallback: [] },
  "remistats.beetol.enabled": { area: "local", key: "milxdy.remistats.beetol.enabled", kind: "boolean", fallback: true },
  "reminetChat.enabled": { area: "local", key: "milxdy.reminetChat.enabled", kind: "boolean", fallback: false },
};

void boot();

async function boot(): Promise<void> {
  await setupThemeControls();
  setupTabs();
  setupUpdateStatus();
  await migrateBeetolSettings();
  await loadControls();
  setupWikiMaxLinksControl();
  setupWikiPreloadTemplateAction();
  setupWikiAiHelp();
  setupRemiStatsIconControls();
  setupReportActions();
  await renderWikiLaterItems();
  observeWikiLaterItems();
  await setupBeetolPanel();
  await renderStatus();
}

async function setupThemeControls(): Promise<void> {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-theme-choice]"));
  if (buttons.length === 0) return;
  const stored = await chrome.storage.local.get(SETTINGS_THEME_KEY);
  const initial = normalizeThemeMode(stored[SETTINGS_THEME_KEY]);
  renderThemeChoice(buttons, initial);
  applySettingsTheme(initial);
  for (const button of buttons) {
    button.addEventListener("click", () => {
      const mode = normalizeThemeMode(button.dataset.themeChoice);
      applySettingsTheme(mode);
      renderThemeChoice(buttons, mode);
      void chrome.storage.local.set({ [SETTINGS_THEME_KEY]: mode });
    });
  }
}

function normalizeThemeMode(value: unknown): ThemeMode {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

function applySettingsTheme(mode: ThemeMode): void {
  if (mode === "system") {
    document.documentElement.removeAttribute("data-theme");
    return;
  }
  document.documentElement.dataset.theme = mode;
}

function renderThemeChoice(buttons: HTMLButtonElement[], active: ThemeMode): void {
  for (const button of buttons) {
    button.setAttribute("aria-pressed", String(button.dataset.themeChoice === active));
  }
}

function setupRemiStatsIconControls(): void {
  const enabled = document.querySelector<HTMLInputElement>('[data-control="remistats.icons.enabled"]');
  const children = Array.from(document.querySelectorAll<HTMLInputElement>(
    '[data-control="remistats.icons.score"], [data-control="remistats.icons.beetle"], [data-control="remistats.icons.poke"]',
  ));
  if (!enabled || children.length === 0) return;
  const syncDisabled = () => {
    for (const child of children) {
      child.disabled = !enabled.checked;
      child.title = enabled.checked ? "" : "RemiStats icons are disabled";
    }
  };
  enabled.addEventListener("change", syncDisabled);
  syncDisabled();
}

async function migrateBeetolSettings(): Promise<void> {
  const legacy = {
    enabled: `milxdy.${LEGACY_BEETOL_PREFIX}.enabled`,
    color: `${LEGACY_BEETOL_PREFIX}Color`,
    mode: `${LEGACY_BEETOL_PREFIX}Mode`,
  };
  const current = await chrome.storage.local.get([
    "milxdy.remistats.beetol.enabled",
    "beetolColor",
    "beetolMode",
    legacy.enabled,
    legacy.color,
    legacy.mode,
  ]);
  const next: Record<string, unknown> = {};
  if (current["milxdy.remistats.beetol.enabled"] === undefined && current[legacy.enabled] !== undefined) {
    next["milxdy.remistats.beetol.enabled"] = current[legacy.enabled];
  }
  if (current.beetolColor === undefined && typeof current[legacy.color] === "string") {
    next.beetolColor = current[legacy.color];
  }
  if (current.beetolMode === undefined && typeof current[legacy.mode] === "string") {
    next.beetolMode = current[legacy.mode];
  }
  if (Object.keys(next).length) await chrome.storage.local.set(next);
}

function setupTabs(): void {
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".tab"));
  const panels = Array.from(document.querySelectorAll<HTMLElement>(".panel"));
  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      const target = tab.dataset.panel;
      for (const entry of tabs) entry.classList.toggle("is-active", entry === tab);
      for (const panel of panels) panel.classList.toggle("is-active", panel.dataset.panel === target);
    });
  }
}

async function loadControls(): Promise<void> {
  await Promise.all(Object.keys(bindings).map(loadControl));
}

async function loadControl(id: string): Promise<void> {
  const element = document.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[data-control="${cssEscape(id)}"]`);
  if (!element) return;
  const binding = bindings[id];
  const storage = binding.area === "sync" ? chrome.storage.sync : chrome.storage.local;
  const stored = await storage.get(binding.key);
  setElementValue(element, readBindingValue(binding, stored[binding.key]));
  const eventName = element instanceof HTMLInputElement && element.type === "checkbox" ? "change" : "change";
  element.addEventListener(eventName, () => {
    void saveControl(id, element);
  });
}

function readBindingValue(binding: ControlBinding, stored: unknown): unknown {
  const raw = binding.property ? objectValue(stored)[binding.property] : stored;
  if (raw === undefined || raw === null) return binding.fallback;
  return raw;
}

async function saveControl(id: string, element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): Promise<void> {
  const binding = bindings[id];
  const storage = binding.area === "sync" ? chrome.storage.sync : chrome.storage.local;
  const value = readElementValue(element, binding);
  if (!binding.property) {
    await storage.set({ [binding.key]: value });
    return;
  }
  const stored = await storage.get(binding.key);
  await storage.set({
    [binding.key]: {
      ...objectValue(stored[binding.key]),
      [binding.property]: value,
    },
  });
}

function setElementValue(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: unknown): void {
  if (element instanceof HTMLInputElement && element.type === "checkbox") {
    element.checked = Boolean(value);
    return;
  }
  if (element instanceof HTMLTextAreaElement && Array.isArray(value)) {
    element.value = value.join("\n");
    return;
  }
  element.value = value == null ? "" : String(value);
}

function readElementValue(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, binding: ControlBinding): unknown {
  if (binding.kind === "boolean" && element instanceof HTMLInputElement) return element.checked;
  if (binding.kind === "number") return Number(element.value);
  if (binding.kind === "nullableString") return element.value.trim() || null;
  if (binding.kind === "handleList") return normalizeHandleList(element.value);
  return element.value;
}

function normalizeHandleList(value: string): string[] {
  return Array.from(new Set(
    value
      .split(/[\n,]+/)
      .map((entry) => entry.trim().replace(/^@/, "").toLowerCase())
      .filter(Boolean),
  )).sort((left, right) => left.localeCompare(right));
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function cssEscape(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

function setupWikiMaxLinksControl(): void {
  const enabled = document.querySelector<HTMLInputElement>('[data-control="wiki.maxLinksPerPostEnabled"]');
  const count = document.querySelector<HTMLInputElement>('[data-control="wiki.maxLinksPerPost"]');
  if (!enabled || !count) return;
  const syncDisabled = () => {
    count.disabled = !enabled.checked;
    count.title = enabled.checked ? "" : "No maximum";
  };
  enabled.addEventListener("change", syncDisabled);
  syncDisabled();
}

async function renderWikiLaterItems(): Promise<void> {
  const root = document.getElementById("wikiLaterItems");
  if (!root) return;
  const stored = await chrome.storage.local.get(WIKI_LATER_KEY);
  const items = normalizeWikiLaterItems(stored[WIKI_LATER_KEY]);
  root.textContent = "";
  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "settings-list-empty";
    empty.textContent = "No saved entries.";
    root.append(empty);
    return;
  }
  for (const item of items) {
    root.append(createWikiLaterRow(item, items));
  }
}

function observeWikiLaterItems(): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[WIKI_LATER_KEY]) {
      void renderWikiLaterItems();
    }
  });
}

function createWikiLaterRow(item: WikiLaterItem, allItems: WikiLaterItem[]): HTMLElement {
  const row = document.createElement("div");
  row.className = "settings-list-row";
  row.dataset.expanded = String(activeWikiLaterSearchId === item.id);

  const main = document.createElement("div");
  main.className = "settings-list-main";
  const text = document.createElement("div");
  text.className = "settings-list-text";
  text.textContent = item.text;
  text.title = item.text;

  const meta = document.createElement("div");
  meta.className = "settings-list-meta";
  const savedAt = document.createElement("span");
  savedAt.textContent = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "Saved";
  meta.append(savedAt);
  if (item.pageUrl) {
    const link = document.createElement("a");
    link.href = item.pageUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = shortUrl(item.pageUrl);
    link.title = item.pageUrl;
    meta.append(link);
  }
  main.append(text, meta);

  const actions = document.createElement("div");
  actions.className = "settings-list-actions";

  const newPage = document.createElement("button");
  newPage.type = "button";
  newPage.className = "settings-list-action";
  newPage.textContent = "New page";
  newPage.addEventListener("click", () => openWikiNewPage(item));

  const addExisting = document.createElement("button");
  addExisting.type = "button";
  addExisting.className = "settings-list-action";
  addExisting.textContent = activeWikiLaterSearchId === item.id ? "Hide search" : "Add to page";
  addExisting.addEventListener("click", () => {
    activeWikiLaterSearchId = activeWikiLaterSearchId === item.id ? null : item.id;
    void renderWikiLaterItems();
  });

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "settings-list-remove";
  remove.textContent = "Remove";
  remove.addEventListener("click", () => {
    void removeWikiLaterItem(item.id, allItems);
  });

  actions.append(newPage, addExisting, remove);
  row.append(main, actions);

  if (activeWikiLaterSearchId === item.id) {
    const search = createWikiLaterSearch(item);
    row.append(search);
    void runWikiLaterSearch(item, search);
  }
  return row;
}

function setupWikiPreloadTemplateAction(): void {
  const button = document.getElementById("wikiPreloadTemplate") as HTMLButtonElement | null;
  button?.addEventListener("click", () => {
    openWikiEditorUrl(wikiEditUrl(WIKI_PRELOAD_TEMPLATE));
  });
}

function setupWikiAiHelp(): void {
  const open = document.getElementById("wikiAiHelp") as HTMLButtonElement | null;
  const dialog = document.getElementById("wikiAiHelpDialog");
  const close = document.getElementById("wikiAiHelpClose") as HTMLButtonElement | null;
  const download = document.getElementById("wikiAiHelpDownload") as HTMLButtonElement | null;
  const wikitoolDownload = document.getElementById("wikiWikitoolDownload") as HTMLButtonElement | null;
  const wikitoolRelease = document.getElementById("wikiWikitoolRelease") as HTMLButtonElement | null;
  const copy = document.getElementById("wikiAiHelpCopy") as HTMLButtonElement | null;
  const message = document.getElementById("wikiAiHelpMessage");
  if (!open || !dialog || !close || !download || !wikitoolDownload || !wikitoolRelease || !copy || !message) return;

  const showDialog = () => {
    dialog.hidden = false;
    message.textContent = "Downloaded remilia-wiki-article-writer.zip.";
  };

  open.addEventListener("click", () => {
    downloadWikiAiHelpZip();
    showDialog();
  });
  download.addEventListener("click", () => {
    downloadWikiAiHelpZip();
    message.textContent = "Downloaded again.";
  });
  wikitoolDownload.addEventListener("click", () => {
    wikitoolDownload.disabled = true;
    message.textContent = "Finding the latest Wikitool release...";
    void downloadLatestWikitool().then((downloaded) => {
      message.textContent = downloaded
        ? "Opened the matching Wikitool release asset."
        : "Opened the Wikitool release page.";
    }).catch(() => {
      openExternalUrl(WIKITOOL_RELEASES_URL);
      message.textContent = "Opened the Wikitool release page.";
    }).finally(() => {
      wikitoolDownload.disabled = false;
    });
  });
  wikitoolRelease.addEventListener("click", () => {
    openExternalUrl(WIKITOOL_RELEASES_URL);
    message.textContent = "Opened the Wikitool release page.";
  });
  copy.addEventListener("click", () => {
    void navigator.clipboard.writeText(wikiAiHelpPrompt()).then(() => {
      message.textContent = "Prompt copied.";
    }).catch(() => {
      message.textContent = "Copy failed. You can still use the downloaded skill zip.";
    });
  });
  close.addEventListener("click", () => {
    dialog.hidden = true;
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.hidden = true;
  });
}

function downloadWikiAiHelpZip(): void {
  const link = document.createElement("a");
  link.href = chrome.runtime.getURL(WIKI_AI_HELP_ZIP);
  link.download = "remilia-wiki-article-writer.zip";
  link.rel = "noopener noreferrer";
  link.click();
}

async function downloadLatestWikitool(): Promise<boolean> {
  const response = await fetch(WIKITOOL_LATEST_RELEASE_API);
  if (!response.ok) {
    openExternalUrl(WIKITOOL_RELEASES_URL);
    return false;
  }
  const release = await response.json() as GitHubRelease;
  const asset = chooseWikitoolAsset(release.assets ?? []);
  if (!asset?.browser_download_url) {
    openExternalUrl(release.html_url || WIKITOOL_RELEASES_URL);
    return false;
  }
  openExternalUrl(asset.browser_download_url);
  return true;
}

function chooseWikitoolAsset(assets: GitHubReleaseAsset[]): GitHubReleaseAsset | null {
  const platform = navigator.platform.toLowerCase();
  const userAgent = navigator.userAgent.toLowerCase();
  const isArm = /arm|aarch64/.test(platform) || /arm|aarch64/.test(userAgent);
  const candidates = assets.filter((asset) => /\.zip$/i.test(asset.name || ""));
  const preferred = platform.includes("win")
    ? ["windows", "x86_64"]
    : platform.includes("mac")
      ? ["macos", isArm ? "arm64" : "x86_64"]
      : ["linux", "x86_64"];
  return candidates.find((asset) => {
    const name = (asset.name || "").toLowerCase();
    return preferred.every((part) => name.includes(part));
  }) || candidates[0] || null;
}

function openExternalUrl(url: string): Promise<chrome.tabs.Tab> {
  return chrome.tabs.create({ url });
}

function wikiAiHelpPrompt(): string {
  return [
    "Help me draft a Remilia Wiki article.",
    "If I provide the Remilia Wikitool release or AI pack, use its AGENTS.md, codex_skills, and writing_context guidance first.",
    "If Wikitool is available locally, start with `wikitool workflow session-refresh` and `wikitool knowledge article-start \"<Topic>\" --intent new --view brief --format json`, then interview me before drafting.",
    "If local tools are not available, use the attached remilia-wiki-article-writer skill as a chat-only fallback.",
    "Interview me for the necessary facts, dates, influences, related pages, and sources. Finish with ready-to-paste MediaWiki wikitext and a short list of unresolved citation gaps.",
  ].join("\n");
}

function createWikiLaterSearch(item: WikiLaterItem): HTMLElement {
  const root = document.createElement("div");
  root.className = "wiki-later-search";
  root.dataset.status = "loading";
  root.textContent = `Searching for "${item.text}"...`;
  return root;
}

async function runWikiLaterSearch(item: WikiLaterItem, root: HTMLElement): Promise<void> {
  const results = await searchWikiPages(item.text).catch(() => []);
  if (!root.isConnected || activeWikiLaterSearchId !== item.id) return;
  root.textContent = "";
  delete root.dataset.status;
  if (results.length === 0) {
    root.dataset.status = "empty";
    root.textContent = "No matching pages found.";
    return;
  }
  for (const result of results) {
    const row = document.createElement("div");
    row.className = "wiki-later-search-row";
    const label = document.createElement("span");
    label.textContent = result.wordcount ? `${result.title} (${result.wordcount} words)` : result.title;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "settings-list-action";
    button.textContent = "Add section";
    button.addEventListener("click", () => openWikiSectionEditor(item, result.title));
    row.append(label, button);
    root.append(row);
  }
}

async function searchWikiPages(query: string): Promise<WikiSearchResult[]> {
  const url = new URL(WIKI_API);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  url.searchParams.set("list", "search");
  url.searchParams.set("srlimit", "5");
  url.searchParams.set("srsearch", query);
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json() as { query?: { search?: WikiSearchResult[] } };
  return data.query?.search ?? [];
}

function openWikiNewPage(item: WikiLaterItem): void {
  const url = wikiEditUrl(titleFromLaterText(item.text));
  url.searchParams.set("preload", WIKI_PRELOAD_TEMPLATE);
  openWikiEditorUrl(url);
}

function openWikiSectionEditor(item: WikiLaterItem, pageTitle: string): void {
  const url = wikiEditUrl(pageTitle);
  url.searchParams.set("section", "new");
  url.searchParams.set("preload", WIKI_PRELOAD_TEMPLATE);
  url.searchParams.set("preloadtitle", item.text);
  openWikiEditorUrl(url);
}

function wikiEditUrl(title: string): URL {
  const url = new URL("https://wiki.remilia.org/index.php");
  url.searchParams.set("title", title);
  url.searchParams.set("action", "edit");
  return url;
}

function titleFromLaterText(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean
    .split(" ")
    .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : "")
    .join(" ");
}

function openWikiEditorUrl(url: URL): void {
  void chrome.tabs.create({ url: url.toString() });
}

async function removeWikiLaterItem(id: string, currentItems: WikiLaterItem[]): Promise<void> {
  await chrome.storage.local.set({
    [WIKI_LATER_KEY]: currentItems.filter((item) => item.id !== id),
  });
}

function normalizeWikiLaterItems(value: unknown): WikiLaterItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      id: typeof item.id === "string" && item.id ? item.id : `${item.createdAt || Date.now()}-${item.text || ""}`,
      text: typeof item.text === "string" ? item.text : "",
      pageUrl: typeof item.pageUrl === "string" ? item.pageUrl : undefined,
      createdAt: typeof item.createdAt === "number" ? item.createdAt : 0,
    }))
    .filter((item) => item.text.trim().length > 0)
    .sort((left, right) => right.createdAt - left.createdAt);
}

function shortUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname}`;
  } catch {
    return value;
  }
}

function setupUpdateStatus(): void {
  const refresh = document.getElementById("updateRefresh") as HTMLButtonElement | null;
  const download = document.getElementById("updateDownload") as HTMLButtonElement | null;
  const copySteps = document.getElementById("updateCopySteps") as HTMLButtonElement | null;
  const reload = document.getElementById("updateReload") as HTMLButtonElement | null;
  const message = document.getElementById("updateMessage");
  void renderUpdateStatus();
  refresh?.addEventListener("click", () => {
    refresh.disabled = true;
    void chrome.runtime.sendMessage({ type: "milxdy:checkUpdate" })
      .then((status) => renderUpdateStatus(isUpdateStatus(status) ? status : undefined))
      .finally(() => {
        refresh.disabled = false;
      });
  });
  download?.addEventListener("click", () => {
    void currentUpdateStatus().then((status) => {
      const url = status?.latestAssetUrl || status?.latestUrl;
      if (!url) {
        if (message) message.textContent = "No release download is available yet. Try refresh first.";
        return;
      }
      openExternalUrl(url);
      if (message) message.textContent = status?.latestAssetUrl ? "Opened the release zip download." : "Opened the release page.";
    });
  });
  copySteps?.addEventListener("click", () => {
    void currentUpdateStatus().then((status) => {
      const steps = updateStepsText(status);
      void navigator.clipboard.writeText(steps).then(() => {
        if (message) message.textContent = "Update steps copied. Replace files in the same folder before using Reload.";
      }).catch(() => {
        if (message) message.textContent = "Copy failed. Use the README update steps.";
      });
    });
  });
  reload?.addEventListener("click", () => {
    if (message) message.textContent = "Reloading extension. Refresh X/Twitter tabs after it comes back.";
    window.setTimeout(() => chrome.runtime.reload(), 250);
  });
}

async function renderUpdateStatus(status?: UpdateStatus): Promise<void> {
  const root = document.getElementById("updateStatus");
  const title = document.getElementById("updateStatusTitle");
  const detail = document.getElementById("updateStatusDetail");
  const link = document.getElementById("updateLink") as HTMLAnchorElement | null;
  const download = document.getElementById("updateDownload") as HTMLButtonElement | null;
  const copySteps = document.getElementById("updateCopySteps") as HTMLButtonElement | null;
  const reload = document.getElementById("updateReload") as HTMLButtonElement | null;
  if (!root || !title || !detail || !link || !download || !copySteps || !reload) return;

  const installedVersion = chrome.runtime.getManifest().version;
  const stored = status ? { [UPDATE_STATUS_KEY]: status } : await chrome.storage.local.get(UPDATE_STATUS_KEY);
  const updateStatus = isUpdateStatus(stored[UPDATE_STATUS_KEY]) ? stored[UPDATE_STATUS_KEY] : null;
  delete root.dataset.state;
  link.hidden = true;
  download.hidden = true;
  copySteps.hidden = true;
  reload.hidden = true;
  link.removeAttribute("href");

  if (!updateStatus) {
    title.textContent = "Checking for updates...";
    detail.textContent = `Installed v${installedVersion}.`;
    return;
  }

  if (updateStatus.updateAvailable && updateStatus.latestVersion) {
    root.dataset.state = "available";
    title.textContent = `Update available: v${updateStatus.latestVersion}`;
    detail.textContent = `Installed v${updateStatus.currentVersion}. Download, replace files in the same folder, then reload to preserve settings and stats.`;
    download.hidden = false;
    copySteps.hidden = false;
    reload.hidden = false;
    if (updateStatus.latestUrl) {
      link.href = updateStatus.latestUrl;
      link.hidden = false;
    }
    return;
  }

  if (updateStatus.error) {
    root.dataset.state = "error";
    title.textContent = "Update check failed";
    detail.textContent = `${updateStatus.error}. Installed v${installedVersion}.`;
    return;
  }

  title.textContent = "milXdy is up to date";
  detail.textContent = `Installed v${updateStatus.currentVersion}. Last checked ${formatCheckedAt(updateStatus.checkedAt)}.`;
  copySteps.hidden = false;
  reload.hidden = false;
}

async function currentUpdateStatus(): Promise<UpdateStatus | null> {
  const stored = await chrome.storage.local.get(UPDATE_STATUS_KEY);
  return isUpdateStatus(stored[UPDATE_STATUS_KEY]) ? stored[UPDATE_STATUS_KEY] : null;
}

function updateStepsText(status: UpdateStatus | null): string {
  const installedVersion = chrome.runtime.getManifest().version;
  const latest = status?.latestVersion ? `v${status.latestVersion}` : "the latest release";
  const asset = status?.latestAssetName ? ` (${status.latestAssetName})` : "";
  const releaseUrl = status?.latestUrl || "https://github.com/bonklek/milXdy/releases";
  const downloadUrl = status?.latestAssetUrl || releaseUrl;
  return [
    `milXdy in-place update steps`,
    "",
    `Installed: v${status?.currentVersion || installedVersion}`,
    `Target: ${latest}${asset}`,
    "",
    "1. Download the latest milXdy prerelease zip:",
    downloadUrl,
    "2. Unzip it over the same folder this unpacked extension already uses.",
    "3. Do not remove milXdy from chrome://extensions.",
    "4. Do not load a fresh folder as a second unpacked extension.",
    "5. Return to the milXdy popup and click Reload, or press reload on the existing chrome://extensions card.",
    "6. Refresh open X/Twitter tabs.",
    "",
    "Keeping the same loaded folder preserves Chrome extension storage, including Maxxer stats, settings, diagnostics, and RemiNet/Beetol login state.",
  ].join("\n");
}

function isUpdateStatus(value: unknown): value is UpdateStatus {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.checkedAt === "number"
    && typeof record.currentVersion === "string"
    && (typeof record.latestAssetUrl === "string" || record.latestAssetUrl == null)
    && (typeof record.latestAssetName === "string" || record.latestAssetName == null)
    && typeof record.updateAvailable === "boolean";
}

function formatCheckedAt(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "recently";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

async function renderStatus(): Promise<void> {
  const statusGrid = document.getElementById("statusGrid");
  if (!statusGrid) return;
  const [local, sync] = await Promise.all([
    chrome.storage.local.get([
      "stats",
      "matchedAccounts",
      "playerStats",
      "milxdy.diagnostics.scanner",
      "milxdy.diagnostics.miladyDetection",
      "milxdy.diagnostics.loadedFeatures",
      "remiliaWikiHyperlink.performance",
    ]),
    chrome.storage.sync.get(["mode"]),
  ]);
  const stats = objectValue(local.stats);
  const matchedAccounts = objectValue(local.matchedAccounts);
  const scanner = objectValue(local["milxdy.diagnostics.scanner"]);
  const miladyDetection = objectValue(local["milxdy.diagnostics.miladyDetection"]);
  const loadedFeatures = objectValue(local["milxdy.diagnostics.loadedFeatures"]);
  const wikiPerformance = objectValue(local["remiliaWikiHyperlink.performance"]);
  statusGrid.innerHTML = "";
  for (const item of [
    ["Loaded bundles", Array.isArray(loadedFeatures.features) ? loadedFeatures.features.join(", ") || "none" : "unknown"],
    ["Mode", typeof sync.mode === "string" ? sync.mode : "milady"],
    ["Maxxer matches", String(Object.keys(matchedAccounts).length)],
    ["Avatars checked", String(stats.avatarsChecked ?? 0)],
    ["Cache hits", String(stats.cacheHits ?? 0)],
    ["Scanner emitted", String(scanner.surfacesEmitted ?? 0)],
    ["Scanner flush", `${String(scanner.lastFlushMs ?? 0)} ms`],
    ["Detection queue", `${String(miladyDetection.active ?? 0)} active / ${String(miladyDetection.queued ?? 0)} queued`],
    ["Wiki links", String(wikiPerformance.linksCreated ?? 0)],
  ]) {
    const node = document.createElement("div");
    node.className = "status-item";
    node.innerHTML = `<strong>${escapeHtml(item[1])}</strong><span>${escapeHtml(item[0])}</span>`;
    statusGrid.appendChild(node);
  }
}

function setupReportActions(): void {
  const message = document.getElementById("reportMessage");
  const llmAssist = document.getElementById("reportLlmAssist") as HTMLInputElement | null;
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-report-target]"));
  for (const button of buttons) {
    button.addEventListener("click", () => {
      const target = button.dataset.reportTarget === "github" ? "github" : "x";
      const template = bugReportTemplate();
      if (llmAssist?.checked) {
        void navigator.clipboard.writeText(llmBugReportPrompt(target, template)).then(() => {
          void openExternalUrl(target === "github" ? GITHUB_ISSUES_NEW_URL : xReplyUrl(""))
            .then(() => showLlmPromptCopiedNotification(target))
            .catch(() => showLlmPromptCopiedNotification(target));
          if (message) {
            message.textContent = `LLM prompt copied. Paste it into a chat window, then use the opened ${target === "github" ? "GitHub issue" : "X reply"} when your report is ready.`;
          }
        }).catch(() => {
          if (message) message.textContent = "Copy failed. Disable LLM assisted to open a prefilled report instead.";
        });
        return;
      }
      if (target === "github") {
        openExternalUrl(githubIssueUrl(template));
        if (message) message.textContent = "Opened GitHub issue form.";
        return;
      }
      openExternalUrl(xReplyUrl(template.x));
      if (message) message.textContent = "Opened X reply composer.";
    });
  }
}

function bugReportTemplate(): { title: string; full: string; x: string } {
  const version = chrome.runtime.getManifest().version;
  return {
    title: "[Bug]: ",
    full: [
      "### Bug report",
      "",
      `milXdy version: ${version}`,
      "Browser:",
      "Feature area:",
      "What happened:",
      "Expected:",
      "Steps to reproduce:",
      "Console errors/screenshots:",
    ].join("\n"),
    x: [
      "🐞 milXdy bug report",
      `v${version}`,
      "Feature:",
      "Issue:",
      "Steps:",
      "Expected:",
    ].join("\n"),
  };
}

function llmBugReportPrompt(target: "github" | "x", template: { title: string; full: string; x: string }): string {
  const version = chrome.runtime.getManifest().version;
  const targetInstructions = target === "github"
    ? [
      "Final destination: GitHub issue.",
      "Output a clear issue title and a Markdown body that follows the template below.",
      "Prefer concise sections, reproduction steps, expected behavior, actual behavior, environment, suspected area, screenshots/logs, and impact.",
      "If information is missing, ask targeted questions before drafting. Do not invent facts.",
    ]
    : [
      "Final destination: X reply to the milXdy bug collector tweet.",
      `Collector tweet: ${X_FEEDBACK_COLLECTOR_URL}`,
      "Respect X character limits. First try to produce one reply under 240 characters that includes feature area, symptom, and reproduction cue.",
      "If the bug needs more detail, output a short reply plus a second expanded note. If you can generate images, offer to create a screenshot-style summary card so the report can fit despite character limits.",
      "Ask targeted questions before drafting. Do not invent facts.",
    ];

  return [
    "Help me create a high-quality milXdy bug report through a short interview.",
    "",
    `milXdy version: ${version}`,
    ...targetInstructions,
    "",
    "Interview flow:",
    "1. Ask only the most relevant questions needed to make the report actionable.",
    "2. Prioritize exact page or feature, what the user clicked or saw, expected vs actual behavior, repeatability, browser/extension version, console errors, screenshots, and whether reloading X or the extension changes anything.",
    "3. If the user is unsure, help them gather evidence with simple steps, such as checking the Diag tab values or copying visible error text.",
    "4. When enough detail is available, output only the final report text for the selected destination.",
    "",
    "Quality bar:",
    "- Make it reproducible.",
    "- Keep speculation separate from observed facts.",
    "- Include privacy reminders before asking for screenshots or logs.",
    "- Keep the user's tone intact while making the report concise.",
    "",
    "Template:",
    target === "github" ? template.full : template.x,
  ].join("\n");
}

function showLlmPromptCopiedNotification(target: "github" | "x"): void {
  chrome.notifications.create(`milxdy-llm-bug-report-${Date.now()}`, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon128.png"),
    title: "LLM prompt copied",
    message: `Paste it into your LLM chat, answer its questions, then use the opened ${target === "github" ? "GitHub issue" : "X reply"} for the final bug report.`,
  });
}

function githubIssueUrl(template: { title: string; full: string }): string {
  const url = new URL(GITHUB_ISSUES_NEW_URL);
  url.searchParams.set("title", template.title);
  url.searchParams.set("body", template.full);
  url.searchParams.set("labels", "bug");
  return url.toString();
}

function xReplyUrl(template: string): string {
  const url = new URL(X_FEEDBACK_REPLY_URL);
  url.searchParams.set("in_reply_to", X_FEEDBACK_POST_ID);
  url.searchParams.set("text", template);
  return url.toString();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char] ?? char);
}

async function setupBeetolPanel(): Promise<void> {
  const session = document.getElementById("beetolSession");
  const status = document.getElementById("beetolStatus");
  const authDetail = document.getElementById("beetolAuthDetail");
  const form = document.getElementById("beetolLoginForm") as HTMLFormElement | null;
  const username = document.getElementById("beetolUsername") as HTMLInputElement | null;
  const password = document.getElementById("beetolPassword") as HTMLInputElement | null;
  const logout = document.getElementById("beetolLogout") as HTMLButtonElement | null;
  const openSso = document.getElementById("beetolOpenSso") as HTMLButtonElement | null;
  const retrySession = document.getElementById("beetolRetrySession") as HTMLButtonElement | null;
  const pokeDiagnostic = document.getElementById("beetolPokeDiagnostic");
  const color = document.getElementById("beetolColor") as HTMLSelectElement | null;
  const mode = document.getElementById("beetolMode") as HTMLSelectElement | null;
  const message = document.getElementById("beetolMessage");

  if (!session || !status || !authDetail || !form || !username || !password || !logout || !openSso || !retrySession || !pokeDiagnostic || !color || !mode || !message) return;

  const settings = await chrome.storage.local.get(["beetolColor", "beetolMode"]);
  color.value = typeof settings.beetolColor === "string" ? settings.beetolColor : "red";
  mode.value = typeof settings.beetolMode === "string" ? settings.beetolMode : "settings";

  const setMessage = (text: string, kind = "") => {
    message.textContent = text;
    if (kind) message.dataset.kind = kind;
    else delete message.dataset.kind;
  };

  const renderAuth = (signedIn: boolean, method = "") => {
    session.toggleAttribute("data-signed-in", signedIn);
    status.parentElement?.toggleAttribute("data-signed-in", signedIn);
    status.textContent = signedIn
      ? `Login active${method === "session" ? " via browser session" : ""}`
      : "Not signed in";
    authDetail.textContent = signedIn
      ? ""
      : "Sign in to remilia.net to use Beetol hunts and RemiStats pokes. Passwords are not stored.";
    form.hidden = signedIn;
    logout.hidden = !signedIn;
    openSso.hidden = signedIn;
    retrySession.hidden = signedIn;
    if (signedIn) pokeDiagnostic.hidden = true;
  };

  const auth = await chrome.runtime.sendMessage({ type: "beetol:authStatus" }).catch(() => null);
  const signedIn = Boolean(auth?.signedIn);
  renderAuth(signedIn, typeof auth?.method === "string" ? auth.method : "");
  if (signedIn) pokeDiagnostic.hidden = true;
  else await renderPokeDiagnostic(pokeDiagnostic);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    setMessage("Logging in...");
    void chrome.runtime.sendMessage({
      type: "beetol:login",
      username: username.value,
      password: password.value,
    }).then((response) => {
      password.value = "";
      if (!response?.ok) {
        const description = String(response?.description || "");
        const has2fa = /otp|mfa|two.factor|authenticat|not fully set up/i.test(description);
        setMessage(has2fa
          ? "2FA requires RemiliaNET SSO. Open SSO, finish login, then retry session."
          : "Login failed.",
        "warn");
        renderAuth(false);
        return;
      }
      setMessage("Logged in.");
      renderAuth(true);
    });
  });

  openSso.addEventListener("click", () => {
    openExternalUrl(REMILIA_NET_LOGIN_URL);
    setMessage("Finish RemiliaNET login in the opened tab, then click Retry session.");
  });

  retrySession.addEventListener("click", () => {
    retrySession.disabled = true;
    setMessage("Checking browser session...");
    void chrome.runtime.sendMessage({ type: "beetol:sessionStatus" }).then((response) => {
      const signedIn = Boolean(response?.signedIn);
      renderAuth(signedIn, signedIn ? "session" : "");
      setMessage(signedIn
        ? "Browser session detected. Some RemiliaNET actions may still require popup login."
        : "No browser session detected. Complete RemiliaNET SSO first.",
      signedIn ? "" : "warn");
    }).finally(() => {
      retrySession.disabled = false;
    });
  });

  logout.addEventListener("click", () => {
    void chrome.runtime.sendMessage({ type: "beetol:logout" }).then(() => {
      setMessage("Logged out.");
      renderAuth(false);
    });
  });

  color.addEventListener("change", () => {
    void chrome.storage.local.set({ beetolColor: color.value });
  });
  mode.addEventListener("change", () => {
    void chrome.storage.local.set({ beetolMode: mode.value });
  });
}

async function renderPokeDiagnostic(root: HTMLElement): Promise<void> {
  const stored = await chrome.storage.local.get(LAST_POKE_DIAGNOSTIC_KEY);
  const diagnostic = objectValue(stored[LAST_POKE_DIAGNOSTIC_KEY]);
  if (!Object.keys(diagnostic).length) {
    root.hidden = true;
    return;
  }
  const updatedAt = typeof diagnostic.updatedAt === "number"
    ? formatCheckedAt(diagnostic.updatedAt)
    : "unknown";
  root.hidden = false;
  root.textContent = [
    `Last poke: ${diagnostic.ok ? "ok" : "failed"} (${updatedAt})`,
    `Target: ${String(diagnostic.username || "")}`,
    `Error: ${String(diagnostic.error || "")}`,
  ].join("\n");
}

export {};
