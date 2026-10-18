import { ownedTweetHeader, tweetBadgeAnchor } from "../../lib/tweet-ownership";

export function badgeNeedsTextFlow(width: number, itemWidths: readonly number[], badgeWidth: number, gap = 6): boolean {
  return itemWidths.reduce((total, item) => total + item, 0) + badgeWidth + gap * itemWidths.length > width + 1;
}


type FlowState = { header: HTMLElement; slot: HTMLElement; resize: ResizeObserver; frame: number };
const states = new WeakMap<HTMLElement, FlowState>();
const surfaces = new WeakMap<HTMLElement, HTMLElement>();

/** Restore extension-owned badge placement and remove obsolete layout wrappers. */
export function releaseBadgeTextFlow(slot: HTMLElement): void {
  const float = slot.closest<HTMLElement>('[data-reminet-flow-badge]');
  if (float) {
    const surface = surfaces.get(slot);
    const anchor = surface && tweetBadgeAnchor(surface);
    if (anchor?.parentElement) anchor.parentElement.insertBefore(slot, anchor.nextSibling);
    else float.before(slot);
    const container = float.parentElement;
    float.remove();
    if (!container?.querySelector('[data-reminet-flow-badge]')) container?.removeAttribute('data-reminet-flow-text');
  }
  const row = slot.parentElement?.matches('[data-reminet-badge-row]') ? slot.parentElement : null;
  if (row) {
    const surface = surfaces.get(slot);
    const anchor = surface && tweetBadgeAnchor(surface);
    if (anchor?.parentElement) anchor.parentElement.insertBefore(slot, anchor.nextSibling);
    else row.before(slot);
    row.remove();
  }
  delete slot.dataset.reminetFlowSlot;
  delete slot.dataset.reminetWrappedRight;
}


function headerItems(parent: Element, slot: HTMLElement): HTMLElement[] {
  return [...parent.children].flatMap(child => child === slot ? []
    : child.contains(slot) || getComputedStyle(child).display === "contents"
      ? headerItems(child, slot) : [child as HTMLElement]);
}

/** Keep metrics inside their author header; crowded metrics get their own row. */
export function maintainBadgeTextFlow(surface: HTMLElement, slot: HTMLElement): void {
  const header = ownedTweetHeader(surface);
  if (!header || slot.dataset.reminetProfileSlot === "true") return;
  if (!header.querySelector("time") && slot.parentElement !== header) header.append(slot);
  surfaces.set(slot, surface);
  const previous = states.get(surface);
  if (previous?.header === header && previous.slot === slot) { schedule(previous, surface); return; }
  previous?.resize.disconnect();
  if (previous?.frame) cancelAnimationFrame(previous.frame);
  const state: FlowState = { header, slot, resize: new ResizeObserver(() => schedule(state, surface)), frame: 0 };
  states.set(surface, state);
  state.resize.observe(header);
  if (header.firstElementChild) state.resize.observe(header.firstElementChild);
  if (header.lastElementChild) state.resize.observe(header.lastElementChild);
  state.resize.observe(slot);
  state.resize.observe(surface);
  schedule(state, surface);
}

/** The badge never shares a layout container with the post body. */
export function placeBadgeInHeader(header: HTMLElement, slot: HTMLElement): void {
  const legacyFloat = slot.closest<HTMLElement>('[data-reminet-flow-badge]');
  if (legacyFloat) releaseBadgeTextFlow(slot);
  const row = slot.parentElement?.matches('[data-reminet-badge-row]') ? slot.parentElement : null;
  // Name overflow may already wrap the metadata to its own line. Only the
  // metadata and metrics need to fit together before adding a third row.
  const metadata = header.querySelector<HTMLElement>('[data-milxdy-metadata-row]');
  const items = headerItems(metadata || header, slot).filter(node => node !== row);
  const wrapped = badgeNeedsTextFlow(header.clientWidth, items.map(node => node.getBoundingClientRect().width), slot.getBoundingClientRect().width);
  if (wrapped) {
    const target = row ?? document.createElement("div");
    target.dataset.reminetBadgeRow = "true";
    target.className = "reminet-badge-row";
    if (target.parentElement !== header) header.append(target);
    if (slot.parentElement !== target) target.append(slot);
    delete slot.dataset.reminetFlowSlot;
    delete slot.dataset.reminetWrappedRight;
  } else if (row) releaseBadgeTextFlow(slot);
}

