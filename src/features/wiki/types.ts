export type WikiEntry = {
  label: string;
  pattern?: string;
  title: string;
  url: string;
  priority?: number;
  confidence?: number;
  requiresContext?: string[];
  blockContext?: string[];
  source?: MatchSource;
};

export type MatchSource = "local" | "curated" | "generated" | "section" | "pattern";

export type WikiMatch = WikiEntry & {
  start: number;
  end: number;
  text: string;
};

export type Settings = {
  enabled: boolean;
  previewsEnabled: boolean;
  debugMode: boolean;
  maxLinksPerPost: number;
  maxLowConfidenceLinksPerPost: number;
  linkColor: string;
};

export type LocalAlias = {
  id: string;
  label: string;
  title: string;
  url: string;
  createdAt: number;
};

export type LaterItem = {
  id: string;
  text: string;
  pageUrl?: string;
  createdAt: number;
};

export type TuningExport = {
  version: 1;
  exportedAt: string;
  aliases: LocalAlias[];
  denyTerms: string[];
  laterItems: LaterItem[];
};

export type PerformanceStats = {
  tweetsScanned: number;
  linksCreated: number;
  matchingMs: number;
  skippedWholeTweet: number;
  skippedLowConfidence: number;
  updatedAt: number;
};

export type PreviewData = {
  title: string;
  extract: string;
  url: string;
  thumbnail?: string;
  cachedAt: number;
};
