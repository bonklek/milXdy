import { safeRuntimeMessage } from "../background/extension-runtime";
import type { MilxdyAppManifest, MilxdyContentAppModule } from "../app-sdk/app-platform";

export type ContextMediaSelection = {
  sourceUrl: string;
  width: number | null;
  height: number | null;
  altAvailable: boolean;
  x: number;
  y: number;
};

type ContextMediaPanelDependencies = {
  loadApp: (app: MilxdyAppManifest, reason: string) => Promise<MilxdyContentAppModule | null>;
  installPackageStyles: (app: MilxdyAppManifest, root: ShadowRoot) => Promise<void>;
  recordDiagnostic: (key: string, detail: Record<string, unknown>) => void;
};

type PanelRequest = {
  app: MilxdyAppManifest;
  actionId: string;
  contributionId: string;
  selected: ContextMediaSelection;
  isCurrent: () => boolean;
  currentClose: () => (() => void) | null;
  setClose: (close: (() => void) | null) => void;
};

type PreparedMedia = { mimeType: string; width: number | null; height: number | null; altAvailable: boolean };

export async function openContextMediaActionPanel(deps: ContextMediaPanelDependencies, request: PanelRequest): Promise<void> {
  request.currentClose()?.();
  const module = await deps.loadApp(request.app, `userAction:contextMedia:${request.actionId}`);
  if (!request.isCurrent() || !module?.onContextMediaAction) return;
  const view = createPanelView(request);
  document.body.append(view.panel);
  request.setClose(view.close);
  document.addEventListener("pointerdown", view.dismiss, true);
  window.addEventListener("keydown", view.escape, true);
  const prepared = await prepareMedia(request);
  if (!request.isCurrent() || view.controller.signal.aborted) return view.close();
  if (!prepared?.ok || !prepared.mediaHandle || !prepared.media) return showPreparationFailure(deps, request, view.surface, prepared?.error);
  await invokeMediaAction(deps, request, module, view, prepared.mediaHandle, prepared.media);
}

function createPanelView(request: PanelRequest): {
  panel: HTMLElement; surface: HTMLElement; controller: AbortController; close: () => void; dismiss: (event: PointerEvent) => void; escape: (event: KeyboardEvent) => void;
} {
  const controller = new AbortController();
  const panel = document.createElement("section");
  panel.className = "milxdy-context-media-panel";
  panel.dataset.appId = request.app.id;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", `${request.app.name} media contribution`);
  panel.style.cssText = panelPosition(request.selected);
  const shadow = panel.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = ":host{all:initial}.preview{display:block;max-width:100%;max-height:180px;margin:0 auto 10px;border-radius:8px;object-fit:contain}.surface{font:14px/1.35 system-ui,sans-serif}.preparation-status{margin:0 0 8px}.native-fallback{color:LinkText;font-weight:700}";
  const preview = document.createElement("img");
  preview.className = "preview";
  preview.alt = "Selected X image preview";
  preview.src = request.selected.sourceUrl;
  const surface = document.createElement("div");
  surface.className = "surface";
  shadow.append(style, preview, surface);
  let assistant: HTMLElement | null = null;
  const close = () => {
    controller.abort(); panel.remove(); assistant?.remove();
    if (request.currentClose() === close) request.setClose(null);
    document.removeEventListener("pointerdown", dismiss, true); window.removeEventListener("keydown", escape, true);
  };
  const dismiss = (event: PointerEvent) => { if (!event.composedPath().includes(panel)) close(); };
  const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); close(); } };
  const openAssistant = () => { assistant?.remove(); assistant = createAssistant(request.selected.sourceUrl); document.body.append(assistant); return { ok: true }; };
  surface.dataset.openAssistant = "ready";
  (surface as HTMLElement & { openAssistant?: () => { ok: boolean } }).openAssistant = openAssistant;
  showPreparing(surface);
  return { panel, surface, controller, close, dismiss, escape };
}

function panelPosition(selected: ContextMediaSelection): string {
  const left = Math.max(8, Math.min(selected.x, window.innerWidth - 380));
  const top = Math.max(8, Math.min(selected.y, window.innerHeight - 440));
  return `color-scheme:light dark;position:fixed;z-index:2147483646;left:${left}px;top:${top}px;max-width:360px;max-height:calc(100vh - 16px);overflow:auto;background:Canvas;color:CanvasText;border:1px solid GrayText;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.28);padding:10px`;
}

