import { createContentRuntime } from "../../platform/runtime/content-runtime";
import { FIRST_PARTY_APPS } from "../../platform/app-sdk/first-party-registry";
import { setupMaxProfileBenchmark } from "../../platform/diagnostics/max-profile-benchmark";
import { setupRootVisualState } from "../../platform/visuals/root-visual-state";
import { appsForRuntimeSite, resolveRuntimeSite, startsMilxdyUiRuntime } from "../../platform/runtime/site-runtime";

const runtimeSite = resolveRuntimeSite(window.location);
const runtimeApps = runtimeSite && startsMilxdyUiRuntime(runtimeSite) ? appsForRuntimeSite(FIRST_PARTY_APPS, runtimeSite) : [];
let contentRuntime = runtimeSite && startsMilxdyUiRuntime(runtimeSite) ? createContentRuntime(runtimeApps, runtimeSite) : null;

if (runtimeSite?.mode === "bridgeOnly") {
  document.documentElement.dataset.milxdyRuntimeSite = runtimeSite.id;
  document.documentElement.dataset.milxdyRuntimeMode = runtimeSite.mode;
  document.documentElement.dataset.milxdyRuntimeState = "bridge-only";
  removeStaleMilxdyUi();
} else if (runtimeSite && contentRuntime) {
  document.documentElement.dataset.milxdyRuntimeSite = runtimeSite.id;
  document.documentElement.dataset.milxdyRuntimeMode = runtimeSite.mode;
  void bootFeaturesWithRecovery();
} else {
  document.documentElement.dataset.milxdyRuntimeState = "unsupported";
}

async function bootFeaturesWithRecovery(attempt = 0): Promise<void> {
  try {
    await bootFeatures();
    document.documentElement.dataset.milxdyRuntimeState = "ready";
    delete document.documentElement.dataset.milxdyRuntimeError;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    document.documentElement.dataset.milxdyRuntimeState = "failed";
    document.documentElement.dataset.milxdyRuntimeError = message.slice(0, 160);
    document.dispatchEvent(new CustomEvent("milxdy:runtime-error", { detail: { attempt, message } }));
    console.error("milXdy startup failed", error);
    if (attempt >= 2) return;
    await contentRuntime?.dispose().catch(() => undefined);
    contentRuntime = runtimeSite && startsMilxdyUiRuntime(runtimeSite) ? createContentRuntime(runtimeApps, runtimeSite) : null;
    window.setTimeout(() => void bootFeaturesWithRecovery(attempt + 1), 500 * (attempt + 1));
  }
}

function removeStaleMilxdyUi(): void {
  for (const id of [
    "milxdy-overlay-dock-root",
    "milxdy-overlay-app-guides",
    "milxdy-app-hub-panel",
    "milxdy-reminet-chat-root",
    "beetol-hunter-root",
  ]) {
    document.getElementById(id)?.remove();
  }
}

async function bootFeatures(): Promise<void> {
  if (!runtimeSite || !contentRuntime) return;
  if (runtimeSite.id === "x") {
    await setupRootVisualState();
    setupMaxProfileBenchmark();
  }
  await contentRuntime.boot();
}
