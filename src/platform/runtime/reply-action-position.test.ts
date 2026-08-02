import { describe, expect, it } from "vitest";
import { resolveReplyActionPanelPosition } from "./reply-action-position";

describe("reply action panel position", () => {
  it("anchors a compact menu to the actual reply control in a narrow layout", () => {
    const position = resolveReplyActionPanelPosition({
      anchor: { top: 145, right: 602, bottom: 169, left: 578 },
      panelWidth: 148,
      viewportWidth: 768,
      viewportHeight: 640,
      stickyHeaderBottom: 54,
    });

    expect(position).toEqual({ left: 578, top: 177, maxHeight: 447, hidden: false });
  });

  it("clamps only enough to keep the measured menu inside the viewport", () => {
    const position = resolveReplyActionPanelPosition({
      anchor: { top: 145, right: 758, bottom: 169, left: 734 },
      panelWidth: 148,
      viewportWidth: 768,
      viewportHeight: 640,
      stickyHeaderBottom: 54,
    });

    expect(position.left).toBe(612);
    expect(position.hidden).toBe(false);
  });

  it("moves with its reply control and hides once the control crosses the sticky header", () => {
    const visible = resolveReplyActionPanelPosition({
      anchor: { top: 100, right: 240, bottom: 124, left: 216 },
      panelWidth: 148,
      viewportWidth: 768,
      viewportHeight: 640,
      stickyHeaderBottom: 54,
    });
    const hidden = resolveReplyActionPanelPosition({
      anchor: { top: 22, right: 240, bottom: 46, left: 216 },
      panelWidth: 148,
      viewportWidth: 768,
      viewportHeight: 640,
      stickyHeaderBottom: 54,
    });

    expect(visible.top).toBe(132);
    expect(visible.hidden).toBe(false);
    expect(hidden.top).toBe(54);
    expect(hidden.hidden).toBe(true);
  });
});
