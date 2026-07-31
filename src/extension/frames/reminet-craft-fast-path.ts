(() => {
  const SETTING_ATTRIBUTE = "data-milxdy-reminet-beetle-reduced-motion-setting";
  const PLACEMENT_STATUS_ATTRIBUTE = "data-milxdy-reminet-craft-placement";
  const FAST_TIMEOUTS = new Set([1_000, 4_500, 8_000]);
  let enabled = document.documentElement.getAttribute(SETTING_ATTRIBUTE) === "true";
  let fastCraftSubmissionUntil = 0;
  // This is deliberately document-scoped: the Remilia chat owns the marker and
  // recreates it on a chat remount.  We must not turn a presentational dismissal
  // into account-scoped state or a server read-history mutation.
  const dismissedChatPositionMarkers = new Set<"last-read" | "present">();
  const autoFilledCraftRoots = new WeakSet<Element>();
  // Slot replacement is presentation-local just like the native crafting
  // selection. A remount starts from the first slot again; nothing is stored
  // per account or sent to Remilia.
  const nextCraftingReplacementSlot = new WeakMap<Element, number>();
  const nativeInspectionClick = new WeakSet<Element>();
  let pendingInspection: { item: Element; timer: number } | null = null;
  const nativeSetTimeout = window.setTimeout.bind(window);

  function ensureLastReadStyle(): void {
    if (document.getElementById("milxdy-last-read-dismissal-style")) return;
    const style = document.createElement("style");
    style.id = "milxdy-last-read-dismissal-style";
    style.textContent = `
      .milxdy-last-read-marker { position: relative; }
      .milxdy-last-read-dismiss {
        display: inline-grid; place-items: center; width: 1.25rem; height: 1.25rem;
        position: absolute; top: .2rem; right: .2rem;
        border: 1px solid currentColor; border-radius: 999px;
        padding: 0; background: Canvas; color: CanvasText; cursor: pointer; font: 700 1rem/1 sans-serif;
        opacity: 0; pointer-events: none;
      }
      .milxdy-last-read-marker:hover .milxdy-last-read-dismiss,
      .milxdy-last-read-marker:focus-within .milxdy-last-read-dismiss { opacity: 1; pointer-events: auto; }
      .milxdy-last-read-dismiss:focus-visible { opacity: 1; pointer-events: auto; outline: 2px solid Highlight; outline-offset: 2px; }
    `;
    document.documentElement.append(style);
  }

  function click(element: HTMLElement): void {
    nativeInspectionClick.add(element);
    element.click();
  }

  function isEmptySlot(element: Element): boolean {
    return !element.classList.contains("crafting-module__input-slot--filled")
      && !element.classList.contains("crafting-module__smash-input-slot--filled")
      && !element.classList.contains("crafting-module__sacrifice-input-slot--filled")
      && !element.querySelector(".crafting-module__input-slot-img, .crafting-module__smash-input-slot-img");
  }

  function itemLooksGreen(item: Element): boolean {
    return /green/i.test(`${item.getAttribute("data-item-type") || ""} ${item.getAttribute("aria-label") || ""} ${item.textContent || ""} ${item.innerHTML}`);
  }

  function itemIsHammer(item: Element): boolean {
    return /hammer/i.test(`${item.getAttribute("data-item-type") || ""} ${item.getAttribute("aria-label") || ""} ${item.textContent || ""} ${item.innerHTML}`);
  }

  type ReactFiber = {
    return?: ReactFiber | null;
    memoizedState?: unknown;
    dependencies?: unknown;
  };

  type DndActions = {
    beginDrag: (sourceIds: string[], options: Record<string, unknown>) => void;
    hover: (targetIds: string[], options: Record<string, unknown>) => void;
    drop: () => void;
    endDrag: () => void;
  };

  type DndManager = {
    getActions: () => DndActions;
    getMonitor: () => { isDragging: () => boolean };
    getRegistry: () => unknown;
  };

  function reactFiber(element: Element): ReactFiber | null {
    const key = Object.getOwnPropertyNames(element).find(name => name.startsWith("__reactFiber$") || name.startsWith("__reactInternalInstance$"));
    return key ? (element as unknown as Record<string, ReactFiber>)[key] || null : null;
  }

  function findDeep<T>(value: unknown, predicate: (candidate: unknown) => candidate is T, maxDepth = 5): T | null {
    const seen = new Set<unknown>();
    let visited = 0;
    const visit = (candidate: unknown, depth: number): T | null => {
      if (predicate(candidate)) return candidate;
      if (!candidate || typeof candidate !== "object" || depth <= 0 || seen.has(candidate) || visited++ > 250) return null;
      seen.add(candidate);
      for (const key of Object.keys(candidate as Record<string, unknown>)) {
        if (key === "child" || key === "sibling" || key === "return" || key === "stateNode") continue;
        const found = visit((candidate as Record<string, unknown>)[key], depth - 1);
        if (found) return found;
      }
      return null;
    };
    return visit(value, maxDepth);
  }

  function isDndManager(candidate: unknown): candidate is DndManager {
    if (!candidate || typeof candidate !== "object") return false;
    const record = candidate as Record<string, unknown>;
    return typeof record.getActions === "function"
      && typeof record.getMonitor === "function"
      && typeof record.getRegistry === "function";
  }

  function handlerIdFor(element: Element, prefix: "S" | "T"): string | null {
    let fiber = reactFiber(element);
    for (let depth = 0; fiber && depth < 18; depth++, fiber = fiber.return || null) {
      let hook = fiber.memoizedState as { memoizedState?: unknown; baseState?: unknown; next?: unknown } | null;
      for (let hookCount = 0; hook && typeof hook === "object" && hookCount < 50; hookCount++) {
        const found = findDeep(
          [hook.memoizedState, hook.baseState],
          (candidate): candidate is string => typeof candidate === "string" && new RegExp(`^${prefix}\\d+$`, "u").test(candidate),
          4,
        );
        if (found) return found;
        hook = hook.next as typeof hook;
      }
    }
    return null;
  }

  function dndManagerFor(...elements: Element[]): DndManager | null {
    for (const element of elements) {
      let fiber = reactFiber(element);
      for (let depth = 0; fiber && depth < 24; depth++, fiber = fiber.return || null) {
        const manager = findDeep(fiber.dependencies, isDndManager, 6);
        if (manager) return manager;
      }
    }
    return null;
  }

  function dragToSlot(item: HTMLElement, destination: HTMLElement | null): boolean {
    const status = (value: string) => document.documentElement.setAttribute(PLACEMENT_STATUS_ATTRIBUTE, value);
    if (!destination) {
      status("missing-destination");
      return false;
    }
    const sourceId = handlerIdFor(item, "S");
    const targetId = handlerIdFor(destination, "T");
    const manager = dndManagerFor(item, destination);
    if (!sourceId) {
      status("missing-source");
      return false;
    }
    if (!targetId) {
      status("missing-target");
      return false;
    }
    if (!manager) {
      status("missing-manager");
      return false;
    }
    const sourceBounds = item.getBoundingClientRect();
    const bounds = destination.getBoundingClientRect();
    const sourceOffset = { x: sourceBounds.left, y: sourceBounds.top };
    const targetOffset = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
    const actions = manager.getActions();
    let began = false;
    try {
      actions.beginDrag([sourceId], {
        publishSource: true,
        clientOffset: sourceOffset,
        getSourceClientOffset: () => sourceOffset,
      });
      began = manager.getMonitor().isDragging();
      if (!began) {
        status("begin-rejected");
        return false;
      }
      actions.hover([targetId], { clientOffset: targetOffset });
      actions.drop();
      status("dropped");
      return true;
    } catch {
      status("error");
      return false;
    } finally {
      try {
        if (began && manager.getMonitor().isDragging()) actions.endDrag();
      } catch {
        status("error");
      }
    }
  }

  function placeCraftingItem(item: HTMLElement): boolean {
    const craft = item.closest(".crafting-module");
    if (!craft) return false;
    const destination = itemIsHammer(item)
      ? craft.querySelector<HTMLElement>(".crafting-module__smash-input-slots .crafting-module__smash-input-slot")
      : nextAssemblySlot(craft);
    return dragToSlot(item, destination as HTMLElement | null);
  }

  function nextAssemblySlot(craft: Element): HTMLElement | null {
    const slots = Array.from(craft.querySelectorAll<HTMLElement>(
      ".crafting-module__input-slot:not(.crafting-module__input-slot--5)",
    ));
    const empty = slots.find(isEmptySlot);
    if (empty) return empty;
    if (slots.length === 0) return null;
    const next = nextCraftingReplacementSlot.get(craft) || 0;
    nextCraftingReplacementSlot.set(craft, (next + 1) % slots.length);
    return slots[next] || null;
  }

  function autoFillGreenSacrifice(craft: Element): void {
    if (autoFilledCraftRoots.has(craft)) return;
    autoFilledCraftRoots.add(craft);
    const sacrifice = craft.querySelectorAll<HTMLElement>(".crafting-module__smash-input-slots .crafting-module__smash-input-slot")[1] || null;
    if (!sacrifice || !isEmptySlot(sacrifice)) return;
    const green = Array.from(craft.querySelectorAll<HTMLElement>(".crafting-module__beetle-item")).find(itemLooksGreen);
    if (green) dragToSlot(green, sacrifice);
  }

  function chatPositionMarkerKind(marker: HTMLElement): "last-read" | "present" {
    return marker.classList.contains("message-list__jump-to-present") ? "present" : "last-read";
  }

  function installLastReadDismissal(marker: HTMLElement): void {
    const kind = chatPositionMarkerKind(marker);
    if (dismissedChatPositionMarkers.has(kind)) {
      marker.remove();
      return;
    }
    if (marker.dataset.milxdyLastReadDismissal === "true") return;
    marker.dataset.milxdyLastReadDismissal = "true";
    marker.classList.add("milxdy-last-read-marker");
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "milxdy-last-read-dismiss";
    dismiss.textContent = "×";
    dismiss.setAttribute("aria-label", "Dismiss chat position marker");
    dismiss.title = "Dismiss chat position marker";
    dismiss.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      dismissedChatPositionMarkers.add(kind);
      marker.remove();
    });
    marker.append(dismiss);
  }

  function syncCraftingAndLastRead(): void {
    if (new URLSearchParams(location.search).get("cartridge") === "craft") {
      document.querySelectorAll(".crafting-module").forEach(autoFillGreenSacrifice);
    }
    // Remilia's marker has no stable class name, but its visible label is a
    // stable, accessible UI contract. Restrict the match to compact elements
    // so a message merely mentioning "last read" is never altered.
    document.querySelectorAll<HTMLElement>(".message-list__jump-to-last-read, .message-list__jump-to-present").forEach(installLastReadDismissal);
  }

  function craftFastSubmissionIsActive(): boolean {
    return enabled
      && new URLSearchParams(location.search).get("cartridge") === "craft"
      && Date.now() < fastCraftSubmissionUntil;
  }

  document.addEventListener("click", (event) => {
    if (!enabled || new URLSearchParams(location.search).get("cartridge") !== "craft") return;
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest<HTMLButtonElement>(".crafting-module__button--primary");
    // A disabled Craft button only validates the recipe. A valid one submits the
    // API action, which is the precise window containing Remilia's staged timers.
    if (!button || button.classList.contains("crafting-module__button--disabled")) return;
    fastCraftSubmissionUntil = Date.now() + 12_000;
  }, true);

  document.addEventListener("click", (event) => {
    if (new URLSearchParams(location.search).get("cartridge") !== "craft") return;
    const target = event.target instanceof Element ? event.target : null;
    const item = target?.closest<HTMLElement>(".crafting-module__beetle-item");
    if (!item || item.classList.contains("crafting-module__beetle-item--unavailable")) return;
    if (nativeInspectionClick.delete(item)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (pendingInspection?.item === item) {
      clearTimeout(pendingInspection.timer);
      pendingInspection = null;
      if (!placeCraftingItem(item)) click(item);
      return;
    }
    const timer = nativeSetTimeout(() => {
      pendingInspection = null;
      click(item);
    }, 220);
    pendingInspection = { item, timer };
  }, true);

  // Remilia schedules these three timers after a valid Craft API submission:
  // a local lock, delayed log output, and delayed result cleanup.
  window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    const delay = Number(timeout);
    return nativeSetTimeout(handler, craftFastSubmissionIsActive() && FAST_TIMEOUTS.has(delay) ? 0 : delay, ...args);
  }) as typeof window.setTimeout;

  new MutationObserver(() => {
    enabled = document.documentElement.getAttribute(SETTING_ATTRIBUTE) === "true";
    syncCraftingAndLastRead();
  }).observe(document.documentElement, { attributes: true, attributeFilter: [SETTING_ATTRIBUTE] });

  new MutationObserver(syncCraftingAndLastRead).observe(document.documentElement, { childList: true, subtree: true });
  ensureLastReadStyle();
  syncCraftingAndLastRead();
})();
