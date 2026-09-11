import { splitExternalHandoffText, validateExternalHandoffCaptions } from "../app-sdk/external-handoff";
import type { AppExternalHandoff, MilxdyAppManifest, MilxdyComposerActionContext } from "../app-sdk/app-platform";
import { deriveComposerKeywordSuggestions } from "./composer-keyword-suggestions";

type ComposerActionApp = Pick<MilxdyAppManifest, "id" | "name" | "composerAction" | "externalHandoffs" | "remoteQueries">;
type ActionResult = { ok: boolean; error?: string };
type RuntimeMessage = <Result>(message: unknown) => Promise<Result | null>;
type ComposerImageReplacement = {
  composerScope: ParentNode;
  removeButton: HTMLButtonElement;
  originalDataUrl: string;
  attachmentIdentity:
    | { kind: "file"; input: HTMLInputElement; name: string; size: number; type: string; lastModified: number }
    | { kind: "preview"; image: HTMLImageElement; src: string };
};

export type ComposerActionPanel = { panel: HTMLElement; shadow: ShadowRoot; surface: HTMLElement };
export type ComposerActionServiceDependencies = {
  app: ComposerActionApp;
  composerSelector: string;
  currentButton: () => HTMLButtonElement;
  sendRuntimeMessage: RuntimeMessage;
  recordDiagnostic: (key: string, value: unknown) => void;
  playLaunchSound: () => void;
  errorMessage: (error: unknown) => string;
};

type ComposerActionServices = Pick<MilxdyComposerActionContext,
  "launchExternalHandoff" | "queryRemoteService" | "suggestRemoteQueryFacets" | "attachRemoteQueryResult">;

export function createComposerActionPanel(app: ComposerActionApp): ComposerActionPanel {
  const panel = document.createElement("section");
  panel.className = "milxdy-composer-action-panel";
  panel.dataset.appId = app.id;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", app.composerAction?.label || app.name);
  const shadow = panel.attachShadow({ mode: "open" });
  const surface = document.createElement("div");
  surface.className = "milxdy-composer-action-surface";
  shadow.append(surface);
  panel.style.visibility = "hidden";
  document.body.append(panel);
  return { panel, shadow, surface };
}

export function createComposerActionContext(input: {
  app: ComposerActionApp;
  kind: "post" | "reply";
  panel: HTMLElement;
  signal: AbortSignal;
  close: () => void;
  openNativeDrafts: () => void;
  services: ComposerActionServices;
}): MilxdyComposerActionContext {
  return {
    kind: input.kind,
    panel: input.panel,
    signal: input.signal,
    close: input.close,
    openNativeDrafts: input.openNativeDrafts,
    externalHandoffs: (input.app.externalHandoffs || []).map(({ id, label }) => ({ id, label })),
    remoteQueries: (input.app.remoteQueries || []).map(({ id, label }) => ({ id, label })),
    ...input.services,
  };
}

export function createComposerActionServices(dependencies: ComposerActionServiceDependencies): ComposerActionServices {
  return {
    launchExternalHandoff: (id, options) => launchExternalHandoff(dependencies, id, options),
    queryRemoteService: (id, request) => queryRemoteService(dependencies, id, request),
    suggestRemoteQueryFacets: (id) => suggestRemoteQueryFacets(dependencies, id),
    attachRemoteQueryResult: (id, itemId) => attachRemoteQueryResult(dependencies, id, itemId),
  };
}

function composerScopeFor(dependencies: ComposerActionServiceDependencies): ParentNode {
  return dependencies.currentButton().closest<HTMLElement>('[role="dialog"], [aria-modal="true"], form') || document;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("The composer image could not be read."));
    reader.onerror = () => reject(reader.error || new Error("The composer image could not be read."));
    reader.readAsDataURL(blob);
  });
}

