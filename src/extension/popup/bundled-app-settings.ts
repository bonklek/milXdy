import type { AppSettingDefinition, MilxdyAppManifest } from "../../platform/app-sdk/app-platform";
import { refreshSettingsChoice } from "./settings-tiles";

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
type BoundSetting = { setting: AppSettingDefinition; control: Control; output?: HTMLOutputElement; scale: number };
const writes = new Map<string, Promise<void>>();

// Authored app palette accents, matching their existing panels and previews.
const appColors: Record<string, string> = {
  rootVisuals: "#1f6f5b",
  composerTools: "#1f6f5b",
  tweetPng: "#b67cff", // Share Kit export palette.
  wiki: "#fce096", // Wiki reader chrome.
  linkBrowser: "#626bb2", // Shared Remilia app chrome.
  "post-reading": "#626bb2",
  remistats: "#e53d30", // RemiStats poke palette.
  miladymaxxer: "#f0b72d",
  beetol: "#626bb2",
  reminetChat: "#626bb2",
  miladychanSpotlight: "#789922", // Board quote palette.
  music: "#c8ad55",
};

export function bundledSettingValue(setting: AppSettingDefinition, stored: unknown): unknown {
  const value = setting.storage.property ? record(stored)[setting.storage.property] : stored;
  return value ?? setting.defaultValue;
}

export function bundledSettingPatch(setting: AppSettingDefinition, stored: unknown, value: unknown): unknown {
  return setting.storage.property ? { ...record(stored), [setting.storage.property]: value } : value;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function normalizeBundledSetting(setting: AppSettingDefinition, value: unknown): unknown {
  if(setting.control.type === "slider" || setting.control.type === "number") {
    const numeric = Number(value);
    if(!Number.isFinite(numeric)) return setting.defaultValue;
    return Math.max(setting.control.min ?? -Infinity, Math.min(setting.control.max ?? Infinity, numeric));
  }
  if(setting.control.options) return setting.control.options.find(option => String(option.value ?? "") === String(value))?.value ?? setting.defaultValue;
  if(setting.control.type === "select" && setting.control.dynamicOptions && value === "" && setting.defaultValue === null) return null;
  if(setting.control.type === "toggle") return Boolean(value);
  if(setting.control.type === "textList") return String(value).split("\n").map(line => line.trim()).filter(Boolean);
  return value;
}

/** Wiki links and its reader are two runtime features of one user-facing app. */
export function bundledAppEntries(apps: readonly MilxdyAppManifest[]): MilxdyAppManifest[] {
  const sidebar = apps.find(app => app.id === "wikiSidebar");
  const wiki = apps.find(app => app.id === "wiki");
  return apps.flatMap(app => {
    if(app.id === "wikiSidebar" && wiki) return [];
    if(app.id !== "wiki") return [app];
    const settings = [...(app.settings ?? []), ...(sidebar?.settings ?? [])];
    return [{ ...app, name: "Remilia Wiki", settings: settings.filter((setting, index) => settings.findIndex(candidate => candidate.id === setting.id) === index) }];
  });
}

export function appSoundSettings(app: MilxdyAppManifest): AppSettingDefinition[] {
  // The SDK audio preset declares ownership; Read Aloud keeps playback below Sounds.
  return (app.settings ?? []).filter(setting => app.id === "post-reading"
    ? setting.id === "post-reading.endOfTweetDing"
    : setting.presets?.includes("audio"));
}

export function setupBundledAppSettings(apps: readonly MilxdyAppManifest[], soundsOnly = false): void {
  const root = document.getElementById(soundsOnly ? "appSoundGroups" : "bundledAppsList");
  if(!root) return;
  const controls: BoundSetting[] = [];
  const voices: (() => void)[] = [];
  for(const app of bundledAppEntries(apps)) {
    if(soundsOnly && !appSoundSettings(app).length) continue;
    root.append(createBundledAppCard(app, soundsOnly, controls, voices));
  }
  void Promise.all(controls.map(loadBundledSetting));
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    for(const item of controls) if(item.setting.storage.area === area && changes[item.setting.storage.key]) renderBundledSetting(item, changes[item.setting.storage.key].newValue);
  };
  chrome.storage.onChanged.addListener(listener);
  const refreshVoices = () => { for(const update of voices) update(); void Promise.all(controls.filter(item => item.setting.control.dynamicOptions).map(loadBundledSetting)); };
  if(voices.length) speechSynthesis.addEventListener("voiceschanged", refreshVoices);
  addEventListener("pagehide", () => {
    chrome.storage.onChanged.removeListener(listener);
    if(voices.length) speechSynthesis.removeEventListener("voiceschanged", refreshVoices);
  }, { once: true });
}

