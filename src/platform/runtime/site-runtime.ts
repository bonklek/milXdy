import type {
  AppLoadTrigger,
  AppSiteId,
  AppSiteRuntimeMode,
  AppSiteScope,
  MilxdyAppManifest,
  MilxdyAppSurface,
  MilxdyRuntimeSite,
} from "../app-sdk/app-platform";

type LocationLike = Pick<Location, "protocol" | "hostname" | "origin" | "pathname">;

type SiteDefinition = {
  id: AppSiteId;
  mode: AppSiteRuntimeMode;
  origins: readonly string[];
};

export const APPROVED_RUNTIME_SITES: readonly SiteDefinition[] = [
  { id: "x", mode: "fullRail", origins: ["https://x.com", "https://twitter.com"] },
  { id: "remiliaNet", mode: "appLauncher", origins: ["https://www.remilia.net"] },
  { id: "remiliaWiki", mode: "featureOnly", origins: ["https://remilia.wiki", "https://wiki.remilia.org"] },
  { id: "miladychan", mode: "appLauncher", origins: ["https://boards.miladychan.org"] },
] as const;

export const APPROVED_RUNTIME_MATCHES = APPROVED_RUNTIME_SITES.flatMap((site) => (
  site.origins.map((origin) => `${origin}/*`)
));

export function resolveRuntimeSite(location: LocationLike): MilxdyRuntimeSite | null {
  if (location.protocol !== "https:") return null;
  const origin = `${location.protocol}//${location.hostname.toLowerCase()}`;
  const definition = APPROVED_RUNTIME_SITES.find((candidate) => candidate.origins.includes(origin));
  return definition ? { id: definition.id, origin, mode: definition.mode } : null;
}

export function contentScriptScopeForApp(
  app: Pick<MilxdyAppManifest, "siteScopes">,
  site: MilxdyRuntimeSite,
): AppSiteScope | null {
  return (app.siteScopes || []).find((scope) => (
    scope.integration === "contentScript"
    && scope.site === site.id
    && scope.hosts.some((pattern) => hostPatternMatchesOrigin(pattern, site.origin))
  )) || null;
}

export function appsForRuntimeSite(
  apps: readonly MilxdyAppManifest[],
  site: MilxdyRuntimeSite,
): MilxdyAppManifest[] {
  return apps.filter((app) => contentScriptScopeForApp(app, site));
}

export function loadTriggersForApp(app: MilxdyAppManifest, site: MilxdyRuntimeSite): readonly AppLoadTrigger[] {
  return contentScriptScopeForApp(app, site)?.loadTriggers || app.loadTriggers;
}

export function surfacesForApp(app: MilxdyAppManifest, site: MilxdyRuntimeSite): readonly MilxdyAppSurface[] {
  return contentScriptScopeForApp(app, site)?.surfaces || [];
}

export function routeScopeMatches(
  app: MilxdyAppManifest,
  site: MilxdyRuntimeSite,
  pathname: string,
): boolean {
  const scope = contentScriptScopeForApp(app, site);
  if (!scope) return false;
  return (scope.routes || []).some((route) => (
    route.type === "exact" ? pathname === route.path : pathname.startsWith(route.path)
  ));
}

function hostPatternMatchesOrigin(pattern: string, origin: string): boolean {
  const match = pattern.match(/^https:\/\/([^/]+)\/\*$/);
  if (!match) return false;
  return `https://${match[1]?.toLowerCase()}` === origin;
}
