export type PlaybackHistoryTarget = {
  trackId: string;
  cursor: number;
};

export class PlaybackHistoryTracker {
  private entries: string[] = [];
  private cursor = -1;

  constructor(private readonly limit = 256) {}

  record(trackId: string): void {
    if (!trackId || this.entries[this.cursor] === trackId) return;
    if (this.cursor < this.entries.length - 1) this.entries.splice(this.cursor + 1);
    this.entries.push(trackId);
    if (this.entries.length > this.limit) this.entries.splice(0, this.entries.length - this.limit);
    this.cursor = this.entries.length - 1;
  }

  peek(offset: -1 | 1): PlaybackHistoryTarget | null {
    const cursor = this.cursor + offset;
    const trackId = this.entries[cursor];
    return typeof trackId === "string" ? { trackId, cursor } : null;
  }

  commit(cursor: number): void {
    if (cursor >= 0 && cursor < this.entries.length) this.cursor = cursor;
  }

  remove(trackIds: Iterable<string>): void {
    const removed = new Set(trackIds);
    if (!removed.size) return;
    const currentTrackId = this.entries[this.cursor] || null;
    this.entries = this.entries.filter((trackId) => !removed.has(trackId));
    this.cursor = currentTrackId
      ? this.entries.lastIndexOf(currentTrackId)
      : Math.min(this.cursor, this.entries.length - 1);
    if (this.cursor < 0 && this.entries.length) this.cursor = 0;
  }

  clear(): void {
    this.entries = [];
    this.cursor = -1;
  }
}
