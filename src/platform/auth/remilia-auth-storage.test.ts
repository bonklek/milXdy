import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthControl, StoredCredentials } from "./remilia-auth-contract";
const credentials: StoredCredentials = { version: 1, accessToken: "synthetic-access", refreshToken: "synthetic-refresh", idToken: "synthetic-id", expiresAt: 9999999999999, grantedScopes: [], identity: { id: "fixture-user" } };
beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());
describe("credential custody write ordering", () => {
  it("keeps disconnect deletion after a pending credential write", async () => {
    let saved: unknown;let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const set = vi.fn(async (values: Record<string, unknown>) => { await gate; saved = Object.values(values)[0]; });
    vi.stubGlobal("chrome", { storage: { session: { setAccessLevel: vi.fn(async () => {}), set, remove: vi.fn(async () => { saved = undefined; }) } } });
    const { writeCredentials, clearCredentials } = await import("./remilia-auth-storage");
    const write = writeCredentials(credentials);await vi.waitFor(() => expect(set).toHaveBeenCalledOnce());
    const clear = clearCredentials();await new Promise(resolve => setTimeout(resolve, 0));
    release();await Promise.all([write, clear]);expect(saved).toBeUndefined();
  });
  it("does not delete a new grant when an older read observed malformed credentials", async () => {
    let saved: unknown = { version: 0 };let release!: () => void;let reads = 0;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const remove = vi.fn(async () => { saved = undefined; });
    vi.stubGlobal("chrome", { storage: { session: {
      setAccessLevel: vi.fn(async () => {}),
      get: vi.fn(async (key: string) => { const snapshot = saved;if (++reads === 1) await gate;return { [key]: snapshot }; }),
      set: vi.fn(async (values: Record<string, unknown>) => { saved = Object.values(values)[0]; }), remove,
    } } });
    const { readCredentials, writeCredentials } = await import("./remilia-auth-storage");
    const read = readCredentials();await vi.waitFor(() => expect(reads).toBe(1));
    await writeCredentials(credentials);release();await read;
    expect(saved).toEqual(credentials);expect(remove).not.toHaveBeenCalled();
  });
  it("continues deletion after a failed credential write", async () => {
    const remove = vi.fn(async () => {});
    vi.stubGlobal("chrome", { storage: { session: { setAccessLevel: vi.fn(async () => {}), set: vi.fn(async () => { throw new Error("storage failure"); }), remove } } });
    const { writeCredentials, clearCredentials } = await import("./remilia-auth-storage");
    await expect(writeCredentials(credentials)).rejects.toThrow("storage failure");await clearCredentials();expect(remove).toHaveBeenCalledOnce();
  });
});

describe("auth control mutation ordering", () => {
  it("keeps an overlapping error update from restoring a stale disconnected flag", async () => {
    let saved: AuthControl = { version: 1, disconnected: false, migration: { version: 1, required: false, legacyDeleted: true } };
    let release!: () => void;let reads = 0;
    const gate = new Promise<void>(resolve => { release = resolve; });
    vi.stubGlobal("chrome", { storage: { local: {
      get: vi.fn(async (key: string) => { const snapshot = saved;if (++reads === 1) await gate;return { [key]: snapshot }; }),
      set: vi.fn(async (values: Record<string, typeof saved>) => { saved = Object.values(values)[0]; }),
    } } });
    const { setLastError, writeControl } = await import("./remilia-auth-storage");
    const error = setLastError("OFFLINE");await vi.waitFor(() => expect(reads).toBe(1));
    const disconnect = writeControl({ ...saved, disconnected: true });release();
    await Promise.all([error, disconnect]);expect(saved.disconnected).toBe(true);
  });
});
