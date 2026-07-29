import { describe, expect, it } from "vitest";
import { authorizeBackgroundMessage, backgroundMessagePatternMatches, extractBackgroundMessageType } from "./background-message-policy";

describe("background message authorization policy", () => {
  it("authorizes declared exact and namespace wildcard message types", () => {
    expect(authorizeBackgroundMessage({ type: "miladychan:fetchJson" }, ["miladychan:fetchJson"])).toEqual({
      messageType: "miladychan:fetchJson",
      authorized: true,
    });
    expect(authorizeBackgroundMessage({ type: "miladychan:fetchJson" }, ["miladychan:*"])).toEqual({
      messageType: "miladychan:fetchJson",
      authorized: true,
    });
  });

  it("fails closed for malformed messages and undeclared namespaces", () => {
    expect(authorizeBackgroundMessage({ payload: "missing type" }, ["miladychan:*"])).toEqual({
      messageType: null,
      authorized: false,
    });
    expect(authorizeBackgroundMessage({ type: "remilia:fetchJson" }, ["miladychan:*"])).toEqual({
      messageType: "remilia:fetchJson",
      authorized: false,
    });
    expect(authorizeBackgroundMessage({ type: "miladychan:fetchJson" }, undefined)).toEqual({
      messageType: "miladychan:fetchJson",
      authorized: false,
    });
  });

  it("preserves the existing permissive wildcard shape", () => {
    expect(backgroundMessagePatternMatches("miladychan:*", "miladychan:")).toBe(true);
    expect(backgroundMessagePatternMatches("miladychan:*", "miladychan:fetchJson")).toBe(true);
    expect(backgroundMessagePatternMatches("miladychan:*", "miladychan")).toBe(false);
  });

  it("only extracts a non-empty string type from a non-array object", () => {
    expect(extractBackgroundMessageType({ type: "ok" })).toBe("ok");
    expect(extractBackgroundMessageType({ type: "" })).toBeNull();
    expect(extractBackgroundMessageType(["ok"])).toBeNull();
    expect(extractBackgroundMessageType(null)).toBeNull();
  });
});
