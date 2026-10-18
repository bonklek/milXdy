import { afterEach, describe, expect, it, vi } from "vitest";
import { createPokeClickHandler, renderPokeButtonState } from "./poke-feedback";

const marker = "private-target token=secret authorization:Bearer body@example.invalid";
function fixture(response: Record<string, unknown> | null = {}) {
  const button = { dataset: {}, disabled: false, title: "", textContent: "", setAttribute: vi.fn() } as unknown as HTMLButtonElement;
  const request = vi.fn(async () => response);
  const state = vi.fn((button, value, label) => renderPokeButtonState(button, value, label, () => { button.textContent = "Poke"; }));
  const deps = {
    target: vi.fn((): { username: string; xHandle: string } | null => ({ username: marker, xHandle: "test_handle" })), cooldown: vi.fn(() => 0),
    startCooldown: vi.fn(), request, state, success: vi.fn(), playSound: vi.fn(),
    successful: (value: Record<string, unknown> | null | undefined) => value?.ok === true,
    cooldownMs: (value: Record<string, unknown> | null | undefined) => typeof value?.cooldownMs === "number" ? value.cooldownMs : 0,
    explicitCooldown: (value: Record<string, unknown> | null | undefined) => value?.code === "poke_cooldown",
  };
  return { button, deps, run: createPokeClickHandler(deps) };
}
afterEach(() => vi.restoreAllMocks());

describe("actual RemiStats content poke handler", () => {
  it("logs only allowlisted enums and finite integer HTTP status for hostile responses", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const throwingValue = { toString: () => { throw new Error("must not stringify remote fields"); } };
    for (const status of [Infinity, NaN, 1e20, -1, 401.5, "Bearer secret", throwingValue]) {
      const f = fixture({ ok: false, username: marker, category: marker, code: throwingValue, status, message: marker, headers: { Authorization: marker }, body: { token: marker }, data: { target: marker } });
      await f.run(f.button);
      expect(warn).toHaveBeenLastCalledWith("RemiNet poke failed", { category: "unknown", code: "unknown_error", status: 0 });
      expect(f.button.dataset.reminetPokeMessage).toBe("Poke unavailable. Try again.");
      expect(f.button.disabled).toBe(false);
      expect(f.button.dataset.reminetPokeShaking).toBeUndefined();
      expect(f.deps.success).not.toHaveBeenCalled();
    }
    expect(JSON.stringify(warn.mock.calls)).not.toContain(marker);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("Authorization");
  });
  it("preserves known bounded diagnostic fields and useful offline recovery", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const f = fixture({ ok: false, category: "network", code: "network_error", status: 503, message: marker });
    await f.run(f.button);
    expect(warn).toHaveBeenCalledExactlyOnceWith("RemiNet poke failed", { category: "network", code: "network_error", status: 503 });
    expect(f.button.title).toBe("Poke unavailable while offline. Try again.");
    expect(f.button.setAttribute).toHaveBeenLastCalledWith("aria-label", f.button.title);
  });
  it("keeps authentication and missing-scope feedback distinct without console payloads", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    for (const [flag, message] of [["authRequired", "Reconnect Remilia to poke"], ["scopeRequired", "Reconnect Remilia with poke permission"]]) {
      const f = fixture({ [flag]: true, message: marker, category: marker, code: marker });
      await f.run(f.button);
      expect(f.button.dataset.reminetPokeMessage).toBe(message);
      expect(f.button.disabled).toBe(false);
      expect(f.deps.success).not.toHaveBeenCalled();
    }
    expect(warn).not.toHaveBeenCalled();
  });
  it("retains successful credit and clears error state without logging a target", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const f = fixture({ ok: true, data: { success: true } });
    await f.run(f.button);
    expect(f.deps.request).toHaveBeenCalledExactlyOnceWith({ type: "remistats:pokeXAuthor", xHandle: "test_handle", expectedRemiliaUsername: marker });
    expect(f.deps.success).toHaveBeenCalledExactlyOnceWith(f.button, marker);
    expect(f.button.dataset.reminetPokeState).toBe("idle");
    expect(f.button.dataset.reminetPokeMessage).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });
  it("respects cached and authoritative cooldowns without inflating success", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const cached = fixture(); cached.deps.cooldown.mockReturnValue(Date.now() + 60_000);
    await cached.run(cached.button);
    expect(cached.deps.request).not.toHaveBeenCalled();
    expect(cached.deps.startCooldown).toHaveBeenCalledOnce();
    const official = fixture({ code: "poke_cooldown", cooldownMs: 15_000, cooldownSource: "offline-fallback", message: marker });
    await official.run(official.button);
    expect(official.deps.startCooldown).toHaveBeenCalledExactlyOnceWith(marker, 15_000, "offline-fallback");
    const unknownDuration = fixture({ code: "poke_cooldown", message: marker });
    await unknownDuration.run(unknownDuration.button);
    expect(unknownDuration.button.title).toBe("Already poked. Cooldown time is unavailable.");
    expect(official.deps.success).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
  it("leaves unconfirmed and disabled targets inert and handles rejected requests safely", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const unconfirmed = fixture(); unconfirmed.deps.target.mockReturnValue(null); await unconfirmed.run(unconfirmed.button); expect(unconfirmed.deps.request).not.toHaveBeenCalled();
    const disabled = fixture(); disabled.button.disabled = true; await disabled.run(disabled.button);
    expect(disabled.deps.request).not.toHaveBeenCalled();
    const rejected = fixture(); rejected.deps.request.mockRejectedValue(new Error(marker)); await rejected.run(rejected.button);
    expect(rejected.button.title).toBe("Poke unavailable. Try again.");
    expect(warn).not.toHaveBeenCalled();
  });
});

it("preserves success credit and warns against retry when only local statistics fail", async () => {
  const f = fixture({ ok: true, localPokeStatsRecorded: false });
  await f.run(f.button);
  expect(f.deps.success).toHaveBeenCalledOnce(); expect(f.deps.request).toHaveBeenCalledOnce();
  expect(f.button.dataset.reminetPokeState).toBe("idle"); expect(f.button.title).toContain("Local poke count could not be saved; do not retry the poke");
});
