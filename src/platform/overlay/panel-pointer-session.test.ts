import { afterEach, expect, it, vi } from "vitest";
import { cancelPointerSession, clearPointerSession, setPointerSession } from "./panel-pointer-session";

afterEach(() => { cancelPointerSession(); });
it("only cancels the owning panel and never repeats cleanup", () => {
  const owner = {} as HTMLElement;
  const cleanup = vi.fn();
  setPointerSession(cleanup, owner);
  expect(cancelPointerSession({} as HTMLElement)).toBe(false);
  expect(cleanup).not.toHaveBeenCalled();
  expect(cancelPointerSession(owner)).toBe(true);
  cancelPointerSession(owner);
  expect(cleanup).toHaveBeenCalledTimes(1);
});
it("does not clear a replacement session from an old callback", () => {
  const old = vi.fn(); const replacement = vi.fn();
  setPointerSession(replacement, null);
  clearPointerSession(old); cancelPointerSession();
  expect(replacement).toHaveBeenCalledTimes(1);
});
