import { setOverlayAppStackOrder } from "./app-layout";
import { OverlayDockController } from "./dock-controller";
import { ChromeDockPersistence } from "./dock-persistence";
import type { OverlayDockApi } from "./dock-types";
import { OverlayDockDomView } from "./dock-view";

export type {
  OverlayDockItem,
  OverlayDockRegistration,
  OverlayDockSettingsAction,
  OverlayDockSettingsOptions,
  OverlayDockSide,
} from "./dock-types";

const globalKey = "__milxdyOverlayDock";

export function getOverlayDock(): OverlayDockApi {
  const host = window as unknown as Record<string, OverlayDockApi | undefined>;
  host[globalKey] ||= new OverlayDockController({
    persistence: new ChromeDockPersistence(),
    view: new OverlayDockDomView(),
    setStackOrder: setOverlayAppStackOrder,
  });
  return host[globalKey];
}
