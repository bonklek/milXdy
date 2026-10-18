import { expect, it, vi } from 'vitest';
import { markWikiFrameReady } from './frame-readiness';
it('clears fallback only for a current open embedded viewer handshake', () => {
  const viewer = { dataset: { slow: 'true' } as Record<string, string> }, clear = vi.fn();
  const state = { open: true, minimized: false, iframeLoaded: false, root: { querySelector: () => viewer } as unknown as HTMLElement };
  markWikiFrameReady(state, clear);
  expect(state.iframeLoaded).toBe(true); expect(viewer.dataset).toEqual({ loaded: 'true' }); expect(clear).toHaveBeenCalledOnce();
});
it('does not mark closed, minimized, or missing viewers as ready', () => {
  const clear = vi.fn();
  for (const value of [{ open: false, minimized: false }, { open: true, minimized: true }, { open: true, minimized: false }]) {
    const state = { ...value, iframeLoaded: false, root: null };
    markWikiFrameReady(state, clear); expect(state.iframeLoaded).toBe(false);
  }
  expect(clear).not.toHaveBeenCalled();
});
