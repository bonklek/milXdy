import { describe, expect, it, vi } from "vitest";
import { raceWithAbort } from "./remilia-auth-oidc";
describe("OIDC abort listener cleanup", () => {
  it.each([true, false])("cleans a listener after promise settlement (success=%s)", async success => {
    const controller = new AbortController();const remove = vi.spyOn(controller.signal, "removeEventListener");
    const promise = raceWithAbort(success ? Promise.resolve("done") : Promise.reject(new Error("failed")), controller.signal);
    if (success) await expect(promise).resolves.toBe("done");else await expect(promise).rejects.toThrow("failed");
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  });
  it("rejects cancellation and releases the listener for an unsettled promise", async () => {
    const controller = new AbortController();const remove = vi.spyOn(controller.signal, "removeEventListener");
    const promise = raceWithAbort(new Promise(() => {}), controller.signal);controller.abort(new Error("cancelled"));
    await expect(promise).rejects.toThrow("cancelled");expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  });
});