function createBundledAppCard(app: MilxdyAppManifest, soundsOnly: boolean, controls: BoundSetting[], voices: (() => void)[]): HTMLElement {
  const soundSettings = appSoundSettings(app);
  const card = document.createElement("details");
  card.className = "setting-group bundled-app";
  card.dataset.appId = app.id;
  card.style.setProperty("--bundled-app-color", appColors[app.id] ?? "#1f6f5b");
  const summary = document.createElement("summary");
  const indicator = document.createElement("span");
  indicator.className = "bundled-app-indicator";
  indicator.setAttribute("aria-hidden", "true");
  const name = document.createElement("span");
  name.className = "bundled-app-name";
  name.textContent = app.id === "post-reading" ? "Read Aloud" : app.name;
  summary.append(indicator, name);
  card.append(summary);
  const body = document.createElement("div");
  body.className = "bundled-app-settings";
  const description = document.createElement("p");
  description.textContent = app.hub?.shortDescription ?? app.description;
  body.append(description);
  const status = document.createElement("p");
  status.className = "message";
  status.setAttribute("role", "status");
  const wikiSettings = !soundsOnly && app.id === "wiki" ? document.getElementById("bundledWikiSettings") : null;
  if(!soundsOnly && soundSettings.length) {
    const sounds = document.createElement("button");
    sounds.type = "button";
    sounds.className = "secondary-button addon-sounds-link";
    sounds.textContent = "Sound settings";
    sounds.addEventListener("click", () => {
      document.querySelector<HTMLButtonElement>('.tab[data-panel="audio"]')?.click();
      const target = document.querySelector<HTMLDetailsElement>(`#appSoundGroups [data-app-id="${app.id}"]`);
      if(target) { target.open = true; target.scrollIntoView({ block: "nearest" }); target.querySelector<HTMLElement>("summary")?.focus(); }
    });
    body.append(sounds);
  }
  for(const setting of(soundsOnly ? soundSettings : (app.settings ?? []).filter(setting => !soundSettings.includes(setting)))) {
    if(["action", "status"].includes(setting.control.type)) continue;
    // The full Wiki editor keeps its bespoke limits, article tools and bindings.
    if(wikiSettings?.querySelector(`[data-control="${setting.id}"]`)) continue;
    appendBundledSetting(setting, app, body, status, soundsOnly, controls, voices);
  }
  if(app.available === false) {
    const reason = document.createElement("p"); reason.textContent = app.unavailableReason ?? "Unavailable in this build."; body.append(reason);
  }
  if(wikiSettings) {
    wikiSettings.hidden = false;
    body.append(wikiSettings);
  }
  body.append(status);
  card.append(body);
  return card;
}

