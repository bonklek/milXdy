import { loadSettings, saveSettings } from "./storage";

void boot();

async function boot(): Promise<void> {
  const root = document.getElementById("app");
  if (!root) return;
  const settings = await loadSettings();
  document.getElementById("close")?.addEventListener("click", () => window.close());

  const autoplay = document.createElement("label");
  autoplay.textContent = "Autoplay";
  const autoplayInput = document.createElement("input");
  autoplayInput.type = "checkbox";
  autoplayInput.checked = settings.autoplayNext;
  autoplayInput.addEventListener("change", async () => {
    settings.autoplayNext = autoplayInput.checked;
    await saveSettings(settings);
  });
  autoplay.append(autoplayInput);

  const mode = document.createElement("label");
  mode.textContent = "Mode";
  const modeSelect = document.createElement("select");
  modeSelect.append(new Option("Visible posts", "visible"), new Option("Autoscroll", "autoscroll"));
  modeSelect.value = settings.autoplayMode;
  modeSelect.addEventListener("change", async () => {
    settings.autoplayMode = modeSelect.value === "autoscroll" ? "autoscroll" : "visible";
    await saveSettings(settings);
  });
  mode.append(modeSelect);

  const speed = document.createElement("label");
  speed.textContent = "Speed";
  const speedInput = document.createElement("input");
  speedInput.type = "number";
  speedInput.min = "0.5";
  speedInput.max = "10";
  speedInput.step = "0.05";
  speedInput.value = String(settings.speed);
  speedInput.addEventListener("change", async () => {
    settings.speed = Number(speedInput.value);
    await saveSettings(settings);
  });
  speed.append(speedInput);

  const volume = document.createElement("label");
  volume.textContent = "Volume";
  const volumeInput = document.createElement("input");
  volumeInput.type = "range";
  volumeInput.min = "0";
  volumeInput.max = "1";
  volumeInput.step = "0.01";
  volumeInput.value = String(settings.volume);
  volumeInput.addEventListener("input", async () => {
    settings.volume = Number(volumeInput.value);
    await saveSettings(settings);
  });
  volume.append(volumeInput);
  const keyNextTweet = keybindLabel("Next post", settings.keyNextTweet, async (value) => {
    settings.keyNextTweet = value;
    await saveSettings(settings);
  });
  const keyPreviousTweet = keybindLabel("Previous post", settings.keyPreviousTweet, async (value) => {
    settings.keyPreviousTweet = value;
    await saveSettings(settings);
  });
  const keyPlayPause = keybindLabel("Play / pause", settings.keyPlayPause, async (value) => {
    settings.keyPlayPause = value;
    await saveSettings(settings);
  });

  root.append(autoplay, mode, speed, volume, keyNextTweet, keyPreviousTweet, keyPlayPause);
}

function keybindLabel(labelText: string, value: string, onChange: (value: string) => Promise<void>): HTMLLabelElement {
  const label = document.createElement("label");
  label.textContent = labelText;
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.addEventListener("keydown", (event) => {
    event.preventDefault();
    const next = eventToKeybind(event);
    if (!next) return;
    input.value = next;
    void onChange(next);
  });
  input.addEventListener("change", () => {
    if (input.value.trim()) void onChange(input.value.trim());
  });
  label.append(input);
  return label;
}

function eventToKeybind(event: KeyboardEvent): string | null {
  const key = normalizeKey(event.key);
  if (!key) return null;
  const parts = [];
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  if (event.metaKey) parts.push("Meta");
  parts.push(key);
  return parts.join("+");
}

function normalizeKey(key: string): string | null {
  if (["Control", "Alt", "Shift", "Meta"].includes(key)) return null;
  if (key === " ") return "Space";
  if (key.length === 1) return key.toUpperCase();
  return key;
}
