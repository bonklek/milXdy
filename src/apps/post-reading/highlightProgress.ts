export type HighlightProgressState = {
  status: string;
  chunkIndex: number;
  chunkStart: number | null;
  charIndex: number | null;
  hasSyncedBoundaries: boolean;
};

const BOUNDARY_STALL_MS = 420;
const LIVE_TICK_MS = 90;

export class HighlightProgressClock {
  private chunkKey = "";
  private chunkStartedAt = 0;
  private boundaryIndex: number | null = null;
  private boundaryObservedAt = 0;
  private lastResolvedIndex: number | null = null;
  private lastStatus = "idle";
  private pausedAt: number | null = null;

  observe(state: HighlightProgressState, now: number): void {
    const chunkKey = `${state.chunkIndex}:${state.chunkStart ?? -1}`;
    if (chunkKey !== this.chunkKey) {
      this.chunkKey = chunkKey;
      this.chunkStartedAt = now;
      this.boundaryIndex = state.charIndex;
      this.boundaryObservedAt = now;
      this.lastResolvedIndex = state.charIndex ?? state.chunkStart;
      this.lastStatus = state.status;
      this.pausedAt = state.status === "paused" ? now : null;
      return;
    }

    if (state.status === "paused" && this.lastStatus !== "paused") {
      this.pausedAt = now;
    } else if (state.status === "speaking" && this.lastStatus === "paused" && this.pausedAt !== null) {
      const pausedDuration = Math.max(0, now - this.pausedAt);
      this.chunkStartedAt += pausedDuration;
      this.boundaryObservedAt += pausedDuration;
      this.pausedAt = null;
    }
    this.lastStatus = state.status;

    if (state.charIndex !== null && state.charIndex !== this.boundaryIndex) {
      this.boundaryIndex = state.charIndex;
      this.boundaryObservedAt = now;
      this.lastResolvedIndex = state.charIndex;
    }
  }

  resolveIndex(state: HighlightProgressState, now: number, charsPerSecond: number, chunkEnd: number): number | null {
    if (state.chunkStart === null) return null;
    this.observe(state, now);
    const boundaryIndex = state.charIndex ?? this.boundaryIndex;
    if (state.status !== "speaking") {
      return this.lastResolvedIndex ?? boundaryIndex ?? state.chunkStart;
    }
    const boundaryAge = Math.max(0, now - this.boundaryObservedAt);
    if (state.hasSyncedBoundaries && boundaryIndex !== null && boundaryAge < BOUNDARY_STALL_MS) {
      this.lastResolvedIndex = boundaryIndex;
      return boundaryIndex ?? state.chunkStart;
    }

    // Give Web Speech a short opportunity to provide its first real boundary.
    // Without this grace period a queued/just-started utterance paints the
    // first token before the spoken author/prefix has reached post body text.
    if (boundaryIndex === null && now - this.chunkStartedAt < BOUNDARY_STALL_MS) return null;

    const anchorIndex = boundaryIndex ?? state.chunkStart;
    const anchorTime = boundaryIndex === null ? this.chunkStartedAt : this.boundaryObservedAt;
    const elapsedSeconds = Math.max(0, now - anchorTime) / 1000;
    const estimatedIndex = anchorIndex + Math.round(elapsedSeconds * Math.max(4, charsPerSecond));
    this.lastResolvedIndex = Math.min(chunkEnd, Math.max(state.chunkStart, estimatedIndex));
    return this.lastResolvedIndex;
  }

  nextUpdateDelay(state: HighlightProgressState, now: number): number | null {
    if (state.status !== "speaking" || state.chunkStart === null) return null;
    this.observe(state, now);
    if (!state.hasSyncedBoundaries || this.boundaryIndex === null) return LIVE_TICK_MS;
    const boundaryAge = Math.max(0, now - this.boundaryObservedAt);
    return boundaryAge < BOUNDARY_STALL_MS ? Math.max(1, BOUNDARY_STALL_MS - boundaryAge) : LIVE_TICK_MS;
  }

  reset(): void {
    this.chunkKey = "";
    this.chunkStartedAt = 0;
    this.boundaryIndex = null;
    this.boundaryObservedAt = 0;
    this.lastResolvedIndex = null;
    this.lastStatus = "idle";
    this.pausedAt = null;
  }
}
