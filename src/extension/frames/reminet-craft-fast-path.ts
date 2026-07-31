(() => {
  const SETTING_ATTRIBUTE = "data-milxdy-reminet-beetle-reduced-motion-setting";
  const FAST_TIMEOUTS = new Set([1_000, 4_500, 8_000]);
  let enabled = document.documentElement.getAttribute(SETTING_ATTRIBUTE) === "true";
  let fastCraftSubmissionUntil = 0;
  // This is deliberately document-scoped: the Remilia chat owns the marker and
  // recreates it on a chat remount.  We must not turn a presentational dismissal
  // into account-scoped state or a server read-history mutation.
  let lastReadDismissedForDocument = false;
  const autoFilledCraftRoots = new WeakSet<Element>();
  const nativeSetTimeout = window.setTimeout.bind(window);

  function ensureLastReadStyle(): void {
    if (document.getElementById("milxdy-last-read-dismissal-style")) return;
    const style = document.createElement("style");
    style.id = "milxdy-last-read-dismissal-style";
    style.textContent = `
      .milxdy-last-read-marker { position: relative; }
      .milxdy-last-read-dismiss {
        display: inline-grid; place-items: center; width: 1.25rem; height: 1.25rem;
        margin-inline-start: .35rem; border: 1px solid currentColor; border-radius: 999px;
        padding: 0; background: Canvas; color: CanvasText; cursor: pointer; font: 700 1rem/1 sans-serif;
        opacity: 0; pointer-events: none;
      }
      .milxdy-last-read-marker:hover .milxdy-last-read-dismiss,
      .milxdy-last-read-marker:focus-within .milxdy-last-read-dismiss { opacity: 1; pointer-events: auto; }
      .milxdy-last-read-dismiss:focus-visible { opacity: 1; pointer-events: auto; outline: 2px solid Highlight; outline-offset: 2px; }
    `;
    document.documentElement.append(style);
  }

  function click(element: Element): void {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
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

  function placeSelectedItem(item: Element, destination: Element | null): void {
    if (!destination || !isEmptySlot(destination)) return;
    // These are the site's existing local selection handlers.  The extension
    // neither writes inventory state nor calls a craft/assembly endpoint.
    click(item);
    queueMicrotask(() => click(destination));
  }

  function placeCraftingItem(item: Element): void {
    const craft = item.closest(".crafting-module");
    if (!craft) return;
    const destination = itemIsHammer(item)
      ? craft.querySelector(".crafting-module__hammer-slot--empty")
      : craft.querySelector(".crafting-module__input-slot:not(.crafting-module__input-slot--filled), .crafting-module__smash-input-slot:not(.crafting-module__smash-input-slot--filled)");
    placeSelectedItem(item, destination);
  }

  function autoFillGreenSacrifice(craft: Element): void {
    if (autoFilledCraftRoots.has(craft)) return;
    autoFilledCraftRoots.add(craft);
    const sacrifice = craft.querySelector(".crafting-module__sacrifice-input-slot");
    if (!sacrifice || !isEmptySlot(sacrifice)) return;
    const green = Array.from(craft.querySelectorAll(".crafting-module__beetle-item")).find(itemLooksGreen);
    if (green) placeSelectedItem(green, sacrifice);
  }

  function installLastReadDismissal(marker: HTMLElement): void {
    if (lastReadDismissedForDocument) {
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
    dismiss.setAttribute("aria-label", "Dismiss Last read marker");
    dismiss.title = "Dismiss Last read marker";
    dismiss.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      lastReadDismissedForDocument = true;
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
    document.querySelectorAll<HTMLElement>("div, span, p").forEach((element) => {
      if (element.children.length > 0 || element.textContent?.trim().toLowerCase() !== "last read") return;
      installLastReadDismissal(element);
    });
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

  document.addEventListener("dblclick", (event) => {
    if (new URLSearchParams(location.search).get("cartridge") !== "craft") return;
    const target = event.target instanceof Element ? event.target : null;
    const item = target?.closest(".crafting-module__beetle-item");
    if (!item || item.classList.contains("crafting-module__beetle-item--unavailable")) return;
    placeCraftingItem(item);
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
