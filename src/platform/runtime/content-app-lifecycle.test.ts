import { describe, expect, it, vi } from "vitest";
import type { MilxdyContentAppContext, MilxdyContentAppModule } from "../app-sdk/app-platform";
import { ContentAppLifecycleOwner, disableContentApp, disposeContentApp } from "./content-app-lifecycle";

describe("content app lifecycle owner", () => {
  it("boots before enabling an active loaded app", async () => {
    const events: string[] = [];
    const owner = createOwner({
      boot: async () => { events.push("boot"); },
      enable: async () => { events.push("enable"); },
    });

    await expect(owner.activate()).resolves.toBe("enabled");
    expect(events).toEqual(["boot", "enable"]);
  });

  it("serializes disable behind an in-flight boot and tears down exactly once", async () => {
    const boot = deferred();
    const events: string[] = [];
    const cleanup = vi.fn();
    const owner = createOwner({
      boot: async () => { events.push("boot"); await boot.promise; },
      enable: async () => { events.push("enable"); },
      disable: async () => { events.push("disable"); },
      dispose: async () => { events.push("dispose"); },
    }, () => true, cleanup);

    const activation = owner.activate();
    const firstDisable = owner.deactivate();
    const secondDisable = owner.deactivate();
    expect(events).toEqual(["boot"]);
    boot.resolve();

    await expect(activation).resolves.toBe("inactive-after-boot");
    await Promise.all([firstDisable, secondDisable]);
    expect(events).toEqual(["boot", "disable", "dispose"]);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("upgrades in-flight teardown to shutdown disposal and never double-disposes", async () => {
    const boot = deferred();
    const events: string[] = [];
    const cleanup = vi.fn();
    const owner = createOwner({
      boot: async () => { events.push("boot"); await boot.promise; },
      disable: async () => { events.push("disable"); },
      dispose: async () => { events.push("dispose"); },
    }, () => true, cleanup);

    const activation = owner.activate();
    const shutdowns = [owner.dispose(), owner.dispose()];
    boot.resolve();

    await expect(activation).resolves.toBe("inactive-after-boot");
    await Promise.all(shutdowns);
    expect(events).toEqual(["boot", "disable", "dispose"]);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("observes re-enable before deferred boot settles when no teardown was requested", async () => {
    const boot = deferred();
    const events: string[] = [];
    let active = false;
    const owner = createOwner({
      boot: async () => { events.push("boot"); await boot.promise; },
      enable: async () => { events.push("enable"); },
    }, () => active);

    const activation = owner.activate();
    active = true;
    boot.resolve();

    await expect(activation).resolves.toBe("enabled");
    expect(events).toEqual(["boot", "enable"]);
  });

  it("waits for in-flight enable before shutdown teardown", async () => {
    const enable = deferred();
    const events: string[] = [];
    const owner = createOwner({
      boot: async () => { events.push("boot"); },
      enable: async () => { events.push("enable"); await enable.promise; },
      disable: async () => { events.push("disable"); },
      dispose: async () => { events.push("dispose"); },
    });

    const activation = owner.activate();
    await Promise.resolve();
    const shutdown = owner.dispose();
    expect(events).toEqual(["boot", "enable"]);
    enable.resolve();

    await expect(activation).resolves.toBe("inactive-after-boot");
    await shutdown;
    expect(events).toEqual(["boot", "enable", "disable", "dispose"]);
  });

  it("upgrades an ordinary in-flight failing disable when shutdown arrives", async () => {
    const disableStarted = deferred();
    const releaseDisable = deferred();
    const events: string[] = [];
    const cleanup = vi.fn(() => { events.push("cleanup"); });
    const owner = createOwner({
      disable: async () => {
        events.push("disable");
        disableStarted.resolve();
        await releaseDisable.promise;
        throw new Error("disable failed");
      },
      dispose: async () => { events.push("dispose"); },
    }, () => true, cleanup);

    await owner.activate();
    const ordinaryDisable = owner.deactivate();
    await disableStarted.promise;
    const shutdown = owner.dispose();
    releaseDisable.resolve();

    await expect(ordinaryDisable).rejects.toThrow("disable failed");
    await expect(shutdown).rejects.toThrow("disable failed");
    expect(events).toEqual(["disable", "dispose", "cleanup"]);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});

describe("content app teardown error compatibility", () => {
  it("runtime shutdown disposes even when disable fails", async () => {
    const dispose = vi.fn();
    const module = { disable: async () => { throw new Error("disable failed"); }, dispose };
    await expect(disposeContentApp(module)).rejects.toThrow("disable failed");
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("ordinary disable preserves the existing skip-dispose-on-failure behavior", async () => {
    const dispose = vi.fn();
    const module = { disable: async () => { throw new Error("disable failed"); }, dispose };
    await expect(disableContentApp(module)).rejects.toThrow("disable failed");
    expect(dispose).not.toHaveBeenCalled();
  });
});

function createOwner(module: MilxdyContentAppModule, isActive = () => true, cleanup: () => void = () => undefined) {
  return new ContentAppLifecycleOwner(module, {} as MilxdyContentAppContext, isActive, cleanup);
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => { resolve = complete; });
  return { promise, resolve };
}
