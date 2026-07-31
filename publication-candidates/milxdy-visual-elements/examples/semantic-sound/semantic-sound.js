const muted = document.querySelector("#muted");
const reducedSensory = document.querySelector("#reduced-sensory");
const volume = document.querySelector("#volume");
const confirmButton = document.querySelector("#confirm");
const status = document.querySelector("#sound-status");
let lastPlayedAt = 0;

function visibleConfirm(message) {
  status.textContent = message;
}

async function playConfirmTone() {
  visibleConfirm("Action confirmed");

  if (muted.checked) {
    visibleConfirm("Action confirmed · sound muted");
    return;
  }

  if (reducedSensory.checked) {
    visibleConfirm("Action confirmed · sensory effect suppressed");
    return;
  }

  const now = performance.now();
  if (now - lastPlayedAt < 400) {
    visibleConfirm("Action confirmed · repeated sound rate-limited");
    return;
  }
  lastPlayedAt = now;

  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextClass) {
    visibleConfirm("Action confirmed · sound unsupported");
    return;
  }

  try {
    const context = new AudioContextClass();
    await context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime;
    const level = Number(volume.value);

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(523.25, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(level, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.13);
    oscillator.addEventListener("ended", () => context.close(), { once: true });
  } catch {
    visibleConfirm("Action confirmed · browser blocked sound");
  }
}

confirmButton.addEventListener("click", playConfirmTone);
