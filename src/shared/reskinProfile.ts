export type ReskinProfile = "max" | "moderate" | "min";

export const RESKIN_PROFILE_KEY = "milxdy.settings.reskinProfile";
export const VISUAL_THEME_KEY = "milxdy.settings.visualTheme";
export const VISUAL_CUSTOM_THEMES_KEY = "milxdy.settings.visualCustomThemes";
export const DEFAULT_RESKIN_PROFILE: ReskinProfile = "moderate";

export type VisualThemeSettings = {
  profile: ReskinProfile;
  tweetFont: "twitter" | "hei" | "mincho" | "menlo";
  uiFont: "hei" | "menlo" | "system";
  backgroundFade: boolean;
  squareMedia: boolean;
  pfpShape: "circle" | "rounded-square" | "square";
  pfpFeed: boolean;
  pfpNotifications: boolean;
  pfpChat: boolean;
  quoteMediaGap: boolean;
  appWindowStyle: "reminet" | "classic";
  appShadows: boolean;
  maxMediaHeight: number;
  postButtonClickly: boolean;
  postSound: boolean;
  sidebarBevel: boolean;
  sidebarSound: boolean;
  newPostsPill: boolean;
  newPostsSound: boolean;
  notificationUnreadTint: boolean;
  remistatsBox: boolean;
  incomingPokeGold: boolean;
  pokePlacement: "top" | "actions";
  reminetChatOverlay: boolean;
  miladyOnly: boolean;
  disableMaxxer: boolean;
  disableSelfTracking: boolean;
  maxxerIntensity: "subtle" | "marked" | "card";
  maxxerSeparators: "subtle" | "beveled" | "none";
  maxxerShimmer: boolean;
  tweetPngIncludeImages: boolean;
  tweetPngIncludeQuoteText: boolean;
  tweetPngIncludeQuoteImages: boolean;
  tweetPngShrinkTallImages: boolean;
  tweetPngIncludeDate: boolean;
  tweetPngIncludeStats: boolean;
  tweetPngBorder: boolean;
  tweetPngBorderPalette: "purple" | "gray" | "blue" | "green";
};

export type SavedVisualTheme = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  settings: VisualThemeSettings;
};

export type ProfileAudioSettings = {
  miladySoundEnabled: boolean;
  remistatsSoundsEnabled: boolean;
  remistatsSoundVolume: number;
  postReadingEndOfTweetDing: boolean;
};

export const DEFAULT_VISUAL_THEME: VisualThemeSettings = {
  profile: DEFAULT_RESKIN_PROFILE,
  tweetFont: "twitter",
  uiFont: "hei",
  backgroundFade: true,
  squareMedia: true,
  pfpShape: "rounded-square",
  pfpFeed: true,
  pfpNotifications: true,
  pfpChat: true,
  quoteMediaGap: false,
  appWindowStyle: "reminet",
  appShadows: true,
  maxMediaHeight: 520,
  postButtonClickly: true,
  postSound: true,
  sidebarBevel: false,
  sidebarSound: false,
  newPostsPill: true,
  newPostsSound: true,
  notificationUnreadTint: true,
  remistatsBox: false,
  incomingPokeGold: true,
  pokePlacement: "actions",
  reminetChatOverlay: false,
  miladyOnly: false,
  disableMaxxer: false,
  disableSelfTracking: false,
  maxxerIntensity: "marked",
  maxxerSeparators: "subtle",
  maxxerShimmer: true,
  tweetPngIncludeImages: true,
  tweetPngIncludeQuoteText: true,
  tweetPngIncludeQuoteImages: true,
  tweetPngShrinkTallImages: true,
  tweetPngIncludeDate: true,
  tweetPngIncludeStats: true,
  tweetPngBorder: true,
  tweetPngBorderPalette: "purple",
};

