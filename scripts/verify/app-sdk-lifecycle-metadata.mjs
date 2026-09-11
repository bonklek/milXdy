export function verifyLifecycleAndSiteMetadata(app, dependencies) {
  verifyLifecycleShape(app, dependencies);
  verifySiteScopes(app, dependencies);
  verifySurfaceCoverage(app, dependencies);
}

function verifyLifecycleShape(app, dependencies) {
  const { directMessageSiteScope, fail, hasRequiredMessagesRoutes, surfaceSupportedBySiteScope, validInvocationTriggers, validLifecycleModes, validLoadTriggers, validRouteMatchTypes, validSiteHostPattern, validSiteIntegrations, validSitePresentations, validSites, validSurfaces, warn } = dependencies;
  if (!Array.isArray(app.surfaces)) {
    fail(`${app.id}: surfaces must be an array`);
  } else {
    for (const surface of app.surfaces) {
      if (!validSurfaces.has(surface)) fail(`${app.id}: unsupported surface ${surface}`);
    }
  }
  if (!Array.isArray(app.loadTriggers)) {
    fail(`${app.id}: loadTriggers must be an array`);
  }

  const lifecycle = app.lifecycle;
  if (lifecycle !== undefined) {
    if (!lifecycle || typeof lifecycle !== "object" || !validLifecycleModes.has(lifecycle.mode)) {
      fail(`${app.id}: unsupported lifecycle mode ${lifecycle?.mode}`);
    } else if (lifecycle.mode === "invoked") {
      if (lifecycle.invokedBy !== undefined && !validInvocationTriggers.has(lifecycle.invokedBy)) {
        fail(`${app.id}: unsupported invocation trigger ${lifecycle.invokedBy}`);
      }
      if (lifecycle.invokedBy !== "userAction") fail(`${app.id}: invoked lifecycle must declare invokedBy userAction`);
      if (!lifecycle.reason) fail(`${app.id}: invoked lifecycle must declare the platform load reason`);
      if (!app.loadTriggers?.every((trigger) => trigger === "userAction")) {
        fail(`${app.id}: invoked lifecycle packages must use only userAction load triggers`);
      }
      if ((app.surfaces || []).length > 0) {
        fail(`${app.id}: invoked lifecycle packages must not declare runtime delivery surfaces`);
      }
    }
  }

}

function verifySiteScopes(app, dependencies) {
  const { directMessageSiteScope, fail, hasRequiredMessagesRoutes, surfaceSupportedBySiteScope, validInvocationTriggers, validLifecycleModes, validLoadTriggers, validRouteMatchTypes, validSiteHostPattern, validSiteIntegrations, validSitePresentations, validSites, validSurfaces, warn } = dependencies;
  const siteScopes = app.siteScopes || [];
  if (!Array.isArray(siteScopes)) fail(`${app.id}: siteScopes must be an array when declared`);
  for (const scope of Array.isArray(siteScopes) ? siteScopes : []) {
    if (!validSites.has(scope.site)) fail(`${app.id}: unsupported site scope ${scope.site}`);
    if (!validSiteIntegrations.has(scope.integration)) {
      fail(`${app.id}: site scope must declare a supported integration mode`);
    }
    if (!Array.isArray(scope.hosts) || scope.hosts.length === 0) {
      fail(`${app.id}: site scope must declare host patterns`);
    } else {
      for (const host of scope.hosts) {
        if (!validSiteHostPattern(host)) fail(`${app.id}: invalid site scope host pattern ${host}`);
      }
    }
    if (!Array.isArray(scope.surfaces) || scope.surfaces.length === 0) {
      fail(`${app.id}: site scope must declare at least one surface`);
    } else {
      for (const surface of scope.surfaces) {
        if (!validSurfaces.has(surface)) fail(`${app.id}: site scope declares unsupported surface ${surface}`);
      }
    }
    if (scope.presentation !== undefined && !validSitePresentations.has(scope.presentation)) {
      fail(`${app.id}: unsupported site presentation ${scope.presentation}`);
    }
    if (scope.loadTriggers !== undefined && (!Array.isArray(scope.loadTriggers) || scope.loadTriggers.length === 0)) {
      fail(`${app.id}: site scope loadTriggers must be a non-empty array`);
    }
    for (const trigger of scope.loadTriggers || []) {
      if (!validLoadTriggers.has(trigger)) fail(`${app.id}: site scope declares unsupported load trigger ${trigger}`);
    }
    if (scope.site !== "x" && scope.integration === "contentScript") {
      if (!scope.fallback || !["nativeSite", "externalPage", "none"].includes(scope.fallback.mode) || typeof scope.fallback.note !== "string" || !scope.fallback.note.trim()) {
        fail(`${app.id}: non-X content-script scope must declare fallback mode and note`);
      }
      if (scope.fallback?.url !== undefined && !/^https:\/\//.test(scope.fallback.url)) {
        fail(`${app.id}: site fallback URL must use HTTPS`);
      }
    }
    if (scope.routes !== undefined && !Array.isArray(scope.routes)) fail(`${app.id}: site scope routes must be an array`);
    for (const route of Array.isArray(scope.routes) ? scope.routes : []) {
      if (!validRouteMatchTypes.has(route.type)) fail(`${app.id}: unsupported route match type ${route.type}`);
      if (typeof route.path !== "string" || !route.path.startsWith("/")) {
        fail(`${app.id}: route pattern must declare an absolute path`);
      }
      if (route.surface !== undefined && !validSurfaces.has(route.surface)) {
        fail(`${app.id}: route pattern declares unsupported surface ${route.surface}`);
      }
      if (route.surface !== undefined && !scope.surfaces.includes(route.surface)) {
        fail(`${app.id}: route pattern surface ${route.surface} must be included in its site scope surfaces`);
      }
    }
  }

}

function verifySurfaceCoverage(app, dependencies) {
  const { directMessageSiteScope, fail, hasRequiredMessagesRoutes, surfaceSupportedBySiteScope, validInvocationTriggers, validLifecycleModes, validLoadTriggers, validRouteMatchTypes, validSiteHostPattern, validSiteIntegrations, validSitePresentations, validSites, validSurfaces, warn } = dependencies;
  const lifecycle = app.lifecycle;
  for (const surface of app.surfaces || []) {
    if (surface === "route" || surface === "overlayApp") continue;
    if (surfaceSupportedBySiteScope(app, surface)) continue;
    warn(`${app.id}: surface ${surface} is declared without matching site scope metadata`);
  }

  if ((app.surfaces || []).includes("directMessage")) {
    const directMessageScope = directMessageSiteScope(app);
    if (lifecycle?.mode !== "runtime") {
      fail(`${app.id}: directMessage packages must declare runtime lifecycle metadata`);
    }
    if (!directMessageScope) {
      fail(`${app.id}: directMessage packages must declare explicit X direct-message site metadata`);
    }
    if ((app.surfaces || []).includes("route") && !hasRequiredMessagesRoutes(directMessageScope)) {
      fail(`${app.id}: directMessage route packages must declare /messages and /i/chat route patterns`);
    }
  }
}
