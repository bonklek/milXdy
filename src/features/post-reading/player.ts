import { icon } from "./icons";
import type { BoundarySupport } from "./speech";
import type { OcrProgress } from "./ocr";
import type { PostReadingSettings, SpeechState } from "./shared/types";
import { knownVoiceBoundarySupport } from "./voiceSupport";
import type { OverlayAppFrame } from "../../shared/overlayAppFrame";
import { animateOverlayAppClose, animateOverlayAppOpen, ensureOverlayAppChromeStyles, markOverlayAppLayoutReady, prepareOverlayAppRoot } from "../../shared/overlayAppChrome";
import { registerOverlayAppRoot } from "../../shared/overlayAppLayout";
import {
  clampOverlayPanelBox,
  restoreOverlayPanelBox,
  startOverlayPanelDrag,
  startOverlayPanelResize,
} from "../../shared/overlayPanelBase";

type PlayerActions = {
  onPauseResume: () => void;
  onStop: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onNextChunk: () => void;
  onPreviousChunk: () => void;
  onSkipOcr: () => void;
  onSettingsChange: (settings: PostReadingSettings) => void;
  onBoundarySupportChange: (results: Record<string, BoundarySupport>) => void;
  getVoices: () => SpeechSynthesisVoice[];
  getPreferredVoice: () => SpeechSynthesisVoice | null;
  probeBoundarySupport: (voice: SpeechSynthesisVoice) => Promise<boolean>;
};

export class MiniPlayer {
  private root: HTMLDivElement;
  private originalParent: HTMLElement | null = null;
  private title: HTMLSpanElement;
  private playButton: HTMLButtonElement;
  private skipOcrButton: HTMLButtonElement;
  private header: HTMLDivElement;
  private controls: HTMLDivElement;
  private headerActions: HTMLDivElement;
  private ocrStatus: HTMLDivElement;
  private ocrText: HTMLSpanElement;
  private ocrBar: HTMLDivElement;
  private settingsPanel: HTMLDivElement;
  private settingsBody: HTMLDivElement | null = null;
  private activePage: "playback" | "navigation" | "reading" | "highlighting" = "playback";
  private lastSpeechStatus: SpeechState["status"] = "idle";
  private settings: PostReadingSettings;
  private actions: PlayerActions;
  private appFrame: OverlayAppFrame | null = null;
  private x = 0;
  private y = 16;
  private width = 360;
  private height = 220;
  private layoutReady = false;
  private closing = false;
  private boundarySupport = new Map<string, BoundarySupport>();
  private probingVoices = false;

