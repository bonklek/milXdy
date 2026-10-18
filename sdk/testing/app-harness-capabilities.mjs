/** @param {unknown} message */
export function messageTypeOf(message) {
  if (!message || typeof message !== "object" || Array.isArray(message)) return null;
  const type = /** @type {Record<string, unknown>} */ (message).type;
  return typeof type === "string" && type.length > 0 ? type : null;
}

/** @param {unknown} message @param {readonly string[]} patterns */
export function isDeclaredMessage(message, patterns) {
  const type = messageTypeOf(message);
  return type !== null && patterns.some((pattern) => pattern === type || (pattern.endsWith(":*") && type.startsWith(pattern.slice(0, -1))));
}

/** @param {string} value */
export function normalizeWikiUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value, "https://wiki.remilia.org/");
    if (url.protocol !== "https:" || !["remilia.wiki", "wiki.remilia.org"].includes(url.hostname.toLowerCase())) return null;
    if (url.hostname.toLowerCase() === "remilia.wiki") url.hostname = "wiki.remilia.org";
    url.username = ""; url.password = ""; url.searchParams.delete("mobileaction"); url.searchParams.delete("useskin");
    return url.toString();
  } catch { return null; }
}
/**
 * @param {{messageTypes?: string[], hostActions?: string[], messageHandler?: (message: unknown, label?: string) => unknown | Promise<unknown>, openWikiPage?: (url: string) => {ok: boolean, reason?: "disabled"|"unavailable"|"invalid-url"|"cancelled"|"failed"} | Promise<{ok: boolean, reason?: "disabled"|"unavailable"|"invalid-url"|"cancelled"|"failed"}>}} options
 * @param {AbortSignal} signal
 * @param {Map<string, unknown>} diagnostics
 * @param {{message: unknown, label?: string}[]} messages
 * @returns {Pick<import("../types/index.d.ts").MilxdyContentAppContext, "sendMessage" | "openWikiPage">}
 */
export function createHarnessCapabilities(options, signal, diagnostics, messages) {
  return {
    async sendMessage(message, label) {
      if (!isDeclaredMessage(message, options.messageTypes ?? [])) {
        diagnostics.set("harness.messageDenied", {
          label: label ?? "runtimeMessage",
          messageType: messageTypeOf(message),
          declaredPatterns: [...(options.messageTypes ?? [])],
        });
        return null;
      }
      if (signal.aborted) return null;
      messages.push({ message, label });
      const result = options.messageHandler ? await options.messageHandler(message, label) : null;
      return signal.aborted ? null : /** @type {any} */ (result);
    },
    async openWikiPage(url) {
      if (!(options.hostActions ?? []).includes("wiki.openPage")) return { ok: false, reason: "unavailable" };
      const normalized = normalizeWikiUrl(url);
      if (!normalized) return { ok: false, reason: "invalid-url" };
      if (signal.aborted) return { ok: false, reason: "cancelled" };
      if (!options.openWikiPage) return { ok: false, reason: "unavailable" };
      try {
        const result = await options.openWikiPage(normalized);
        return signal.aborted ? { ok: false, reason: "cancelled" } : result;
      } catch {
        return { ok: false, reason: signal.aborted ? "cancelled" : "failed" };
      }
    },
  };
}
