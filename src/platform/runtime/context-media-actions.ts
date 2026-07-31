import type { AppContextMediaAction, AppMediaContribution, MilxdyAppManifest } from "../app-sdk/app-platform";

export type EligibleContextMediaAction = {
  app: MilxdyAppManifest;
  action: AppContextMediaAction;
  contribution: AppMediaContribution;
};

/** Keep a package's image-menu capability declaration-bound and enabled-only. */
export function eligibleContextMediaActions(
  apps: readonly MilxdyAppManifest[],
  enabledAppIds: ReadonlySet<string>,
): EligibleContextMediaAction[] {
  const seen = new Set<string>();
  const eligible: EligibleContextMediaAction[] = [];
  for (const app of apps) {
    if (app.available === false || !enabledAppIds.has(app.id)) continue;
    for (const action of app.contextMediaActions || []) {
      const contribution = (app.mediaContributions || []).find((candidate) => candidate.contextMediaActionId === action.id);
      const key = `${app.id}:${action.id}`;
      if (!contribution || seen.has(key)) continue;
      seen.add(key);
      eligible.push({ app, action, contribution });
    }
  }
  return eligible;
}
