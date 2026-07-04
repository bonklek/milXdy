export function getLevel(postsLiked: number): number {
  return Math.floor(Math.sqrt(postsLiked));
}

export interface LevelProgress {
  level: number;
  current: number;
  needed: number;
}

// Player XP: same polynomial but 3x slower (3 likes = level 1, 12 = level 2, etc.)
export function getPlayerLevel(totalLikesGiven: number): number {
  if (totalLikesGiven <= 0) return 0;
  if (totalLikesGiven >= 1 && totalLikesGiven < 3) return 1;
  return Math.floor(Math.sqrt(totalLikesGiven / 3)) + 1;
}

export function getPlayerLevelProgress(totalLikesGiven: number): LevelProgress {
  const likes = Math.max(0, totalLikesGiven);
  const level = getPlayerLevel(likes);
  if (level === 0) return { level: 0, current: 0, needed: 1 };
  if (level === 1) {
    return { level: 1, current: likes, needed: 3 };
  }
  const adjustedLevel = level - 1;
  const currentThreshold = 3 * adjustedLevel * adjustedLevel;
  const nextThreshold = 3 * (adjustedLevel + 1) * (adjustedLevel + 1);
  const raw = likes - currentThreshold;
  const span = nextThreshold - currentThreshold;
  return {
    level,
    current: raw === 0 && likes > 0 ? 1 : raw,
    needed: span,
  };
}

export function getLevelProgress(postsLiked: number): LevelProgress {
  const level = getLevel(postsLiked);
  const currentThreshold = level * level;
  const nextThreshold = (level + 1) * (level + 1);
  const raw = postsLiked - currentThreshold;
  const span = nextThreshold - currentThreshold;
  return {
    level,
    current: raw === 0 && postsLiked > 0 ? 1 : raw,
    needed: span,
  };
}
