import type { OverlayDockSide } from "../../platform/overlay/dock";
import type { MusicSdkServices } from "./sdk-services";

type MusicLayoutState = {
  libraryMinimized: boolean;
  side: OverlayDockSide;
  x: number;
  width: number;
  height: number;
  topOffset: number;
  layoutReady: boolean;
};

type LoadMusicLayoutOptions = {
  services: MusicSdkServices;
  isCurrent(): boolean;
  state: MusicLayoutState;
  panelMinimums(): { minWidth: number; minHeight: number };
  applyLayout(): void;
  render(): void;
  restoreLayout(id: string, options: {
    side: OverlayDockSide;
    minWidth: number;
    minHeight: number;
    defaultWidth: number;
    defaultHeight: number;
    legacy: { width: number; height: number; topOffset: number };
  }): Promise<{ x?: number; width: number; height: number; topOffset: number }>;
  keys: { width: string; height: string; top: string; libraryMinimized: string };
};

/** Restores the host-owned panel state while keeping stale activations inert. */
export async function loadMusicLayoutSettings(options: LoadMusicLayoutOptions): Promise<void> {
  const { services, isCurrent, state, panelMinimums, applyLayout, render, restoreLayout, keys } = options;
  const stored = await services.readLocal({
    [keys.width]: undefined,
    [keys.height]: undefined,
    [keys.top]: undefined,
    [keys.libraryMinimized]: false,
  }).catch((): Record<string, unknown> => ({}));
  if (!isCurrent()) return;
  state.libraryMinimized = stored[keys.libraryMinimized] === true;
  const layout = await restoreLayout("music", {
    side: state.side,
    ...panelMinimums(),
    defaultWidth: state.width,
    defaultHeight: state.height,
    legacy: {
      width: Number(stored[keys.width]),
      height: Number(stored[keys.height]),
      topOffset: Number(stored[keys.top]),
    },
  });
  if (!isCurrent()) return;
  state.x = layout.x ?? state.x;
  state.width = layout.width;
  state.height = layout.height;
  state.topOffset = layout.topOffset;
  state.layoutReady = true;
  applyLayout();
  render();
}
