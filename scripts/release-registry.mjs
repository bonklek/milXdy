import { coreHostPermissions } from "./release-builds.mjs";

export function appIncludedInBuildProfile(app, profile) {
  if (profile === "full") return true;
  return app.hub?.presets?.includes(profile) === true;
}

export function appsForProfile(registry, profile) {
  return registry.filter((app) => appIncludedInBuildProfile(app, profile));
}

export function featureBundleName(app) {
  return `${app.entryName.split("/").pop()}.js`;
}

export function featureBundlesForProfile(registry, profile) {
  return appsForProfile(registry, profile)
    .map(featureBundleName)
    .sort();
}

export function hostPermissionsForProfile(registry, profile) {
  return Array.from(new Set([
    ...coreHostPermissions,
    ...appsForProfile(registry, profile).flatMap((app) => app.permissions?.hosts || []),
  ]));
}
