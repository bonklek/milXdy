/**
 * In-memory harness for testing a public milXdy content app module without an
 * extension build. It intentionally implements only the documented SDK facade.
 */

/** @typedef {import("../types/index.d.ts").MilxdyContentAppModule} MilxdyContentAppModule */
/** @typedef {import("../types/index.d.ts").MilxdyRouteChange} MilxdyRouteChange */
/** @typedef {import("../types/index.d.ts").TwitterSurface} TwitterSurface */
/** @typedef {import("../types/index.d.ts").Disposable} Disposable */
/** @typedef {import("../types/index.d.ts").AppStorageArea} AppStorageArea */

/**
 * @param {{
 *   id?: string,
 *   name?: string,
 *   version?: string,
 *   surfaces?: import("../types/index.d.ts").MilxdyAppSurface[],
 *   loadTriggers?: import("../types/index.d.ts").PublicAppManifest["loadTriggers"],
 *   storageKeys?: {local?: string[], sync?: string[]},
 *   assets?: string[],
 *   initialStorage?: {local?: Record<string, unknown>, sync?: Record<string, unknown>},
 *   messageHandler?: (message: unknown, label?: string) => unknown | Promise<unknown>,
 * }} [options]
 */
export function createAppHarness(options = {}) {
  const controller = new AbortController();
  const diagnostics = new Map();
  /** @type {{message: unknown, label?: string}[]} */
  const messages = [];
  /** @type {string[]} */
  const lifecycle = [];
  /** @type {Disposable[]} */
  const disposables = [];
  /** @type {{kind: string, callback: () => void, cancelled: boolean}[]} */
  const scheduled = [];
  let rescans = 0;

  /** @type {import("../types/index.d.ts").MilxdyContentAppContext} */
  const context = {
    manifest: Object.freeze({
      id: options.id ?? "test-app",
      name: options.name ?? "Test App",
      version: options.version ?? "0.0.0",
      description: "App SDK harness fixture",
      surfaces: options.surfaces ?? /** @type {import("../types/index.d.ts").MilxdyAppSurface[]} */ (["route"]),
      loadTriggers: options.loadTriggers ?? /** @type {import("../types/index.d.ts").PublicAppManifest["loadTriggers"]} */ (["startup"]),
    }),
    signal: controller.signal,
    scheduler: {
      idle: (callback, _options) => schedule("idle", callback),
      timeout: (callback, _delayMs) => schedule("timeout", callback),
    },
    storage: {
      local: createStorageArea("local", options.storageKeys?.local ?? [], options.initialStorage?.local ?? {}),
      sync: createStorageArea("sync", options.storageKeys?.sync ?? [], options.initialStorage?.sync ?? {}),
    },
    resolveAssetUrl(path) {
      assertSafeRelativePath(path);
      if (!(options.assets ?? []).includes(path)) throw new Error(`Undeclared app asset: ${path}`);
      return `chrome-extension://milxdy/apps/${context.manifest.id}/${path}`;
    },
    requestSurfaceRescan() {
      rescans += 1;
    },
    async sendMessage(message, label) {
      messages.push({ message, label });
      return /** @type {any} */ (options.messageHandler ? await options.messageHandler(message, label) : null);
    },
    recordDiagnostic(key, value) {
      diagnostics.set(key, value);
    },
    addDisposable(disposable) {
      disposables.push(disposable);
    },
  };

  /** @param {string} kind @param {() => void} callback */
  function schedule(kind, callback) {
    const task = { kind, callback, cancelled: false };
    scheduled.push(task);
    return () => {
      task.cancelled = true;
    };
  }

  /**
   * @param {"local" | "sync"} area
   * @param {string[]} declaredKeys
   * @param {Record<string, unknown>} initialValues
   * @returns {AppStorageArea}
   */
  function createStorageArea(area, declaredKeys, initialValues) {
    const values = new Map(Object.entries(initialValues));
    /** @type {Set<(changes: Record<string, import("../types/index.d.ts").AppStorageChange>) => void>} */
    const listeners = new Set();
    /** @param {readonly string[]} keys */
    const check = (keys) => {
      for (const key of keys) {
        if (!declaredKeys.includes(key)) throw new Error(`Undeclared ${area} storage key: ${key}`);
      }
    };
    /** @template {Record<string, unknown>} T @param {T} defaults @returns {Promise<T>} */
    async function get(defaults) {
      check(Object.keys(defaults));
      return /** @type {T} */ (Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, values.has(key) ? values.get(key) : fallback])));
    }
    return {
      get,
      async set(nextValues) {
        check(Object.keys(nextValues));
        /** @type {Record<string, import("../types/index.d.ts").AppStorageChange>} */
        const changes = {};
        for (const [key, newValue] of Object.entries(nextValues)) {
          changes[key] = { oldValue: values.get(key), newValue };
          values.set(key, newValue);
        }
        for (const listener of listeners) listener(changes);
      },
      async remove(keys) {
        const list = typeof keys === "string" ? [keys] : [...keys];
        check(list);
        /** @type {Record<string, import("../types/index.d.ts").AppStorageChange>} */
        const changes = {};
        for (const key of list) {
          if (values.has(key)) changes[key] = { oldValue: values.get(key) };
          values.delete(key);
        }
        if (Object.keys(changes).length) for (const listener of listeners) listener(changes);
      },
      onChanged(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  }

  /** @param {MilxdyContentAppModule} module @param {keyof MilxdyContentAppModule} hook @param {unknown} [argument] */
  async function invoke(module, hook, argument) {
    lifecycle.push(hook);
    const callback = module[hook];
    if (typeof callback === "function") await /** @type {any} */ (callback)(argument);
  }

  return {
    context,
    diagnostics,
    messages,
    lifecycle,
    get rescanCount() { return rescans; },
    /** @param {MilxdyContentAppModule} module */
    async boot(module) { await invoke(module, "boot", context); },
    /** @param {MilxdyContentAppModule} module */
    async enable(module) { await invoke(module, "enable"); },
    /** @param {MilxdyContentAppModule} module @param {MilxdyRouteChange} route */
    async route(module, route) { await invoke(module, "onRouteChange", route); },
    /** @param {MilxdyContentAppModule} module @param {TwitterSurface} surface */
    async surface(module, surface) { await invoke(module, "onSurface", surface); },
    /** @param {MilxdyContentAppModule} module */
    async open(module) { await invoke(module, "open"); },
    /** @param {MilxdyContentAppModule} module */
    async close(module) { await invoke(module, "close"); },
    /** @param {MilxdyContentAppModule} module */
    async disable(module) { await invoke(module, "disable"); },
    abort() { controller.abort(); },
    flushScheduled() {
      for (const task of scheduled.splice(0)) if (!task.cancelled && !controller.signal.aborted) task.callback();
    },
    /** @param {MilxdyContentAppModule} module */
    async dispose(module) {
      await invoke(module, "dispose");
      for (const disposable of disposables.splice(0).reverse()) {
        if (typeof disposable === "function") disposable();
        else disposable.dispose();
      }
    },
  };
}

/** @param {string} path */
function assertSafeRelativePath(path) {
  if (!path || path.startsWith("/") || path.startsWith("\\") || /^[A-Za-z]:/.test(path) || path.split(/[\\/]/).includes("..")) {
    throw new Error(`Unsafe app asset path: ${path}`);
  }
}
