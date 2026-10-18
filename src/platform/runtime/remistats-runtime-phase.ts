export const REMISTATS_RUNTIME_CHANNELS = ["activation", "profile", "poke"] as const;

export type RemiStatsRuntimeChannel = typeof REMISTATS_RUNTIME_CHANNELS[number];

const PHASES = new Set([
  "module-started",
  "feature-enabled",
  "feature-disabled",
  "initialization-failed",
  "route-observed",
  "directory-requested",
  "directory-cached-negative",
  "directory-forced-requested",
  "directory-forced-no-response",
  "directory-forced-rejected",
  "directory-forced-not-found",
  "directory-forced-result-mismatch",
  "directory-forced-confirmed",
  "directory-no-response",
  "directory-policy-rejected",
  "directory-sender-rejected",
  "directory-rejected",
  "directory-auth-required",
  "directory-scope-required",
  "directory-rate-limited",
  "directory-not-found",
  "directory-no-match",
  "directory-result-mismatch",
  "directory-confirmed",
  "banner-waiting",
  "banner-root-missing",
  "banner-control-mounted",
  "banner-empty",
  "banner-ready",
  "banner-error",
  "banner-removed",
  "control-mounted",
] as const);

export type RemiStatsRuntimePhase = typeof PHASES extends Set<infer T> ? T : never;

export type RemiStatsRuntimePhaseState = Record<RemiStatsRuntimeChannel, string>;

export type RemiStatsRuntimePhaseUpdate = {
  channel: RemiStatsRuntimeChannel;
  phase: string;
};

export function emptyRemiStatsRuntimePhaseState(): RemiStatsRuntimePhaseState {
  return {
    activation: "not-started",
    profile: "not-observed",
    poke: "not-observed",
  };
}

export function sanitizeRemiStatsRuntimePhaseUpdate(value: unknown): RemiStatsRuntimePhaseUpdate | null {
  if (!isRecord(value) || Object.keys(value).some((key) => key !== "channel" && key !== "phase")) return null;
  if (!REMISTATS_RUNTIME_CHANNELS.includes(value.channel as RemiStatsRuntimeChannel)) return null;
  if (typeof value.phase !== "string" || !PHASES.has(value.phase as never)) return null;
  return { channel: value.channel as RemiStatsRuntimeChannel, phase: value.phase };
}

export function applyRemiStatsRuntimePhaseUpdate(
  state: RemiStatsRuntimePhaseState,
  value: unknown,
): RemiStatsRuntimePhaseState {
  const update = sanitizeRemiStatsRuntimePhaseUpdate(value);
  return update ? { ...state, [update.channel]: update.phase } : state;
}

export function formatRemiStatsRuntimePhaseState(state: RemiStatsRuntimePhaseState): string {
  return `Runtime check — activation: ${state.activation}; profile: ${state.profile}; Poke: ${state.poke}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
