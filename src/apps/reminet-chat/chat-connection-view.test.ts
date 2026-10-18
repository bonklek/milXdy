import { describe, expect, it } from "vitest";
import { renderChatReconnectState } from "./chat-connection-view";
import { escapeHtml, formatBody } from "./chat-value-format";
const state = { recoveryMessage: "Recheck", recoveryVisibleState: "failed", composerError: "<img src=x onerror=bad>" };
describe("merged Chat connection UI", () => {
  it.each(["disconnected", "expired", "missing-scope", "migration-required"])("offers the extension login path for %s", phase => {
    const html = renderChatReconnectState(phase, state, escapeHtml);
    expect(html).toContain('data-chat-action="login"');
    expect(html).not.toContain('data-chat-action="retry-connection"');
  });
  it("shows a bounded waiting state while login is pending", () => {
    expect(renderChatReconnectState("connecting", state, escapeHtml)).toContain("login is in progress");
    expect(renderChatReconnectState("connecting", state, escapeHtml)).not.toContain("<button");
  });
  it("escapes failure and message text after formatting extraction", () => {
    expect(renderChatReconnectState("unknown", state, escapeHtml)).toContain("&lt;img");
    expect(formatBody('<img src=x>\nhttps://example.test')).toContain('&lt;img src=x&gt;<br><a href="https://example.test"');
  });
});