async function prepareComposerImageReplacement(
  dependencies: ComposerActionServiceDependencies,
  composerScope: ParentNode,
  handoff: AppExternalHandoff,
): Promise<ComposerImageReplacement | { error: string }> {
  const transfer = handoff.mediaTransfer;
  if (!transfer || transfer.source !== "initiatingComposerImage" || transfer.result !== "replaceSameAttachment" || transfer.consent !== "perInvocation") return { error: "This package does not declare reviewed composer-image replacement." };
  const removeButtons = Array.from(composerScope.querySelectorAll<HTMLButtonElement>('button[aria-label*="remove media" i], button[data-testid="removeMedia"]'));
  if (removeButtons.length !== 1) return { error: "CheeseWorld requires exactly one existing composer image." };
  const input = Array.from(composerScope.querySelectorAll<HTMLInputElement>('input[type="file"]')).find((candidate) => candidate.accept.includes("image") || candidate.getAttribute("data-testid") === "fileInput");
  const originalFile = input?.files?.length === 1 ? input.files[0] : null;
  let blob: Blob | null = originalFile;
  let attachmentIdentity: ComposerImageReplacement["attachmentIdentity"] | null = originalFile && input
    ? { kind: "file", input, name: originalFile.name, size: originalFile.size, type: originalFile.type, lastModified: originalFile.lastModified }
    : null;
  if (!blob) {
    const previews = Array.from(composerScope.querySelectorAll<HTMLImageElement>('[data-testid="attachments"] img[src]')).filter((candidate) => candidate.offsetParent !== null && /^(?:blob:|data:image\/)/u.test(candidate.src));
    if (previews.length !== 1) return { error: "The existing composer image cannot be transferred safely." };
    try {
      blob = await fetch(previews[0].src).then((response) => response.blob());
      attachmentIdentity = { kind: "preview", image: previews[0], src: previews[0].src };
    } catch (error) {
      return { error: dependencies.errorMessage(error) };
    }
  }
  if (!blob || !attachmentIdentity) return { error: "The existing composer image cannot be transferred safely." };
  if (!transfer.allowedMimeTypes.some((type) => type === blob.type) || blob.size < 1 || blob.size > transfer.maxBytes) return { error: "The composer image type or size is outside the reviewed CheeseWorld limits." };
  return { composerScope, removeButton: removeButtons[0], originalDataUrl: await blobToDataUrl(blob), attachmentIdentity };
}

async function launchExternalHandoff(
  dependencies: ComposerActionServiceDependencies,
  id: string,
  options: { mode: "captioned" | "randomMeme"; captions?: { topText: string; bottomText: string } },
): Promise<ActionResult> {
  if (!navigator.userActivation?.isActive) return { ok: false, error: "Open a maker directly from its control." };
  const handoff = (dependencies.app.externalHandoffs || []).find((candidate) => candidate.id === id);
  if (!handoff) return { ok: false, error: "This handoff is not declared by the package." };
  const mode = options?.mode;
  if (mode !== "captioned" && mode !== "randomMeme") return { ok: false, error: "Choose an explicit maker mode from its control." };
  if (!(handoff.modes || ["captioned"]).includes(mode)) return { ok: false, error: "This handoff mode is not declared by the package." };
  dependencies.playLaunchSound();
  const composerScope = composerScopeFor(dependencies);
  const explicitCaptions = handoff.captionSource === "packageFields" ? validateExternalHandoffCaptions(options.captions, handoff.captionMaxLength) : null;
  if (handoff.captionSource === "packageFields" && !explicitCaptions) return { ok: false, error: "Enter the reviewed top and bottom captions before opening a maker." };
  const editor = handoff.captionSource === "packageFields" ? null : Array.from(composerScope.querySelectorAll<HTMLElement>(dependencies.composerSelector)).find((candidate) => candidate.isContentEditable && candidate.offsetParent !== null);
  const captions = explicitCaptions || splitExternalHandoffText(editor?.innerText || editor?.textContent || "");
  if ((!captions?.topText && !captions?.bottomText) && mode !== "randomMeme" && !handoff.mediaTransfer) return { ok: false, error: handoff.captionSource === "packageFields" ? "Enter a top or bottom caption before opening a maker." : "Write a draft before opening a maker." };
  const prepared = handoff.mediaTransfer ? await prepareComposerImageReplacement(dependencies, composerScope, handoff) : null;
  if (prepared && "error" in prepared) return { ok: false, error: prepared.error };
  const response = await dependencies.sendRuntimeMessage<{ ok?: boolean; error?: string; imageDataUrl?: string }>({ type: "milxdy:externalHandoff", appId: dependencies.app.id, handoffId: handoff.id, adapter: handoff.adapter, target: handoff.target, mode, ...(captions || { topText: "", bottomText: "" }), ...(prepared ? { imageDataUrl: prepared.originalDataUrl } : {}) });
  const result = response?.ok === true ? prepared ? await replaceComposerImage(dependencies, prepared, response.imageDataUrl) : await attachImageToComposer(dependencies, composerScope, response.imageDataUrl, "remilia-maker.png") : { ok: false, error: response?.error || "The maker handoff could not start." };
  dependencies.recordDiagnostic(`externalHandoff.${dependencies.app.id}`, { handoff: handoff.id, ok: result.ok, updatedAt: Date.now() });
  return result;
}