export const VISUAL_PRESETS: Record<ReskinProfile, VisualThemeSettings> = {
  max: {
    ...DEFAULT_VISUAL_THEME,
    profile: "max",
    tweetFont: "hei",
    uiFont: "hei",
    backgroundFade: true,
    squareMedia: true,
    pfpShape: "rounded-square",
    pfpFeed: true,
    pfpNotifications: true,
    pfpChat: true,
    quoteMediaGap: false,
    appWindowStyle: "reminet",
    appShadows: true,
    maxMediaHeight: 480,
    postButtonClickly: true,
    postSound: true,
    sidebarBevel: true,
    sidebarSound: true,
    newPostsPill: true,
    newPostsSound: true,
    notificationUnreadTint: true,
    remistatsBox: false,
    incomingPokeGold: true,
    pokePlacement: "actions",
    reminetChatOverlay: true,
    miladyOnly: false,
    disableMaxxer: false,
    disableSelfTracking: false,
    maxxerIntensity: "card",
    maxxerSeparators: "beveled",
    maxxerShimmer: true,
    tweetPngIncludeImages: true,
    tweetPngIncludeQuoteText: true,
    tweetPngIncludeQuoteImages: true,
    tweetPngShrinkTallImages: true,
    tweetPngIncludeDate: true,
    tweetPngIncludeStats: true,
    tweetPngBorder: true,
    tweetPngBorderPalette: "purple",
  },
  moderate: {
    ...DEFAULT_VISUAL_THEME,
    profile: "moderate",
    tweetFont: "mincho",
    uiFont: "hei",
    backgroundFade: true,
    squareMedia: true,
    pfpShape: "rounded-square",
    pfpFeed: true,
    pfpNotifications: true,
    pfpChat: false,
    quoteMediaGap: true,
    appWindowStyle: "reminet",
    appShadows: true,
    maxMediaHeight: 560,
    postButtonClickly: true,
    postSound: false,
    sidebarBevel: false,
    sidebarSound: false,
    newPostsPill: true,
    newPostsSound: false,
    notificationUnreadTint: true,
    remistatsBox: false,
    incomingPokeGold: true,
    pokePlacement: "actions",
    reminetChatOverlay: false,
    miladyOnly: false,
    disableMaxxer: false,
    disableSelfTracking: false,
    maxxerIntensity: "marked",
    maxxerSeparators: "subtle",
    maxxerShimmer: false,
    tweetPngIncludeImages: true,
    tweetPngIncludeQuoteText: true,
    tweetPngIncludeQuoteImages: true,
    tweetPngShrinkTallImages: true,
    tweetPngIncludeDate: true,
    tweetPngIncludeStats: true,
    tweetPngBorder: true,
    tweetPngBorderPalette: "purple",
  },
  min: {
    ...DEFAULT_VISUAL_THEME,
    profile: "min",
    tweetFont: "twitter",
    uiFont: "system",
    backgroundFade: false,
    squareMedia: false,
    pfpShape: "circle",
    pfpFeed: false,
    pfpNotifications: false,
    pfpChat: false,
    quoteMediaGap: true,
    appWindowStyle: "reminet",
    appShadows: false,
    maxMediaHeight: 0,
    postButtonClickly: false,
    postSound: false,
    sidebarBevel: false,
    sidebarSound: false,
    newPostsPill: false,
    newPostsSound: false,
    notificationUnreadTint: false,
    remistatsBox: false,
    incomingPokeGold: false,
    pokePlacement: "actions",
    reminetChatOverlay: false,
    miladyOnly: false,
    disableMaxxer: false,
    disableSelfTracking: false,
    maxxerIntensity: "subtle",
    maxxerSeparators: "none",
    maxxerShimmer: false,
    tweetPngIncludeImages: true,
    tweetPngIncludeQuoteText: true,
    tweetPngIncludeQuoteImages: true,
    tweetPngShrinkTallImages: true,
    tweetPngIncludeDate: true,
    tweetPngIncludeStats: true,
    tweetPngBorder: false,
    tweetPngBorderPalette: "gray",
  },
};

export const PROFILE_AUDIO_PRESETS: Record<ReskinProfile, ProfileAudioSettings> = {
  max: {
    miladySoundEnabled: true,
    remistatsSoundsEnabled: true,
    remistatsSoundVolume: 0.75,
    postReadingEndOfTweetDing: true,
  },
  moderate: {
    miladySoundEnabled: true,
    remistatsSoundsEnabled: true,
    remistatsSoundVolume: 0.55,
    postReadingEndOfTweetDing: false,
  },
  min: {
    miladySoundEnabled: false,
    remistatsSoundsEnabled: false,
    remistatsSoundVolume: 0.4,
    postReadingEndOfTweetDing: false,
  },
};

export function normalizeReskinProfile(value: unknown): ReskinProfile {
  return value === "max" || value === "moderate" || value === "min"
    ? value
    : DEFAULT_RESKIN_PROFILE;
}

