const byId = (catalog) => new Map(
  catalog.sections.flatMap((section) => section.packages).map((pkg) => [pkg.id, pkg]),
);

export function isSelectable(pkg, target = "chromium") {
  return pkg?.availability === "published"
    && pkg.review?.status === "approved"
    && pkg.version
    && pkg.artifact?.kind === "maintainer-source"
    && pkg.artifact?.packageSha256
    && pkg.artifact?.recipeId
    && target === "chromium";
}

export function resolveSelection(catalog, requestedIds, target = "chromium") {
  const packages = byId(catalog);
  const ids = [...new Set(requestedIds)].sort((left, right) => left.localeCompare(right));
  const selected = ids.map((id) => packages.get(id)).filter(Boolean);
  const selectedIds = new Set(selected.map((pkg) => pkg.id));
  const errors = [];

  if (!catalog.supportedBuildTargets.includes(target)) errors.push(`Unsupported build target: ${target}.`);
  for (const id of ids) {
    const pkg = packages.get(id);
    if (!pkg) {
      errors.push(`Unknown package: ${id}.`);
      continue;
    }
    if (!isSelectable(pkg, target)) errors.push(`${pkg.name} is ${pkg.availability} and cannot be selected.`);
  }
  for (const pkg of selected) {
    for (const dependency of pkg.dependencies || []) {
      const resolved = packages.get(dependency.id);
      if (!selectedIds.has(dependency.id)) {
        errors.push(`${pkg.name} requires explicit selection of ${dependency.id}@${dependency.version}.`);
      } else if (resolved?.version !== dependency.version) {
        errors.push(`${pkg.name} requires ${dependency.id}@${dependency.version}, not ${resolved?.version || "an unavailable version"}.`);
      }
    }
    for (const conflict of pkg.conflicts || []) {
      if (selectedIds.has(conflict.id)) errors.push(`${pkg.name} conflicts with ${conflict.id}: ${conflict.reason}`);
    }
  }

  return {
    ok: errors.length === 0,
    target,
    selected,
    errors: [...new Set(errors)],
    summary: capabilitySummary(selected),
  };
}

export function selectionFor(catalog, packages, target = "chromium") {
  const resolved = resolveSelection(catalog, packages.map((pkg) => pkg.id), target);
  if (!resolved.ok) throw new Error(resolved.errors.join(" "));
  const recipe = catalog.buildRecipes.find((candidate) => candidate.target === target);
  if (!recipe) throw new Error(`No catalog build recipe exists for ${target}.`);
  return {
    schemaVersion: 2,
    catalog: {
      id: catalog.catalogId,
      revision: catalog.revision,
    },
    build: {
      target,
      recipeId: recipe.id,
    },
    packages: resolved.selected.map((pkg) => ({
      id: pkg.id,
      version: pkg.version,
      packageSha256: pkg.artifact.packageSha256,
    })),
  };
}

export function selectionJson(catalog, packages, target = "chromium") {
  return `${JSON.stringify(selectionFor(catalog, packages, target), null, 2)}\n`;
}

function capabilitySummary(packages) {
  const unique = (values) => [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
  return {
    packages: packages.map((pkg) => `${pkg.id}@${pkg.version || "unavailable"}`).sort(),
    capabilities: unique(packages.flatMap((pkg) => pkg.capabilities || [])),
    hosts: unique(packages.flatMap((pkg) => pkg.permissions?.hosts || [])),
    optionalPermissions: unique(packages.flatMap((pkg) => pkg.permissions?.optional || [])),
    privilegedSurfaces: unique(packages.flatMap((pkg) => pkg.permissions?.privilegedSurfaces || [])),
    siteScopes: unique(packages.flatMap((pkg) => pkg.siteScopes || [])),
    remoteServices: unique(packages.flatMap((pkg) => (pkg.remoteServices || []).map((service) => `${service.name} (${service.origin})`))),
    storage: unique(packages.flatMap((pkg) => [
      ...(pkg.storage?.local || []).map((key) => `local:${key}`),
      ...(pkg.storage?.sync || []).map((key) => `sync:${key}`),
      ...(pkg.storage?.session || []).map((key) => `session:${key}`),
    ])),
    privacyNotes: unique(packages.flatMap((pkg) => pkg.privacyNotes || [])),
    acknowledgements: unique(packages.flatMap((pkg) => [
      pkg.replacement?.acknowledgement,
      ...(pkg.permissions?.privilegedSurfaces?.length ? ["--acknowledge-package-consent"] : []),
    ])),
  };
}
