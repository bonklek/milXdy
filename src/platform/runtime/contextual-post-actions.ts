import type { AppContextualPostAction, MilxdyAppManifest } from "../app-sdk/app-platform";

export type EligibleContextualPostAction = {
  app: MilxdyAppManifest;
  action: AppContextualPostAction;
};

export function eligibleContextualPostActions(
  apps: readonly MilxdyAppManifest[],
  enabledAppIds: ReadonlySet<string>,
): EligibleContextualPostAction[] {
  const seen = new Set<string>();
  const eligible: EligibleContextualPostAction[] = [];
  for (const app of apps) {
    if (app.available === false || !enabledAppIds.has(app.id)) continue;
    for (const action of app.contextualPostActions || []) {
      const key = `${app.id}:${action.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      eligible.push({ app, action });
    }
  }
  return eligible;
}
