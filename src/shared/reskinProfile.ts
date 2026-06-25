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
  postButtonClickly: boolean;
  postSound: boolean;
  sidebarBevel: boolean;
  sidebarSound: boolean;
  newPostsPill: boolean;
  newPostsSound: boolean;
  notificationUnreadTint: boolean;
  remistatsBox: boolean;
  pokePlacement: "top" | "actions";
  reminetChatOverlay: boolean;
  miladyOnly: boolean;
  disableSelfTracking: boolean;
  maxxerIntensity: "subtle" | "marked" | "card";
  maxxerSeparators: "subtle" | "beveled" | "none";
  maxxerShimmer: boolean;
};

export type SavedVisualTheme = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  settings: VisualThemeSettings;
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
  postButtonClickly: true,
  postSound: true,
  sidebarBevel: false,
  sidebarSound: false,
  newPostsPill: true,
  newPostsSound: true,
  notificationUnreadTint: true,
  remistatsBox: false,
  pokePlacement: "actions",
  reminetChatOverlay: false,
  miladyOnly: false,
  disableSelfTracking: false,
  maxxerIntensity: "marked",
  maxxerSeparators: "subtle",
  maxxerShimmer: true,
};

export const VISUAL_PRESETS: Record<ReskinProfile, VisualThemeSettings> = {
  max: {
    ...DEFAULT_VISUAL_THEME,
    profile: "max",
    backgroundFade: true,
    squareMedia: true,
    pfpShape: "rounded-square",
    pfpFeed: true,
    pfpNotifications: true,
    pfpChat: true,
    quoteMediaGap: false,
    postButtonClickly: true,
    postSound: true,
    sidebarBevel: false,
    sidebarSound: false,
    newPostsPill: true,
    newPostsSound: true,
    notificationUnreadTint: true,
    remistatsBox: false,
    pokePlacement: "actions",
    reminetChatOverlay: false,
    miladyOnly: false,
    disableSelfTracking: false,
    maxxerIntensity: "marked",
    maxxerSeparators: "subtle",
    maxxerShimmer: true,
  },
  moderate: {
    ...DEFAULT_VISUAL_THEME,
    profile: "moderate",
    backgroundFade: false,
    squareMedia: false,
    pfpShape: "circle",
    pfpFeed: true,
    pfpNotifications: true,
    pfpChat: true,
    quoteMediaGap: true,
    postButtonClickly: false,
    postSound: false,
    sidebarBevel: false,
    sidebarSound: false,
    newPostsPill: false,
    newPostsSound: false,
    notificationUnreadTint: true,
    remistatsBox: false,
    pokePlacement: "top",
    reminetChatOverlay: false,
    miladyOnly: false,
    disableSelfTracking: false,
    maxxerIntensity: "subtle",
    maxxerSeparators: "subtle",
    maxxerShimmer: false,
  },
  min: {
    ...DEFAULT_VISUAL_THEME,
    profile: "min",
    backgroundFade: false,
    squareMedia: false,
    pfpShape: "circle",
    pfpFeed: false,
    pfpNotifications: false,
    pfpChat: false,
    quoteMediaGap: true,
    postButtonClickly: false,
    postSound: false,
    sidebarBevel: false,
    sidebarSound: false,
    newPostsPill: false,
    newPostsSound: false,
    notificationUnreadTint: false,
    remistatsBox: false,
    pokePlacement: "top",
    reminetChatOverlay: false,
    miladyOnly: false,
    disableSelfTracking: false,
    maxxerIntensity: "subtle",
    maxxerSeparators: "none",
    maxxerShimmer: false,
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
    postButtonClickly: booleanValue(record.postButtonClickly, fallback.postButtonClickly),
    postSound: booleanValue(record.postSound, fallback.postSound),
    sidebarBevel: booleanValue(record.sidebarBevel, fallback.sidebarBevel),
    sidebarSound: booleanValue(record.sidebarSound, fallback.sidebarSound),
    newPostsPill: booleanValue(record.newPostsPill, fallback.newPostsPill),
    newPostsSound: booleanValue(record.newPostsSound, fallback.newPostsSound),
    notificationUnreadTint: booleanValue(record.notificationUnreadTint, fallback.notificationUnreadTint),
    remistatsBox: booleanValue(record.remistatsBox, fallback.remistatsBox),
    pokePlacement: oneOf(record.pokePlacement, ["top", "actions"], fallback.pokePlacement),
    reminetChatOverlay: booleanValue(record.reminetChatOverlay, fallback.reminetChatOverlay),
    miladyOnly: booleanValue(record.miladyOnly, fallback.miladyOnly),
    disableSelfTracking: booleanValue(record.disableSelfTracking, fallback.disableSelfTracking),
    maxxerIntensity: oneOf(record.maxxerIntensity, ["subtle", "marked", "card"], fallback.maxxerIntensity),
    maxxerSeparators: oneOf(record.maxxerSeparators, ["subtle", "beveled", "none"], fallback.maxxerSeparators),
    maxxerShimmer: booleanValue(record.maxxerShimmer, fallback.maxxerShimmer),
  };
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}
