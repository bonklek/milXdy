import type { TwitterSurface, TwitterSurfaceKind } from "../scanner/twitter-scanner";
import type { Disposable } from "../runtime/disposables";
import type { AppStorageFacade } from "./app-storage";

export type { AppStorageArea, AppStorageAreaName, AppStorageChange, AppStorageChanges, AppStorageFacade } from "./app-storage";

export type MilxdyAppId = string;

export type MilxdyAppSurface = TwitterSurfaceKind | "route" | "overlayApp" | "composerAction" | "replyAction";
export type AppCostLevel = "cheap" | "moderate" | "heavy";
export type AppNetworkCost = "none" | "batched" | "eager";
export type AppWorkerCost = "none" | "optional" | "heavy";
export type AppDomWriteCost = "small" | "moderate" | "large";
export type AppLoadTrigger = "startup" | "surface" | "dockOpen" | "idle" | "userAction";
export type AppHubCategory = "appearance" | "reading" | "social" | "game" | "media" | "developer";
export type AppPreset = "lite" | "balanced" | "full";
export type AppPrivacyLabel = "local-only" | "browser-session" | "remote-api" | "local-files" | "diagnostics";
export type AppChromeStyle = "native" | "reminet" | "classic" | "maxxer" | "reader" | "miladychan" | "music" | "wiki";
export type AppPackageKind = "app" | "feature" | "theme";
export type AppLifecycleMode = "runtime" | "invoked";
export type AppInvocationTrigger = "userAction";
export type AppSiteId = "x" | "remiliaNet" | "remiliaWiki" | "miladychan";
export type AppRouteMatchType = "exact" | "prefix";
export type AppSiteIntegration = "contentScript" | "backgroundService" | "embeddedFrame" | "overlayApp";
export type AppSitePresentation = "sideRailOverlay" | "hostRouteOverlay" | "userAction";
export type AppSettingStorageArea = "local" | "sync";
export type AppSettingScope = "global" | "app" | "feature";
export type AppSettingLocation = "appearance" | "appsAndFeatures" | "appSurface" | "advanced";
export type AppSettingRole = "preference" | "enablement" | "open" | "reset";
export type AppSettingControlType = "toggle" | "select" | "segmented" | "slider" | "number" | "text" | "textarea" | "textList" | "action" | "status";
export type AppSettingPreset = "visual" | "audio" | "performance" | "firstRun" | "profilePack";
export type AppSettingResetBehavior = "removeKey" | "restoreDefault" | "restoreAppDefault" | "custom";
export type AppSettingValue = string | number | boolean | null | string[] | Record<string, unknown>;
export type AppIconAsset = string | {
  light: string;
  dark: string;
};
export type AppComposerAction = {
  label: string;
  icon?: AppIconAsset;
  presentation: "anchoredPanel";
};
export type AppContextualPostAction = {
  id: string;
  label: string;
  icon?: AppIconAsset;
  placement: "shareMenu";
};
/** Narrow host-owned companion action; packages cannot inject arbitrary toolbar UI. */
export type AppHostComposerAction = "nativeDrafts";
export type AppReplyActionTemplate = {
  id: string;
  label: string;
  text?: string;
  storageKey?: string;
  /** A bounded, host-rendered local text-list setting expanded into reply rows. */
  storageListKey?: string;
  /** Explicit reviewed opt-in: submit after the host inserts this template. */
  sendAfterInsert?: boolean;
};
export type AppReplyAction = {
  templates: AppReplyActionTemplate[];
};
/** A reviewed host adapter; packages never receive X draft text or remote DOM access. */
export type AppExternalHandoff = {
  id: string;
  label: string;
  adapter: string;
  target: string;
  /** Explicit reviewed behavior choices; packages cannot pass arbitrary adapter options. */
  modes?: Array<"captioned" | "randomMeme">;
  /** The reviewed source of caption text; omitted declarations use the X draft. */
  captionSource?: "composerDraft" | "packageFields";
  /** Per-field bound for explicit package caption fields (1–10,000). */
  captionMaxLength?: number;
};
/** A reviewed, read-only remote gallery adapter; packages never receive raw fetch. */
export type AppRemoteQuery = {
  id: string;
  label: string;
  adapter: "remibooru";
  resources: Array<"posts" | "facets">;
  maxPageSize: number;
  minIntervalMs: number;
  cache: { policy: "none" } | { policy: "shortLived"; maxAgeSeconds: number };
};
export type MilxdyLocalPackageManifestVersion = 1;
export type MilxdyLocalPackageReviewStatus = "local" | "reviewed" | "blocked";
export type MilxdyPackageAssetKind = "icon" | "image" | "style" | "font" | "audio" | "worker" | "wasm" | "html" | "other";

export type AppCostProfile = {
  startup: AppCostLevel;
  perSurface: AppCostLevel;
  network: AppNetworkCost;
  worker: AppWorkerCost;
  domWrite: AppDomWriteCost;
};

export type AppSettingControlOption = {
  value: string | number | boolean | null;
  label: string;
  description?: string;
};

