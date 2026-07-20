export type SocketAuthCredential = {
  ok: boolean;
  token?: string;
  error?: string;
};

export function hasUsableSocketSession(result: SocketAuthCredential): boolean {
  return result.ok;
}

export function hasUsableSocketAccessToken(result: SocketAuthCredential): boolean {
  return result.ok && typeof result.token === "string" && result.token.trim().length > 0;
}

export async function resolveSocketAuthCredential(
  prepare: () => Promise<SocketAuthCredential>,
  refreshBrowserSession: () => Promise<SocketAuthCredential>,
  options: { forceBrowserSessionRefresh?: boolean; requireAccessTokenAfterRefresh?: boolean } = {},
): Promise<SocketAuthCredential> {
  const prepared = options.forceBrowserSessionRefresh ? null : await prepare();
  if (prepared && hasUsableSocketSession(prepared)) return prepared;

  const refreshed = await refreshBrowserSession();
  const refreshedUsable = options.requireAccessTokenAfterRefresh
    ? hasUsableSocketAccessToken(refreshed)
    : hasUsableSocketSession(refreshed);
  if (refreshedUsable) return refreshed;

  return { ok: false, error: refreshed.error || prepared?.error || "AUTH_REQUIRED" };
}
