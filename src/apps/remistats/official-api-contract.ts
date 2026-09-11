import type { RemiliaApiError, RemiliaApiNotification, RemiliaApiPoke, RemiliaApiStats } from "../../platform/auth/remilia-api";
import { REMILIA_SCOPE_NOTIFICATIONS_READ, REMILIA_SCOPE_POKES_WRITE, REMILIA_SCOPE_STATS_READ } from "../../platform/auth/remilia-api";

export const REMISTATS_OFFICIAL_SCOPES = [REMILIA_SCOPE_STATS_READ, REMILIA_SCOPE_NOTIFICATIONS_READ, REMILIA_SCOPE_POKES_WRITE] as const;

export type RemiStatsOfficialScope = typeof REMISTATS_OFFICIAL_SCOPES[number];

export type RemiStatsStorage = {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove?(key: string): Promise<void>;
};

export type RemiStatsOfficialFailure = {
  ok: false;
  source: "official";
  error: string;
  message: string;
  status: number;
  category: RemiliaApiError["category"];
  code: RemiliaApiError["code"];
  retryAfterMs?: number;
  nextAllowedAt?: number;
  authRequired?: boolean;
  scopeRequired?: boolean;
  cooldownMs?: number;
  cooldownUntil?: number;
  cooldownSource?: "official" | "offline-fallback";
};

export type RemiStatsStatsResult = {
  ok: true;
  source: "official";
  scope: typeof REMILIA_SCOPE_STATS_READ;
  status: number;
  data: RemiliaApiStats;
} | RemiStatsOfficialFailure;

export type RemiStatsAuthStatus = {
  phase: string;
  identity?: { id?: string; username?: string };
};

export type RemiStatsSelfProfileData = {
  xHandle: string;
  remiliaUsername: string;
  displayName: string;
  score: number | null;
  beetleCount: number | null;
  followers: number | null;
};

export type RemiStatsSelfProfileResult = {
  ok: true;
  source: "official";
  matched: true;
  scope: typeof REMILIA_SCOPE_STATS_READ;
  status: number;
  data: RemiStatsSelfProfileData;
} | {
  ok: true;
  source: "official";
  matched: false;
  data: null;
} | RemiStatsOfficialFailure;

export type RemiStatsNotificationItem = RemiliaApiNotification & {
  key: string;
  read: boolean;
  readSource: "official" | "local" | "unread";
};

export type RemiStatsNotificationsResult = {
  ok: true;
  source: "official";
  scope: typeof REMILIA_SCOPE_NOTIFICATIONS_READ;
  status: number;
  notifications: RemiStatsNotificationItem[];
  pageCount: number;
  duplicateCount: number;
} | RemiStatsOfficialFailure;

export type RemiStatsIncomingPoke = {
  key: string;
  handle: string;
  createdAt: number;
};

export type RemiStatsIncomingPokesResult = {
  ok: true;
  source: "official";
  scope: typeof REMILIA_SCOPE_NOTIFICATIONS_READ;
  pokes: RemiStatsIncomingPoke[];
  pokers: string[];
  notificationCount: number;
  pageCount: number;
  duplicateCount: number;
  fetchedAt: number;
} | RemiStatsOfficialFailure;

export type RemiStatsPokeSuccess = {
  ok: true;
  source: "official";
  scope: typeof REMILIA_SCOPE_POKES_WRITE;
  status: number;
  data: RemiliaApiPoke;
  cooldownMs: 0;
};

export type RemiStatsPokeResult = RemiStatsPokeSuccess | RemiStatsOfficialFailure;

export type RemiStatsPokeTarget = {
  xHandle: string;
  remiliaUsername: string;
};

export type RemiStatsPokeTargetsResult = {
  ok: true;
  source: "official";
  targets: RemiStatsPokeTarget[];
};

export type StoredNotificationReadState = {
  schemaVersion: 1;
  entries: Array<{ key: string; readAt: number }>;
};

export type StoredPokeCooldown = {
  until: number;
  observedAt: number;
  source: "official";
};

export type StoredPokeCooldownState = {
  schemaVersion: 3;
  accounts: Record<string, Record<string, StoredPokeCooldown>>;
};
