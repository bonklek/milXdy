/** Public content-app declarations for milXdy App SDK 0.2.5. */

export type TwitterSurfaceKind =
  | "tweet"
  | "xArticle"
  | "userCell"
  | "notification"
  | "directMessage"
  | "profile";

export type MilxdyAppSurface = TwitterSurfaceKind | "route" | "overlayApp";

export interface AppComposerAction {
  label: string;
  icon?: string | { light: string; dark: string };
  presentation: "anchoredPanel";
}

export interface AppExternalHandoff {
  id: string;
  label: string;
  adapter: string;
  target: string;
  modes?: Array<"captioned" | "randomMeme">;
  captionSource?: "composerDraft" | "packageFields";
  captionMaxLength?: number;
  mediaTransfer?: {
    source: "initiatingComposerImage";
    result: "replaceSameAttachment";
    consent: "perInvocation";
    maxBytes: number;
    allowedMimeTypes: Array<"image/png" | "image/jpeg" | "image/gif" | "image/webp">;
  };
}

export interface AppContextualPostAction {
  id: string;
  label: string;
  icon?: string | { light: string; dark: string };
  placement: "shareMenu";
}

/** A reviewed X-image action. The host retains the selected image and exposes only an opaque handle. */
export interface AppContextMediaAction {
  id: string;
  label: string;
  site: "x";
  eligibleMedia: Array<"image">;
  presentation: "hostPanel";
}

/** A reviewed, host-owned native contribution flow; packages supply only bounded user-entered tags. */
export interface AppMediaContribution {
  id: string;
  label: string;
  adapter: "remibooru";
  contextMediaActionId: string;
  maxTags: number;
  maxTagLength: number;
}

export interface AppPageContextAction {
  id: string;
  label: string;
  entry: string;
  documentUrlPatterns: Array<"http://*/*" | "https://*/*">;
}

export interface MilxdyPageContextActionHost<TSync extends object = Record<string, unknown>> {
  readonly appId: string;
  readonly actionId: string;
  readonly storage: {
    readonly sync: {
      readonly values: Partial<TSync>;
      set(values: Partial<TSync>): Promise<void>;
    };
  };
  sendMessage<T = unknown>(message: unknown, label?: string): Promise<T | null>;
}

export interface TwitterSurface {
  kind: TwitterSurfaceKind;
  element: HTMLElement;
  handle: string | null;
  avatarUrl: string | null;
  textContainers: HTMLElement[];
  statusUrl: string | null;
  actionRow: HTMLElement | null;
  cacheKey: string;
  emittedAt: number;
}

export interface MilxdyRouteChange {
  href: string;
  pathname: string;
  previousHref: string | null;
  visible: boolean;
  changedAt: number;
}

export interface AppRuntimeScheduler {
  idle(callback: () => void, options?: { timeout?: number }): () => void;
  timeout(callback: () => void, delayMs: number): () => void;
}

export type Disposable = (() => void) | { dispose(): void };

export interface AppStorageChange {
  oldValue?: unknown;
  newValue?: unknown;
}

export interface AppStorageArea {
  get<T extends Record<string, unknown>>(defaults: T): Promise<T>;
  set(values: Record<string, unknown>): Promise<void>;
  remove(keys: string | readonly string[]): Promise<void>;
  onChanged(listener: (changes: Record<string, AppStorageChange>) => void): () => void;
}

export interface AppStorageFacade {
  readonly local: AppStorageArea;
  readonly sync: AppStorageArea;
}

export interface PublicAppManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  surfaces: MilxdyAppSurface[];
  loadTriggers: Array<"startup" | "surface" | "dockOpen" | "idle" | "userAction">;
  composerAction?: AppComposerAction;
  externalHandoffs?: AppExternalHandoff[];
  contextualPostActions?: AppContextualPostAction[];
  contextMediaActions?: AppContextMediaAction[];
  mediaContributions?: AppMediaContribution[];
  pageContextActions?: AppPageContextAction[];
}

export interface MilxdyContentAppContext {
  readonly manifest: PublicAppManifest;
  readonly signal: AbortSignal;
  readonly scheduler: AppRuntimeScheduler;
  readonly storage: AppStorageFacade;
  resolveAssetUrl(path: string): string;
  requestSurfaceRescan(): void;
  sendMessage<T = unknown>(message: unknown, label?: string): Promise<T | null>;
  recordDiagnostic(key: string, value: unknown): void;
  addDisposable(disposable: Disposable): void;
}

