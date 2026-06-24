// Reminet Sound Engine - Converted from useSounds.ts
// Lightweight Web Audio engine for extension sounds

let audioCtx = null;
let compressor = null;
let reverb = null;
let delayNode = null;

async function ensureContext() {
  if (typeof window === 'undefined') return;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();

      // Master dynamics
      compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 24;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;

      // Tiny room reverb impulse
      reverb = audioCtx.createConvolver();
      reverb.buffer = createSmallImpulse(audioCtx);

      // Short slapback delay
      delayNode = audioCtx.createDelay(0.5);
      delayNode.delayTime.value = 0.12;

      // Wire buses
      reverb.connect(compressor);
      delayNode.connect(compressor);
      compressor.connect(audioCtx.destination);
    } catch (e) {
      // Silently fail if AudioContext creation fails (autoplay policy)
      console.log('AudioContext creation skipped:', e.message);
      return;
    }
  }
  // Don't try to resume automatically - it will fail without user gesture
  // The first user interaction will trigger resume
}

function createSmallImpulse(ctx) {
  const length = Math.floor(ctx.sampleRate * 0.18);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const fade = Math.pow(1 - i / length, 3);
      data[i] = (Math.random() * 2 - 1) * fade * 0.6;
    }
  }
  return impulse;
}

function createOscillator(freq, type = 'sine') {
  const osc = audioCtx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  return osc;
}

function gain(value = 1) {
  const g = audioCtx.createGain();
  g.gain.value = value;
  return g;
}

function connectToMix(node, { withReverb = true, withDelay = false } = {}) {
  if (compressor) node.connect(compressor);
  if (withReverb && reverb) node.connect(reverb);
  if (withDelay && delayNode) node.connect(delayNode);
}

// Sound playback functions
async function playHoverSound(variation) {
  try {
    await ensureContext();
    if (!audioCtx) return;
    
    // Try to resume context on user interaction
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume().catch(() => {});
    }
    
    const now = audioCtx.currentTime;
    const base = 440; // A4
    const semitones = [0, 2, -2, 5]; // simple 4-step cycle
    const v = ((variation % 4) + 4) % 4;
    const freq = base * Math.pow(2, semitones[v] / 12);
    const o = createOscillator(freq, 'triangle');
    const g = gain(0);
    o.connect(g);
    connectToMix(g, { withReverb: true });
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.08, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    o.start(now);
    o.stop(now + 0.17);
  } catch (e) {
    // Silently ignore AudioContext errors (autoplay policy)
  }
}

async function playClickSound() {
  try {
    await ensureContext();
    if (!audioCtx) return;
    
    // Try to resume context on user interaction
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume().catch(() => {});
    }
    
    const now = audioCtx.currentTime;
    const o1 = createOscillator(523.25, 'square');
    const o2 = createOscillator(659.25, 'square');
    const g = gain(0);
    o1.connect(g); o2.connect(g);
    connectToMix(g, { withReverb: false, withDelay: false });
    g.gain.setValueAtTime(0.1, now);
    g.gain.setValueAtTime(0.0, now + 0.04);
    g.gain.setValueAtTime(0.1, now + 0.05);
    g.gain.setValueAtTime(0.0, now + 0.09);
    o1.start(now); o1.stop(now + 0.04);
    o2.start(now + 0.05); o2.stop(now + 0.09);
  } catch (e) {
    // Silently ignore AudioContext errors (autoplay policy)
  }
}

async function playMenuOpenSound() {
  try {
    await ensureContext();
    if (!audioCtx) return;
    
    // Try to resume context on user interaction
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume().catch(() => {});
    }
    
    const now = audioCtx.currentTime;
    const freqs = [261.63, 329.63, 392, 523.25];
    const bus = gain(0.25);
    connectToMix(bus, { withReverb: true });
    freqs.forEach((f, i) => {
      const o = createOscillator(f, 'sine');
      const g = gain(0);
      const t = now + i * 0.03;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.08, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g); g.connect(bus);
      o.start(t); o.stop(t + 0.3);
    });
  } catch (e) {
    // Silently ignore AudioContext errors (autoplay policy)
  }
}

async function playSuccessSound() {
  try {
    await ensureContext();
    if (!audioCtx) return;
    
    // Try to resume context on user interaction
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume().catch(() => {});
    }
    
    const now = audioCtx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.5];
    const bus = gain(0.3);
    connectToMix(bus, { withReverb: true });
    freqs.forEach((f, i) => {
      const o = createOscillator(f, 'sine');
      const g = gain(0);
      const t = now + i * 0.05;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.1, t + 0.02);
      g.gain.setValueAtTime(0.1, t + 0.1);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      o.connect(g); g.connect(bus);
      o.start(t); o.stop(t + 0.5);
    });
  } catch (e) {
    // Silently ignore AudioContext errors (autoplay policy)
  }
}

async function playNotificationSound() {
  try {
    await ensureContext();
    if (!audioCtx) return;
    
    // Try to resume context on user interaction
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume().catch(() => {});
    }
    
    const now = audioCtx.currentTime;
    const freqs = [1318.51, 1567.98];
    const bus = gain(0.18);
    connectToMix(bus, { withReverb: true });
    freqs.forEach((f, i) => {
      const o = createOscillator(f, 'sine');
      const g = gain(0);
      const t = now + i * 0.1;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.connect(g); g.connect(bus);
      o.start(t); o.stop(t + 0.2);
    });
  } catch (e) {
    // Silently ignore AudioContext errors (autoplay policy)
  }
}

