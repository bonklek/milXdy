type FrameState = { open: boolean; minimized: boolean; root: HTMLElement | null; iframeLoaded: boolean };
/** A content-script handshake, rather than an error document's load event, marks the embedded page ready. */
export function markWikiFrameReady(state: FrameState, clearLoadTimer: () => void): void {
  if (!state.open || state.minimized) return;
  const viewer = state.root?.querySelector<HTMLElement>('.milxdy-wiki-sidebar-viewer');
  if (!viewer) return;
  state.iframeLoaded = true;
  clearLoadTimer();
  viewer.dataset.loaded = 'true';
  delete viewer.dataset.slow;
}
