/**
 * Public content-app declarations for milXdy App SDK 0.2.5.
 *
 * These declarations are the portable author contract. They intentionally do
 * not expose runtime loading, scanning, or private platform helpers.
 */

export type TwitterSurfaceKind =
  | "tweet"
  | "xArticle"
  | "userCell"
  | "notification"
  | "directMessage"
  | "profile";

export type MilxdyAppSurface = TwitterSurfaceKind | "document" | "route" | "overlayApp" | "composerAction" | "replyAction";
export type MilxdyAppSiteId = "x" | "remiliaNet" | "remiliaWiki" | "miladychan";
export type MilxdySiteRuntimeMode = "fullRail" | "appLauncher" | "featureOnly" | "bridgeOnly";

/** The site and host runtime that activated this app. */
export interface MilxdyRuntimeSite {
  readonly id: MilxdyAppSiteId;
  readonly origin: string;
  readonly mode: MilxdySiteRuntimeMode;
}

export interface AppComposerAction {
  label: string;
  icon?: string | { light: string; dark: string };
  presentation: "anchoredPanel";
}

/** A reviewed host companion rendered beside the declared composer action. */
export type AppHostComposerAction = "nativeDrafts";

export interface AppReplyActionTemplate {
  id: string;
  label: string;
  text?: string;
  storageKey?: string;
  storageListKey?: string;
  sendAfterInsert?: boolean;
  /** Declared local, default-false toggle; manifest permission alone never sends. */
  sendAfterInsertStorageKey?: string;
}

export interface AppReplyAction {
  templates: AppReplyActionTemplate[];
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

export type RemiliaCapabilityId =
  | "remilia.profile.public"
  | "remilia.profile.me"
  | "remilia.directory.read"
  | "remilia.stats.read"
  | "remilia.notifications.read"
  | "remilia.pokes.write"
  | "remilia.beetle.read"
  | "remilia.chat.read"
  | "remilia.chat.write";

export type RemiliaCapabilityOperation =
  | "getUserProfile"
  | "getMe"
  | "getMyStats"
  | "listMyNotifications"
  | "getMyBeetle"
  | "getMyBeetleCards"
  | "pokeUser"
  | "listGlobalChatMessages"
  | "postGlobalChatMessage"
  | "resolveDirectory"
  | "listDirectoryUsers";

export type RemiliaOfficialScope =
  | "remilia:stats.read"
  | "remilia:notifications.read"
  | "remilia:pokes.write"
  | "remilia:beetle.read"
  | "remilia:chat.read"
  | "remilia:chat.write"
  | "remilia:directory.read";

export interface AppRemiliaCapabilityDeclaration {
  id: RemiliaCapabilityId;
  operations: RemiliaCapabilityOperation[];
  scopes: RemiliaOfficialScope[];
  consent: "enablement" | "perInvocation";
  reason: string;
}

export interface RemiliaDirectoryIdentifier {
  type: "handle" | "x_handle" | "github" | "discord";
  value: string;
}

export interface RemiliaCapabilityParams {
  getUserProfile: { username: string };
  getMe: Record<string, never>;
  getMyStats: Record<string, never>;
  listMyNotifications: { limit?: number; page?: number };
  getMyBeetle: Record<string, never>;
  getMyBeetleCards: Record<string, never>;
  pokeUser: { handle: string };
  listGlobalChatMessages: { limit?: number; before?: string };
  postGlobalChatMessage: { text: string; replyToId?: string };
  resolveDirectory: { identifiers: RemiliaDirectoryIdentifier[] };
  listDirectoryUsers: { limit?: number; cursor?: string };
}

export type RemiliaCapabilityBrokerResult<T = unknown> =
  | { ok: true; data: T; status: number; rateLimit?: { limit?: number; remaining?: number; resetAt?: number } }
  | { ok: false; error: { category: string; code: string; message: string; status: number; retryAfterMs?: number; nextAllowedAt?: number } };

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

/**
 * Retention metadata is separate from access authorization in `storageKeys`.
 * A represented settings resource resets by default; represented authored,
 * cached, and sensitive data is preserved by default. Unrepresented keys are
 * preserved unless a legacy per-setting reset rule covers that setting. Use
 * `reset: "reset"` only after the manifest disclosure and reset preview make
 * the deletion clear to the user.
 */
export interface AppStorageResource {
  area: "local" | "sync";
  key: string;
  kind: "settings" | "cache" | "authoredData" | "sensitiveData";
  reset?: "reset" | "preserve";
}

export interface AppWindowCreateOptions {
  /** Stable package-local ID used by the host for one managed window. */
  id: string;
  title: string;
  /** Package-owned content. The host owns its surrounding window chrome. */
  content: HTMLElement;
  initialBounds?: {
    width?: number;
    height?: number;
    top?: number;
    side?: "left" | "right";
  };
  minWidth?: number;
  minHeight?: number;
  resizable?: boolean;
  /** Declared local-storage key used only for this window's layout record. */
  persistKey?: string;
  onClose?: () => void;
}

export interface AppWindowHandle {
  open(): void;
  close(): void;
  focus(): void;
  dispose(): void;
  readonly element: HTMLElement;
  readonly isOpen: boolean;
}

/** Host-owned window behavior: mount, drag/resize, clamping, focus, and cleanup. */
export interface AppWindowService {
  create(options: AppWindowCreateOptions): AppWindowHandle;
}

export interface PublicAppManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  surfaces: MilxdyAppSurface[];
  loadTriggers: Array<"startup" | "surface" | "dockOpen" | "idle" | "userAction">;
  composerAction?: AppComposerAction;
  hostComposerActions?: AppHostComposerAction[];
  replyAction?: AppReplyAction;
  externalHandoffs?: AppExternalHandoff[];
  contextualPostActions?: AppContextualPostAction[];
  contextMediaActions?: AppContextMediaAction[];
  mediaContributions?: AppMediaContribution[];
  pageContextActions?: AppPageContextAction[];
  /** Declared host actions are the only cross-app operations available to a package. */
  hostActions?: Array<"wiki.openPage">;
  storageResources?: AppStorageResource[];
  /** Host-filtered reviewed Remilia operations. Credentials never enter package code. */
  remiliaCapabilities?: AppRemiliaCapabilityDeclaration[];
}