async function queryRemoteService(
  dependencies: ComposerActionServiceDependencies,
  id: string,
  request: Parameters<MilxdyComposerActionContext["queryRemoteService"]>[1],
): ReturnType<MilxdyComposerActionContext["queryRemoteService"]> {
  if (!navigator.userActivation?.isActive) return { ok: false, error: "Open the gallery from its control." };
  const query = (dependencies.app.remoteQueries || []).find((candidate) => candidate.id === id);
  if (!query || !query.resources.includes(request.resource)) return { ok: false, error: query ? "This remote gallery resource is not declared by the package." : "This remote gallery is not declared by the package." };
  const response = await dependencies.sendRuntimeMessage<Awaited<ReturnType<MilxdyComposerActionContext["queryRemoteService"]>>>({ type: "milxdy:remoteQuery", appId: dependencies.app.id, queryId: query.id, request });
  return response?.ok === true ? { ok: true, page: response.page, facets: response.facets } : { ok: false, error: response?.error || "The remote gallery is unavailable." };
}

async function suggestRemoteQueryFacets(dependencies: ComposerActionServiceDependencies, id: string): ReturnType<MilxdyComposerActionContext["suggestRemoteQueryFacets"]> {
  if (!navigator.userActivation?.isActive) return { ok: false, error: "Request suggestions from the Tags control.", suggestions: [] };
  const query = (dependencies.app.remoteQueries || []).find((candidate) => candidate.id === id);
  const declaration = query?.composerSuggestions;
  if (!query || !declaration || !query.resources.includes("facets")) return { ok: false, error: "Composer suggestions are not declared for this gallery.", suggestions: [] };
  const editor = Array.from(composerScopeFor(dependencies).querySelectorAll<HTMLElement>(dependencies.composerSelector)).find((candidate) => candidate.isContentEditable && candidate.offsetParent !== null);
  return { ok: true, suggestions: deriveComposerKeywordSuggestions(editor?.innerText || editor?.textContent || "", declaration) };
}

async function attachRemoteQueryResult(dependencies: ComposerActionServiceDependencies, id: string, itemId: string): Promise<ActionResult> {
  if (!navigator.userActivation?.isActive) return { ok: false, error: "Attach a gallery result from its control." };
  const query = (dependencies.app.remoteQueries || []).find((candidate) => candidate.id === id);
  if (!query || !query.resultActions?.includes("attachToInitiatingComposer")) return { ok: false, error: "This gallery does not declare composer attachment." };
  if (typeof itemId !== "string" || itemId.length < 1 || itemId.length > 128) return { ok: false, error: "This gallery result is invalid." };
  const composerScope = composerScopeFor(dependencies);
  if (composerScope.querySelectorAll('button[aria-label*="remove media" i], button[data-testid="removeMedia"]').length >= 4) return { ok: false, error: "X's composer supports up to 4 images." };
  const response = await dependencies.sendRuntimeMessage<{ ok?: boolean; error?: string; imageDataUrl?: string; contentType?: string }>({ type: "milxdy:remoteQueryAttach", appId: dependencies.app.id, queryId: query.id, itemId });
  const result = response?.ok === true ? await attachImageToComposer(dependencies, composerScope, response.imageDataUrl, remoteQueryAttachmentFileName(response.contentType)) : { ok: false, error: response?.error || "The gallery result could not be attached." };
  dependencies.recordDiagnostic(`remoteQueryAttachment.${dependencies.app.id}`, { query: query.id, ok: result.ok, updatedAt: Date.now() });
  return result;
}

function remoteQueryAttachmentFileName(contentType: string | undefined): string {
  const extension = contentType === "image/png" ? "png" : contentType === "image/jpeg" ? "jpg" : contentType === "image/gif" ? "gif" : "webp";
  return `remibooru-result.${extension}`;
}

