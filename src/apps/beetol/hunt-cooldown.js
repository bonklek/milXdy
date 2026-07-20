export const BEETLE_HUNT_COOLDOWN_MS = 90 * 60 * 1000;

export function beetleHuntCooldownFromUser(user, now = Date.now()) {
  const huntsUsed = Number(user?.beetleHuntsUsed);
  const lastHuntAt = normalizeServerTimestamp(user?.lastBeetleHuntDate);
  if (!Number.isFinite(huntsUsed) || huntsUsed < 3 || lastHuntAt <= 0) return 0;
  return Math.max(0, lastHuntAt + BEETLE_HUNT_COOLDOWN_MS - now);
}

export function beetleHuntChargesFromUser(user, now = Date.now()) {
  const huntsUsed = Number(user?.beetleHuntsUsed);
  if (!Number.isFinite(huntsUsed) || huntsUsed < 0) return null;
  if (huntsUsed < 3) return Math.max(0, 3 - Math.floor(huntsUsed));
  return beetleHuntCooldownFromUser(user, now) > 0 ? 0 : 3;
}

function normalizeServerTimestamp(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
}