async function playPokeSound() {
  try {
    await ensureContext();
    if (!audioCtx) return;

    if (audioCtx.state === 'suspended') {
      await audioCtx.resume().catch(() => {});
    }

    const now = audioCtx.currentTime;
    const bus = gain(0.22);
    connectToMix(bus, { withReverb: true, withDelay: true });

    const tap = createOscillator(220, 'square');
    const tapGain = gain(0);
    tap.connect(tapGain);
    tapGain.connect(bus);
    tapGain.gain.setValueAtTime(0, now);
    tapGain.gain.linearRampToValueAtTime(0.16, now + 0.006);
    tapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    tap.start(now);
    tap.stop(now + 0.06);

    const chirp = createOscillator(740, 'triangle');
    const chirpGain = gain(0);
    chirp.connect(chirpGain);
    chirpGain.connect(bus);
    chirp.frequency.setValueAtTime(740, now + 0.035);
    chirp.frequency.exponentialRampToValueAtTime(1180, now + 0.18);
    chirpGain.gain.setValueAtTime(0, now + 0.035);
    chirpGain.gain.linearRampToValueAtTime(0.1, now + 0.055);
    chirpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    chirp.start(now + 0.035);
    chirp.stop(now + 0.24);
  } catch (e) {
    // Silently ignore AudioContext errors (autoplay policy)
  }
}

// Main sound manager
class SoundManager {
  constructor() {
    this.hoverVariation = 0;
    this.lastHoverTime = 0;
    this.logoHoverVariation = 0;
    this.lastLogoHoverTime = 0;
    this.cooldowns = new Map();
    this.enabled = true;
    this.volume = 1.0;

    this.loadSettings();
  }

  async loadSettings() {
    const settings = await chrome.storage.sync.get(['soundsEnabled', 'soundVolume']);
    this.enabled = settings.soundsEnabled !== false; // Default to true
    this.volume = settings.soundVolume || 1.0;
  }

  canPlaySound(type, cooldownMs) {
    if (!this.enabled) return false;
    const now = Date.now();
    const last = this.cooldowns.get(type) || 0;
    if (now - last < cooldownMs) return false;
    this.cooldowns.set(type, now);
    return true;
  }
  
  async updateSettings() {
    await this.loadSettings();
  }

  async playHover() {
    if (!this.canPlaySound('HOVER', 100)) return;
    const e = Date.now();
    this.hoverVariation = (e - this.lastHoverTime > 1000) ? 0 : (this.hoverVariation + 1) % 4;
    this.lastHoverTime = e;
    await playHoverSound(this.hoverVariation);
  }

  async playClick() {
    if (!this.enabled) return;
    await playClickSound();
  }

  async playMenuOpen() {
    if (!this.enabled) return;
    await playMenuOpenSound();
  }

  async playSuccess() {
    if (!this.enabled) return;
    await playSuccessSound();
  }

  async playNotification() {
    if (!this.enabled) return;
    await playNotificationSound();
  }

  async playPoke() {
    if (!this.canPlaySound('POKE', 180)) return;
    await playPokeSound();
  }

  async playLogoHover() {
    if (!this.enabled) return;
    await ensureContext();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume().catch(() => {});
    }

    const now = audioCtx.currentTime;
    const e = Date.now();
    this.logoHoverVariation = (e - this.lastLogoHoverTime > 1000) ? 0 : (this.logoHoverVariation + 1) % 12;
    this.lastLogoHoverTime = e;

    const variationSemitone = ((this.logoHoverVariation % 12) + 12) % 12;
    const baseFreq = 523.25 * Math.pow(2, variationSemitone / 12);
    const freqs = [
      baseFreq, baseFreq * 1.25, baseFreq * 1.5, baseFreq * 1.875,
      baseFreq * 2.25, baseFreq * 2, baseFreq * 2.5, baseFreq * 3, baseFreq * 4,
    ];

    const bus = gain(0.25);
    connectToMix(bus, { withReverb: true });

    freqs.forEach((f, idx) => {
      const t = now + idx * 0.056;
      const osc = createOscillator(f, 'sine');
      const amp = audioCtx.createGain();
      const attack = 0.003;
      const shape = 0.035;
      const sustainScale = 0.3;
      const end = 0.56 - idx * 0.035;
      let peak = 0.12;
      if (idx === 0 || idx === 5) peak = 0.15;
      if (idx > 6) peak = 0.08;

      amp.gain.setValueAtTime(0, t);
      amp.gain.linearRampToValueAtTime(peak, t + attack);
      amp.gain.exponentialRampToValueAtTime(peak * sustainScale, t + attack + shape);
      amp.gain.exponentialRampToValueAtTime(0.001, t + end);

      osc.connect(amp);
      amp.connect(bus);
      osc.start(t);
      osc.stop(t + end);
    });
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    chrome.storage.sync.set({ soundsEnabled: enabled });
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    chrome.storage.sync.set({ soundVolume: this.volume });
  }
}

// Global sound manager instance
window.reminetSounds = new SoundManager();

