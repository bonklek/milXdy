/**
 * Creates the lifecycle-shaped managed-window facade used by the SDK harness.
 * @param {AbortSignal} signal
 * @returns {{ service: import("../types/index.d.ts").AppWindowService, dispose: () => void }}
 */
export function createHarnessWindowService(signal) {
  /** @type {Set<import("../types/index.d.ts").AppWindowHandle>} */
  const windows = new Set();
  return {
    service: {
      create(options) {
        if (signal.aborted) throw new DOMException("App activation has ended", "AbortError");
        let opened = false;
        let disposed = false;
        const handle = {
          element: options.content,
          get isOpen() { return opened; },
          open() { if (!disposed && !signal.aborted) opened = true; },
          close() {
            if (!opened) return;
            opened = false;
            options.onClose?.();
          },
          focus() {},
          dispose() {
            if (disposed) return;
            handle.close();
            disposed = true;
            windows.delete(handle);
          },
        };
        windows.add(handle);
        return handle;
      },
    },
    dispose() {
      for (const appWindow of [...windows]) appWindow.dispose();
    },
  };
}
