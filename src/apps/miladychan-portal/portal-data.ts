import type { BoardTheme, BoardSummary, ChanThread, ChanImage, PostDraft, WatchedThread } from "./portal-contract";

export const API_ROOT = "https://boards.miladychan.org";

export const DEFAULT_BOARDS = ["milady", "remilio", "a", "ai", "kpop", "pol", "v", "all"];

export const BOARD_THEME_BY_BOARD: Record<string, BoardTheme> = {
  milady: "tea",
  all: "tea",
  remilio: "yotsuba",
  a: "yots_b",
  pol: "yots_b",
  v: "yots_b",
  ai: "console",
  kpop: "moon",
};

export const FILE_TYPES = [
  "jpg", "png", "gif", "webm", "pdf", "svg", "mp4", "mp3", "ogg", "zip",
  "7z", "tar.gz", "tar.xz", "flac", "noFile", "txt", "webp", "rar", "cbz", "cbr",
] as const;

export function normalizeWatchedThreads(value: unknown): WatchedThread[] {
  const candidates = value && typeof value === "object" && Array.isArray((value as { threads?: unknown }).threads)
    ? (value as { threads: unknown[] }).threads
    : [];
  const seen = new Set<string>();
  return candidates.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const raw = candidate as Partial<WatchedThread>;
    const threadId = raw.threadId;
    if (typeof raw.board !== "string" || !DEFAULT_BOARDS.includes(raw.board) || !Number.isInteger(threadId) || threadId === undefined || threadId <= 0) return [];
    const key = `${raw.board}/${threadId}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{
      board: raw.board,
      threadId,
      title: typeof raw.title === "string" ? raw.title.slice(0, 200) : `No. ${threadId}`,
      watchedAt: Number.isFinite(raw.watchedAt) ? Number(raw.watchedAt) : 0,
      seenPostCount: nonNegativeInteger(raw.seenPostCount),
      latestPostCount: nonNegativeInteger(raw.latestPostCount),
    }];
  }).sort((left, right) => right.watchedAt - left.watchedAt);
}

export function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

export function nativeDestinationUrl(board: string, threadId: number | null): string {
  return threadId === null ? `${API_ROOT}/${board}/` : `${API_ROOT}/${board}/${threadId}`;
}

export function normalizeDrafts(value: unknown): PostDraft[] {
  if (Array.isArray(value)) return value.map(normalizeDraft).filter((draft): draft is PostDraft => draft !== null);
  if (value && typeof value === "object" && Array.isArray((value as { drafts?: unknown }).drafts)) {
    return (value as { drafts: unknown[] }).drafts.map(normalizeDraft).filter((draft): draft is PostDraft => draft !== null);
  }
  const legacyDraft = normalizeDraft(value);
  return legacyDraft ? [legacyDraft] : [];
}

export function normalizeDraft(value: unknown): PostDraft | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<PostDraft>;
  if (typeof raw.board !== "string" || !raw.board || typeof raw.body !== "string") return null;
  const candidateThreadId = raw.threadId;
  const threadId: number | null = candidateThreadId === null
    ? null
    : typeof candidateThreadId === "number" && Number.isInteger(candidateThreadId) && candidateThreadId > 0
      ? candidateThreadId
      : null;
  return {
    board: raw.board,
    threadId,
    name: typeof raw.name === "string" ? raw.name.slice(0, 100) : "milXdy",
    subject: typeof raw.subject === "string" ? raw.subject.slice(0, 200) : "",
    body: raw.body,
    updatedAt: Number.isFinite(raw.updatedAt) ? Number(raw.updatedAt) : 0,
  };
}

export function summarizeBoard(board: BoardSummary): BoardSummary {
  return {
    ...board,
    activeScore: board.threads.reduce((sum, thread) => sum + (thread.activity || 0), 0),
    connected: board.threads.reduce((sum, thread) => sum + (thread.connected || 0), 0),
    latestUpdate: Math.max(0, ...board.threads.map((thread) => thread.update_time || 0)),
  };
}

export function emptyBoard(id: string, title: string): BoardSummary {
  return { id, title, loading: false, error: "", threads: [], activeScore: 0, connected: 0, latestUpdate: 0 };
}

export function upsertBoard(boards: BoardSummary[], next: BoardSummary): BoardSummary[] {
  const found = boards.some((board) => board.id === next.id);
  return found ? boards.map((board) => board.id === next.id ? next : board) : [...boards, next];
}

export function sortThreads(threads: ChanThread[]): ChanThread[] {
  return [...threads].sort((a, b) => {
    const stickyDelta = Number(Boolean(b.sticky)) - Number(Boolean(a.sticky));
    if (stickyDelta) return stickyDelta;
    return (b.activity || 0) - (a.activity || 0)
      || (b.connected || 0) - (a.connected || 0)
      || (b.update_time || 0) - (a.update_time || 0);
  });
}

export function imageUrl(image: ChanImage | null | undefined, kind: "thumb" | "src"): string {
  if (!image?.sha1) return "";
  const type = kind === "thumb" ? image.thumb_type : image.file_type;
  const extension = fileExtension(type);
  if (!extension || extension === "noFile") return "";
  return `${API_ROOT}/assets/images/${kind}/${image.sha1}.${extension}`;
}

export function fileExtension(type: number | undefined): string {
  if (type === undefined || type < 0 || type >= FILE_TYPES.length) return "";
  return FILE_TYPES[type] || "";
}

export function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 160) || "No body";
}

export function relativeTime(seconds: number): string {
  if (!seconds) return "unknown";
  const delta = Math.max(0, Math.floor(Date.now() / 1000) - seconds);
  if (delta < 60) return "now";
  const minute = Math.floor(delta / 60);
  if (minute < 60) return `${minute}m`;
  const hour = Math.floor(minute / 60);
  if (hour < 24) return `${hour}h`;
  return `${Math.floor(hour / 24)}d`;
}

export function boardTheme(boardId: string): BoardTheme {
  return BOARD_THEME_BY_BOARD[boardId] || "tea";
}
