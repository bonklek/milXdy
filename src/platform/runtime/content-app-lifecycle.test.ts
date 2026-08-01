import { describe, expect, it, vi } from "vitest";
import type { MilxdyContentAppContext, MilxdyContentAppModule, MilxdyRouteChange } from "../app-sdk/app-platform";
import { ContentAppLifecycleOwner, disableContentApp, disposeContentApp } from "./content-app-lifecycle";

const ROUTE: MilxdyRouteChange = {
  href: "https://x.com/home",
  pathname: "/home",
  previousHref: null,
  visible: true,
  changedAt: 1,
};

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

  it("aborts and tears down partial boot state before a clean retry", async () => {
    const events: string[] = [];
    let attempt = 0;
    let initialized = false;
    const module: MilxdyContentAppModule = {
      boot: async () => {
        events.push(`boot:${++attempt}`);
        if (initialized) throw new Error("dirty singleton");
        initialized = true;
        if (attempt === 1) throw new Error("boot failed");
      },
      enable: async () => { events.push("enable"); },
      disable: async () => { events.push("disable"); },
      dispose: async () => { events.push("dispose"); initialized = false; },
    };
    const first = createOwner(module, () => true, () => events.push("cleanup"), () => events.push("abort"));

    await expect(first.activate()).rejects.toThrow("boot failed");
    expect(events).toEqual(["boot:1", "abort", "disable", "dispose", "cleanup"]);

    const retry = createOwner(module);
    await expect(retry.activate()).resolves.toBe("enabled");
    expect(events).toEqual(["boot:1", "abort", "disable", "dispose", "cleanup", "boot:2", "enable"]);
  });

  it("aborts and disposes when enable rejects", async () => {
    const events: string[] = [];
    const owner = createOwner({
      boot: async () => { events.push("boot"); },
      enable: async () => { events.push("enable"); throw new Error("enable failed"); },
      disable: async () => { events.push("disable"); },
      dispose: async () => { events.push("dispose"); },
    }, () => true, () => events.push("cleanup"), () => events.push("abort"));

    await expect(owner.activate()).rejects.toThrow("enable failed");
    expect(events).toEqual(["boot", "enable", "abort", "disable", "dispose", "cleanup"]);
  });

  it("serializes disable behind an in-flight boot and tears down exactly once", async () => {
    const boot = deferred();
    const events: string[] = [];
    const cleanup = vi.fn();
    const abort = vi.fn();
    const owner = createOwner({
      boot: async () => { events.push("boot"); await boot.promise; },
      enable: async () => { events.push("enable"); },
      disable: async () => { events.push("disable"); },
      dispose: async () => { events.push("dispose"); },
    }, () => true, cleanup, abort);

    const activation = owner.activate();
    const firstDisable = owner.deactivate();
    const secondDisable = owner.deactivate();
    expect(events).toEqual(["boot"]);
    expect(abort).toHaveBeenCalledOnce();
    boot.resolve();

    await expect(activation).resolves.toBe("inactive-after-boot");
    await Promise.all([firstDisable, secondDisable]);
    expect(events).toEqual(["boot", "disable", "dispose"]);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(abort).toHaveBeenCalledOnce();
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
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("waits for an active route hook after abort before teardown", async () => {
    const route = deferred();
    const events: string[] = [];
    const owner = createOwner({
      onRouteChange: async () => { events.push("route"); await route.promise; },
      disable: async () => { events.push("disable"); },
      dispose: async () => { events.push("dispose"); },
    }, () => true, () => events.push("cleanup"), () => events.push("abort"));
    await owner.activate();

    const routeCall = owner.route(ROUTE);
    await Promise.resolve();
    const shutdown = owner.dispose();
    expect(events).toEqual(["route", "abort"]);
    route.resolve();

    await Promise.all([routeCall, shutdown]);
    expect(events).toEqual(["route", "abort", "disable", "dispose", "cleanup"]);
  });

  it.each([
    ["route", (owner: ContentAppLifecycleOwner) => owner.route(ROUTE)],
    ["open", (owner: ContentAppLifecycleOwner) => owner.open()],
    ["close", (owner: ContentAppLifecycleOwner) => owner.close()],
  ] as const)("makes a rejecting %s hook terminal and failure-safe", async (hook, invoke) => {
    const events: string[] = [];
    const module: MilxdyContentAppModule = {
      onRouteChange: async () => { if (hook === "route") throw new Error("route failed"); },
      open: async () => { if (hook === "open") throw new Error("open failed"); },
      close: async () => { if (hook === "close") throw new Error("close failed"); },
      disable: async () => { events.push("disable"); },
      dispose: async () => { events.push("dispose"); },
    };
    const owner = createOwner(module, () => true, () => events.push("cleanup"), () => events.push("abort"));
    await owner.activate();

    await expect(invoke(owner)).rejects.toThrow(`${hook} failed`);
    expect(events).toEqual(["abort", "disable", "dispose", "cleanup"]);
    await expect(owner.dispose()).resolves.toBeUndefined();
    expect(events).toEqual(["abort", "disable", "dispose", "cleanup"]);
  });

  it("attempts dispose and cleanup even when disable rejects", async () => {
    const events: string[] = [];
    const owner = createOwner({
      disable: async () => { events.push("disable"); throw new Error("disable failed"); },
      dispose: async () => { events.push("dispose"); },
    }, () => true, () => events.push("cleanup"));
    await owner.activate();

    await expect(owner.deactivate()).rejects.toThrow("disable failed");
    expect(events).toEqual(["disable", "dispose", "cleanup"]);
  });

  it("attempts every teardown stage and aggregates independent failures", async () => {
    const events: string[] = [];
    const owner = createOwner({
      disable: async () => { events.push("disable"); throw new Error("disable failed"); },
      dispose: async () => { events.push("dispose"); throw new Error("dispose failed"); },
    }, () => true, () => { events.push("cleanup"); throw new Error("cleanup failed"); });
    await owner.activate();

    const error = await owner.dispose().catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).errors).toHaveLength(3);
    expect(events).toEqual(["disable", "dispose", "cleanup"]);
  });
});

describe("content app teardown helpers", () => {
  it.each([
    ["ordinary disable", disableContentApp],
    ["runtime shutdown", disposeContentApp],
  ] as const)("%s disposes even when disable fails", async (_label, teardown) => {
    const dispose = vi.fn();
    const module = { disable: async () => { throw new Error("disable failed"); }, dispose };
    await expect(teardown(module)).rejects.toThrow("disable failed");
    expect(dispose).toHaveBeenCalledOnce();
  });
});

function createOwner(
  module: MilxdyContentAppModule,
  isActive = () => true,
  cleanup: () => void = () => undefined,
  abort: () => void = () => undefined,
) {
  return new ContentAppLifecycleOwner(module, {} as MilxdyContentAppContext, isActive, cleanup, abort);
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => { resolve = complete; });
  return { promise, resolve };
}
