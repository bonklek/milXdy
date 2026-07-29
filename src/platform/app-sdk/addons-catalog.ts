import type { UrlAllowRule } from "../browser/url-allowlist";

/** Canonical public discovery surface for optional, locally composed add-ons. */
export const MILXDY_ADDONS_CATALOG_URL = "https://bonklek.github.io/milXdy/addons/";
export const MILXDY_ADDONS_CATALOG_FALLBACK_URL = "https://github.com/bonklek/milXdy/blob/main/docs/sdk/APP_SDK.md#future-github-app-store-path";
export const MILXDY_ADDONS_CATALOG_URL_RULES: readonly UrlAllowRule[] = [
  { origin: "https://bonklek.github.io", pathPrefix: "/milXdy/addons/" },
  { origin: "https://github.com", pathPrefix: "/bonklek/milXdy/blob/main/docs/sdk/APP_SDK.md" },
];
