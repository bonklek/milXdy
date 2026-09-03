import {
  mergeReminetDirectoryCache,
  remiNetDirectoryAliasKey,
  resolveReminetDirectoryIdentifiers,
  type ReminetDirectoryApiResponse,
  type ReminetDirectoryIdentifier,
  type ReminetDirectoryResolution,
  type ResolveReminetDirectoryOptions,
} from "./reminet-directory";
import {
  clearPublicProfileMiss,
  emptyIdentityProfile,
  freshPublicProfileMiss,
  identityCacheEntry,
  identityCacheKeyForRemiliaUsername,
  mergeIdentityProfile,
  normalizeRemiliaUsername,
  pruneSharedIdentityCache,
  rememberPublicProfileMiss,
  rememberSharedIdentity,
  type ReminetIdentityCache,
  type ReminetIdentityProfile,
  type ReminetIdentityProvenance,
} from "./reminet-identity";

export type ReminetPublicProfileApi = {
  ok: true;
  data: unknown;
  status: number;
} | {
  ok: false;
  error: {
    code: string;
    category?: string;
    status: number;
    retryAfterMs?: number;
  };
};

export type ReminetIdentityApi = {
  resolveDirectory(identifiers: readonly ReminetDirectoryIdentifier[]): Promise<ReminetDirectoryApiResponse>;
  getUserProfile(username: string): Promise<ReminetPublicProfileApi>;
};

export type ResolveReminetIdentitiesOptions = ResolveReminetDirectoryOptions & {
  profileMaxAgeMs?: number;
};

export type ReminetResolvedIdentity = ReminetDirectoryResolution & {
  profile: ReminetIdentityProfile | null;
};

export type ResolveReminetIdentitiesResult = {
  results: ReminetResolvedIdentity[];
  cache: ReminetIdentityCache;
  batchSizes: number[];
};

export async function resolveReminetIdentities(
  identifiers: readonly ReminetDirectoryIdentifier[],
  cache: ReminetIdentityCache,
  api: ReminetIdentityApi,
  options: ResolveReminetIdentitiesOptions = {},
): Promise<ResolveReminetIdentitiesResult> {
  const now = options.now ?? Date.now;
  const observedAt = now();
  const working = pruneSharedIdentityCache(cache, undefined, observedAt);
  const directory = await resolveReminetDirectoryIdentifiers(
    identifiers,
    working.directory,
    (batch) => api.resolveDirectory(batch),
    { ...options, now: () => observedAt },
  );
  mergeReminetDirectoryCache(working.directory, directory.cache);

  const handles = new Set<string>();
  for (const result of directory.results) {
    const handle = normalizeRemiliaUsername(result.identity?.handle);
    if (result.status === "resolved" && handle) handles.add(handle);
  }
  const profiles = new Map<string, ReminetIdentityProfile | null>();
  await Promise.all(Array.from(handles, async (handle) => {
    const alias = identityCacheKeyForRemiliaUsername(handle);
    const cached = identityCacheEntry(working, alias);
    const maxAgeMs = options.profileMaxAgeMs ?? 6 * 60 * 60 * 1000;
    if (options.force !== true && cached?.publicProfileCachedAt && observedAt - cached.publicProfileCachedAt < maxAgeMs) {
      profiles.set(handle, cached.profile);
      return;
    }
    if (options.force !== true && freshPublicProfileMiss(working, handle, undefined, observedAt)) {
      profiles.set(handle, null);
      return;
    }
    const response = await api.getUserProfile(handle);
    if (!response.ok) {
      if (response.error.status === 404 || ["not_found", "user_not_found"].includes(response.error.code)) {
        rememberPublicProfileMiss(working, handle, observedAt);
      }
      profiles.set(handle, null);
      return;
    }
    const profile = mergeIdentityProfile(
      emptyIdentityProfile(),
      identityProfileFromApiV1(response.data, handle, observedAt),
      "remilia-api-v1:profile",
    );
    rememberSharedIdentity(working, profile, {
      cachedAt: observedAt,
      publicProfileCachedAt: observedAt,
      aliases: [alias],
    });
    clearPublicProfileMiss(working, handle);
    profiles.set(handle, profile);
  }));

  const results = directory.results.map((result): ReminetResolvedIdentity => {
    const handle = normalizeRemiliaUsername(result.identity?.handle);
    const profile = handle ? profiles.get(handle) ?? identityCacheEntry(working, identityCacheKeyForRemiliaUsername(handle))?.profile ?? null : null;
    if (result.status === "resolved" && handle && profile) {
      const alias = remiNetDirectoryAliasKey(result.query);
      const enriched = mergeIdentityProfile(profile, {
        remiliaUsername: handle,
        displayName: profile.displayName || result.identity?.display_name || null,
        pfpUrl: profile.pfpUrl || result.identity?.avatar_url || null,
        externalIdentifiers: [result.query],
        provenance: [directoryProvenance(result.query, observedAt)],
      }, "remilia-api-v1:directory");
      rememberSharedIdentity(working, enriched, {
        cachedAt: observedAt,
        publicProfileCachedAt: identityCacheEntry(working, identityCacheKeyForRemiliaUsername(handle))?.publicProfileCachedAt,
        aliases: [alias, identityCacheKeyForRemiliaUsername(handle)].filter(Boolean),
        authoritativeAliases: true,
      });
      return { ...result, profile: enriched };
    }
    return { ...result, profile };
  });

  return { results, cache: pruneSharedIdentityCache(working, undefined, observedAt), batchSizes: directory.batchSizes };
}

