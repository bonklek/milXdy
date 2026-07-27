/** Public content-app declarations for milXdy App SDK 0.2.3. */

export type TwitterSurfaceKind =
  | "tweet"
  | "xArticle"
  | "userCell"
  | "notification"
  | "directMessage"
  | "profile";

export type MilxdyAppSurface = TwitterSurfaceKind | "route" | "overlayApp" | "composerAction";

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
  composerAction?: {
    label: string;
    icon?: string | { light: string; dark: string };
  };
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
  open?(): Promise<void> | void;
  close?(): Promise<void> | void;
  dispose?(): Promise<void> | void;
}
