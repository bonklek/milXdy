import { describe, expect, it, vi } from "vitest";
import { dispatchAuthorizedBackgroundMessage } from "./background-message-dispatch";

describe("authorized background message dispatch", () => {
  it("denies undeclared messages without invoking the queue callback", () => {
    const queued = vi.fn();
    const denied = vi.fn(() => "denied");

    const result = dispatchAuthorizedBackgroundMessage(
      { type: "other:secret" },
      ["declared:*"],
      { authorized: queued, denied },
    );

    expect(result).toBe("denied");
    expect(denied).toHaveBeenCalledWith({ authorized: false, messageType: "other:secret" });
    expect(queued).not.toHaveBeenCalled();
  });

  it("invokes the queue callback only after a declared type is authorized", () => {
    const events: string[] = [];

    const result = dispatchAuthorizedBackgroundMessage(
      { type: "declared:ready" },
      ["declared:*"],
      {
        denied: () => { events.push("denied"); return false; },
        authorized: (authorization) => {
          events.push(`queued:${authorization.messageType}`);
          return true;
        },
      },
    );

    expect(result).toBe(true);
    expect(events).toEqual(["queued:declared:ready"]);
  });
});
