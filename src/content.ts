import { createContentRuntime } from "./shared/contentRuntime";
import { FIRST_PARTY_APPS } from "./shared/firstPartyApps";
import { setupRootVisualState } from "./shared/rootVisualState";

const contentRuntime = createContentRuntime(FIRST_PARTY_APPS);

void bootFeatures();

async function bootFeatures(): Promise<void> {
  await setupRootVisualState();
  await contentRuntime.boot();
}
