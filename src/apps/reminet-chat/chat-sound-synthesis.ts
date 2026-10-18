export function playTone(context: AudioContext, start: number, frequencies: number[], step: number, type: OscillatorType, gainScale: number, volume: number): void {
  frequencies.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const when = start + index * step;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.08 * gainScale), when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + step);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(when);
    oscillator.stop(when + step + 0.02);
  });
}

export function playPokeTone(context: AudioContext, start: number, volume: number): void {
  const tap = context.createOscillator();
  const tapGain = context.createGain();
  tap.type = "square";
  tap.frequency.setValueAtTime(220, start);
  tapGain.gain.setValueAtTime(0.0001, start);
  tapGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.035), start + 0.006);
  tapGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.055);
  tap.connect(tapGain);
  tapGain.connect(context.destination);
  tap.start(start);
  tap.stop(start + 0.06);

  const chirp = context.createOscillator();
  const chirpGain = context.createGain();
  const chirpStart = start + 0.035;
  chirp.type = "triangle";
  chirp.frequency.setValueAtTime(740, chirpStart);
  chirp.frequency.exponentialRampToValueAtTime(1180, start + 0.18);
  chirpGain.gain.setValueAtTime(0.0001, chirpStart);
  chirpGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.025), chirpStart + 0.02);
  chirpGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
  chirp.connect(chirpGain);
  chirpGain.connect(context.destination);
  chirp.start(chirpStart);
  chirp.stop(start + 0.24);
}