function createAssistant(sourceUrl: string): HTMLElement {
  const assistant = document.createElement("section");
  assistant.className = "milxdy-context-media-assistant";
  assistant.setAttribute("role", "dialog"); assistant.setAttribute("aria-label", "Grok tag helper");
  assistant.style.cssText = "color-scheme:light dark;position:fixed;right:16px;bottom:16px;z-index:2147483647;width:300px;padding:10px;background:Canvas;color:CanvasText;border:1px solid GrayText;border-radius:10px;box-shadow:0 6px 22px rgba(0,0,0,.3)";
  const prompt = document.createElement("textarea");
  prompt.readOnly = true; prompt.value = `Suggest concise Remibooru tags for this X image: ${sourceUrl}\nReturn tags only; do not upload or post anything.`;
  prompt.style.cssText = "box-sizing:border-box;width:100%;min-height:96px";
  const copy = document.createElement("button"); copy.textContent = "Copy prompt";
  copy.addEventListener("click", () => void navigator.clipboard.writeText(prompt.value));
  const open = document.createElement("button"); open.textContent = "Open Grok";
  open.addEventListener("click", () => window.open(`https://x.com/i/grok?text=${encodeURIComponent(prompt.value)}`, "_blank", "noopener,noreferrer"));
  assistant.append(prompt, copy, open); return assistant;
}

function showPreparing(surface: HTMLElement): void {
  const preparing = document.createElement("p");
  preparing.className = "preparation-status"; preparing.setAttribute("role", "status");
  preparing.textContent = "Preparing the selected media for public Remibooru review...";
  surface.replaceChildren(preparing);
}

async function prepareMedia(request: PanelRequest): Promise<{ ok?: boolean; error?: string; mediaHandle?: string; media?: PreparedMedia } | null> {
  return safeRuntimeMessage({ type: "milxdy:contextMediaPrepare", appId: request.app.id, actionId: request.actionId, sourceUrl: request.selected.sourceUrl, width: request.selected.width, height: request.selected.height, altAvailable: request.selected.altAvailable });
}

function showPreparationFailure(deps: ContextMediaPanelDependencies, request: PanelRequest, surface: HTMLElement, error?: string): void {
  const text = error || "The selected image could not be prepared for direct contribution.";
  deps.recordDiagnostic(`contextMedia.${request.app.id}`, { error: text });
  const message = document.createElement("p"); message.className = "preparation-status"; message.setAttribute("role", "alert"); message.textContent = text;
  const fallback = document.createElement("a"); fallback.className = "native-fallback"; fallback.href = "https://remibooru.com/upload"; fallback.target = "_blank"; fallback.rel = "noopener noreferrer"; fallback.textContent = "Open Remibooru's native uploader";
  surface.replaceChildren(message, fallback);
}

async function invokeMediaAction(deps: ContextMediaPanelDependencies, request: PanelRequest, module: MilxdyContentAppModule, view: ReturnType<typeof createPanelView>, mediaHandle: string, media: PreparedMedia): Promise<void> {
  try {
    await deps.installPackageStyles(request.app, view.panel.shadowRoot!);
    const openAssistant = (view.surface as HTMLElement & { openAssistant?: () => { ok: boolean } }).openAssistant!;
    await module.onContextMediaAction?.({ actionId: request.actionId, panel: view.surface, signal: view.controller.signal, close: view.close, mediaHandle, media, openVisibleAssistantPrompt: async (id) => id === "remibooru-tags" ? openAssistant() : { ok: false, error: "Unsupported assistant prompt." }, submitMediaContribution: ({ id, mediaHandle: handle, tags }) => {
      if (id !== request.contributionId || handle !== mediaHandle) return Promise.resolve({ ok: false, error: "The contribution does not match this selected image." });
      return safeRuntimeMessage<{ ok: boolean; canonicalUrl?: string; error?: string }>({ type: "milxdy:mediaContributionSubmit", appId: request.app.id, actionId: request.actionId, contributionId: request.contributionId, mediaHandle, tags }).then((value) => value || { ok: false, error: "The contribution service is unavailable." });
    } });
  } catch (error) { view.close(); deps.recordDiagnostic(`contextMedia.${request.app.id}`, { error: error instanceof Error ? error.message : String(error) }); }
}
