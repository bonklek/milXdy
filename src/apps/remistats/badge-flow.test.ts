import { describe, expect, it } from "vitest";
import { badgeNeedsTextFlow, releaseBadgeTextFlow, placeBadgeInHeader } from "./badge-flow";

describe("badge text-flow threshold", () => {
  it("keeps all metrics inline when they fit", () => {
    expect(badgeNeedsTextFlow(480, [130, 140, 25], 108)).toBe(false);
  });
  it("requires a separate header row when metrics cannot fit beside identity", () => {
    expect(badgeNeedsTextFlow(400, [130, 140, 25], 108)).toBe(true);
  });
  it("tolerates fractional rounding at the boundary", () => {
    expect(badgeNeedsTextFlow(421, [130, 140, 25], 108)).toBe(false);
  });
});


describe("empty badge cleanup", () => {
  it("removes an existing float and its text exclusion", () => {
    const attributes = new Set(["data-reminet-flow-text"]);
    const container = {
      querySelector: () => null,
      removeAttribute: (name: string) => attributes.delete(name),
    };
    let removed = false;
    let restored = false;
    const float = {
      parentElement: container,
      before: () => { restored = true; },
      remove: () => { removed = true; },
    };
    const slot = {
      dataset: { reminetFlowSlot: "true", reminetWrappedRight: "" },
      closest: () => float,
    };
    releaseBadgeTextFlow(slot as unknown as HTMLElement);
    expect(restored).toBe(true);
    expect(removed).toBe(true);
    expect(attributes.has("data-reminet-flow-text")).toBe(false);
    expect(slot.dataset).toEqual({});
  });

  it("releases an empty extension-owned header row without touching the author", () => {
    let restored = false, removed = false;
    const row = { matches: (selector: string) => selector === '[data-reminet-badge-row]', before: () => { restored = true; }, remove: () => { removed = true; } };
    const slot = { dataset: {}, closest: () => null, parentElement: row };
    releaseBadgeTextFlow(slot as unknown as HTMLElement);
    expect(restored).toBe(true); expect(removed).toBe(true);
  });

  it("preserves the text exclusion while another badge float remains", () => {
    let cleared = false;
    const float = {
      parentElement: { querySelector: () => ({}), removeAttribute: () => { cleared = true; } },
      before: () => {}, remove: () => {},
    };
    releaseBadgeTextFlow({ dataset: {}, closest: () => float } as unknown as HTMLElement);
    expect(cleared).toBe(false);
  });
});


describe("crowded metrics ownership", () => {
  it.each([155, 350])("budgets metadata separately from the name (%s pixels)", metadataWidth => {
    const row = { dataset: {} as Record<string, string>, className: "", parentElement: null as unknown, append: () => {} };
    const leaf = (width: number) => ({ contains: () => false, getBoundingClientRect: () => ({ width }) });
    const slot = { dataset: {}, closest: () => null, parentElement: { matches: () => false }, getBoundingClientRect: () => ({ width: 145 }) };
    const metadata = { contains: (node: unknown) => node === slot, children: [leaf(metadataWidth - 35), leaf(35), slot] };
    const header = { clientWidth: 441, children: [leaf(421), metadata], querySelector: () => metadata, append: () => { row.parentElement = header; } };
    const oldStyle = globalThis.getComputedStyle, oldDocument = globalThis.document;
    Object.assign(globalThis, { getComputedStyle: () => ({ display: "flex" }), document: { createElement: () => row } });
    try {
      placeBadgeInHeader(header as unknown as HTMLElement, slot as unknown as HTMLElement);
      expect(row.parentElement).toBe(metadataWidth === 350 ? header : null);
    } finally { Object.assign(globalThis, { getComputedStyle: oldStyle, document: oldDocument }); }
  });
  it("moves metrics to their own author-header row rather than the post body", () => {
    const row = { dataset: {} as Record<string, string>, className: "", parentElement: null as unknown, append: (node: unknown) => { slot.parentElement = row; expect(node).toBe(slot); } };
    const header = { clientWidth: 441, children: [] as unknown[], querySelector: () => null, append: (node: unknown) => { expect(node).toBe(row); row.parentElement = header; } };
    const identity = { contains: () => false, getBoundingClientRect: () => ({ width: 420 }) };
    const slot = { contains: () => false, dataset: { reminetWrappedRight: "" }, closest: () => null, parentElement: { matches: () => false } as unknown, getBoundingClientRect: () => ({ width: 145 }) };
    header.children = [identity, slot];
    const oldStyle = globalThis.getComputedStyle, oldDocument = globalThis.document;
    Object.assign(globalThis, { getComputedStyle: () => ({ display: "flex" }), document: { createElement: () => row } });
    try {
      placeBadgeInHeader(header as unknown as HTMLElement, slot as unknown as HTMLElement);
      expect(row.parentElement).toBe(header);
      expect(slot.parentElement).toBe(row);
      expect(row.dataset.reminetBadgeRow).toBe("true");
      expect(slot.dataset).toEqual({});
    } finally { Object.assign(globalThis, { getComputedStyle: oldStyle, document: oldDocument }); }
  });
});