export type AppSettingDynamicOptionProvider = "webSpeechVoices";

export type AppSettingDynamicOptions = {
  provider: AppSettingDynamicOptionProvider;
  valueField: "voiceURI";
  labelField: "name";
  descriptionField?: "lang";
  refreshEvent?: "voiceschanged";
  portability?: "browserProfile" | "machineLocal";
};

export type AppSettingDefinition = {
  id: string;
  label: string;
  description?: string;
  scope: AppSettingScope;
  location: AppSettingLocation;
  role?: AppSettingRole;
  storage: {
    area: AppSettingStorageArea;
    key: string;
    property?: string;
  };
  defaultValue?: AppSettingValue;
  control: {
    type: AppSettingControlType;
    options?: AppSettingControlOption[];
    dynamicOptions?: AppSettingDynamicOptions;
    min?: number;
    max?: number;
    step?: number;
    placeholder?: string;
    maxItems?: number;
    maxLength?: number;
  };
  reset: {
    behavior: AppSettingResetBehavior;
    warning?: string;
  };
  presets?: AppSettingPreset[];
  presetBehavior?: {
    overwriteWarning?: string;
    saveAsCustom?: boolean;
  };
  advanced?: boolean;
  requires?: string[];
};

export type AppLifecycleMetadata = {
  mode: AppLifecycleMode;
  invokedBy?: AppInvocationTrigger;
  ownerAppId?: MilxdyAppId;
  reason?: string;
  localOnly?: boolean;
  notes?: string[];
};

export type AppRoutePattern = {
  type: AppRouteMatchType;
  path: string;
  surface?: MilxdyAppSurface;
};

export type AppSiteScope = {
  site: AppSiteId;
  hosts: string[];
  integration: AppSiteIntegration;
  surfaces: MilxdyAppSurface[];
  routes?: AppRoutePattern[];
  presentation?: AppSitePresentation;
  notes?: string[];
};

export type MilxdyAppManifest = {
  id: MilxdyAppId;
  name: string;
  version: string;
  description: string;
  packageKind?: AppPackageKind;
  contentEntry: string;
  available?: boolean;
  unavailableReason?: string;
  css?: Array<{ id: string; path: string }>;
  dock?: {
    label: string;
    icon?: AppIconAsset;
    defaultSide?: "left" | "right";
  };
  composerAction?: AppComposerAction;
  contextualPostActions?: AppContextualPostAction[];
  hostComposerActions?: AppHostComposerAction[];
  replyAction?: AppReplyAction;
  externalHandoffs?: AppExternalHandoff[];
  remoteQueries?: AppRemoteQuery[];
  chrome?: {
    nativeStyle: AppChromeStyle;
    supportedStyles: AppChromeStyle[];
    notes?: string[];
  };
  defaultEnabled: boolean;
  storageKeys: {
    sync?: string[];
    local?: string[];
  };
  settings?: AppSettingDefinition[];
  surfaces: MilxdyAppSurface[];
  deliverySurfaces?: TwitterSurfaceKind[];
  lifecycle?: AppLifecycleMetadata;
  siteScopes?: AppSiteScope[];
  cost: AppCostProfile;
  loadTriggers: AppLoadTrigger[];
  hub?: {
    category: AppHubCategory;
    shortDescription: string;
    longDescription?: string;
    rail: {
      supported: boolean;
      defaultPinned: boolean;
    };
    presets: AppPreset[];
    permissionNotes?: string[];
    dataNotes?: string[];
    remoteServices?: string[];
    localStorageNotes?: string[];
    privacyLabels?: AppPrivacyLabel[];
  };
  permissions?: {
    hosts?: string[];
    optional?: string[];
  };
  background?: {
    messageTypes?: string[];
    services?: string[];
  };
  package: {
    assets?: string[];
    webAccessibleAssets?: string[];
  };
  /** Internal build metadata used to grant reviewed host-asset access. */
  assets?: string[];
  requiredOutputs?: string[];
  hostAssetAccess?: string[];
  localPackage?: Record<string, unknown>;
  isEnabled: () => Promise<boolean>;
  setEnabled?: (enabled: boolean) => Promise<void>;
};

export type MilxdyLocalPackageAsset = {
  id?: string;
  path: string;
  kind: MilxdyPackageAssetKind;
  webAccessible?: boolean;
  sha256?: string;
};

export type MilxdyLocalPackageSdkCompatibility = {
  minVersion: string;
  targetVersion?: string;
  notes?: string[];
};

export type MilxdyLocalPackagePrivacy = {
  permissionNotes: string[];
  dataNotes: string[];
  localStorageNotes: string[];
  remoteServices?: string[];
  privacyLabels: AppPrivacyLabel[];
  consentRequired?: boolean;
};

export type MilxdyLocalPackageReview = {
  status: MilxdyLocalPackageReviewStatus;
  sourceUrl?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string[];
};

export type MilxdyLocalAppPackageManifestV1 = Omit<
  MilxdyAppManifest,
  "available" | "unavailableReason" | "hub" | "isEnabled" | "setEnabled" | "package" | "assets" | "requiredOutputs" | "hostAssetAccess" | "localPackage"
