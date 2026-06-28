import type { TwitterSurface, TwitterSurfaceKind } from "./twitterScanner";
import type { Disposable } from "./disposables";

export type MilxdyAppId = string;

export type MilxdyAppSurface = TwitterSurfaceKind | "route" | "overlayApp";
export type AppCostLevel = "cheap" | "moderate" | "heavy";
export type AppNetworkCost = "none" | "batched" | "eager";
export type AppWorkerCost = "none" | "optional" | "heavy";
export type AppDomWriteCost = "small" | "moderate" | "large";
export type AppLoadTrigger = "startup" | "surface" | "dockOpen" | "idle" | "userAction";
export type AppHubCategory = "appearance" | "reading" | "social" | "game" | "media" | "developer";
export type AppPreset = "lite" | "balanced" | "full";
export type AppPrivacyLabel = "local-only" | "browser-session" | "remote-api" | "local-files" | "diagnostics";

export type AppCostProfile = {
  startup: AppCostLevel;
  perSurface: AppCostLevel;
  network: AppNetworkCost;
  worker: AppWorkerCost;
  domWrite: AppDomWriteCost;
};

export type MilxdyAppManifest = {
  id: MilxdyAppId;
  name: string;
  version: string;
  description: string;
  contentEntry: string;
  available?: boolean;
  unavailableReason?: string;
  css?: Array<{ id: string; path: string }>;
  dock?: {
    label: string;
    icon?: string;
    defaultSide?: "left" | "right";
  };
  defaultEnabled: boolean;
  storageKeys: {
    sync?: string[];
    local?: string[];
  };
  surfaces: MilxdyAppSurface[];
  deliverySurfaces?: TwitterSurfaceKind[];
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
  isEnabled: () => Promise<boolean>;
  setEnabled?: (enabled: boolean) => Promise<void>;
};

export type AppRuntimeScheduler = {
  idle: (callback: () => void, options?: { timeout?: number }) => () => void;
  timeout: (callback: () => void, delayMs: number) => () => void;
};

export type MilxdyContentAppContext = {
  manifest: MilxdyAppManifest;
  signal: AbortSignal;
  scheduleScan: () => void;
  loadAppById: (id: MilxdyAppId, reason?: string) => Promise<MilxdyContentAppModule | null>;
  scheduler: AppRuntimeScheduler;
  sendMessage: <T = unknown>(message: unknown, label?: string) => Promise<T | null>;
  recordDiagnostic: (key: string, value: unknown) => void;
  addDisposable: (disposable: Disposable) => void;
};

export type MilxdyContentAppModule = {
  id?: string;
  boot?: (context: MilxdyContentAppContext) => Promise<void> | void;
  enable?: () => Promise<void> | void;
  disable?: () => Promise<void> | void;
  onRouteChange?: (route: MilxdyRouteChange) => Promise<void> | void;
  onSurface?: (surface: TwitterSurface) => Promise<void> | void;
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
