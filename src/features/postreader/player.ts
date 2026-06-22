import { icon } from "./icons";
import type { BoundarySupport } from "./speech";
import type { OcrProgress } from "./ocr";
import type { PostreaderSettings, SpeechState } from "./shared/types";

type PlayerActions = {
  onPauseResume: () => void;
  onStop: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onNextChunk: () => void;
  onPreviousChunk: () => void;
  onSkipOcr: () => void;
  onSettingsChange: (settings: PostreaderSettings) => void;
  onBoundarySupportChange: (results: Record<string, BoundarySupport>) => void;
  getVoices: () => SpeechSynthesisVoice[];
  getPreferredVoice: () => SpeechSynthesisVoice | null;
  probeBoundarySupport: (voice: SpeechSynthesisVoice) => Promise<boolean>;
};

export class MiniPlayer {
  private root: HTMLDivElement;
  private title: HTMLSpanElement;
  private playButton: HTMLButtonElement;
  private ocrStatus: HTMLDivElement;
  private ocrText: HTMLSpanElement;
  private ocrBar: HTMLDivElement;
  private settingsPanel: HTMLDivElement;
  private activePage: "playback" | "navigation" | "reading" | "highlighting" | "appearance" = "playback";
  private settings: PostreaderSettings;
  private actions: PlayerActions;
  private boundarySupport = new Map<string, BoundarySupport>();
  private probingVoices = false;

