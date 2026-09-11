import type { OverlayAppFrame } from "../../platform/overlay/app-frame";
import type { OverlayDockSide } from "../../platform/overlay/dock";

export type BoardInfo = {
  id: string;
  title: string;
};

export type ChanUser = {
  displayname?: string;
  username?: string;
  pfpUrl?: string;
};

export type ChanImage = {
  spoiler?: boolean;
  audio?: boolean;
  video?: boolean;
  file_type: number;
  thumb_type: number;
  dims?: number[];
  size?: number;
  sha1: string;
  name?: string;
};

export type ChanPost = {
  id: number;
  time: number;
  body: string;
  name?: string;
  image?: ChanImage | null;
  user?: ChanUser | null;
  op?: number;
  board?: string;
};

export type ChanThread = ChanPost & {
  abbrev?: boolean;
  sticky?: boolean;
  locked?: boolean;
  post_count: number;
  image_count: number;
  update_time: number;
  bump_time: number;
  subject: string;
  board: string;
  activity?: number;
  connected?: number;
  unique_posters?: number;
  posts?: ChanPost[] | null;
};

export type BoardPayload = {
  pages?: number;
  threads: ChanThread[];
};

export type BoardSummary = BoardInfo & {
  loading: boolean;
  error: string;
  threads: ChanThread[];
  activeScore: number;
  connected: number;
  latestUpdate: number;
};

export type ViewMode = "boards" | "threads" | "thread";

export type BoardTheme = "tea" | "yotsuba" | "yots_b" | "console" | "moon";

export type PostDraft = {
  board: string;
  threadId: number | null;
  name: string;
  subject: string;
  body: string;
  updatedAt: number;
};

export type WatchedThread = {
  board: string;
  threadId: number;
  title: string;
  watchedAt: number;
  seenPostCount: number | null;
  latestPostCount: number | null;
};

export type SpotlightState = {
  root: HTMLElement | null;
  appFrame: OverlayAppFrame | null;
  open: boolean;
  minimized: boolean;
  loadingBoards: boolean;
  loadingThreads: boolean;
  loadingThread: boolean;
  error: string;
  boards: BoardSummary[];
  selectedBoard: string;
  selectedThread: ChanThread | null;
  view: ViewMode;
  side: OverlayDockSide;
  x: number;
  width: number;
  height: number;
  topOffset: number;
  theme: "light" | "dark" | "system";
  lastLoadedAt: number;
  layoutReady: boolean;
  drafts: PostDraft[];
  watchedThreads: WatchedThread[];
  draftNotice: string;
};
