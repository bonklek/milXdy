import type { RemiliaAuthIdentity } from "./remilia-auth-contract";

export function identityFromClaims(claims: Record<string, unknown>): RemiliaAuthIdentity {
  return compactObject({
    id: String(claims.sub),
    displayName: optionalString(claims.name),
    username: optionalString(claims.preferred_username),
    avatarUrl: optionalHttpsUrl(claims.picture),
  });
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalHttpsUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