  constructor(settings: PostreaderSettings, actions: PlayerActions) {
    this.settings = settings;
    this.actions = actions;
    this.root = document.createElement("div");
    this.root.className = "postreader-player";
    this.root.dataset.visible = "false";
    this.root.dataset.position = settings.playerPosition;
    this.root.setAttribute("role", "region");
    this.root.setAttribute("aria-label", "Postreader controls");

    const shell = document.createElement("div");
    shell.className = "postreader-shell";
    const controls = document.createElement("div");
    controls.className = "postreader-controls";

    const prev = controlButton("Previous post", "prev", actions.onPrevious);
    const prevChunk = controlButton("Previous paragraph", "prevChunk", actions.onPreviousChunk);
    this.playButton = controlButton("Play or pause", "play", actions.onPauseResume);
    const nextChunk = controlButton("Next paragraph", "nextChunk", actions.onNextChunk);
    const next = controlButton("Next post", "next", actions.onNext);
    this.title = document.createElement("span");
    this.title.className = "postreader-title";
    this.title.textContent = "Postreader";

    const settingsButton = controlButton("Settings", "settings", () => {
      this.settingsPanel.hidden = !this.settingsPanel.hidden;
      if (!this.settingsPanel.hidden) this.renderSettings();
    });
    const close = controlButton("Close player", "close", () => this.closePlayer());
    close.classList.add("postreader-close");
    close.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.closePlayer();
    }, { capture: true });

    this.ocrStatus = document.createElement("div");
    this.ocrStatus.className = "postreader-ocr";
    this.ocrStatus.hidden = true;
    const ocrDetails = document.createElement("div");
    ocrDetails.className = "postreader-ocr-details";
    this.ocrText = document.createElement("span");
    this.ocrBar = document.createElement("div");
    this.ocrBar.className = "postreader-ocr-bar";
    this.ocrBar.setAttribute("role", "progressbar");
    this.ocrBar.setAttribute("aria-valuemin", "0");
    this.ocrBar.setAttribute("aria-valuemax", "100");
    this.ocrBar.innerHTML = '<span></span>';
    const skipOcr = document.createElement("button");
    skipOcr.type = "button";
    skipOcr.className = "postreader-secondary postreader-ocr-skip";
    skipOcr.textContent = "Skip OCR";
    skipOcr.addEventListener("click", actions.onSkipOcr);
    ocrDetails.append(this.ocrText, this.ocrBar);
    this.ocrStatus.append(ocrDetails, skipOcr);

    this.settingsPanel = document.createElement("div");
    this.settingsPanel.className = "postreader-settings";
    this.settingsPanel.hidden = true;

    controls.append(prev, prevChunk, this.playButton, nextChunk, next, this.title, settingsButton, close);
    shell.append(controls, this.ocrStatus);
    this.root.append(shell, this.settingsPanel);
    document.body.appendChild(this.root);
    this.renderSettings();
  }

  setBoundarySupport(results: Record<string, BoundarySupport>): void {
    this.boundarySupport = new Map(Object.entries(results));
    this.renderSettings();
  }

  updateState(state: SpeechState): void {
    this.root.dataset.visible = state.status === "idle" && !state.title ? "false" : "true";
    const progress = state.chunkCount > 1 ? ` ${state.chunkIndex}/${state.chunkCount}` : "";
    this.title.textContent = state.error || `${state.title || "Postreader"}${progress}`;
    this.playButton.innerHTML = state.status === "speaking" ? icon("pause") : icon("play");
    this.playButton.setAttribute("aria-label", state.status === "speaking" ? "Pause" : "Resume");
  }

  updateSettings(settings: PostreaderSettings): void {
    this.settings = settings;
    this.root.dataset.position = settings.playerPosition;
    this.renderSettings();
  }

  refreshVoices(): void {
    this.renderSettings();
  }

  updateOcrStatus(progress: OcrProgress | null): void {
    this.ocrStatus.hidden = !progress;
    if (!progress) {
      this.ocrText.textContent = "";
      this.ocrBar.style.setProperty("--postreader-ocr-progress", "0%");
      this.ocrBar.removeAttribute("aria-valuenow");
      if (this.title.textContent?.startsWith("OCR")) this.title.textContent = "Postreader";
      return;
    }
    const imageLabel = progress.imageCount > 1 ? ` image ${progress.imageIndex + 1}/${progress.imageCount}` : "";
    const progressValue = typeof progress.progress === "number" ? Math.max(0, Math.min(1, progress.progress)) : null;
    const stage = progressValue === null ? "" : `Stage ${Math.round(progressValue * 100)}%: `;
    const message = `${stage}${progress.status}${imageLabel}`;
    this.ocrText.textContent = message;
    this.ocrBar.style.setProperty("--postreader-ocr-progress", `${Math.round((progressValue ?? 0) * 100)}%`);
    if (progressValue === null) {
      this.ocrBar.removeAttribute("aria-valuenow");
    } else {
      this.ocrBar.setAttribute("aria-valuenow", String(Math.round(progressValue * 100)));
    }
    this.title.textContent = `OCR: ${message}`;
    this.root.dataset.visible = "true";
  }

  private renderSettings(): void {
    const voices = this.actions.getVoices();
    this.settingsPanel.textContent = "";
    const tabs = document.createElement("div");
    tabs.className = "postreader-tabs";
    for (const page of ["playback", "navigation", "reading", "highlighting", "appearance"] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = titleCase(page);
      button.dataset.active = String(this.activePage === page);
      button.addEventListener("click", () => {
        this.activePage = page;
        this.renderSettings();
      });
      tabs.append(button);
    }
    this.settingsPanel.append(tabs);

    const sortedVoices = sortVoicesByBoundarySupport(voices, this.boundarySupport);
    const voiceLabel = document.createElement("label");
    voiceLabel.textContent = "Voice";
    const voiceSelect = document.createElement("select");
    voiceSelect.append(new Option("System default", ""));
    for (const voice of sortedVoices) {
      const support = this.boundarySupport.get(voice.voiceURI) ?? "unknown";
      const suffix = support === "supported" ? " - highlights" : support === "unsupported" ? " - no word sync" : "";
      voiceSelect.append(new Option(`${voice.name} (${voice.lang})${suffix}`, voice.voiceURI));
    }
    voiceSelect.value = this.settings.voiceURI || "";
    voiceSelect.addEventListener("change", () => this.update({ voiceURI: voiceSelect.value || null }));
    voiceLabel.append(voiceSelect);

    const selectedVoice = this.actions.getPreferredVoice();
    const voiceHint = document.createElement("div");
    voiceHint.className = "postreader-hint";
    voiceHint.textContent = selectedVoice ? `Default: ${selectedVoice.name}` : "Default: system voice";
    const engine = selectInput("Engine", this.settings.ttsEngine, [
      ["web-speech", "Browser Web Speech"],
      ["custom-http", "Custom HTTP endpoint"],
    ], (value) => this.update({ ttsEngine: value as PostreaderSettings["ttsEngine"] }));
    const customEndpoint = document.createElement("label");
    customEndpoint.textContent = "Custom endpoint";
    const customEndpointInput = document.createElement("input");
    customEndpointInput.type = "url";
    customEndpointInput.placeholder = "http://localhost:8787/speak";
    customEndpointInput.value = this.settings.customTtsEndpoint || "";
    customEndpointInput.addEventListener("change", () => this.update({ customTtsEndpoint: customEndpointInput.value.trim() || null }));
    customEndpoint.append(customEndpointInput);
    const customTiming = selectInput("Custom timing", this.settings.customTtsTimingMode, [
      ["engine", "Use endpoint boundaries"],
      ["off", "Audio only"],
    ], (value) => this.update({ customTtsTimingMode: value as PostreaderSettings["customTtsTimingMode"] }));
    const customHint = document.createElement("div");
    customHint.className = "postreader-hint";
    customHint.textContent = "Endpoint response: audioUrl or audioBase64, optional boundaries with charIndex and elapsedTime.";
    const probeButton = document.createElement("button");
    probeButton.type = "button";
    probeButton.className = "postreader-secondary";
    probeButton.textContent = this.probingVoices ? "Testing voices..." : "Test voice highlighting";
    probeButton.disabled = this.probingVoices || voices.length === 0;
    probeButton.addEventListener("click", () => {
      void this.probeVoices(sortedVoices);
    });

    const speedLabel = document.createElement("label");
    speedLabel.textContent = "Speed";
    const speed = document.createElement("input");
    speed.type = "number";
    speed.min = "0.5";
    speed.max = "10";
    speed.step = "0.05";
    speed.value = String(this.settings.speed);
    speed.inputMode = "decimal";
    speed.addEventListener("change", () => {
      const next = Math.min(10, Math.max(0.5, Number(speed.value) || 1));
      speed.value = next.toFixed(2).replace(/\.00$/, "");
      this.update({ speed: next });
    });
    speedLabel.append(speed);

    const volumeLabel = document.createElement("label");
    volumeLabel.textContent = `Volume: ${Math.round(this.settings.volume * 100)}%`;
    const volume = document.createElement("input");
    volume.type = "range";
    volume.min = "0";
    volume.max = "1";
    volume.step = "0.01";
    volume.value = String(this.settings.volume);
    volume.addEventListener("input", () => {
      const next = Math.min(1, Math.max(0, Number(volume.value) || 0));
      volumeLabel.firstChild!.textContent = `Volume: ${Math.round(next * 100)}%`;
      this.update({ volume: next });
    });
    volumeLabel.append(volume);

    const autoplay = checkbox("Autoplay next post", this.settings.autoplayNext, (checked) => this.update({ autoplayNext: checked }));
    const endDing = checkbox("Ding at end of post", this.settings.endOfTweetDing, (checked) => this.update({ endOfTweetDing: checked }));
    const autoscroll = checkbox("Autoscroll in autoplay", this.settings.autoplayMode === "autoscroll", (checked) => {
      this.update({ autoplayMode: checked ? "autoscroll" : "visible" });
    });
    const skipPromoted = checkbox("Skip promoted posts", this.settings.skipPromotedPosts, (checked) => this.update({ skipPromotedPosts: checked }));
    const quotes = checkbox("Include quoted posts", this.settings.includeQuotes, (checked) => this.update({ includeQuotes: checked }));
    const fullQuotes = checkbox("Fetch full quoted posts", this.settings.fetchFullQuotes, (checked) => this.update({ fetchFullQuotes: checked }));
    const fullQuoteDisplay = selectInput("Full quote display", this.settings.fullQuoteDisplay, [
      ["hidden", "Hidden"],
      ["expand", "Expand"],
      ["scroll", "Scroll in preview"],
    ], (value) => this.update({ fullQuoteDisplay: value as PostreaderSettings["fullQuoteDisplay"] }));
    const hyperlinks = checkbox("Read hyperlinks", this.settings.includeHyperlinks, (checked) => this.update({ includeHyperlinks: checked }));
    const images = checkbox("Include image descriptions", this.settings.includeImageAltText, (checked) => this.update({ includeImageAltText: checked }));
    const imageOcr = checkbox("Read image text with OCR", this.settings.includeImageOcr, (checked) => this.update({ includeImageOcr: checked }));
    const links = checkbox("Include link previews", this.settings.includeLinkPreviews, (checked) => this.update({ includeLinkPreviews: checked }));
    const expand = checkbox('Expand "Show more"', this.settings.expandShowMore, (checked) => this.update({ expandShowMore: checked }));
    const keyNextTweet = keybindInput("Next post", this.settings.keyNextTweet, (value) => this.update({ keyNextTweet: value }));
    const keyPreviousTweet = keybindInput("Previous post", this.settings.keyPreviousTweet, (value) => this.update({ keyPreviousTweet: value }));
    const keyNextChunk = keybindInput("Next paragraph", this.settings.keyNextChunk, (value) => this.update({ keyNextChunk: value }));
    const keyPreviousChunk = keybindInput("Previous paragraph", this.settings.keyPreviousChunk, (value) => this.update({ keyPreviousChunk: value }));
    const keySkipOcr = keybindInput("Skip OCR", this.settings.keySkipOcr, (value) => this.update({ keySkipOcr: value }));
    const keyPlayPause = keybindInput("Play / pause", this.settings.keyPlayPause, (value) => this.update({ keyPlayPause: value }));

    if (this.activePage === "playback") {
      this.settingsPanel.append(engine);
      if (this.settings.ttsEngine === "custom-http") {
        this.settingsPanel.append(customEndpoint, customTiming, customHint);
      } else {
        this.settingsPanel.append(voiceLabel, voiceHint, probeButton);
      }
      this.settingsPanel.append(speedLabel, volumeLabel, keyPlayPause, keySkipOcr, keyNextChunk, keyPreviousChunk);
    } else if (this.activePage === "navigation") {
      this.settingsPanel.append(autoplay, autoscroll, endDing, skipPromoted, keyNextTweet, keyPreviousTweet);
    } else if (this.activePage === "reading") {
      this.settingsPanel.append(quotes, fullQuotes, fullQuoteDisplay, hyperlinks, images, imageOcr, links, expand);
    } else if (this.activePage === "highlighting") {
      const activeTweet = checkbox("Highlight active tweet", this.settings.activeTweetHighlight, (checked) => this.update({ activeTweetHighlight: checked }));
      const bodyMode = selectInput("Body text", this.settings.bodyHighlightMode, [
        ["off", "Off"],
        ["word", "Current word"],
        ["smooth", "Smooth character fill"],
      ], (value) => this.update({ bodyHighlightMode: value as PostreaderSettings["bodyHighlightMode"] }));
      this.settingsPanel.append(activeTweet, bodyMode);
    } else {
      this.settingsPanel.append(selectInput("Player position", this.settings.playerPosition, [
        ["top-right", "Top right"],
        ["bottom-right", "Bottom right"],
        ["top-left", "Top left"],
        ["bottom-left", "Bottom left"],
      ], (value) => this.update({ playerPosition: value as PostreaderSettings["playerPosition"] })), selectInput("Read button", this.settings.buttonPlacement, [
        ["auto", "Auto"],
        ["top", "Top controls"],
        ["actions", "Action bar"],
      ], (value) => this.update({ buttonPlacement: value as PostreaderSettings["buttonPlacement"] })));
    }
  }

  private update(partial: Partial<PostreaderSettings>): void {
    this.settings = { ...this.settings, ...partial };
    this.actions.onSettingsChange(this.settings);
  }

  private closePlayer(): void {
    this.settingsPanel.hidden = true;
    this.root.dataset.visible = "false";
    this.actions.onStop();
  }

  private async probeVoices(voices: SpeechSynthesisVoice[]): Promise<void> {
    this.probingVoices = true;
    this.renderSettings();
    for (const voice of voices) {
      if (this.boundarySupport.get(voice.voiceURI) === "supported") continue;
      const supported = await this.actions.probeBoundarySupport(voice);
      this.boundarySupport.set(voice.voiceURI, supported ? "supported" : "unsupported");
      this.actions.onBoundarySupportChange(Object.fromEntries(this.boundarySupport));
      this.renderSettings();
    }
    this.probingVoices = false;
    this.renderSettings();
  }
}

