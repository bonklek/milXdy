import { createContentRuntime } from "../../platform/runtime/content-runtime";
import { FIRST_PARTY_APPS } from "../../platform/app-sdk/first-party-registry";
import { setupMaxProfileBenchmark } from "../../platform/diagnostics/max-profile-benchmark";
import { setupRootVisualState } from "../../platform/visuals/root-visual-state";

let contentRuntime = createContentRuntime(FIRST_PARTY_APPS);

void bootFeaturesWithRecovery();

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
    await contentRuntime.dispose().catch(() => undefined);
    contentRuntime = createContentRuntime(FIRST_PARTY_APPS);
    window.setTimeout(() => void bootFeaturesWithRecovery(attempt + 1), 500 * (attempt + 1));
  }
}

async function bootFeatures(): Promise<void> {
  await setupRootVisualState();
  setupMaxProfileBenchmark();
  await contentRuntime.boot();
}
