import type { OverlayDockApi, OverlayDockRegistration } from "../overlay/dock-types";

export function registerAddonsCatalogAction(options: {
  dock: Pick<OverlayDockApi, "register">;
  send: () => Promise<unknown>;
  playCue: () => void;
  feedback: (text: string, failed: boolean) => void;
  now?: () => number;
}): OverlayDockRegistration {
  let pending = false;
  let disposed = false;
  let lastLaunch = -Infinity;
  const now = options.now ?? Date.now;
  const label = "Get more add-ons";
  const registration = options.dock.register({
    id: "milxdyAddOnsCatalog", label, icon: "+", stackable: false, title: label, active: false,
    onActivate: () => {
      if (pending || disposed || now() - lastLaunch < 800) return;
      pending = true;
      lastLaunch = now();
      registration.update({ label: "Opening add-ons catalog", title: "Opening add-ons catalog…", badgeText: "…" });
      options.feedback("Opening add-ons catalog…", false);
      try { options.playCue(); } catch { /* Audio restrictions must never block navigation. */ }
      void (async () => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const response = await Promise.race([
            options.send(),
            new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), 15000); }),
          ]);
          if (disposed) return;
          if (!response || typeof response !== "object" || (response as { ok?: unknown }).ok !== true) throw new Error("unavailable");
          options.feedback("Add-ons catalog opened in a browser tab.", false);
        } catch {
          if (!disposed) options.feedback("Could not open the add-ons catalog. Select + to try again. If the tab opened but did not load, check your connection.", true);
        } finally {
          clearTimeout(timer);
          pending = false;
          if (!disposed) registration.update({ label, title: label, badgeText: undefined });
        }
      })();
    },
  });
  return { update: registration.update, remove: () => { disposed = true; registration.remove(); } };
}

/** A persistent, dismissible result beside the rail; never covers the + retry control. */
export function createCatalogFeedback(side: () => "left" | "right"): { show: (text: string, failed: boolean) => void; dispose: () => void } {
  let root: HTMLElement | null = null;
  return {
    show(text, failed) {
      if (!root) {
        root = document.createElement("aside");
        root.dataset.addonsCatalogFeedback = "true";
        root.style.cssText = "position:fixed;bottom:20px;z-index:2147483647;box-sizing:border-box;width:min(300px,calc(100vw - 88px));max-height:calc(100vh - 40px);overflow:auto;padding:12px;border:1px solid #888;border-radius:12px;background:Canvas;color:CanvasText;color-scheme:light dark;font:14px/1.45 system-ui;box-shadow:0 4px 20px #0004;";
        const message = document.createElement("p");
        message.style.cssText = "margin:0 0 8px;overflow-wrap:anywhere";
        message.setAttribute("aria-live", "polite");
        message.setAttribute("aria-atomic", "true");
        const dismiss = document.createElement("button");
        dismiss.type = "button";
        dismiss.textContent = "Dismiss";
        dismiss.style.cssText = "font:inherit;padding:6px 12px;min-height:36px;cursor:pointer";
        dismiss.addEventListener("click", () => {
          root?.remove(); root = null;
          document.querySelector<HTMLButtonElement>('button[data-item-id="milxdyAddOnsCatalog"]')?.focus();
        });
        root.append(message, dismiss);
        document.documentElement.append(root);
      }
      root.style.left = side() === "left" ? "72px" : "auto";
      root.style.right = side() === "right" ? "72px" : "auto";
      const message = root.querySelector("p")!;
      message.setAttribute("role", failed ? "alert" : "status");
      message.textContent = text;
    },
    dispose() { root?.remove(); root = null; },
  };
}
