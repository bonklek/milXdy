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
        position: absolute; top: 50%; right: -.25rem; transform: translate(100%, -50%);
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
    if (!destination || !isEmptySlot(destination)) return;
    // React DnD owns the actual selection and validation. These local DOM
    // events drive its existing drag/drop path; they neither mutate inventory
    // themselves nor contact the craft endpoint.
    const dataTransfer = new DataTransfer();
    // The site registers a single drop target that chooses the compatible
    // crafting slot from React DnD's client offset.  A synthetic event defaults
    // to (0, 0), which is outside every target and therefore correctly results
    // in no assignment.  Use the centre of the exact native slot instead.
    const bounds = destination.getBoundingClientRect();
    const clientX = bounds.left + bounds.width / 2;
    const clientY = bounds.top + bounds.height / 2;
    const event = (type: string, target: HTMLElement) => target.dispatchEvent(new DragEvent(type, {
      bubbles: true,
      cancelable: true,
      dataTransfer,
      clientX,
      clientY,
      screenX: window.screenX + clientX,
      screenY: window.screenY + clientY,
    }));
    event("dragstart", item);
    event("dragenter", destination);
    event("dragover", destination);
    event("drop", destination);
    event("dragend", item);
  }

  function placeCraftingItem(item: HTMLElement): void {
    const craft = item.closest(".crafting-module");
    if (!craft) return;
    const destination = itemIsHammer(item)
      ? craft.querySelector<HTMLElement>(".crafting-module__smash-input-slots .crafting-module__smash-input-slot")
      : craft.querySelector(".crafting-module__input-slot:not(.crafting-module__input-slot--5):not(.crafting-module__input-slot--filled)");
    dragToSlot(item, destination as HTMLElement | null);
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
