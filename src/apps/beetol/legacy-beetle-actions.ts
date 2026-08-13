export type LegacyBeetleAction = "catchBeetle" | "beetleHunt" | "claimUBC" | "junkFaucet";

export type LegacyBeetleOperation =
  | LegacyBeetleAction
  | "craft"
  | "trophyShelf";

export type LegacyBeetleEndpointNote = {
  operation: LegacyBeetleOperation;
  apiFamily: "legacy-undocumented";
  method: "GET" | "POST";
  pathTemplate: string;
  privacy: string;
  removalCondition: string;
};

export const LEGACY_BEETLE_ENDPOINTS: readonly LegacyBeetleEndpointNote[] = Object.freeze([
  ...(["catchBeetle", "beetleHunt", "claimUBC", "junkFaucet"] as const).map((operation) => Object.freeze({
    operation,
    apiFamily: "legacy-undocumented" as const,
    method: "POST" as const,
    pathTemplate: `/api/beetle/action/${operation}`,
    privacy: "Sends no arbitrary URL or caller-supplied body. The authenticated account mutation runs only after an explicit Beetol button press; credentials remain in background auth code.",
    removalCondition: `Remove this ${operation} adapter when Remilia API v1 documents an equivalent user-delegated operation and milXdy has shipped and live-verified that replacement.`,
  })),
  Object.freeze({
    operation: "craft" as const,
    apiFamily: "legacy-undocumented" as const,
    method: "POST" as const,
    pathTemplate: "/api/beetle/action/craft",
    privacy: "Sends only the fixed craft type and two locally selected inventory codenames after the user starts Crunch All Junk. Credentials and the full inventory stay in background code.",
    removalCondition: "Remove this craft adapter when Remilia API v1 documents an equivalent user-delegated craft operation, including per-recipe failure semantics, and the replacement passes live parity QA.",
  }),
  Object.freeze({
    operation: "trophyShelf" as const,
    apiFamily: "legacy-undocumented" as const,
    method: "GET" as const,
    pathTemplate: "/api/beetle/trophy/~{username}/shelf",
    privacy: "Discloses only the already-resolved public Remilia username to Remilia's shelf-image endpoint. It sends no bearer token, inventory, card state, or X browsing data.",
    removalCondition: "Remove this trophy-shelf adapter when API v1 provides a documented public shelf asset/read contract, or remove the banner mode if Remilia retires the legacy image endpoint.",
  }),
]);

export type LegacyBeetleRequest = (request: {
  operation: Exclude<LegacyBeetleOperation, "trophyShelf">;
  apiFamily: "legacy-undocumented";
  method: "POST";
  path: string;
  body: Record<string, unknown>;
}) => Promise<Record<string, unknown>>;

export function createLegacyBeetleActionsAdapter(request: LegacyBeetleRequest) {
  return Object.freeze({
    runAction(action: LegacyBeetleAction): Promise<Record<string, unknown>> {
      if (!isLegacyBeetleAction(action)) {
        return Promise.resolve({ ok: false, error: "UNKNOWN_LEGACY_BEETLE_ACTION" });
      }
      return request({
        operation: action,
        apiFamily: "legacy-undocumented",
        method: "POST",
        path: `/api/beetle/action/${action}`,
        body: {},
      });
    },

    craftJunk(slot1: string, slot2: string): Promise<Record<string, unknown>> {
      const first = normalizeItemCodename(slot1);
      const second = normalizeItemCodename(slot2);
      if (!first || !second) {
        return Promise.resolve({ ok: false, error: "INVALID_LEGACY_CRAFT_ITEM" });
      }
      return request({
        operation: "craft",
        apiFamily: "legacy-undocumented",
        method: "POST",
        path: "/api/beetle/action/craft",
        body: { type: 1, slot1: first, slot2: second },
      });
    },
  });
}

export function legacyBeetleTrophyShelfUrl(
  username: string,
  baseUrl = "https://www.remilia.net",
): string | null {
  const clean = normalizePublicUsername(username);
  if (!clean) return null;
  const base = new URL(baseUrl);
  if (base.protocol !== "https:" || base.hostname !== "www.remilia.net") return null;
  return new URL(`/api/beetle/trophy/~${encodeURIComponent(clean)}/shelf`, base).href;
}

export function isLegacyBeetleAction(value: unknown): value is LegacyBeetleAction {
  return value === "catchBeetle"
    || value === "beetleHunt"
    || value === "claimUBC"
    || value === "junkFaucet";
}

function normalizeItemCodename(value: unknown): string {
  if (typeof value !== "string") return "";
  const clean = value.trim();
  return /^[A-Za-z0-9_-]{1,80}$/.test(clean) ? clean : "";
}

function normalizePublicUsername(value: unknown): string {
  if (typeof value !== "string") return "";
  const clean = value.replace(/^[@~]/, "").trim();
  return /^[A-Za-z0-9_]{1,32}$/.test(clean) ? clean : "";
}
