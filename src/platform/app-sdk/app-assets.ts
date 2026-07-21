export type AppAssetManifest = {
  id: string;
  localPackage?: unknown;
  package: { assets?: readonly string[] };
  assets?: readonly string[];
  requiredOutputs?: readonly string[];
  hostAssetAccess?: readonly string[];
};

export function createAppAssetResolver(app: AppAssetManifest, getExtensionUrl: (path: string) => string): (path: string) => string {
  const packageAssets = new Set(app.package.assets || []);
  const hostAccess = app.hostAssetAccess || [...(app.assets || []), ...(app.requiredOutputs || [])];
  return (input: string): string => {
    const path = normalizeAssetPath(input);
    const packagePath = app.localPackage ? `local-apps/${app.id}/${path}` : path;
    if (packageAssets.has(packagePath)) return getExtensionUrl(packagePath);
    if (hostAccess.some((entry) => path === entry || path.startsWith(`${entry.replace(/\/$/, "")}/`))) {
      return getExtensionUrl(path);
    }
    throw new Error(`${app.id}: asset path is not declared or policy-granted: ${path}`);
  };
}

function normalizeAssetPath(value: string): string {
  if (!value || value.includes("\\") || value.startsWith("/") || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) {
    throw new Error(`App asset path must be a non-empty relative path: ${value || "<empty>"}`);
  }
  const parts = value.split("/");
  if (parts.some((part) => !part || part === "." || part === "..") || value.includes("?") || value.includes("#")) {
    throw new Error(`App asset path is unsafe: ${value}`);
  }
  return parts.join("/");
}
