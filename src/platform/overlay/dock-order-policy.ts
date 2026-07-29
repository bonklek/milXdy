import type { OverlayDockItem } from "./dock-types";

const TERMINAL_DOCK_ITEM_ID = "milxdyAddOnsCatalog";

export function normalizeStoredOrder(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

export function itemOrder(order: readonly string[], items: ReadonlyMap<string, OverlayDockItem>): string[] {
  const known = new Set(order);
  return [...order, ...Array.from(items.keys()).filter((id) => !known.has(id))];
}

export function visibleItems(
  order: readonly string[],
  items: ReadonlyMap<string, OverlayDockItem>,
  hiddenItems: ReadonlySet<string>,
): OverlayDockItem[] {
  const visible = itemOrder(order, items)
    .map((id) => items.get(id))
    .filter((item): item is OverlayDockItem => item != null && !hiddenItems.has(item.id));
  return placeTerminalItemLast(applyBeforePlacements(visible));
}

function placeTerminalItemLast(items: OverlayDockItem[]): OverlayDockItem[] {
  const terminalIndex = items.findIndex((item) => item.id === TERMINAL_DOCK_ITEM_ID);
  if (terminalIndex === -1 || terminalIndex === items.length - 1) return items;
  const [terminalItem] = items.splice(terminalIndex, 1);
  items.push(terminalItem);
  return items;
}

export function applyBeforePlacements(items: readonly OverlayDockItem[]): OverlayDockItem[] {
  const placed = [...items];
  for (const item of items) {
    if (!item.beforeId) continue;
    const from = placed.findIndex((candidate) => candidate.id === item.id);
    const to = placed.findIndex((candidate) => candidate.id === item.beforeId);
    if (from === -1 || to === -1 || from === to - 1) continue;
    placed.splice(from, 1);
    const nextTo = placed.findIndex((candidate) => candidate.id === item.beforeId);
    if (nextTo === -1) placed.push(item);
    else placed.splice(nextTo, 0, item);
  }
  return placed;
}

export function stackableOrder(order: readonly string[], items: ReadonlyMap<string, OverlayDockItem>): string[] {
  return itemOrder(order, items).filter((id) => {
    const item = items.get(id);
    return item != null && item.stackable !== false;
  });
}

export function mergeStackableOrder(
  order: readonly string[],
  requestedIds: readonly string[],
  items: ReadonlyMap<string, OverlayDockItem>,
): string[] {
  const currentStackable = stackableOrder(order, items);
  const requested = requestedIds.filter((id) => typeof id === "string" && items.get(id)?.stackable !== false);
  const requestedSet = new Set(requested);
  const merged = [
    ...requested.filter((id) => currentStackable.includes(id)),
    ...currentStackable.filter((id) => !requestedSet.has(id)),
  ];
  const stackableSet = new Set(currentStackable);
  const next: string[] = [];
  let stackIndex = 0;
  for (const id of order) {
    if (stackableSet.has(id)) {
      const replacement = merged[stackIndex++];
      if (replacement) next.push(replacement);
    } else next.push(id);
  }
  for (; stackIndex < merged.length; stackIndex += 1) next.push(merged[stackIndex]);
  for (const id of items.keys()) if (!next.includes(id)) next.push(id);
  return next;
}

export function moveBefore(order: readonly string[], id: string, targetId: string): string[] {
  if (id === targetId) return [...order];
  const from = order.indexOf(id);
  const to = order.indexOf(targetId);
  if (from === -1 || to === -1) return [...order];
  const next = [...order];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

export function moveBy(order: readonly string[], id: string, delta: -1 | 1): string[] {
  const from = order.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= order.length) return [...order];
  const next = [...order];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
