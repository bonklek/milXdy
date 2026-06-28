export type AutoplayMode = "visible" | "autoscroll";
export type BodyHighlightMode = "off" | "word" | "smooth";
export type ButtonPlacement = "auto" | "top" | "actions";
export type FullQuoteDisplay = "hidden" | "expand" | "scroll";
export type PlayerPosition = "top-right" | "bottom-right" | "top-left" | "bottom-left";
export type TtsEngineChoice = "web-speech" | "custom-http";
export type CustomTtsTimingMode = "off" | "engine";

export type PostReadingSettings = {
  enabled: boolean;
  speed: number;
  volume: number;
  voiceURI: string | null;
  autoVoice: boolean;
  ttsEngine: TtsEngineChoice;
  customTtsEndpoint: string | null;
  customTtsTimingMode: CustomTtsTimingMode;
  autoplayNext: boolean;
  autoplayMode: AutoplayMode;
  skipPromotedPosts: boolean;
  endOfTweetDing: boolean;
  includeQuotes: boolean;
  fetchFullQuotes: boolean;
  fullQuoteDisplay: FullQuoteDisplay;
  includeHyperlinks: boolean;
  includeImageAltText: boolean;
  includeImageOcr: boolean;
  includeLinkPreviews: boolean;
  expandShowMore: boolean;
  wikiAutoScroll: boolean;
  activeTweetHighlight: boolean;
  bodyHighlightMode: BodyHighlightMode;
  playerPosition: PlayerPosition;
  buttonPlacement: ButtonPlacement;
  useHandles: boolean;
  keyNextTweet: string;
  keyPreviousTweet: string;
  keyNextChunk: string;
  keyPreviousChunk: string;
  keySkipOcr: string;
  keyPlayPause: string;
};

export type ReadableQuote = {
  authorDisplayName: string;
  text: string;
  url: string | null;
};

export type ReadablePost = {
  authorDisplayName: string;
  text: string;
  url: string | null;
  quote: ReadableQuote | null;
  imageDescriptions: string[];
  imageTexts: string[];
  linkPreviews: string[];
  pollOptions: string[];
};

export type SpeechStatus = "idle" | "speaking" | "paused" | "error";

export type SpeechState = {
  status: SpeechStatus;
  title: string;
  text: string;
  error: string | null;
  chunkIndex: number;
  chunkCount: number;
  chunkStart: number | null;
  charIndex: number | null;
  charLength: number | null;
  boundaryElapsedTime: number | null;
  hasSyncedBoundaries: boolean;
};
