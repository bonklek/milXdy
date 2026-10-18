import { afterEach, expect, it, vi } from 'vitest';
import { createSoundManager } from './sounds.js';
afterEach(() => vi.unstubAllGlobals());
it('applies live sound controls without new storage listeners or write feedback', async () => {
  const changed = vi.fn(), write = vi.fn();
  vi.stubGlobal('chrome', { storage: { sync: { get: async () => ({ soundVolume: 0.6 }), set: write }, onChanged: { addListener: changed } } });
  const manager = createSoundManager(); await Promise.resolve();
  expect(changed).not.toHaveBeenCalled();
  manager.applySettings({ soundsEnabled: { newValue: false }, soundVolume: { newValue: 2 } });
  expect(manager.enabled).toBe(false); expect(manager.volume).toBe(2);
  manager.applySettings({ soundsEnabled: { newValue: true }, soundVolume: { newValue: -1 } });
  expect(manager.enabled).toBe(true); expect(manager.volume).toBe(0);
  expect(write).not.toHaveBeenCalled();
});
it('does not overwrite newer live controls with a delayed initial storage snapshot', async () => {
  let finish!: (value: Record<string, unknown>) => void;
  vi.stubGlobal('chrome', { storage: { sync: { get: () => new Promise(resolve => { finish = resolve; }) } } });
  const manager = createSoundManager();
  manager.applySettings({ soundsEnabled: { newValue: false }, soundVolume: { newValue: 2 } });
  finish({ soundsEnabled: true, soundVolume: 0.6 }); await Promise.resolve();
  expect(manager.enabled).toBe(false); expect(manager.volume).toBe(2);
});
it('still applies untouched fields and tolerates unavailable initial storage', async () => {
  let finish!: (value: Record<string, unknown>) => void;
  vi.stubGlobal('chrome', { storage: { sync: { get: () => new Promise(resolve => { finish = resolve; }) } } });
  const manager = createSoundManager(); manager.applySettings({ soundVolume: { newValue: 2 } });
  finish({ soundsEnabled: false, soundVolume: 0.6 }); await Promise.resolve();
  expect(manager.enabled).toBe(false); expect(manager.volume).toBe(2);
  vi.stubGlobal('chrome', { storage: { sync: { get: async () => { throw new Error('unavailable'); } } } });
  const unavailable = createSoundManager(); await Promise.resolve();
  expect(unavailable.enabled).toBe(true); expect(unavailable.volume).toBe(0.6);
});
