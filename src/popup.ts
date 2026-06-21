type Area = "local" | "sync";
type ControlKind = "boolean" | "number" | "string" | "nullableString" | "handleList";

type ControlBinding = {
  area: Area;
  key: string;
  property?: string;
  kind: ControlKind;
  fallback: boolean | number | string | null | string[];
};

const WIKI_SETTINGS_KEY = "remiliaWikiHyperlink.settings";
const UPDATE_STATUS_KEY = "milxdy.updateStatus";

type UpdateStatus = {
  checkedAt: number;
  currentVersion: string;
  latestVersion: string | null;
  latestUrl: string | null;
  updateAvailable: boolean;
  error?: string;
};

const bindings: Record<string, ControlBinding> = {
  diagnosticsEnabled: { area: "local", key: "milxdy.diagnostics.enabled", kind: "boolean", fallback: false },
  "wiki.enabled": { area: "local", key: WIKI_SETTINGS_KEY, property: "enabled", kind: "boolean", fallback: true },
  "wiki.previewsEnabled": { area: "local", key: WIKI_SETTINGS_KEY, property: "previewsEnabled", kind: "boolean", fallback: true },
  "wiki.debugMode": { area: "local", key: WIKI_SETTINGS_KEY, property: "debugMode", kind: "boolean", fallback: false },
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
  "milady.mode": { area: "sync", key: "mode", kind: "string", fallback: "milady" },
  "milady.soundEnabled": { area: "sync", key: "soundEnabled", kind: "boolean", fallback: true },
  "milady.showLevelBadge": { area: "sync", key: "showLevelBadge", kind: "boolean", fallback: true },
  "milady.includeRemiStatsBeetles": { area: "sync", key: "includeRemiStatsBeetles", kind: "boolean", fallback: true },
  "milady.cardTheme": { area: "sync", key: "cardTheme", kind: "string", fallback: "full" },
  "milady.whitelistHandles": { area: "sync", key: "whitelistHandles", kind: "handleList", fallback: [] },
  "milady.miladyListHandles": { area: "sync", key: "miladyListHandles", kind: "handleList", fallback: [] },
  "bextol.enabled": { area: "local", key: "milxdy.bextol.enabled", kind: "boolean", fallback: true },
};

void boot();

async function boot(): Promise<void> {
  setupTabs();
  setupUpdateStatus();
  await loadControls();
  await setupBextolPanel();
  await renderStatus();
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

function setupUpdateStatus(): void {
  const refresh = document.getElementById("updateRefresh") as HTMLButtonElement | null;
  void renderUpdateStatus();
  refresh?.addEventListener("click", () => {
    refresh.disabled = true;
    void chrome.runtime.sendMessage({ type: "milxdy:checkUpdate" })
      .then((status) => renderUpdateStatus(isUpdateStatus(status) ? status : undefined))
      .finally(() => {
        refresh.disabled = false;
      });
  });
}

async function renderUpdateStatus(status?: UpdateStatus): Promise<void> {
  const root = document.getElementById("updateStatus");
  const title = document.getElementById("updateStatusTitle");
  const detail = document.getElementById("updateStatusDetail");
  const link = document.getElementById("updateLink") as HTMLAnchorElement | null;
  if (!root || !title || !detail || !link) return;

  const installedVersion = chrome.runtime.getManifest().version;
  const stored = status ? { [UPDATE_STATUS_KEY]: status } : await chrome.storage.local.get(UPDATE_STATUS_KEY);
  const updateStatus = isUpdateStatus(stored[UPDATE_STATUS_KEY]) ? stored[UPDATE_STATUS_KEY] : null;
  delete root.dataset.state;
  link.hidden = true;
  link.removeAttribute("href");

  if (!updateStatus) {
    title.textContent = "Checking for updates...";
    detail.textContent = `Installed v${installedVersion}.`;
    return;
  }

  if (updateStatus.updateAvailable && updateStatus.latestVersion) {
    root.dataset.state = "available";
    title.textContent = `Update available: v${updateStatus.latestVersion}`;
    detail.textContent = `Installed v${updateStatus.currentVersion}. Download the latest GitHub release and reload the unpacked extension.`;
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
}

function isUpdateStatus(value: unknown): value is UpdateStatus {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.checkedAt === "number"
    && typeof record.currentVersion === "string"
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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char] ?? char);
}

async function setupBextolPanel(): Promise<void> {
  const status = document.getElementById("bextolStatus");
  const form = document.getElementById("bextolLoginForm") as HTMLFormElement | null;
  const username = document.getElementById("bextolUsername") as HTMLInputElement | null;
  const password = document.getElementById("bextolPassword") as HTMLInputElement | null;
  const logout = document.getElementById("bextolLogout") as HTMLButtonElement | null;
  const color = document.getElementById("bextolColor") as HTMLSelectElement | null;
  const mode = document.getElementById("bextolMode") as HTMLSelectElement | null;
  const message = document.getElementById("bextolMessage");

  if (!status || !form || !username || !password || !logout || !color || !mode || !message) return;

  const settings = await chrome.storage.local.get(["bextolColor", "bextolMode"]);
  color.value = typeof settings.bextolColor === "string" ? settings.bextolColor : "red";
  mode.value = typeof settings.bextolMode === "string" ? settings.bextolMode : "dark";

  const setMessage = (text: string, kind = "") => {
    message.textContent = text;
    if (kind) message.dataset.kind = kind;
    else delete message.dataset.kind;
  };

  const renderAuth = (signedIn: boolean) => {
    status.textContent = signedIn ? "Signed in to remilia.net" : "Not signed in";
    form.hidden = signedIn;
    logout.hidden = !signedIn;
  };

  const auth = await chrome.runtime.sendMessage({ type: "bextol:authStatus" }).catch(() => null);
  renderAuth(Boolean(auth?.signedIn));

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    setMessage("Logging in...");
    void chrome.runtime.sendMessage({
      type: "bextol:login",
      username: username.value,
      password: password.value,
    }).then((response) => {
      password.value = "";
      if (!response?.ok) {
        const description = String(response?.description || "");
        const has2fa = /otp|mfa|two.factor|authenticat|not fully set up/i.test(description);
        setMessage(has2fa ? "2FA is not supported by this flow." : "Login failed.", "warn");
        renderAuth(false);
        return;
      }
      setMessage("Logged in.");
      renderAuth(true);
    });
  });

  logout.addEventListener("click", () => {
    void chrome.runtime.sendMessage({ type: "bextol:logout" }).then(() => {
      setMessage("Logged out.");
      renderAuth(false);
    });
  });

  color.addEventListener("change", () => {
    void chrome.storage.local.set({ bextolColor: color.value });
  });
  mode.addEventListener("change", () => {
    void chrome.storage.local.set({ bextolMode: mode.value });
  });
}

export {};
