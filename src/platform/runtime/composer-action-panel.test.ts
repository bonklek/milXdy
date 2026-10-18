import { afterEach, describe, expect, it, vi } from "vitest";
import { createComposerActionServices, type ComposerActionServiceDependencies } from "./composer-action-panel";

const button = { isConnected: true, closest: () => null } as unknown as HTMLButtonElement;
const app: ComposerActionServiceDependencies["app"] = {
  id: "synthetic-gallery",
  name: "Synthetic gallery",
  remoteQueries: [{
    id: "gallery",
    label: "Gallery",
    adapter: "remibooru",
    resources: ["posts"],
    maxPageSize: 24,
    minIntervalMs: 1000,
    cache: { policy: "none" },
  }],
};

function services(sendRuntimeMessage = vi.fn<(message: unknown) => Promise<unknown>>(async () => null)) {
  return {
    sendRuntimeMessage,
    services: createComposerActionServices({
      app,
      composerSelector: '[contenteditable="true"]',
      currentButton: () => button,
      sendRuntimeMessage: async <Result>(message: unknown) => await sendRuntimeMessage(message) as Result | null,
      recordDiagnostic: vi.fn(),
      playLaunchSound: vi.fn(),
      errorMessage: (error) => error instanceof Error ? error.message : String(error),
    }),
  };
}

function setActivation(active: boolean) {
  vi.stubGlobal("navigator", { userActivation: { isActive: active } });
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("composer action services", () => {
  it("requires a live user gesture before a remote query reaches transport", async () => {
    setActivation(false);
    const { services: actions, sendRuntimeMessage } = services();

    await expect(actions.queryRemoteService("gallery", { resource: "posts", facets: ["synthetic"] }))
      .resolves.toEqual({ ok: false, error: "Open the gallery from its control." });
    expect(sendRuntimeMessage).not.toHaveBeenCalled();
  });

  it("rejects undeclared resources before transport", async () => {
    setActivation(true);
    const { services: actions, sendRuntimeMessage } = services();

    await expect(actions.queryRemoteService("gallery", { resource: "facets" }))
      .resolves.toEqual({ ok: false, error: "This remote gallery resource is not declared by the package." });
    expect(sendRuntimeMessage).not.toHaveBeenCalled();
  });

  it("routes an allowed query through the host transport with its declared identity", async () => {
    setActivation(true);
    const sendRuntimeMessage = vi.fn<(message: unknown) => Promise<unknown>>(async () => ({ ok: true, page: { items: [], nextCursor: null }, facets: [] }));
    const { services: actions } = services(sendRuntimeMessage);

    await expect(actions.queryRemoteService("gallery", { resource: "posts", facets: ["synthetic"] }))
      .resolves.toEqual({ ok: true, page: { items: [], nextCursor: null }, facets: [] });
    expect(sendRuntimeMessage).toHaveBeenCalledWith({
      type: "milxdy:remoteQuery",
      appId: "synthetic-gallery",
      queryId: "gallery",
      request: { resource: "posts", facets: ["synthetic"] },
    });
  });
});
