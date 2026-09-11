import { describe, expect, it } from "vitest";
import { createPortalStorage } from "./storage";

describe("Portal SDK storage adapter", () => {
  it("uses the injected local facade for reads, writes, removal, and changes", async () => {
    const calls: string[] = [];
    let listener: ((changes: Record<string, { newValue?: unknown }>) => void) | null = null;
    const storage = createPortalStorage({ local: {
      get: async (defaults) => { calls.push("get"); return defaults; },
      set: async () => { calls.push("set"); },
      remove: async () => { calls.push("remove"); },
      onChanged: (next) => { listener = next; return () => { listener = null; }; },
    }, sync: {} as never });
    expect(await storage.get(["draft"])).toEqual({ draft: undefined });
    await storage.set({ draft: "hello" });
    await storage.remove("draft");
    let changed = false;
    const dispose = storage.onChanged(() => { changed = true; });
    (listener as ((changes: Record<string, { newValue?: unknown }>) => void) | null)?.({ draft: { newValue: "updated" } });
    dispose();
    expect(changed).toBe(true);
    expect(calls).toEqual(["get", "set", "remove"]);
  });
});
