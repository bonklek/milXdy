import { describe, expect, it, vi } from "vitest";
import {
  applyBeforePlacements,
  mergeStackableOrder,
  moveBefore,
  moveBy,
  normalizeStoredOrder,
  stackableOrder,
  visibleItems,
} from "./dock-order-policy";
import type { OverlayDockItem } from "./dock-types";

describe("dock order policy", () => {
  it("normalizes persisted order without inventing values", () => {
    expect(normalizeStoredOrder(["a", 2, "b", null])).toEqual(["a", "b"]);
    expect(normalizeStoredOrder({ a: true })).toEqual([]);
  });

  it("appends newly registered items, hides requested items, and honors before placements", () => {
    const items = itemMap(item("a"), item("b"), item("c", { beforeId: "b" }), item("d"));
    expect(visibleItems(["a", "b"], items, new Set(["d"])).map(({ id }) => id)).toEqual(["a", "c", "b"]);
    expect(applyBeforePlacements([item("a", { beforeId: "missing" }), item("b")]).map(({ id }) => id)).toEqual(["a", "b"]);
  });

  it("keeps the Add-ons catalog terminal even when persisted order puts it first", () => {
    const items = itemMap(item("milxdyAddOnsCatalog"), item("a"), item("b"));
    expect(visibleItems(["milxdyAddOnsCatalog", "a", "b"], items, new Set()).map(({ id }) => id))
      .toEqual(["a", "b", "milxdyAddOnsCatalog"]);
  });

  it("keeps non-stackable positions while applying a partial requested stack order", () => {
    const items = itemMap(item("a"), item("utility", { stackable: false }), item("b"), item("c"));
    expect(stackableOrder(["a", "utility", "b"], items)).toEqual(["a", "b", "c"]);
    expect(mergeStackableOrder(["a", "utility", "b", "c"], ["c", "a"], items)).toEqual(["c", "utility", "a", "b"]);
    expect(stackableOrder(["removed", "a"], items)).toEqual(["a", "b", "c"]);
  });

  it("preserves historical target-index drag behavior and bounds button moves", () => {
    expect(moveBefore(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
    expect(moveBefore(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(moveBy(["a", "b"], "a", -1)).toEqual(["a", "b"]);
    expect(moveBy(["a", "b"], "a", 1)).toEqual(["b", "a"]);
  });
});

function item(id: string, overrides: Partial<OverlayDockItem> = {}): OverlayDockItem {
  return { id, label: id, icon: id, onActivate: vi.fn(), ...overrides };
}

function itemMap(...items: OverlayDockItem[]): Map<string, OverlayDockItem> {
  return new Map(items.map((entry) => [entry.id, entry]));
}
