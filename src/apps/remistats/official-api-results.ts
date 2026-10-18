import type { RemiliaApiError } from "../../platform/auth/remilia-api";
import type { RemiStatsOfficialFailure, RemiStatsSelfProfileResult } from "./official-api-contract";

export function officialFailure(error: RemiliaApiError): RemiStatsOfficialFailure {
  return {
    ok: false, source: "official", error: error.code, message: error.message, status: error.status,
    category: error.category, code: error.code,
    ...(error.retryAfterMs === undefined ? {} : { retryAfterMs: error.retryAfterMs }),
    ...(error.nextAllowedAt === undefined ? {} : { nextAllowedAt: error.nextAllowedAt }),
    ...(["unauthorized", "invalid_token", "auth_unavailable"].includes(error.code) ? { authRequired: true } : {}),
    ...(["insufficient_scope", "requires_user"].includes(error.code) ? { scopeRequired: true } : {}),
  };
}

export function invalidPaginationFailure(): RemiStatsOfficialFailure {
  return officialFailure({
    category: "invalid_response", code: "invalid_response", message: "The Remilia API returned an invalid response.", status: 0,
  });
}

export function unmatchedSelfProfile(): RemiStatsSelfProfileResult {
  return { ok: true, source: "official", matched: false, data: null };
}

export function authRequiredFailure(): RemiStatsOfficialFailure {
  return officialFailure({ category: "authentication", code: "auth_unavailable", message: "Connect Remilia to use this action.", status: 401 });
}

export function unavailablePokeTargetFailure(): RemiStatsOfficialFailure {
  return officialFailure({ category: "authorization", code: "forbidden", message: "This X profile cannot be poked.", status: 403 });
}