function sortVoicesByBoundarySupport(
  voices: SpeechSynthesisVoice[],
  boundarySupport: Map<string, BoundarySupport>,
): SpeechSynthesisVoice[] {
  return [...voices].sort((left, right) => {
    const leftRank = supportRank(boundarySupport.get(left.voiceURI) ?? "unknown");
    const rightRank = supportRank(boundarySupport.get(right.voiceURI) ?? "unknown");
    if (leftRank !== rightRank) return leftRank - rightRank;
    const leftEnglish = /^en[-_]?/i.test(left.lang) ? 0 : 1;
    const rightEnglish = /^en[-_]?/i.test(right.lang) ? 0 : 1;
    if (leftEnglish !== rightEnglish) return leftEnglish - rightEnglish;
    return left.name.localeCompare(right.name);
  });
}

function supportRank(value: BoundarySupport): number {
  if (value === "supported") return 0;
  if (value === "unknown") return 1;
  return 2;
}

function selectInput(labelText: string, value: string, options: Array<[string, string]>, onChange: (value: string) => void): HTMLLabelElement {
  const label = document.createElement("label");
  label.textContent = labelText;
  const select = document.createElement("select");
  for (const [optionValue, optionLabel] of options) select.append(new Option(optionLabel, optionValue));
  select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  label.append(select);
  return label;
}

function titleCase(value: string): string {
  return value[0].toUpperCase() + value.slice(1);
}

function keybindInput(label: string, value: string, onChange: (value: string) => void): HTMLLabelElement {
  const wrapper = document.createElement("label");
  wrapper.textContent = label;
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.placeholder = "Ctrl+Alt+ArrowDown";
  input.addEventListener("keydown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const next = eventToKeybind(event);
    if (!next) return;
    input.value = next;
    onChange(next);
  });
  input.addEventListener("change", () => {
    if (input.value.trim()) onChange(input.value.trim());
  });
  wrapper.append(input);
  return wrapper;
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

function controlButton(label: string, iconName: Parameters<typeof icon>[0], onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "postreader-control";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = icon(iconName);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  return button;
}

function checkbox(label: string, checked: boolean, onChange: (checked: boolean) => void): HTMLLabelElement {
  const wrapper = document.createElement("label");
  wrapper.className = "postreader-checkbox";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  const text = document.createElement("span");
  text.textContent = label;
  wrapper.append(input, text);
  return wrapper;
}
