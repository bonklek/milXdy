let audioContext: AudioContext | null = null;
let master: GainNode | null = null;

export async function playEndDing(volume: number): Promise<void> {
  try {
    const ctx = await ensureAudioContext();
    if (!ctx || !master) return;
    if (ctx.state === "suspended") await ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    const first = ctx.createOscillator();
    const second = ctx.createOscillator();
    first.type = "triangle";
    second.type = "sine";
    first.frequency.setValueAtTime(659.25, now);
    second.frequency.setValueAtTime(987.77, now + 0.055);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12 * Math.max(0, Math.min(1, volume)), now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    first.connect(gain);
    second.connect(gain);
    gain.connect(master);
    first.start(now);
    first.stop(now + 0.16);
    second.start(now + 0.055);
    second.stop(now + 0.32);
  } catch {
    // Audio is best-effort; Chrome may block context resume until user gesture.
  }
}

async function ensureAudioContext(): Promise<AudioContext | null> {
  if (audioContext) return audioContext;
  const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;
  audioContext = new AudioCtor();
  master = audioContext.createGain();
  master.gain.value = 0.8;
  master.connect(audioContext.destination);
  return audioContext;
}