export interface MilxdyContentAppModule {
  readonly id?: string;
  boot?(context: MilxdyContentAppContext): Promise<void> | void;
  enable?(): Promise<void> | void;
  disable?(): Promise<void> | void;
  onRouteChange?(route: MilxdyRouteChange): Promise<void> | void;
  onSurface?(surface: TwitterSurface): Promise<void> | void;
  onComposerAction?(context: MilxdyComposerActionContext): Promise<void> | void;
  onContextualPostAction?(context: MilxdyContextualPostActionContext): Promise<void> | void;
  onContextMediaAction?(context: MilxdyContextMediaActionContext): Promise<void> | void;
  /** Host-only local attachment handoff used by reviewed app integrations. */
  stageLocalAttachment?(file: File): Promise<{ ok: boolean; error?: string }>;
  open?(): Promise<void> | void;
  close?(): Promise<void> | void;
  dispose?(): Promise<void> | void;
}

export interface MilxdyComposerActionContext {
  readonly kind: "post" | "reply";
  readonly panel: HTMLElement;
  readonly signal: AbortSignal;
  readonly externalHandoffs: ReadonlyArray<Pick<AppExternalHandoff, "id" | "label">>;
  launchExternalHandoff(id: string, options?: {
    mode?: "captioned" | "randomMeme";
    captions?: { topText: string; bottomText: string };
  }): Promise<{ ok: boolean; error?: string }>;
  readonly remoteQueries: ReadonlyArray<{ id: string; label: string }>;
  queryRemoteService(id: string, request: {
    resource: "posts" | "facets";
    cursor?: string;
    limit?: number;
    facets?: string[];
  }): Promise<{
    ok: boolean;
    error?: string;
    page?: {
      items: Array<{
        id: string;
        postUrl: string;
        thumbnailUrl: string;
        media: { contentType: string; width: number; height: number; isGif: boolean };
        facets: Array<{ kind: string; value: string; category: string }>;
        attribution: { label: string; uploader: string | null };
      }>;
      nextCursor: string | null;
    };
    facets?: Array<{ kind: string; value: string; category: string; postCount: number }>;
  }>;
  suggestRemoteQueryFacets(id: string): Promise<{ ok: boolean; error?: string; suggestions: string[] }>;
  /** Attaches one recently returned reviewed result to this initiating composer; never posts. */
  attachRemoteQueryResult(id: string, itemId: string): Promise<{ ok: boolean; error?: string }>;
  close(): void;
}

export interface MilxdyContextualPostActionContext {
  readonly actionId: string;
  readonly post: HTMLElement;
  readonly statusUrl: string | null;
  readonly signal: AbortSignal;
  readonly storage: AppStorageFacade;
  resolveAssetUrl(path: string): string;
  /** Retests the host-owned RemiNet browser session without reloading the page. */
  probeRemiNetConnection(): Promise<{ connected: boolean }>;
  /** Opens the fixed RemiliaNET session page in an inactive tab. */
  openRemiNetSession(): Promise<{ ok: boolean; error?: string }>;
  /** Stages a reviewed PNG locally in RemiNet Chat. Upload still requires Send. */
  stageRemiNetChatPng(input: {
    blob: Blob;
    fileName: string;
  }): Promise<{ ok: boolean; error?: string }>;
}

/**
 * A host-owned image selection. `mediaHandle` is opaque, short-lived, and may
 * only be supplied back to the declared contribution callback for this action.
 */
export interface MilxdyContextMediaActionContext {
  readonly actionId: string;
  readonly panel: HTMLElement;
  readonly signal: AbortSignal;
  close(): void;
  readonly mediaHandle: string;
  readonly media: Readonly<{
    mimeType: string;
    width: number | null;
    height: number | null;
    altAvailable: boolean;
  }>;
  openVisibleAssistantPrompt(promptId: "remibooru-tags"): Promise<{ ok: boolean; error?: string }>;
  submitMediaContribution(input: {
    id: string;
    mediaHandle: string;
    tags: string[];
  }): Promise<{ ok: boolean; canonicalUrl?: string; error?: string }>;
}