> & {
  manifestVersion: MilxdyLocalPackageManifestVersion;
  sdk: MilxdyLocalPackageSdkCompatibility;
  packageKind: AppPackageKind;
  hub: NonNullable<MilxdyAppManifest["hub"]>;
  package: {
    assets?: MilxdyLocalPackageAsset[];
    webAccessibleAssets?: string[];
  };
  privacy: MilxdyLocalPackagePrivacy;
  review?: MilxdyLocalPackageReview;
};

export type AppRuntimeScheduler = {
  idle: (callback: () => void, options?: { timeout?: number }) => () => void;
  timeout: (callback: () => void, delayMs: number) => () => void;
};

export type MilxdyContentAppContext = {
  manifest: MilxdyAppManifest;
  signal: AbortSignal;
  requestSurfaceRescan: () => void;
  /** @deprecated Internal compatibility alias. External packages use requestSurfaceRescan. */
  scheduleScan: () => void;
  loadAppById: (id: MilxdyAppId, reason?: string) => Promise<MilxdyContentAppModule | null>;
  scheduler: AppRuntimeScheduler;
  storage: AppStorageFacade;
  resolveAssetUrl: (path: string) => string;
  sendMessage: <T = unknown>(message: unknown, label?: string) => Promise<T | null>;
  recordDiagnostic: (key: string, value: unknown) => void;
  addDisposable: (disposable: Disposable) => void;
};

export type MilxdyComposerActionContext = {
  kind: "post" | "reply";
  panel: HTMLElement;
  signal: AbortSignal;
  close: () => void;
  /** Opens X's native drafts surface after an explicit package control click. */
  openNativeDrafts: () => void;
  /**
   * Host-filtered declarations. A package may start one only from an explicit
   * click. A declaration chooses either the host-owned active-composer split
   * or bounded, explicit package caption fields; packages never receive X text.
   */
  externalHandoffs: ReadonlyArray<Pick<AppExternalHandoff, "id" | "label">>;
  launchExternalHandoff: (id: string, options?: {
    mode?: "captioned" | "randomMeme";
    captions?: { topText: string; bottomText: string };
  }) => Promise<{ ok: boolean; error?: string }>;
  /** Host-filtered, sanitized gallery services; no package fetch or raw URLs. */
  remoteQueries: ReadonlyArray<Pick<AppRemoteQuery, "id" | "label">>;
  queryRemoteService: (id: string, request: {
    resource: "posts" | "facets";
    cursor?: string;
    limit?: number;
    facets?: string[];
  }) => Promise<{
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
};

/**
 * A reviewed, package-rendered reply panel. The host owns the X control,
 * anchoring, dismissal, focus return, and the narrow native type-only bridge;
 * packages own every visible row, label, and asset inside `panel`.
 */
export type MilxdyReplyActionContext = {
  panel: HTMLElement;
  signal: AbortSignal;
  close: () => void;
  templates: ReadonlyArray<Pick<AppReplyActionTemplate, "id" | "label">>;
  openNativeReply: () => void;
  selectTemplate: (id: string) => void;
};

/**
 * Host-owned post selection and storage services for a declared contextual
 * action. Packages own their review UI; the host owns X menu discovery,
 * duplicate suppression, lifecycle, and focus-safe invocation.
 */
export type MilxdyContextualPostActionContext = {
  actionId: string;
  post: HTMLElement;
  statusUrl: string | null;
  signal: AbortSignal;
  storage: AppStorageFacade;
  resolveAssetUrl: (path: string) => string;
};

export type MilxdyContentAppModule = {
  id?: string;
  boot?: (context: MilxdyContentAppContext) => Promise<void> | void;
  enable?: () => Promise<void> | void;
  disable?: () => Promise<void> | void;
  onRouteChange?: (route: MilxdyRouteChange) => Promise<void> | void;
  onSurface?: (surface: TwitterSurface) => Promise<void> | void;
  onComposerAction?: (context: MilxdyComposerActionContext) => Promise<void> | void;
  onReplyAction?: (context: MilxdyReplyActionContext) => Promise<void> | void;
  onContextualPostAction?: (context: MilxdyContextualPostActionContext) => Promise<void> | void;
  open?: () => Promise<void> | void;
  close?: () => Promise<void> | void;
  dispose?: () => Promise<void> | void;
};

export type MilxdyRouteChange = {
  href: string;
  pathname: string;
  previousHref: string | null;
  visible: boolean;
  changedAt: number;
};

export type AppLoadState = "pending" | "disabled" | "loaded" | "failed";

export type AppDiagnostics = {
  id: MilxdyAppId;
  state: AppLoadState;
  contentEntry: string;
  available?: boolean;
  unavailableReason?: string;
  hub?: {
    category: AppHubCategory;
    railSupported: boolean;
    railDefaultPinned: boolean;
    presets: AppPreset[];
  };
  loadedAt?: number;
  loadMs?: number;
  deferredReason?: string;
  error?: string;
};
