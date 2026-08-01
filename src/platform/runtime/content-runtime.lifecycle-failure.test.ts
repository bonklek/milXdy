import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("content runtime lifecycle failure wiring", () => {
  it("contains activation failure per app and wires abort into the lifecycle owner", async () => {
    const source = await runtimeSource();

    expect(source).toContain("() => cleanupAppResources(app.id), () => abortAppWork(app.id)");
    expect(source).toContain("if (!lifecycleOwnsTeardown)");
    expect(source).toContain('reportAppLifecycleFailure(app, "activation", error);');
    expect(source).toMatch(/reportAppLifecycleFailure\(app, "activation", error\);\s+return null;/u);
  });

  it("routes disable, route, open, and close through contained lifecycle calls", async () => {
    const source = await runtimeSource();

    expect(source).toContain('.catch((error) => reportAppLifecycleFailure(app, "disable", error))');
    expect(source).toContain('invokeAppLifecycleHook(app, "route", () => lifecycle.route(next)');
    expect(source).toContain('invokeAppLifecycleHook(app, "open", () => lifecycle.open())');
    expect(source).toContain('invokeAppLifecycleHook(app, "close", () => lifecycle.close())');
    expect(source).not.toMatch(/Promise\.resolve\(module\?\.(?:open|close)\?\.\(\)\)/u);
    expect(source).not.toContain("Promise.resolve(module.onRouteChange(");
  });
});

async function runtimeSource(): Promise<string> {
  return readFile(new URL("./content-runtime.ts", import.meta.url), "utf8");
}