async function replaceComposerImage(dependencies: ComposerActionServiceDependencies, replacement: ComposerImageReplacement, imageDataUrl: string | undefined): Promise<ActionResult> {
  const scopeNode = replacement.composerScope as Node;
  const removeButtons = Array.from(replacement.composerScope.querySelectorAll<HTMLButtonElement>('button[aria-label*="remove media" i], button[data-testid="removeMedia"]'));
  const identityMatches = replacement.attachmentIdentity.kind === "file" ? fileAttachmentMatches(replacement.attachmentIdentity) : replacement.attachmentIdentity.image.isConnected && replacement.attachmentIdentity.image.src === replacement.attachmentIdentity.src;
  if (!dependencies.currentButton().isConnected || !scopeNode.isConnected || composerScopeFor(dependencies) !== replacement.composerScope || removeButtons.length !== 1 || removeButtons[0] !== replacement.removeButton || !replacement.removeButton.isConnected || !identityMatches) return { ok: false, error: "The initiating composer or its image changed before CheeseWorld finished." };
  replacement.removeButton.click();
  const released = await waitForRemoval(replacement.removeButton);
  if (!released) return { ok: false, error: "X did not release the original composer image." };
  const attached = await attachImageToComposer(dependencies, replacement.composerScope, imageDataUrl, "cheeseworld-deepfry.png", false);
  if (attached.ok && await waitForComposerImage(replacement.composerScope, replacement.removeButton)) return { ok: true };
  const restored = await attachImageToComposer(dependencies, replacement.composerScope, replacement.originalDataUrl, "cheeseworld-original", false);
  const replacementError = attached.error || "X did not accept the CheeseWorld replacement image.";
  const restoreAccepted = restored.ok && await waitForComposerImage(replacement.composerScope, replacement.removeButton);
  return { ok: false, error: restoreAccepted ? `${replacementError} The original image was restored.` : `${replacementError} The original image could not be restored.` };
}

function fileAttachmentMatches(identity: Extract<ComposerImageReplacement["attachmentIdentity"], { kind: "file" }>): boolean {
  const current = identity.input.files?.length === 1 ? identity.input.files[0] : null;
  return identity.input.isConnected && current?.name === identity.name && current.size === identity.size && current.type === identity.type && current.lastModified === identity.lastModified;
}

async function waitForRemoval(removeButton: HTMLButtonElement): Promise<boolean> {
  const deadline = Date.now() + 3_000;
  while (removeButton.isConnected && Date.now() < deadline) await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
  return !removeButton.isConnected;
}

async function waitForComposerImage(composerScope: ParentNode, previousRemoveButton: HTMLButtonElement): Promise<boolean> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const removeButtons = Array.from(composerScope.querySelectorAll<HTMLButtonElement>('button[aria-label*="remove media" i], button[data-testid="removeMedia"]'));
    if (removeButtons.length === 1 && removeButtons[0] !== previousRemoveButton && removeButtons[0].isConnected) return true;
    await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
  }
  return false;
}

async function attachImageToComposer(dependencies: ComposerActionServiceDependencies, composerScope: ParentNode, imageDataUrl: string | undefined, fileName: string, preserveExisting = true): Promise<ActionResult> {
  if (typeof imageDataUrl !== "string" || !/^data:image\/(?:png|jpeg|gif|webp);base64,/u.test(imageDataUrl)) return { ok: false, error: "The image handoff returned unsupported media." };
  try {
    const blob = await fetch(imageDataUrl).then((response) => response.blob());
    if (!["image/png", "image/jpeg", "image/gif", "image/webp"].includes(blob.type) || blob.size === 0 || blob.size > 10 * 1024 * 1024) return { ok: false, error: "The image is unavailable or too large." };
    const input = Array.from(composerScope.querySelectorAll<HTMLInputElement>('input[type="file"]')).find((candidate) => candidate.accept.includes("image") || candidate.getAttribute("data-testid") === "fileInput");
    if (!input) return { ok: false, error: "X's media control is unavailable." };
    const existingFiles = preserveExisting ? Array.from(input.files || []) : [];
    if (existingFiles.length >= 4) return { ok: false, error: "X's composer supports up to 4 images." };
    const transfer = new DataTransfer();
    for (const existingFile of existingFiles) transfer.items.add(existingFile);
    transfer.items.add(new File([blob], fileName, { type: blob.type }));
    input.files = transfer.files;
    if (input.files?.length !== existingFiles.length + 1) return { ok: false, error: "X's media control rejected the selected image." };
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: dependencies.errorMessage(error) };
  }
}