/** The JSON-compatible manifest shape for a portable local package. */
export interface MilxdyLocalAppPackageManifestV1 extends PublicAppManifest {
  manifestVersion: 1;
  packageKind: "app" | "feature" | "theme";
  sdk: { minVersion: string; targetVersion?: string; notes?: string[] };
  contentEntry: string;
  defaultEnabled: boolean;
  storageKeys: { local?: string[]; sync?: string[] };
  cost: {
    startup: "cheap" | "moderate" | "heavy";
    perSurface: "cheap" | "moderate" | "heavy";
    network: "none" | "batched" | "eager";
    worker: "none" | "optional" | "heavy";
    domWrite: "small" | "moderate" | "large";
  };
  siteScopes?: Array<{
    site: MilxdyAppSiteId;
    hosts: string[];
    integration: "contentScript" | "backgroundService" | "embeddedFrame" | "overlayApp";
    surfaces: MilxdyAppSurface[];
    routes?: Array<{ type: "exact" | "prefix"; path: string; surface?: MilxdyAppSurface }>;
    loadTriggers?: Array<"startup" | "surface" | "dockOpen" | "idle" | "userAction">;
    presentation?: "sideRailOverlay" | "hostRouteOverlay" | "userAction";
    fallback?: { mode: "nativeSite" | "externalPage" | "none"; url?: string; note: string };
    notes?: string[];
  }>;
  background?: {
    /** Declares package-owned message namespaces routed to reviewed host handlers. */
    messageTypes?: string[];
  };
}

export interface MilxdyContentAppContext {
  readonly manifest: PublicAppManifest;
  readonly site: MilxdyRuntimeSite;
  readonly signal: AbortSignal;
  readonly scheduler: AppRuntimeScheduler;
  readonly storage: AppStorageFacade;
  readonly windows: AppWindowService;
  resolveAssetUrl(path: string): string;
  requestSurfaceRescan(): void;
  sendMessage<T = unknown>(message: unknown, label?: string): Promise<T | null>;
  readonly remiliaCapabilities?: ReadonlyArray<AppRemiliaCapabilityDeclaration>;
  invokeRemiliaCapability?<Operation extends RemiliaCapabilityOperation>(
    operation: Operation,
    params: RemiliaCapabilityParams[Operation],
  ): Promise<RemiliaCapabilityBrokerResult>;
  /** Opens a validated Wiki page only when the package declared `wiki.openPage`. */
  openWikiPage(url: string): Promise<{ ok: boolean; reason?: "disabled" | "unavailable" | "invalid-url" | "cancelled" | "failed" }>;
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
  onReplyAction?(context: MilxdyReplyActionContext): Promise<void> | void;
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
  launchExternalHandoff(id: string, options: {
    mode: "captioned" | "randomMeme";
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
  /** Opens X's native Drafts UI after an explicit package-control click. */
  openNativeDrafts(): void;
  /** Attaches one recently returned reviewed result to this initiating composer; never posts. */
  attachRemoteQueryResult(id: string, itemId: string): Promise<{ ok: boolean; error?: string }>;
  close(): void;
}

/** A host-owned reply action panel. The host owns anchoring and native insertion. */
export interface MilxdyReplyActionContext {
  readonly panel: HTMLElement;
  readonly signal: AbortSignal;
  close(): void;
  readonly templates: ReadonlyArray<Pick<AppReplyActionTemplate, "id" | "label" | "sendAfterInsert">>;
  openNativeReply(): void;
  selectTemplate(id: string): void;
}

export interface MilxdyContextualPostActionContext {
  readonly actionId: string;
  readonly post: HTMLElement;
  readonly statusUrl: string | null;
  readonly signal: AbortSignal;
  readonly storage: AppStorageFacade;
  resolveAssetUrl(path: string): string;
  /** Requests a token-free retest of the host-owned Remilia connection without reloading the page. */
  probeRemiNetConnection(): Promise<{ connected: boolean }>;
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
