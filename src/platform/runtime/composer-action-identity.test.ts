import { describe, expect, it } from "vitest";
import { composerActionButtonIdentity, findPackageComposerActionButton } from "./composer-action-identity";

function button(appId: string, hostAction?: string) {
  return { dataset: { appId, ...(hostAction ? { hostAction } : {}) } };
}

describe("composer action identity", () => {
  it("never aliases a host companion action as the package action", () => {
    const drafts = button("tweet-composer-kit", "nativeDrafts");
    const factory = button("tweet-composer-kit");

    expect(findPackageComposerActionButton([drafts, factory], "tweet-composer-kit")).toBe(factory);
    expect(findPackageComposerActionButton([drafts], "tweet-composer-kit")).toBeNull();
  });

  it("preserves the action route when X clones or reorders controls", () => {
    const originalFactory = button("tweet-composer-kit");
    const clonedFactory = button("tweet-composer-kit");
    const drafts = button("tweet-composer-kit", "nativeDrafts");

    expect(composerActionButtonIdentity(originalFactory)).toEqual({ appId: "tweet-composer-kit", hostAction: null });
    expect(composerActionButtonIdentity(clonedFactory)).toEqual({ appId: "tweet-composer-kit", hostAction: null });
    expect(composerActionButtonIdentity(drafts)).toEqual({ appId: "tweet-composer-kit", hostAction: "nativeDrafts" });
    expect(findPackageComposerActionButton([drafts, clonedFactory], "tweet-composer-kit")).toBe(clonedFactory);
  });
});
