import type {
  CollectedAvatarMap,
  DetectionStats,
  ExtensionSettings,
  MatchedAccountMap,
  PlayerStats,
} from "./types";

export const DEFAULT_SETTINGS: ExtensionSettings = {
  mode: "milady",
  whitelistHandles: [],
  miladyListHandles: [],
  includeRemiStatsBeetles: true,
  soundEnabled: true,
  showLevelBadge: true,
  cardTheme: "full" as const,
};

export const DEFAULT_STATS: DetectionStats = {
  tweetsScanned: 0,
  avatarsChecked: 0,
  cacheHits: 0,
  postsMatched: 0,
  modelMatches: 0,
  errors: 0,
  lastMatchAt: null,
};

export const DEFAULT_MATCHED_ACCOUNTS: MatchedAccountMap = {};
export const DEFAULT_COLLECTED_AVATARS: CollectedAvatarMap = {};
export const DEFAULT_PLAYER_STATS: PlayerStats = { totalLikesGiven: 0 };

export const CLASSIFIER_MODEL_INPUT_SIZE = 128;
export const CLASSIFIER_MODEL_CHANNELS = 3;
export const CLASSIFIER_MODEL_MEAN: [number, number, number] = [0.485, 0.456, 0.406];
export const CLASSIFIER_MODEL_STD: [number, number, number] = [0.229, 0.224, 0.225];
export const CLASSIFIER_MODEL_METADATA_URL = "generated/milady-mobilenetv3-small.meta.json";
export const CLASSIFIER_MODEL_URL = "models/milady-mobilenetv3-small.onnx";
