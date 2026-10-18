export const POST_READING_RAIL_DEFAULT_MIGRATION_KEY = "milxdy.apps.postReadingRailDefault.v1";

type PostReadingRailDefaultInput = {
  appId: string;
  enabled: boolean;
  available: boolean;
  hasDock: boolean;
  railSupported: boolean;
  railDefaultPinned: boolean;
  alreadyMigrated: boolean;
  pinnedAppIds: Iterable<string>;
  unpinnedAppIds: Iterable<string>;
};

export type PostReadingRailDefaultMigration = {
  changed: boolean;
  migrated: boolean;
  pinnedAppIds: Set<string>;
  unpinnedAppIds: Set<string>;
};

export function migratePostReadingRailDefault(
  input: PostReadingRailDefaultInput,
): PostReadingRailDefaultMigration {
  const pinnedAppIds = new Set(input.pinnedAppIds);
  const unpinnedAppIds = new Set(input.unpinnedAppIds);
  const eligible = input.appId === "post-reading"
    && input.enabled
    && input.available
    && input.hasDock
    && input.railSupported
    && input.railDefaultPinned;

  if (!eligible || input.alreadyMigrated) {
    return {
      changed: false,
      migrated: input.alreadyMigrated,
      pinnedAppIds,
      unpinnedAppIds,
    };
  }

  pinnedAppIds.add(input.appId);
  unpinnedAppIds.delete(input.appId);
  return {
    changed: true,
    migrated: true,
    pinnedAppIds,
    unpinnedAppIds,
  };
}
