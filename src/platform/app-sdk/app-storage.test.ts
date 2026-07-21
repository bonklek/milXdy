import { describe, expect, it, vi } from "vitest";
import { createAppStorageFacade, type AppStorageBackend, type AppStorageChanges } from "./app-storage";

function backendFixture() {
  let listener: ((area: "local" | "sync", changes: AppStorageChanges) => void) | null = null;
  const backend: AppStorageBackend = {
    get: vi.fn(async (_area, defaults) => ({ ...defaults, enabled: true })),
    set: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    onChanged: vi.fn((next) => {
      listener = next;
      return () => {
        listener = null;
      };
    }),
  };
  return { backend, emit: (area: "local" | "sync", changes: AppStorageChanges) => listener?.(area, changes) };
}

describe("createAppStorageFacade", () => {
  it("allows declared keys and forwards operations", async () => {
    const { backend } = backendFixture();
    const storage = createAppStorageFacade("reader", { sync: ["enabled"] }, backend);
    await expect(storage.sync.get({ enabled: false })).resolves.toEqual({ enabled: true });
    await storage.sync.set({ enabled: true });
    await storage.sync.remove("enabled");
    expect(backend.set).toHaveBeenCalledWith("sync", { enabled: true });
    expect(backend.remove).toHaveBeenCalledWith("sync", ["enabled"]);
  });

  it("rejects undeclared reads, writes, and removals", async () => {
    const { backend } = backendFixture();
    const storage = createAppStorageFacade("reader", { sync: ["enabled"] }, backend);
    await expect(storage.sync.get({ token: null })).rejects.toThrow("requires declared keys: token");
    await expect(storage.sync.set({ token: "secret" })).rejects.toThrow("requires declared keys: token");
    await expect(storage.sync.remove("token")).rejects.toThrow("requires declared keys: token");
  });

  it("delivers only declared changes from the selected area", () => {
    const { backend, emit } = backendFixture();
    const storage = createAppStorageFacade("reader", { sync: ["enabled"] }, backend);
    const listener = vi.fn();
    storage.sync.onChanged(listener);
    emit("local", { enabled: { newValue: true } });
    emit("sync", { token: { newValue: "hidden" } });
    emit("sync", { enabled: { newValue: true }, token: { newValue: "hidden" } });
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({ enabled: { newValue: true } });
  });
});
