import type { MilxdyContentAppContext } from "../../platform/app-sdk/app-platform";

let runtimeResolveAssetUrl: MilxdyContentAppContext["resolveAssetUrl"] | null = null;

export function configurePostReadingAssetResolver(resolveAssetUrl: MilxdyContentAppContext["resolveAssetUrl"] | null): void {
  runtimeResolveAssetUrl = resolveAssetUrl;
}

export function postReadingAssetUrl(path: string): string {
  if (!runtimeResolveAssetUrl) throw new Error("Post-reading asset capability unavailable");
  return runtimeResolveAssetUrl(path);
}
