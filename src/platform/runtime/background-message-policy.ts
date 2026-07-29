/**
 * Pure authorization policy for an app's content-to-background messages.
 *
 * This is intentionally not a security boundary: reviewed app code remains
 * privileged. It is the SDK contract check used before the runtime queues a
 * message for the background service.
 */
export type BackgroundMessageAuthorization = {
  messageType: string | null;
  authorized: boolean;
};

export function authorizeBackgroundMessage(
  message: unknown,
  declaredPatterns: readonly string[] | undefined,
): BackgroundMessageAuthorization {
  const messageType = extractBackgroundMessageType(message);
  return {
    messageType,
    authorized: messageType !== null && (declaredPatterns || []).some((pattern) => backgroundMessagePatternMatches(pattern, messageType)),
  };
}

export function extractBackgroundMessageType(message: unknown): string | null {
  if (!message || typeof message !== "object" || Array.isArray(message)) return null;
  const type = (message as Record<string, unknown>).type;
  return typeof type === "string" && type.length > 0 ? type : null;
}

export function backgroundMessagePatternMatches(pattern: string, messageType: string): boolean {
  if (typeof pattern !== "string" || pattern.length === 0) return false;
  if (pattern.endsWith(":*")) return messageType.startsWith(pattern.slice(0, -1));
  return pattern === messageType;
}
