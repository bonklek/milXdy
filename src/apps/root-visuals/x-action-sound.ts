let postSoundContext: AudioContext | null = null;
export function disposeXActionSound(): void { postSoundContext?.close?.().catch(() => undefined); postSoundContext = null; }
export function playXActionSound(volumeScale = 1): void {
  if (volumeScale <= 0) return;
  const audioWindow = window as Window & typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioContextCtor = audioWindow.AudioContext || audioWindow.webkitAudioContext;
  if (!AudioContextCtor) return;
  const context = postSoundContext ?? new AudioContextCtor();
  postSoundContext = context;
  if (context.state === "suspended") void context.resume().catch(() => undefined);
  const start = context.currentTime + 0.005;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.035 * volumeScale, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
  gain.connect(context.destination);

  const first = context.createOscillator();
  first.type = "square";
  first.frequency.setValueAtTime(660, start);
  first.frequency.exponentialRampToValueAtTime(880, start + 0.08);
  first.connect(gain);
  first.start(start);
  first.stop(start + 0.11);

  const second = context.createOscillator();
  second.type = "triangle";
  second.frequency.setValueAtTime(1320, start + 0.055);
  second.connect(gain);
  second.start(start + 0.055);
  second.stop(start + 0.18);
}
