(() => {
  const SETTING_ATTRIBUTE = "data-milxdy-reminet-beetle-reduced-motion-setting";
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

  function dragToSlot(item: HTMLElement, destination: HTMLElement | null): void {
    if (!destination) return;
    // Remilia uses React DnD's TouchBackend with mouse support, rather than
    // the HTML5 backend. Drive that existing local gesture path so the site
    // retains ownership of compatibility checks and slot state.
    const sourceBounds = item.getBoundingClientRect();
    const bounds = destination.getBoundingClientRect();
    const sourceX = sourceBounds.left + sourceBounds.width / 2;
    const sourceY = sourceBounds.top + sourceBounds.height / 2;
    const clientX = bounds.left + bounds.width / 2;
    const clientY = bounds.top + bounds.height / 2;
    const event = (type: "mousedown" | "mousemove" | "mouseup", target: HTMLElement, x: number, y: number, buttons: number) => target.dispatchEvent(new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      buttons,
      clientX: x,
      clientY: y,
      screenX: window.screenX + x,
      screenY: window.screenY + y,
    }));
    event("mousedown", item, sourceX, sourceY, 1);
    event("mousemove", destination, clientX, clientY, 1);
    event("mouseup", destination, clientX, clientY, 0);
  }

  function placeCraftingItem(item: HTMLElement): void {
    const craft = item.closest(".crafting-module");
    if (!craft) return;
    const destination = itemIsHammer(item)
      ? craft.querySelector<HTMLElement>(".crafting-module__smash-input-slots .crafting-module__smash-input-slot")
      : nextAssemblySlot(craft);
    dragToSlot(item, destination as HTMLElement | null);
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
      placeCraftingItem(item);
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