export function normalizeVisualTheme(value: unknown, profileFallback: ReskinProfile = DEFAULT_RESKIN_PROFILE): VisualThemeSettings {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const profile = normalizeReskinProfile(record.profile ?? profileFallback);
  const fallback = VISUAL_PRESETS[profile];
  return {
    profile,
    tweetFont: oneOf(record.tweetFont, ["twitter", "hei", "mincho", "menlo"], fallback.tweetFont),
    uiFont: oneOf(record.uiFont, ["hei", "menlo", "system"], fallback.uiFont),
    backgroundFade: booleanValue(record.backgroundFade, fallback.backgroundFade),
    squareMedia: booleanValue(record.squareMedia, fallback.squareMedia),
    pfpShape: oneOf(record.pfpShape, ["circle", "rounded-square", "square"], fallback.pfpShape),
    pfpFeed: booleanValue(record.pfpFeed, fallback.pfpFeed),
    pfpNotifications: booleanValue(record.pfpNotifications, fallback.pfpNotifications),
    pfpChat: booleanValue(record.pfpChat, fallback.pfpChat),
    quoteMediaGap: booleanValue(record.quoteMediaGap, fallback.quoteMediaGap),
    appWindowStyle: oneOf(record.appWindowStyle, ["reminet", "classic"], fallback.appWindowStyle),
    appShadows: booleanValue(record.appShadows, fallback.appShadows),
    maxMediaHeight: numberValue(record.maxMediaHeight, fallback.maxMediaHeight, 0, 1200),
    postButtonClickly: booleanValue(record.postButtonClickly, fallback.postButtonClickly),
    postSound: booleanValue(record.postSound, fallback.postSound),
    sidebarBevel: booleanValue(record.sidebarBevel, fallback.sidebarBevel),
    sidebarSound: booleanValue(record.sidebarSound, fallback.sidebarSound),
    newPostsPill: booleanValue(record.newPostsPill, fallback.newPostsPill),
    newPostsSound: booleanValue(record.newPostsSound, fallback.newPostsSound),
    notificationUnreadTint: booleanValue(record.notificationUnreadTint, fallback.notificationUnreadTint),
    remistatsBox: booleanValue(record.remistatsBox, fallback.remistatsBox),
    incomingPokeGold: booleanValue(record.incomingPokeGold, fallback.incomingPokeGold),
    pokePlacement: oneOf(record.pokePlacement, ["top", "actions"], fallback.pokePlacement),
    reminetChatOverlay: booleanValue(record.reminetChatOverlay, fallback.reminetChatOverlay),
    miladyOnly: booleanValue(record.miladyOnly, fallback.miladyOnly),
    disableMaxxer: booleanValue(record.disableMaxxer, fallback.disableMaxxer),
    disableSelfTracking: booleanValue(record.disableSelfTracking, fallback.disableSelfTracking),
    maxxerIntensity: oneOf(record.maxxerIntensity, ["subtle", "marked", "card"], fallback.maxxerIntensity),
    maxxerSeparators: oneOf(record.maxxerSeparators, ["subtle", "beveled", "none"], fallback.maxxerSeparators),
    maxxerShimmer: booleanValue(record.maxxerShimmer, fallback.maxxerShimmer),
    tweetPngIncludeImages: booleanValue(record.tweetPngIncludeImages, fallback.tweetPngIncludeImages),
    tweetPngIncludeQuoteText: booleanValue(record.tweetPngIncludeQuoteText, fallback.tweetPngIncludeQuoteText),
    tweetPngIncludeQuoteImages: booleanValue(record.tweetPngIncludeQuoteImages, fallback.tweetPngIncludeQuoteImages),
    tweetPngShrinkTallImages: booleanValue(record.tweetPngShrinkTallImages, fallback.tweetPngShrinkTallImages),
    tweetPngIncludeDate: booleanValue(record.tweetPngIncludeDate, fallback.tweetPngIncludeDate),
    tweetPngIncludeStats: booleanValue(record.tweetPngIncludeStats, fallback.tweetPngIncludeStats),
    tweetPngBorder: booleanValue(record.tweetPngBorder, fallback.tweetPngBorder),
    tweetPngBorderPalette: oneOf(record.tweetPngBorderPalette, ["purple", "gray", "blue", "green"], fallback.tweetPngBorderPalette),
  };
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function numberValue(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}