export function identityProfileFromApiV1(
  value: unknown,
  fallbackUsername: string,
  observedAt = Date.now(),
): Partial<ReminetIdentityProfile> {
  const root = recordValue(value);
  const user = recordValue(root.user);
  const pfp = recordValue(user.pfp);
  const username = normalizeRemiliaUsername(stringValue(user.username) || fallbackUsername) || normalizeRemiliaUsername(fallbackUsername);
  const connections = Array.isArray(user.connections) ? user.connections : null;
  const externalIdentifiers = identifiersFromConnections(connections);
  const xHandle = externalIdentifiers.find((identifier) => identifier.type === "x_handle")?.value ?? null;
  return {
    xHandle,
    remiliaUsername: username || null,
    displayName: stringValue(user.displayName) || null,
    pfpProject: stringValue(pfp.project) || null,
    pfpId: stringValue(pfp.id) || null,
    pfpUrl: stringValue(user.pfpUrl) || null,
    beetleCount: numberValue(user.beetles),
    remiStatsScore: numberValue(user.socialCredit),
    friendCount: numberValue(user.friendCount),
    trophyShelves: Array.isArray(user.trophyShelves) ? user.trophyShelves : null,
    allTrophies: Array.isArray(user.allTrophies) ? user.allTrophies : null,
    connections,
    friendsDisplayed: Array.isArray(user.friendsDisplayed) ? user.friendsDisplayed : null,
    viewerContext: Object.keys(recordValue(root.viewerContext)).length ? recordValue(root.viewerContext) : null,
    isAuthenticated: typeof root.isAuthenticated === "boolean" ? root.isAuthenticated : null,
    isOwnProfile: typeof root.isOwnProfile === "boolean" ? root.isOwnProfile : null,
    externalIdentifiers,
    provenance: [profileProvenance(username || fallbackUsername, observedAt)],
  };
}

function identifiersFromConnections(connections: unknown[] | null): ReminetDirectoryIdentifier[] {
  if (!connections) return [];
  const results: ReminetDirectoryIdentifier[] = [];
  for (const value of connections) {
    const connection = recordValue(value);
    const provider = stringValue(connection.provider || connection.type || connection.platform || connection.service).toLowerCase();
    const identifier = stringValue(
      connection.handle
      || connection.username
      || connection.userName
      || connection.user_name
      || connection.screenName
      || connection.screen_name
      || connection.id,
    );
    if (!identifier) continue;
    if (provider === "x" || provider.includes("twitter")) results.push({ type: "x_handle", value: identifier });
    else if (provider.includes("github")) results.push({ type: "github", value: identifier });
    else if (provider.includes("discord")) results.push({ type: "discord", value: identifier });
  }
  return results;
}

function directoryProvenance(identifier: ReminetDirectoryIdentifier, observedAt: number): ReminetIdentityProvenance {
  return {
    source: "remilia-api-v1",
    endpoint: "POST /api/v1/directory/resolve",
    identifier,
    observedAt,
  };
}

function profileProvenance(username: string, observedAt: number): ReminetIdentityProvenance {
  return {
    source: "remilia-api-v1",
    endpoint: `GET /api/v1/users/${username}`,
    identifier: { type: "handle", value: username },
    observedAt,
  };
}

function recordValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
