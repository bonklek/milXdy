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
        border: 1px solid currentColor; border-radius: 0;
        padding: 0; background: Canvas; color: CanvasText; cursor: pointer; font: 700 1rem/1 sans-serif;
        opacity: 0; pointer-events: none;
      }
      .milxdy-last-read-marker:hover .milxdy-last-read-dismiss,
      .milxdy-last-read-marker:focus-within .milxdy-last-read-dismiss { opacity: 1; pointer-events: auto; }
      .milxdy-last-read-dismiss:focus-visible { opacity: 1; pointer-events: auto; outline: 2px solid Highlight; outline-offset: 2px; }
      .milxdy-last-read-marker--dismissed { display: none !important; }
    `;
    document.documentElement.append(style);
  }

  function click(element: HTMLElement): void {
    nativeInspectionClick.add(element);
    element.click();
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
    memoizedProps?: unknown;
  };

  type CraftingStore = {
    mode: "assemble" | "smash";
    craftingSlots: Record<string, string | null>;
    assignToSlot: (slotId: string, itemType: string) => void;
    selectedHammer: string | null;
    selectedSacrificeBeetle: string | null;
    selectHammer: (itemType: string) => void;
    selectSacrifice: (itemType: string) => void;
  };

  function reactFiber(element: Element): ReactFiber | null {
    const key = Object.getOwnPropertyNames(element).find(name => name.startsWith("__reactFiber$") || name.startsWith("__reactInternalInstance$"));
    return key ? (element as unknown as Record<string, ReactFiber>)[key] || null : null;
  }

  function findDeep<T>(value: unknown, predicate: (candidate: unknown) => candidate is T, maxDepth = 5): T | null {
    const seen = new Set<unknown>();
    let visited = 0;
    const visit = (candidate: unknown, depth: number): T | null => {
      try {
        if (predicate(candidate)) return candidate;
      } catch {
        // React props may retain cross-origin Window proxies. Treat opaque
        // objects as terminal leaves instead of destabilizing the host page.
        return null;
      }
      if (!candidate || typeof candidate !== "object" || depth <= 0 || seen.has(candidate) || visited++ > 250) return null;
      seen.add(candidate);
      let keys: string[];
      try {
        keys = Object.keys(candidate as Record<string, unknown>);
      } catch {
        return null;
      }
      for (const key of keys) {
        if (key === "child" || key === "sibling" || key === "return" || key === "stateNode") continue;
        let child: unknown;
        try {
          child = (candidate as Record<string, unknown>)[key];
        } catch {
          continue;
        }
        const found = visit(child, depth - 1);
        if (found) return found;
      }
      return null;
    };
    return visit(value, maxDepth);
  }

  function isCraftingStore(candidate: unknown): candidate is CraftingStore {
    if (!candidate || typeof candidate !== "object") return false;
    const record = candidate as Record<string, unknown>;
    return (record.mode === "assemble" || record.mode === "smash")
      && Boolean(record.craftingSlots && typeof record.craftingSlots === "object")
      && typeof record.assignToSlot === "function"
      && typeof record.selectHammer === "function"
      && typeof record.selectSacrifice === "function";
  }

  function craftingStoreFor(...elements: Element[]): CraftingStore | null {
    // Remilia's own drop handler ends by calling this Zustand action. Reusing
    // that action keeps the visible slots, remaining counts, native Craft
    // button, request payload, and error recovery under Remilia's ownership.
    for (const element of elements) {
      let fiber = reactFiber(element);
      for (let depth = 0; fiber && depth < 24; depth++, fiber = fiber.return || null) {
        const store = findDeep([fiber.memoizedState, fiber.memoizedProps], isCraftingStore, 7);
        if (store) return store;
      }
    }
    return null;
  }

  function itemTypeFor(item: Element): string | null {
    let fiber = reactFiber(item);
    for (let depth = 0; fiber && depth < 16; depth++, fiber = fiber.return || null) {
      const value = findDeep(
        fiber.memoizedProps,
        (candidate): candidate is { type: string } => {
          if (!candidate || typeof candidate !== "object") return false;
          const record = candidate as Record<string, unknown>;
          return typeof record.type === "string"
            && (typeof record.remainingCount === "number"
              || typeof record.count === "number"
              || typeof record.category === "number"
              || typeof record.icon === "string");
        },
        5,
      );
      if (value) return value.type;
    }
    return null;
  }

  function placeCraftingItem(item: HTMLElement): boolean {
    const craft = item.closest(".crafting-module");
    if (!craft) return false;
    const status = (value: string) => document.documentElement.setAttribute(PLACEMENT_STATUS_ATTRIBUTE, value);
    const store = craftingStoreFor(item, craft);
    const itemType = itemTypeFor(item);
    if (!store) {
      status("missing-store");
      return false;
    }
    if (!itemType) {
      status("missing-item-type");
      return false;
    }
    try {
      if (itemType.startsWith("hammer_") || itemIsHammer(item)) {
        store.selectHammer(itemType);
        status("assigned-hammer");
        return true;
      }
      const slotId = nextAssemblySlot(craft, store);
      if (!slotId) {
        status("missing-destination");
        return false;
      }
      store.assignToSlot(slotId, itemType);
      status(`assigned-${slotId}`);
      return true;
    } catch {
      status("error");
      return false;
    }
  }

  function nextAssemblySlot(craft: Element, store: CraftingStore): string | null {
    const slots = Array.from(craft.querySelectorAll<HTMLElement>(
      ".crafting-module__input-slot:not(.crafting-module__input-slot--5)",
    )).slice(0, 3).map((_, index) => `input${index + 1}`);
    const empty = slots.find(slotId => !store.craftingSlots[slotId]);
    if (empty) return empty;
    if (slots.length === 0) return null;
    const next = nextCraftingReplacementSlot.get(craft) || 0;
    nextCraftingReplacementSlot.set(craft, (next + 1) % slots.length);
    return slots[next] || null;
  }

  function autoFillGreenSacrifice(craft: Element): void {
    if (autoFilledCraftRoots.has(craft)) return;
    const store = craftingStoreFor(craft);
    if (!store || store.selectedSacrificeBeetle) return;
    const green = Array.from(craft.querySelectorAll<HTMLElement>(".crafting-module__beetle-item"))
      .find(item => itemTypeFor(item) === "green" || itemLooksGreen(item));
    const greenType = green ? itemTypeFor(green) : null;
    if (!greenType) return;
    store.selectSacrifice(greenType);
    autoFilledCraftRoots.add(craft);
  }

  function chatPositionMarkerKind(marker: HTMLElement): "last-read" | "present" {
    return marker.classList.contains("message-list__jump-to-present") ? "present" : "last-read";
  }

  function installLastReadDismissal(marker: HTMLElement): void {
    const kind = chatPositionMarkerKind(marker);
    if (dismissedChatPositionMarkers.has(kind)) {
      marker.classList.add("milxdy-last-read-marker--dismissed");
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
      marker.classList.add("milxdy-last-read-marker--dismissed");
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
