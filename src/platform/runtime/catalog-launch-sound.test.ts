import { afterEach, expect, it, vi } from 'vitest';
import { playCatalogLaunchSound } from './catalog-launch-sound';
afterEach(() => vi.unstubAllGlobals());
it('retains the established launch level and applies the selected amplification without ignoring mute', () => {
  const gains: number[] = [];
  class Audio {
    currentTime = 0;
    destination = {};
    resume = async () => undefined;
    close = async () => undefined;
    createGain() { return { gain: { setValueAtTime: (value: number) => gains.push(value), exponentialRampToValueAtTime() {} }, connect() {} }; }
    createOscillator() { return { type: '', frequency: { setValueAtTime() {} }, connect() { return { connect() {} }; }, start() {}, stop() {} }; }
  }
  vi.stubGlobal('window', { AudioContext: Audio, setTimeout() {} });
  playCatalogLaunchSound(true, 1); const normal = gains[0];
  gains.length = 0; playCatalogLaunchSound(true, 2); expect(gains[0]).toBeCloseTo(normal! * 2);
  gains.length = 0; playCatalogLaunchSound(true, 10); expect(gains[0]).toBeCloseTo(normal! * 2);
  gains.length = 0; playCatalogLaunchSound(true, 0); playCatalogLaunchSound(false, 1); expect(gains).toEqual([]);
});