function appendBundledSetting(setting: AppSettingDefinition, app: MilxdyAppManifest, body: HTMLElement, status: HTMLElement, soundsOnly: boolean, controls: BoundSetting[], voices: (() => void)[]): void {
  const label = document.createElement("label");
  label.className = setting.control.type === "toggle" ? "setting" : "field";
  const text = document.createElement("span");
  const title = document.createElement("strong");
  title.textContent = setting.label;
  text.append(title);
  if(setting.description) {
    const help = document.createElement("small"); help.textContent = setting.description; text.append(help);
  }
  label.append(text);
  let control: Control;
  const select = setting.control.type === "select" || setting.control.type === "segmented";
  if(select) {
    control = document.createElement("select");
    for(const option of setting.control.options ?? []) {
      control.add(new Option(option.label, String(option.value ?? "")));
    }
  } else if(["textarea", "textList"].includes(setting.control.type)) {
    control = document.createElement("textarea");
  } else {
    control = document.createElement("input");
    control.type = setting.control.type === "toggle" ? "checkbox" : setting.control.type === "slider" ? "range" : setting.control.type === "number" ? "number" : "text";
    if(setting.control.min !== undefined) control.min = String(setting.control.min);
    if(setting.control.max !== undefined) control.max = String(setting.control.max);
    if(setting.control.step !== undefined) control.step = String(setting.control.step);
  }
  const scale = ["post-reading.speed", "post-reading.volume"].includes(setting.id) ? 100 : 1;
  const displayValue = () => scale === 100 ? `${control.value}%` : control.value;
  if(scale !== 1 && control instanceof HTMLInputElement) {
    control.min = String((setting.control.min ?? 0) * scale);
    control.max = String((setting.control.max ?? 1) * scale);
    control.step = String((setting.control.step ?? 0.01) * scale);
  }
  control.dataset.bundledSetting = setting.id;
  control.setAttribute("aria-label", setting.label);
  if(!(control instanceof HTMLSelectElement)) control.placeholder = setting.control.placeholder ?? "";
  if(app.available === false) control.disabled = true;
  label.append(control);
  let output: HTMLOutputElement | undefined;
  if(setting.control.type === "slider") {
    output = document.createElement("output");
    control.id = `${soundsOnly ? "sound" : "bundled"}-${setting.id}`;
    output.htmlFor = control.id;
    label.append(output);
    control.addEventListener("input", () => { output!.textContent = displayValue(); });
  }
  const item = { setting, control, output, scale };
  controls.push(item);
  if(control instanceof HTMLSelectElement && setting.control.dynamicOptions?.provider === "webSpeechVoices") {
    const update = () => {
      const selected = control.value;
      control.replaceChildren(new Option("Default voice", ""));
      for(const voice of speechSynthesis.getVoices()) control.add(new Option(`${voice.name} (${voice.lang})`, voice.voiceURI));
      control.value = selected;
    };
    voices.push(update); update();
  }
  control.addEventListener("change", () => {
    const value = normalizeBundledSetting(setting, control instanceof HTMLInputElement && control.type === "checkbox" ? control.checked : scale !== 1 ? Number(control.value) / scale : control.value);
    const storage = chrome.storage[setting.storage.area];
    const queueKey = `${setting.storage.area}:${setting.storage.key}`;
    const previous = writes.get(queueKey) ?? Promise.resolve();
    const next = previous.catch(() => { }).then(async () => {
      const stored = await storage.get(setting.storage.key);
      await storage.set({ [setting.storage.key]: bundledSettingPatch(setting, stored[setting.storage.key], value) });
    });
    writes.set(queueKey, next);
    void next.then(() => { status.textContent = ""; }).catch(() => { status.textContent = "Could not save this setting. Try again."; void loadBundledSetting(item); });
  });
  body.append(label);
}
function renderBundledSetting(item: BoundSetting, stored: unknown): void {
  const value = bundledSettingValue(item.setting, stored);
  if(item.control instanceof HTMLInputElement && item.control.type === "checkbox") item.control.checked = Boolean(value);
  else item.control.value = Array.isArray(value) ? value.join("\n") : String(item.scale !== 1 ? Math.round(Number(value) * item.scale) : value ?? "");
  if(item.output) item.output.textContent = item.scale === 100 ? `${item.control.value}%` : item.control.value;
  refreshSettingsChoice(item.control);
}
async function loadBundledSetting(item: BoundSetting): Promise<void> {
  const stored = await chrome.storage[item.setting.storage.area].get(item.setting.storage.key);
  renderBundledSetting(item, stored[item.setting.storage.key]);
}
