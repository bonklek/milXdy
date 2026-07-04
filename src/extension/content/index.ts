import { createContentRuntime } from "../../platform/runtime/content-runtime";
import { FIRST_PARTY_APPS } from "../../platform/app-sdk/first-party-registry";
import { setupMaxProfileBenchmark } from "../../platform/diagnostics/max-profile-benchmark";
import { setupRootVisualState } from "../../platform/visuals/root-visual-state";

const contentRuntime = createContentRuntime(FIRST_PARTY_APPS);

void bootFeatures();

async function bootFeatures(): Promise<void> {
  await setupRootVisualState();
  setupMaxProfileBenchmark();
  await contentRuntime.boot();
}
