export function playCatalogLaunchSound(enabled: boolean, volume: number, delay = 0): void {
  if (!enabled || volume <= 0) return;
  try {
    const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const context = new AudioCtor();
    void context.resume().catch(() => undefined);
    const now = context.currentTime + delay;
    const master = context.createGain();
    // Preserve the established level at 1, with the selected amplification up to 2.
    const selectedVolume = Math.min(2, Math.max(0, volume));
    master.gain.setValueAtTime(Math.max(0.0001, Math.min(0.702, Math.min(1, selectedVolume) * 1.035) * Math.max(1, selectedVolume)), now);
    master.connect(context.destination);
    const notes = [
      { frequency: 783.99, offset: 0, level: 0.38, release: 0.65 },
      { frequency: 987.77, offset: 0.13, level: 0.30, release: 0.55 },
      { frequency: 1174.66, offset: 0.27, level: 0.23, release: 0.27 },
    ];
    const partials = [
      { ratio: 1, level: 1 },
      { ratio: 2.01, level: 0.32 },
      { ratio: 3.44, level: 0.15 },
    ];
    for (const note of notes) {
      for (const partial of partials) {
        const oscillator = context.createOscillator();
        const envelope = context.createGain();
        const start = now + note.offset;
        const peak = Math.max(0.0001, note.level * partial.level);
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(note.frequency * partial.ratio, start);
        envelope.gain.setValueAtTime(0.0001, start);
        envelope.gain.exponentialRampToValueAtTime(peak, start + 0.009);
        envelope.gain.exponentialRampToValueAtTime(0.0001, start + note.release);
        oscillator.connect(envelope).connect(master);
        oscillator.start(start);
        oscillator.stop(start + note.release + 0.02);
      }
    }
    window.setTimeout(() => void context.close().catch(() => undefined), Math.ceil((delay + 1) * 1_000));
  } catch {
    // Audio restrictions must never block the catalog tab.
  }
}