function schedule(state: FlowState, surface: HTMLElement): void {
  if (state.frame) return;
  state.frame = requestAnimationFrame(() => {
    state.frame = 0;
    if (!surface.isConnected || !state.slot.isConnected) { state.resize.disconnect(); return; }
    const ready = state.slot.dataset.reminetState === "ready" && Boolean(state.slot.querySelector('[data-reminet-badge]'));
    if (!state.header.querySelector("time")) {
      if (state.slot.parentElement !== state.header || state.header.lastElementChild !== state.slot) state.header.append(state.slot);
      return;
    }
    if (!ready) {
      releaseBadgeTextFlow(state.slot);
      return;
    }
    placeBadgeInHeader(state.header, state.slot);

  });
}

export function insertBadgeSlot(element: HTMLElement, badgeOrSlot: HTMLElement, findOwnedHeaderTime: (element: HTMLElement) => HTMLElement | null, findOwnedUserName: (element: HTMLElement) => HTMLElement | null, findOwnedNode: (element: HTMLElement, selector: string) => HTMLElement | null): boolean {
  const timeElement = findOwnedHeaderTime(element);
  if (timeElement && timeElement.parentElement) {
    const anchor = tweetBadgeAnchor(element) || timeElement;
    anchor.parentElement?.insertBefore(badgeOrSlot, anchor.nextSibling);
    return true;
  }

  const userNameContainer = findOwnedUserName(element);
  if (userNameContainer) {
    const insertPoint = tweetBadgeAnchor(element) || userNameContainer;
    if (insertPoint.parentElement) {
      insertPoint.parentElement?.insertBefore(badgeOrSlot, insertPoint.nextSibling);
      return true;
    }
  }

  const fallback = findOwnedNode(element, '[dir="ltr"][class*="css"]');
  if (fallback && fallback.parentElement) {
    const insertPoint = fallback.querySelector<HTMLElement>('[dir="ltr"]') || fallback;
    insertPoint.parentElement?.insertBefore(badgeOrSlot, insertPoint.nextSibling);
    return true;
  }

  return false;
}


export function positionBadgeSlotNearTweetTime(element: HTMLElement, slot: HTMLElement) {
  if (!element || !slot || slot.dataset.reminetProfileSlot === 'true') return false;
  if (slot.dataset.reminetFlowSlot === 'true' || slot.parentElement?.matches('[data-reminet-badge-row]')) return true;
  const anchor = tweetBadgeAnchor(element);
  if (!anchor?.parentElement) return false;
  if (slot.parentElement !== anchor.parentElement || slot.previousSibling !== anchor) {
    delete slot.dataset.reminetBadgeWrapped;
    anchor.parentElement.insertBefore(slot, anchor.nextSibling);
  }
  return true;
}


export function markBadgeSlotEmpty(slot: HTMLElement | null) {
  if (!slot) return;
  slot.replaceChildren();
  slot.dataset.reminetState = 'empty';
  releaseBadgeTextFlow(slot);
  slot.setAttribute('aria-hidden', 'true');
  removeEmptyBadgeRow(slot.parentElement);
}


export function removeEmptyBadgeRow(row: HTMLElement | null) {
  if (!row?.matches?.('[data-reminet-badge-row]')) return;
  if (!row.querySelector('[data-reminet-badge-slot], [data-milxdy-tweet-slot="remistats-badge"]')) row.remove();
}