  constructor(settings: PostReadingSettings, actions: PlayerActions) {
    this.settings = settings;
    this.actions = actions;
    ensureOverlayAppChromeStyles();
    this.root = document.createElement("div");
    this.root.className = "post-reading-player milxdy-overlay-app-shell";
    prepareOverlayAppRoot(this.root);
    this.root.dataset.visible = "false";
    this.root.dataset.position = settings.playerPosition;
    this.root.setAttribute("role", "region");
    this.root.setAttribute("aria-label", "Post-reading controls");
    for (const type of ["click", "mousedown", "mouseup", "pointerdown", "pointerup"]) {
      this.root.addEventListener(type, (event) => event.stopPropagation());
    }

    const card = document.createElement("div");
    card.className = "post-reading-box milxdy-overlay-app-card";
    const resizeSide = resizeHandle("post-reading-resize-edge post-reading-resize-edge-side", "Drag to resize width", "x", (event) => this.startResize(event, "x"));
    const resizeBottom = resizeHandle("post-reading-resize-edge post-reading-resize-edge-bottom", "Drag to resize height", "y", (event) => this.startResize(event, "y"));
    const resizeGrip = resizeHandle("post-reading-resize-grip", "Drag to resize", "both", (event) => this.startResize(event, "both"));
    const shell = document.createElement("div");
    shell.className = "post-reading-shell";
    const header = document.createElement("div");
    header.className = "post-reading-panel-header milxdy-overlay-app-header";
    this.header = header;
    header.addEventListener("pointerdown", (event) => this.startDrag(event));
    const heading = document.createElement("div");
    heading.className = "post-reading-panel-heading";
    const logo = document.createElement("img");
    logo.className = "post-reading-panel-logo";
    logo.src = chrome.runtime.getURL("post-reading/post-reading-logo.png");
    logo.alt = "";
    const headingText = document.createElement("div");
    headingText.className = "post-reading-panel-heading-text";
    const headingTitle = document.createElement("strong");
    headingTitle.textContent = "Post-reading";
    this.title = document.createElement("span");
    this.title.className = "post-reading-title";
    this.title.textContent = "Ready";
    headingText.append(headingTitle, this.title);
    heading.append(logo, headingText);

    const controls = document.createElement("div");
    controls.className = "post-reading-controls";
    this.controls = controls;

    const prev = controlButton("Previous post", "prev", actions.onPrevious);
    const prevChunk = controlButton("Previous paragraph", "prevChunk", actions.onPreviousChunk);
    this.playButton = controlButton("Play or pause", "play", () => {
      const nextIsSpeaking = this.lastSpeechStatus !== "speaking";
      this.setPlayButtonIcon(nextIsSpeaking);
      actions.onPauseResume();
    });
    const nextChunk = controlButton("Next paragraph", "nextChunk", actions.onNextChunk);
    const next = controlButton("Next post", "next", actions.onNext);
    this.skipOcrButton = document.createElement("button");
    this.skipOcrButton.type = "button";
    this.skipOcrButton.className = "post-reading-control post-reading-ocr-control";
    this.skipOcrButton.textContent = "OCR";
    this.skipOcrButton.title = "Skip OCR";
    this.skipOcrButton.setAttribute("aria-label", "Skip OCR");
    this.skipOcrButton.disabled = true;
    this.skipOcrButton.addEventListener("click", actions.onSkipOcr);
    const settingsButton = controlButton("Settings", "settings", () => {
      this.settingsPanel.hidden = !this.settingsPanel.hidden;
      this.root.dataset.settingsOpen = String(!this.settingsPanel.hidden);
      if (!this.settingsPanel.hidden) this.renderSettings();
    });
    const close = controlButton("Minimize player", "minimize", () => this.close());
    close.classList.add("post-reading-close");
    close.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.close();
    }, { capture: true });

    this.ocrStatus = document.createElement("div");
    this.ocrStatus.className = "post-reading-ocr";
    this.ocrStatus.hidden = true;
    const ocrDetails = document.createElement("div");
    ocrDetails.className = "post-reading-ocr-details";
    this.ocrText = document.createElement("span");
    this.ocrBar = document.createElement("div");
    this.ocrBar.className = "post-reading-ocr-bar";
    this.ocrBar.setAttribute("role", "progressbar");
    this.ocrBar.setAttribute("aria-valuemin", "0");
    this.ocrBar.setAttribute("aria-valuemax", "100");
    this.ocrBar.innerHTML = '<span></span>';
    ocrDetails.append(this.ocrText, this.ocrBar);
    this.ocrStatus.append(ocrDetails);

    this.settingsPanel = document.createElement("div");
    this.settingsPanel.className = "post-reading-settings";
    this.settingsPanel.hidden = true;

    const headerActions = document.createElement("div");
    headerActions.className = "post-reading-panel-actions";
    this.headerActions = headerActions;
    headerActions.append(settingsButton, close);
    header.append(heading, headerActions);
    controls.append(prev, prevChunk, this.playButton, nextChunk, next, this.skipOcrButton);
    shell.append(header, controls, this.ocrStatus);
    card.append(shell, this.settingsPanel, resizeSide, resizeBottom, resizeGrip);
    this.root.append(card);
    document.body.appendChild(this.root);
    this.originalParent = document.body;
    this.renderSettings();
  }

  setAppFrame(frame: OverlayAppFrame | null): void {
    this.appFrame = frame;
    void this.restoreFrameLayout();
    this.applyFrameLayout();
  }

  setBoundarySupport(results: Record<string, BoundarySupport>): void {
    this.boundarySupport = new Map(Object.entries(results));
    this.renderSettings();
  }

  updateState(state: SpeechState): void {
    if (!(this.closing && state.status === "idle" && !state.title)) {
      this.setVisible(!(state.status === "idle" && !state.title));
    }
    const progress = state.chunkCount > 1 ? ` ${state.chunkIndex}/${state.chunkCount}` : "";
    this.title.textContent = state.error || `${state.title || "Post-reading"}${progress}`;
    this.lastSpeechStatus = state.status;
    this.setPlayButtonIcon(state.status === "speaking");
  }

  updateSettings(settings: PostReadingSettings): void {
    this.settings = settings;
    this.root.dataset.position = settings.playerPosition;
    this.applyFrameLayout();
    this.renderSettings();
  }

  refreshVoices(): void {
    this.renderSettings();
  }

  setOcrSkipAvailable(available: boolean): void {
    this.skipOcrButton.disabled = !available;
    this.skipOcrButton.dataset.active = String(available);
  }

  updateOcrStatus(progress: OcrProgress | null): void {
    this.ocrStatus.hidden = !progress;
    const skippableOcrProgress = Boolean(progress
      && typeof progress.progress === "number"
      && /\b(ocr|image)\b/i.test(progress.status)
      && !/\bquoted\b/i.test(progress.status));
    this.setOcrSkipAvailable(skippableOcrProgress);
    if (!progress) {
      this.ocrText.textContent = "";
      this.ocrBar.style.setProperty("--post-reading-ocr-progress", "0%");
      this.ocrBar.removeAttribute("aria-valuenow");
      if (this.title.textContent?.startsWith("OCR")) this.title.textContent = "Post-reading";
      return;
    }
    const imageLabel = progress.imageCount > 1 ? ` image ${progress.imageIndex + 1}/${progress.imageCount}` : "";
    const progressValue = typeof progress.progress === "number" ? Math.max(0, Math.min(1, progress.progress)) : null;
    const stage = progressValue === null ? "" : `Stage ${Math.round(progressValue * 100)}%: `;
    const message = `${stage}${progress.status}${imageLabel}`;
    this.ocrText.textContent = message;
    this.ocrBar.style.setProperty("--post-reading-ocr-progress", `${Math.round((progressValue ?? 0) * 100)}%`);
    if (progressValue === null) {
      this.ocrBar.removeAttribute("aria-valuenow");
    } else {
      this.ocrBar.setAttribute("aria-valuenow", String(Math.round(progressValue * 100)));
    }
    this.title.textContent = `OCR: ${message}`;
    this.setVisible(true);
  }

  show(): void {
    this.closing = false;
    this.setVisible(true);
    this.applyFrameLayout();
  }

  attachTo(container: HTMLElement): void {
    if (!container.isConnected) return;
    this.root.dataset.attached = "wikiSidebarBottom";
    this.controls.append(this.headerActions);
    container.replaceChildren(this.root);
    this.closing = false;
    this.setVisible(true);
  }

  detach(): void {
    if (!this.root.dataset.attached) return;
    delete this.root.dataset.attached;
    this.header.append(this.headerActions);
    (this.originalParent || document.body).appendChild(this.root);
    this.applyFrameLayout();
  }

  close(): void {
    this.settingsPanel.hidden = true;
    this.root.dataset.settingsOpen = "false";
    this.closing = true;
    this.actions.onStop();
    animateOverlayAppClose(this.root, () => {
      this.closing = false;
      this.root.dataset.visible = "false";
    });
  }

  isVisible(): boolean {
    return this.root.dataset.visible === "true" && !this.closing;
  }

  private setVisible(visible: boolean): void {
    const wasVisible = this.root.dataset.visible === "true";
    this.root.dataset.visible = String(visible);
    if (visible && !wasVisible) {
      this.applyFrameLayout();
      animateOverlayAppOpen(this.root);
    }
  }

  private setPlayButtonIcon(isSpeaking: boolean): void {
    this.playButton.innerHTML = isSpeaking ? icon("pause") : icon("play");
    const label = isSpeaking ? "Pause" : "Resume";
    this.playButton.setAttribute("aria-label", label);
    this.playButton.title = label;
  }

  applyFrameLayout(): void {
    if (this.root.dataset.attached === "wikiSidebarBottom") {
      this.root.style.left = "";
      this.root.style.right = "";
      this.root.style.top = "";
      this.root.style.width = "";
      this.root.style.height = "";
      this.root.dataset.panelSide = "attached";
      markOverlayAppLayoutReady(this.root, true);
      return;
    }
    const side = this.appFrame?.getSide() || "right";
    registerOverlayAppRoot("post-reading", this.root);
    const box = clampOverlayPanelBox(
      { x: this.x, width: this.width, height: this.height, topOffset: this.y },
      { minWidth: 280, minHeight: 120, dockSide: side },
    );
    this.x = box.x ?? this.x;
    this.y = box.topOffset;
    this.width = box.width;
    this.height = box.height;
    this.root.style.left = `${this.x}px`;
    this.root.style.right = "auto";
    this.root.style.top = `${this.y}px`;
    this.root.style.width = `${this.width}px`;
    this.root.style.height = `${this.height}px`;
    this.root.dataset.panelSide = side;
    markOverlayAppLayoutReady(this.root, this.layoutReady);
  }

  private async restoreFrameLayout(): Promise<void> {
    const side = this.appFrame?.getSide() || "right";
    const layout = await restoreOverlayPanelBox("post-reading", {
      side,
      minWidth: 280,
      minHeight: 120,
      defaultWidth: this.width,
      defaultHeight: this.height,
    });
    this.x = layout.x ?? this.x;
    this.y = layout.topOffset;
    this.width = layout.width;
    this.height = layout.height;
    this.layoutReady = true;
    this.applyFrameLayout();
  }

  private startDrag(event: PointerEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("button, input, textarea, select, [data-post-reading-resize='true']")) return;
    this.root.dataset.dragging = "true";
    startOverlayPanelDrag(event, {
      appId: "post-reading",
      root: this.root,
      minWidth: 280,
      minHeight: 120,
      side: () => this.appFrame?.getSide() || "right",
      box: () => ({ x: this.x, width: this.width, height: this.height, topOffset: this.y }),
      setBox: (box) => {
        if (typeof box.x === "number") this.x = box.x;
        if (typeof box.width === "number") this.width = box.width;
        if (typeof box.height === "number") this.height = box.height;
        if (typeof box.topOffset === "number") this.y = box.topOffset;
      },
      apply: () => this.applyFrameLayout(),
      persist: () => {
        this.root.dataset.dragging = "false";
      },
    });
  }

  private startResize(event: PointerEvent, axis: "both" | "x" | "y"): void {
    if (this.root.dataset.attached === "wikiSidebarBottom") return;
    this.root.dataset.resizing = "true";
    startOverlayPanelResize(event, {
      appId: "post-reading",
      root: this.root,
      minWidth: 280,
      minHeight: 120,
      side: () => this.appFrame?.getSide() || "right",
      box: () => ({ x: this.x, width: this.width, height: this.height, topOffset: this.y }),
      setBox: (box) => {
        if (typeof box.x === "number") this.x = box.x;
        if (typeof box.width === "number") this.width = box.width;
        if (typeof box.height === "number") this.height = box.height;
        if (typeof box.topOffset === "number") this.y = box.topOffset;
      },
      apply: () => this.applyFrameLayout(),
      persist: () => {
        this.root.dataset.resizing = "false";
      },
    }, axis);
  }

  private renderSettings(): void {
    const voices = this.actions.getVoices();
    const isWikiAttached = this.root.dataset.attached === "wikiSidebarBottom";
    const pages = isWikiAttached
      ? (["playback", "navigation", "highlighting"] as const)
      : (["playback", "navigation", "reading", "highlighting"] as const);
    if (!pages.some((page) => page === this.activePage)) {
      this.activePage = pages[0];
    }
    this.settingsPanel.textContent = "";
    this.settingsBody = document.createElement("div");
    this.settingsBody.className = "post-reading-settings-body";
    const tabs = document.createElement("div");
    tabs.className = "post-reading-tabs";
    for (const page of pages) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = isWikiAttached && page === "navigation" ? "Article" : titleCase(page);
      button.dataset.active = String(this.activePage === page);
      button.addEventListener("click", () => {
        this.activePage = page;
        this.renderSettings();
      });
      tabs.append(button);
    }
    this.settingsPanel.append(tabs, this.settingsBody);

    const sortedVoices = sortVoicesByBoundarySupport(voices, this.boundarySupport);
    const voiceLabel = document.createElement("label");
    voiceLabel.textContent = "Voice";
    const voiceSelect = document.createElement("select");
    voiceSelect.append(new Option("System default", ""));
    for (const voice of sortedVoices) {
      const support = this.boundarySupport.get(voice.voiceURI) ?? knownVoiceBoundarySupport(voice);
      const suffix = support === "supported" ? " - highlights" : support === "unsupported" ? " - no word sync" : "";
      voiceSelect.append(new Option(`${voice.name} (${voice.lang})${suffix}`, voice.voiceURI));
    }
    voiceSelect.value = this.settings.voiceURI || "";
    voiceSelect.addEventListener("change", () => this.update({ voiceURI: voiceSelect.value || null }));
    voiceLabel.append(voiceSelect);

    const selectedVoice = this.actions.getPreferredVoice();
    const voiceHint = document.createElement("div");
    voiceHint.className = "post-reading-hint";
    voiceHint.textContent = selectedVoice ? `Default: ${selectedVoice.name}` : "Default: system voice";
    const engine = selectInput("Engine", this.settings.ttsEngine, [
      ["web-speech", "Browser Web Speech"],
      ["custom-http", "Custom HTTP endpoint"],
    ], (value) => this.update({ ttsEngine: value as PostReadingSettings["ttsEngine"] }));
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
    ], (value) => this.update({ customTtsTimingMode: value as PostReadingSettings["customTtsTimingMode"] }));
    const customHint = document.createElement("div");
    customHint.className = "post-reading-hint";
    customHint.textContent = "Endpoint response: audioUrl or audioBase64, optional boundaries with charIndex and elapsedTime.";
    const probeButton = document.createElement("button");
    probeButton.type = "button";
    probeButton.className = "post-reading-secondary";
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
    const wikiAutoScroll = checkbox("Follow current line", this.settings.wikiAutoScroll, (checked) => this.update({ wikiAutoScroll: checked }));
    const skipPromoted = checkbox("Skip promoted posts", this.settings.skipPromotedPosts, (checked) => this.update({ skipPromotedPosts: checked }));
    const quotes = checkbox("Include quoted posts", this.settings.includeQuotes, (checked) => this.update({ includeQuotes: checked }));
    const fullQuotes = checkbox("Fetch full quoted posts", this.settings.fetchFullQuotes, (checked) => this.update({ fetchFullQuotes: checked }));
    const fullQuoteDisplay = selectInput("Full quote display", this.settings.fullQuoteDisplay, [
      ["hidden", "Hidden"],
      ["expand", "Expand"],
      ["scroll", "Scroll in preview"],
    ], (value) => this.update({ fullQuoteDisplay: value as PostReadingSettings["fullQuoteDisplay"] }));
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
    const body = this.settingsBody;
    if (!body) return;

    if (this.activePage === "playback") {
      body.append(engine);
      if (this.settings.ttsEngine === "custom-http") {
        body.append(customEndpoint, customTiming, customHint);
      } else {
        body.append(voiceLabel, voiceHint, probeButton);
      }
      body.append(speedLabel, volumeLabel, keyPlayPause, keyNextChunk, keyPreviousChunk);
      if (!isWikiAttached) body.append(keySkipOcr);
    } else if (this.activePage === "navigation") {
      if (isWikiAttached) {
        body.append(wikiAutoScroll, keyNextChunk, keyPreviousChunk);
      } else {
        body.append(autoplay, autoscroll, endDing, skipPromoted, keyNextTweet, keyPreviousTweet);
      }
    } else if (this.activePage === "reading") {
      body.append(quotes, fullQuotes, fullQuoteDisplay, hyperlinks, images, imageOcr, links, expand);
    } else if (this.activePage === "highlighting") {
      const activeTweet = checkbox("Highlight active tweet", this.settings.activeTweetHighlight, (checked) => this.update({ activeTweetHighlight: checked }));
      const bodyMode = selectInput("Body text", this.settings.bodyHighlightMode, [
        ["off", "Off"],
        ["word", "Current word"],
        ["smooth", "Smooth character fill"],
      ], (value) => this.update({ bodyHighlightMode: value as PostReadingSettings["bodyHighlightMode"] }));
      if (!isWikiAttached) body.append(activeTweet);
      body.append(bodyMode);
    }
  }

  private update(partial: Partial<PostReadingSettings>): void {
    this.settings = { ...this.settings, ...partial };
    this.actions.onSettingsChange(this.settings);
  }

  private async probeVoices(voices: SpeechSynthesisVoice[]): Promise<void> {
    this.probingVoices = true;
    this.renderSettings();
    for (const voice of voices) {
      if (this.boundarySupport.get(voice.voiceURI) === "supported") continue;
      if (knownVoiceBoundarySupport(voice) === "supported") {
        this.boundarySupport.set(voice.voiceURI, "supported");
        this.actions.onBoundarySupportChange(Object.fromEntries(this.boundarySupport));
        this.renderSettings();
        continue;
      }
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
    const leftRank = supportRank(boundarySupport.get(left.voiceURI) ?? knownVoiceBoundarySupport(left));
    const rightRank = supportRank(boundarySupport.get(right.voiceURI) ?? knownVoiceBoundarySupport(right));
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
  button.className = "post-reading-control";
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

function resizeHandle(
  className: string,
  title: string,
  axis: "both" | "x" | "y",
  onPointerDown: (event: PointerEvent) => void,
): HTMLDivElement {
  const handle = document.createElement("div");
  handle.className = className;
  handle.dataset.postReadingResize = "true";
  handle.dataset.resizeAxis = axis;
  handle.title = title;
  handle.addEventListener("pointerdown", onPointerDown);
  return handle;
}

function checkbox(label: string, checked: boolean, onChange: (checked: boolean) => void): HTMLLabelElement {
  const wrapper = document.createElement("label");
  wrapper.className = "post-reading-checkbox";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  const text = document.createElement("span");
  text.textContent = label;
  wrapper.append(input, text);
  return wrapper;
}
