export type FilterMode = "off" | "milady" | "debug";
export type CardTheme = "full" | "no-premium" | "silver-only" | "off";

export interface ExtensionSettings {
  mode: FilterMode;
  whitelistHandles: string[];
  miladyListHandles: string[];
  includeRemiStatsBeetles: boolean;
  soundEnabled: boolean;
  showLevelBadge: boolean;
  cardTheme: CardTheme;
}

export interface DetectionStats {
  tweetsScanned: number;
  avatarsChecked: number;
  cacheHits: number;
  postsMatched: number;
  modelMatches: number;
  errors: number;
  lastMatchAt: string | null;
}

export type VerificationStatus = "unverified" | "verified" | "unknown";

export interface MatchedAccount {
  handle: string;
  displayName: string | null;
  postsMatched: number;
  postsLiked: number;
  lastMatchedAt: string | null;
  lastDetectionScore: number | null;
  caught: boolean;
  caughtAt: string | null;
  verificationStatus: VerificationStatus;
}

export type MatchedAccountMap = Record<string, MatchedAccount>;

export interface CollectedAvatar {
  normalizedUrl: string;
  originalUrl: string;
  handles: string[];
  displayNames: string[];
  sourceSurfaces: string[];
  seenCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  exampleProfileUrl: string | null;
  exampleNotificationUrl: string | null;
  exampleTweetUrl: string | null;
  heuristicMatch: boolean | null;
  heuristicSource: "onnx" | "remistats" | null;
  heuristicScore: number | null;
  heuristicTokenId: number | null;
  whitelisted: boolean;
}

export type CollectedAvatarMap = Record<string, CollectedAvatar>;

export interface PlayerStats {
  totalLikesGiven: number;
}

export interface ModelMetadata {
  architecture?: string;
  classNames?: string[];
  inputSize?: number;
  channels?: number;
  mean?: [number, number, number];
  std?: [number, number, number];
  positiveIndex?: number;
  collection?: string;
  generatedAt: string;
  threshold: number;
  inputLength?: number;
}

export interface DetectionResult {
  matched: boolean;
  source: "onnx" | "remistats" | null;
  score: number | null;
  tokenId: number | null;
  debugLabel?: string | null;
}

export interface WorkerRequest {
  id: string;
  tensor: number[];
  shape: [number, number, number, number];
}

export interface WorkerResponse {
  id: string;
  score?: number;
  error?: string;
}
