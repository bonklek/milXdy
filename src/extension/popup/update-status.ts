import { normalizeBuildTarget, type BuildTarget } from "./build-identity";
declare const MILXDY_BUILD_TARGET: string;
const BUILD_TARGET = normalizeBuildTarget(MILXDY_BUILD_TARGET);
const UPDATE_STATUS_KEY = "milxdy.updateStatus";
const UPDATE_LLM_PROVIDER_KEY = "milxdy.update.llmProvider";
const UPDATE_LLM_CUSTOM_URL_KEY = "milxdy.update.llmCustomUrl";
type UpdateStatus = {
  checkedAt: number;
  currentVersion: string;
  buildTarget?: BuildTarget;
  latestVersion: string | null;
  latestUrl: string | null;
  latestAssetUrl?: string | null;
  latestAssetName?: string | null;
  expectedAssetName?: string | null;
  matchedExpectedAsset?: boolean;
  updateAvailable: boolean;
  error?: string;
};

function openExternalUrl(url: string): Promise<chrome.tabs.Tab> { return chrome.tabs.create({ url }); }
function bindRefresh(refresh: HTMLButtonElement | null, message: HTMLElement | null): void {
  refresh?.addEventListener("click", () => {
    const startedAt = performance.now();
    const minimumLoopMs = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1100;
    refresh.disabled = true;
    refresh.classList.add("is-checking");
    refresh.setAttribute("aria-busy", "true");
    refresh.setAttribute("aria-label", "Checking for updates");
    void chrome.runtime.sendMessage({ type: "milxdy:checkUpdate" })
      .then((status) => renderUpdateStatus(isUpdateStatus(status) ? status : undefined))
      .catch(() => {
        const title = document.getElementById("updateStatusTitle");
        if (title) title.textContent = "Update check failed";
        if (message) message.textContent = "Try checking again.";
      })
      .finally(async () => {
        // Cached/up-to-date responses can finish before the browser paints a frame.
        // Show at least one full turn for every click; longer checks keep looping.
        const remaining = minimumLoopMs - (performance.now() - startedAt);
        if (remaining > 0) await new Promise<void>(resolve => window.setTimeout(resolve, remaining));
        refresh.disabled = false;
        refresh.classList.remove("is-checking");
        refresh.removeAttribute("aria-busy");
        refresh.setAttribute("aria-label", "Check for updates");
      });
  });
}
export function setupUpdateStatus(): void {
  const refresh = document.getElementById("updateRefresh") as HTMLButtonElement | null;
  const download = document.getElementById("updateDownload") as HTMLButtonElement | null;
  const copySteps = document.getElementById("updateCopySteps") as HTMLButtonElement | null;
  const llmProvider = document.getElementById("updateLlmProvider") as HTMLSelectElement | null;
  const openLlm = document.getElementById("updateOpenLlm") as HTMLButtonElement | null;
  const reload = document.getElementById("updateReload") as HTMLButtonElement | null;
  const message = document.getElementById("updateMessage");
  void renderUpdateStatus();
  void chrome.storage.local.get({ [UPDATE_LLM_PROVIDER_KEY]: "none" }).then((stored) => {
    if (llmProvider) llmProvider.value = normalizeUpdateLlmProvider(stored[UPDATE_LLM_PROVIDER_KEY]);
  });
  llmProvider?.addEventListener("change", () => {
    void saveUpdateLlmProvider(llmProvider.value);
  });
  bindRefresh(refresh, message);
  download?.addEventListener("click", () => {
    void currentUpdateStatus().then((status) => {
      const safeDirectAsset = isDirectUpdateAssetSafe(status) ? status : null;
      const directAssetUrl = safeDirectAsset?.latestAssetUrl || null;
      const directAssetName = safeDirectAsset?.latestAssetName || null;
      const url = directAssetUrl || status?.latestUrl;
      if (!url) {
        if (message) message.textContent = "No release download is available yet. Try refresh first.";
        return;
      }
      openExternalUrl(url);
      if (message) {
        message.textContent = directAssetUrl
          ? `Opened ${directAssetName}.`
          : "Opened the release page.";
      }
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
  openLlm?.addEventListener("click", () => {
    void currentUpdateStatus().then(async (status) => {
      const selectedProvider = llmProvider ? normalizeUpdateLlmProvider(llmProvider.value) : "none";
      if (selectedProvider === "none") {
        if (message) message.textContent = "Choose an LLM first.";
        llmProvider?.focus();
        return;
      }
      const provider = await saveUpdateLlmProvider(selectedProvider);
      if (provider === "none") {
        if (message) message.textContent = "Choose an LLM first.";
        llmProvider?.focus();
        return;
      }
      const prompt = updateStepsLlmPrompt(status);
      try {
        await navigator.clipboard.writeText(prompt);
      } catch {
        if (message) message.textContent = "Copy failed. Copy Steps first, then open your LLM manually.";
        return;
      }
      const url = await updateLlmUrl(provider);
      if (!url) {
        if (message) message.textContent = "Custom LLM URL was not set.";
        return;
      }
      openExternalUrl(url);
      if (message) message.textContent = "LLM prompt copied. Paste it into the opened chat if the site does not accept prefilled text.";
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
  const llmProvider = document.getElementById("updateLlmProvider") as HTMLSelectElement | null;
  const openLlm = document.getElementById("updateOpenLlm") as HTMLButtonElement | null;
  const reload = document.getElementById("updateReload") as HTMLButtonElement | null;
  if (!root || !title || !detail || !link || !download || !copySteps || !llmProvider || !openLlm || !reload) return;

  const installedVersion = chrome.runtime.getManifest().version;
  const stored = status ? { [UPDATE_STATUS_KEY]: status } : await chrome.storage.local.get(UPDATE_STATUS_KEY);
  const updateStatus = isUpdateStatus(stored[UPDATE_STATUS_KEY]) ? stored[UPDATE_STATUS_KEY] : null;
  delete root.dataset.state;
  link.hidden = true;
  download.hidden = true;
  copySteps.hidden = true;
  llmProvider.hidden = true;
  openLlm.hidden = true;
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
    detail.textContent = isDirectUpdateAssetSafe(updateStatus)
      ? `Installed v${updateStatus.currentVersion}. Download ${updateStatus.latestAssetName}, replace files in the same folder, then reload to preserve settings and stats.`
      : `Installed v${updateStatus.currentVersion}. Expected ${updateStatus.expectedAssetName || "this build's profile archive"}; Download opens the release page so you can choose the matching archive.`;
    download.hidden = false;
    copySteps.hidden = false;
    llmProvider.hidden = false;
    openLlm.hidden = false;
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
  llmProvider.hidden = false;
  openLlm.hidden = false;
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
  const expected = status?.expectedAssetName ? `Expected archive: ${status.expectedAssetName}` : "";
  const releaseUrl = status?.latestUrl || "https://github.com/bonklek/milXdy/releases";
  const downloadUrl = isDirectUpdateAssetSafe(status) ? status.latestAssetUrl : releaseUrl;
  return [
    `milXdy in-place update steps`,
    "",
    `Installed: v${status?.currentVersion || installedVersion}`,
    `Target: ${latest}${asset}`,
    expected,
    "",
    "1. Download the latest milXdy release zip:",
    downloadUrl,
    "2. Unzip it over the same folder this unpacked extension already uses.",
    "3. Do not remove milXdy from chrome://extensions.",
    "4. Do not load a fresh folder as a second unpacked extension.",
    "5. Return to the milXdy popup and click Reload, or press reload on the existing chrome://extensions card.",
    "6. Refresh open X/Twitter tabs.",
    "",
    "Keeping the same loaded folder preserves Chrome extension storage, including Maxxer stats, settings, and diagnostics. Reloading clears the milXdy Remilia connection; reconnect explicitly. The RemiliaNET website sign-in is separate.",
  ].join("\n");
}

function updateStepsLlmPrompt(status: UpdateStatus | null): string {
  const browserName = BUILD_TARGET === "firefox" ? "Firefox temporary add-on" : "Chrome unpacked extension";
  return [
    `Help me update a ${browserName} named milXdy without losing local extension storage.`,
    "",
    "Use these exact update steps as the source of truth. Turn them into a concise checklist, ask me before any destructive step, and remind me not to remove the existing extension or load a second folder.",
    "",
    updateStepsText(status),
  ].join("\n");
}

type UpdateLlmProvider = "none" | "chatgpt" | "claude" | "grok" | "custom";

function normalizeUpdateLlmProvider(value: unknown): UpdateLlmProvider {
  return value === "chatgpt" || value === "claude" || value === "grok" || value === "custom" ? value : "none";
}

async function saveUpdateLlmProvider(value: string): Promise<UpdateLlmProvider> {
  const provider = normalizeUpdateLlmProvider(value);
  const updates: Record<string, string> = { [UPDATE_LLM_PROVIDER_KEY]: provider };
  if (provider === "custom") {
    const stored = await chrome.storage.local.get(UPDATE_LLM_CUSTOM_URL_KEY);
    const current = typeof stored[UPDATE_LLM_CUSTOM_URL_KEY] === "string" ? stored[UPDATE_LLM_CUSTOM_URL_KEY] : "";
    if (!current) {
      const customUrl = window.prompt("Custom LLM chat URL", "https://chat.openai.com/")?.trim() || "";
      if (customUrl) updates[UPDATE_LLM_CUSTOM_URL_KEY] = customUrl;
    }
  }
  await chrome.storage.local.set(updates);
  return provider;
}

async function updateLlmUrl(provider: UpdateLlmProvider): Promise<string | null> {
  if (provider === "none") return null;
  if (provider === "claude") return "https://claude.ai/new";
  if (provider === "grok") return "https://x.com/i/grok";
  if (provider === "custom") {
    const stored = await chrome.storage.local.get(UPDATE_LLM_CUSTOM_URL_KEY);
    return typeof stored[UPDATE_LLM_CUSTOM_URL_KEY] === "string" && stored[UPDATE_LLM_CUSTOM_URL_KEY].trim()
      ? stored[UPDATE_LLM_CUSTOM_URL_KEY].trim()
      : null;
  }
  return "https://chatgpt.com/";
}

function isUpdateStatus(value: unknown): value is UpdateStatus {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.checkedAt === "number"
    && typeof record.currentVersion === "string"
    && (record.buildTarget === "chromium" || record.buildTarget === "firefox" || record.buildTarget == null)
    && (typeof record.latestAssetUrl === "string" || record.latestAssetUrl == null)
    && (typeof record.latestAssetName === "string" || record.latestAssetName == null)
    && (typeof record.expectedAssetName === "string" || record.expectedAssetName == null)
    && (typeof record.matchedExpectedAsset === "boolean" || record.matchedExpectedAsset == null)
    && typeof record.updateAvailable === "boolean";
}

function isDirectUpdateAssetSafe(status: UpdateStatus | null): status is UpdateStatus & {
  latestAssetUrl: string;
  latestAssetName: string;
} {
  return Boolean(
    status
      && status.buildTarget === BUILD_TARGET
      && status.matchedExpectedAsset === true
      && typeof status.latestAssetUrl === "string"
      && typeof status.latestAssetName === "string",
  );
}

export function formatCheckedAt(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "recently";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
