import type { MilxdyContentAppContext } from "../../platform/app-sdk/app-platform";

type BeetolSdkContext = Pick<MilxdyContentAppContext, "scheduler"> & Partial<Pick<MilxdyContentAppContext, "resolveAssetUrl" | "sendMessage" | "signal" | "storage">>;

/** Captures Beetol's host-owned services before UI work begins. */
export function createBeetolSdkServices(context: BeetolSdkContext) {
  if (!context.storage || !context.resolveAssetUrl) throw new Error("Beetol requires an SDK app context");
  return {
    tabIconUrl: context.resolveAssetUrl("beetol/icons/hunt-beetle.png"),
    runtimeScheduler: context.scheduler,
    lifecycleSignal: context.signal || null,
    appSdkSendMessage: context.sendMessage || null,
    getLocal: <T extends Record<string, unknown>>(defaults: T) => context.storage!.local.get(defaults),
    setLocal: (values: Record<string, unknown>) => context.storage!.local.set(values),
    observeLocal: context.storage.local.onChanged,
  };
}
