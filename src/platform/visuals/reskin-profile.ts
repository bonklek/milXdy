export type ReskinProfile = "max" | "moderate" | "min";
export type AppWindowStyle = "native" | "reminet" | "classic";

export const RESKIN_PROFILE_KEY = "milxdy.settings.reskinProfile";
export const VISUAL_THEME_KEY = "milxdy.settings.visualTheme";
export const VISUAL_CUSTOM_THEMES_KEY = "milxdy.settings.visualCustomThemes";
export const DEFAULT_RESKIN_PROFILE: ReskinProfile = "moderate";

export type VisualThemeSettings = {
  profile: ReskinProfile;
  tweetFont: "twitter" | "hei" | "mincho" | "menlo";
  uiFont: "twitter" | "hei" | "menlo" | "system";
  backgroundFade: boolean;
  useRemiliaProfileColor: boolean;
  mediaAdvanced: boolean;
  pfpRounding: number;
  mediaRounding: number;
  quoteSpacing: number;
  squareMedia: boolean;
  pfpShape: "circle" | "rounded-square" | "square";
  pfpFeed: boolean;
  pfpNotifications: boolean;
  pfpChat: boolean;
  quoteMediaGap: boolean;
  appWindowStyle: AppWindowStyle;
  appShadows: boolean;
  maxMediaHeight: number;
  postButtonClickly: boolean;
  postSound: boolean;
  sidebarBevel: boolean;
  sidebarSound: boolean;
  newPostsPill: boolean;
  newPostsSound: boolean;
  notificationUnreadTint: boolean;
  hideMessageRequestDot: boolean;
  hideBoostButton: boolean;
  remistatsBox: boolean;
  incomingPokeGold: boolean;
  reminetChatOverlay: boolean;
  pokePlacement: "top" | "actions";
  miladyOnly: boolean;
  disableMaxxer: boolean;
  disableSelfTracking: boolean;
  maxxerIntensity: "subtle" | "marked" | "card";
  maxxerSeparators: "subtle" | "beveled" | "none";
  maxxerShimmer: boolean;
  tweetPngIncludeDisplayName: boolean;
  tweetPngIncludeHandle: boolean;
  tweetPngIncludeImages: boolean;
  tweetPngIncludeQuoteText: boolean;
  tweetPngIncludeQuoteImages: boolean;
  tweetPngShrinkTallImages: boolean;
  tweetPngIncludeDate: boolean;
  tweetPngIncludeWatermark: boolean;
  tweetPngIncludeStats: boolean;
  tweetPngBorder: boolean;
  tweetPngBorderPalette: "purple" | "gray" | "blue" | "green" | `#${string}`;
  interfaceAccentColor: string;
  tweetPngBackgroundColor: string;
  tweetPngFontColor: string;
};

export type VisualThemeControlOwner = "root-visuals" | "app-chrome" | "tweet-png" | "reminet" | "maxxer";

export type VisualThemeControlGroup = {
  id: string;
  label: string;
  owner: VisualThemeControlOwner;
  scope: "global-x" | "global-app-chrome" | "feature-mirror" | "app-mirror";
  profilePackSafe: true;
  settings: readonly (keyof VisualThemeSettings)[];
};

export const VISUAL_THEME_CONTROL_GROUPS: readonly VisualThemeControlGroup[] = [
  {
    id: "root-page-type",
    label: "X page and typography",
    owner: "root-visuals",
    scope: "global-x",
    profilePackSafe: true,
    settings: ["profile", "tweetFont", "uiFont", "backgroundFade", "useRemiliaProfileColor", "interfaceAccentColor"],
  },
  {
    id: "root-avatars-media",
    label: "PFPs, media, and cards",
    owner: "root-visuals",
    scope: "global-x",
    profilePackSafe: true,
    settings: ["mediaAdvanced", "pfpRounding", "mediaRounding", "quoteSpacing", "pfpShape", "pfpFeed", "pfpNotifications", "pfpChat", "squareMedia", "quoteMediaGap", "maxMediaHeight"],
  },
  {
    id: "root-notifications",
    label: "X notifications",
    owner: "root-visuals",
    scope: "global-x",
    profilePackSafe: true,
    settings: ["notificationUnreadTint", "hideMessageRequestDot"],
  },
  {
    id: "root-navigation-actions",
    label: "X navigation and actions",
    owner: "root-visuals",
    scope: "global-x",
    profilePackSafe: true,
    settings: [
      "hideBoostButton",
      "postButtonClickly",
      "postSound",
      "sidebarBevel",
      "sidebarSound",
      "newPostsPill",
      "newPostsSound",
    ],
  },
  {
    id: "app-chrome",
    label: "App chrome",
    owner: "app-chrome",
    scope: "global-app-chrome",
    profilePackSafe: true,
    settings: ["appWindowStyle", "appShadows"],
  },
  {
    id: "tweet-png",
    label: "Tweet PNG mirror",
    owner: "tweet-png",
    scope: "feature-mirror",
    profilePackSafe: true,
    settings: [
      "tweetPngIncludeDisplayName",
      "tweetPngIncludeHandle",
      "tweetPngIncludeImages",
      "tweetPngIncludeQuoteText",
      "tweetPngIncludeQuoteImages",
      "tweetPngShrinkTallImages",
      "tweetPngIncludeDate",
      "tweetPngIncludeWatermark",
      "tweetPngIncludeStats",
      "tweetPngBorder",
      "tweetPngBorderPalette",
      "tweetPngBackgroundColor",
      "tweetPngFontColor",
    ],
  },
  {
    id: "reminet-appearance",
    label: "RemiStats and poke mirrors",
    owner: "reminet",
    scope: "feature-mirror",
    profilePackSafe: true,
    settings: ["remistatsBox", "incomingPokeGold", "pokePlacement"],
  },
  {
    id: "maxxer-visuals",
    label: "Maxxer visual mirror",
    owner: "maxxer",
    scope: "app-mirror",
    profilePackSafe: true,
    settings: ["miladyOnly", "disableMaxxer", "disableSelfTracking", "maxxerIntensity", "maxxerSeparators", "maxxerShimmer"],
  },
] as const;

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
  remistatsLikeAutoPoke: boolean;
  postReadingEndOfTweetDing: boolean;
};

export const DEFAULT_VISUAL_THEME: VisualThemeSettings = {
  profile: DEFAULT_RESKIN_PROFILE,
  tweetFont: "twitter",
  uiFont: "twitter",
  useRemiliaProfileColor: true,
  backgroundFade: true,
  mediaAdvanced: false,
  squareMedia: true, mediaRounding: 0,
  pfpShape: "rounded-square", pfpRounding: 25,
  pfpFeed: true,
  pfpNotifications: true,
  pfpChat: true,
  quoteMediaGap: false, quoteSpacing: 0,
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
  hideMessageRequestDot: false,
  hideBoostButton: true,
  remistatsBox: false,
  incomingPokeGold: true,
  reminetChatOverlay: false,
  pokePlacement: "actions",
  miladyOnly: false,
  disableMaxxer: false,
  disableSelfTracking: false,
  maxxerIntensity: "marked",
  maxxerSeparators: "subtle",
  maxxerShimmer: true,
  tweetPngIncludeDisplayName: true,
  tweetPngIncludeHandle: true,
  tweetPngIncludeImages: true,
  tweetPngIncludeQuoteText: true,
  tweetPngIncludeQuoteImages: true,
  tweetPngShrinkTallImages: true,
  tweetPngIncludeDate: true,
  tweetPngIncludeWatermark: true,
  tweetPngIncludeStats: true,
  tweetPngBorder: true,
  interfaceAccentColor: "",
  tweetPngBorderPalette: "purple",
  tweetPngBackgroundColor: "#fffaff",
  tweetPngFontColor: "#20122f",
};

export const VISUAL_PRESETS: Record<ReskinProfile, VisualThemeSettings> = {
  max: {
    ...DEFAULT_VISUAL_THEME,
    profile: "max",
    tweetFont: "hei",
    uiFont: "twitter",
    backgroundFade: true,
    squareMedia: true, mediaRounding: 0,
    pfpShape: "rounded-square", pfpRounding: 25,
    pfpFeed: true,
    pfpNotifications: true,
    pfpChat: true,
    quoteMediaGap: false, quoteSpacing: 0,
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
    reminetChatOverlay: false,
    pokePlacement: "actions",
    miladyOnly: false,
    disableMaxxer: false,
    disableSelfTracking: false,
    maxxerIntensity: "card",
    maxxerSeparators: "beveled",
    maxxerShimmer: true,
    tweetPngIncludeDisplayName: true,
    tweetPngIncludeHandle: true,
    tweetPngIncludeImages: true,
    tweetPngIncludeQuoteText: true,
    tweetPngIncludeQuoteImages: true,
    tweetPngShrinkTallImages: true,
    tweetPngIncludeDate: true,
    tweetPngIncludeWatermark: true,
    tweetPngIncludeStats: true,
    tweetPngBorder: true,
    interfaceAccentColor: "",
    tweetPngBorderPalette: "purple",
    tweetPngBackgroundColor: "#fffaff",
    tweetPngFontColor: "#20122f",
  },
  moderate: {
    ...DEFAULT_VISUAL_THEME,
    profile: "moderate",
    tweetFont: "twitter",
    uiFont: "twitter",
    backgroundFade: true,
    squareMedia: true, mediaRounding: 0,
    pfpShape: "rounded-square", pfpRounding: 25,
    pfpFeed: true,
    pfpNotifications: true,
    pfpChat: false,
    quoteMediaGap: true, quoteSpacing: 12,
    appWindowStyle: "reminet",
    appShadows: true,
    maxMediaHeight: 560,
    postButtonClickly: true,
    postSound: true,
    sidebarBevel: false,
    sidebarSound: false,
    newPostsPill: true,
    newPostsSound: false,
    notificationUnreadTint: true,
    remistatsBox: false,
    incomingPokeGold: true,
    reminetChatOverlay: false,
    pokePlacement: "actions",
    miladyOnly: false,
    disableMaxxer: false,
    disableSelfTracking: false,
    maxxerIntensity: "marked",
    maxxerSeparators: "subtle",
    maxxerShimmer: false,
    tweetPngIncludeDisplayName: true,
    tweetPngIncludeHandle: true,
    tweetPngIncludeImages: true,
    tweetPngIncludeQuoteText: true,
    tweetPngIncludeQuoteImages: true,
    tweetPngShrinkTallImages: true,
    tweetPngIncludeDate: true,
    tweetPngIncludeWatermark: true,
    tweetPngIncludeStats: true,
    tweetPngBorder: true,
    interfaceAccentColor: "",
    tweetPngBorderPalette: "purple",
    tweetPngBackgroundColor: "#fffaff",
    tweetPngFontColor: "#20122f",
  },
  min: {
    ...DEFAULT_VISUAL_THEME,
    profile: "min",
    tweetFont: "twitter",
    uiFont: "twitter",
    backgroundFade: false,
    squareMedia: false, mediaRounding: 16,
    pfpShape: "circle", pfpRounding: 100,
    pfpFeed: false,
    pfpNotifications: false,
    pfpChat: false,
    quoteMediaGap: true, quoteSpacing: 12,
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
    reminetChatOverlay: false,
    pokePlacement: "actions",
    miladyOnly: false,
    disableMaxxer: false,
    disableSelfTracking: false,
    maxxerIntensity: "subtle",
    maxxerSeparators: "none",
    maxxerShimmer: false,
    tweetPngIncludeDisplayName: true,
    tweetPngIncludeHandle: true,
    tweetPngIncludeImages: true,
    tweetPngIncludeQuoteText: true,
    tweetPngIncludeQuoteImages: true,
    tweetPngShrinkTallImages: true,
    tweetPngIncludeDate: true,
    tweetPngIncludeWatermark: true,
    tweetPngIncludeStats: true,
    tweetPngBorder: false,
    interfaceAccentColor: "",
    tweetPngBorderPalette: "gray",
    tweetPngBackgroundColor: "#fffaff",
    tweetPngFontColor: "#20122f",
  },
};

export const PROFILE_AUDIO_PRESETS: Record<ReskinProfile, ProfileAudioSettings> = {
  max: {
    miladySoundEnabled: true,
    remistatsSoundsEnabled: true,
    remistatsSoundVolume: 0.75,
    remistatsLikeAutoPoke: true,
    postReadingEndOfTweetDing: true,
  },
  moderate: {
    miladySoundEnabled: true,
    remistatsSoundsEnabled: true,
    remistatsSoundVolume: 0.55,
    remistatsLikeAutoPoke: true,
    postReadingEndOfTweetDing: false,
  },
  min: {
    miladySoundEnabled: false,
    remistatsSoundsEnabled: false,
    remistatsSoundVolume: 0.4,
    remistatsLikeAutoPoke: false,
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
    uiFont: oneOf(record.uiFont, ["twitter", "hei", "menlo", "system"], fallback.uiFont),
    backgroundFade: booleanValue(record.backgroundFade, fallback.backgroundFade),
    useRemiliaProfileColor: booleanValue(record.useRemiliaProfileColor, true),
    mediaAdvanced: booleanValue(record.mediaAdvanced, false),
    pfpRounding: numberValue(record.pfpRounding, (record.pfpShape ?? fallback.pfpShape) === "circle" ? 100 : (record.pfpShape ?? fallback.pfpShape) === "square" ? 0 : 25, 0, 100),
    mediaRounding: numberValue(record.mediaRounding, booleanValue(record.squareMedia, fallback.squareMedia) ? 0 : 16, 0, 100),
    quoteSpacing: numberValue(record.quoteSpacing, booleanValue(record.quoteMediaGap, fallback.quoteMediaGap) ? 12 : 0, 0, 32),
    squareMedia: booleanValue(record.squareMedia, fallback.squareMedia),
    pfpShape: oneOf(record.pfpShape, ["circle", "rounded-square", "square"], fallback.pfpShape),
    pfpFeed: booleanValue(record.pfpFeed, fallback.pfpFeed),
    pfpNotifications: booleanValue(record.pfpNotifications, fallback.pfpNotifications),
    pfpChat: booleanValue(record.pfpChat, fallback.pfpChat),
    quoteMediaGap: booleanValue(record.quoteMediaGap, fallback.quoteMediaGap),
    appWindowStyle: oneOf(record.appWindowStyle, ["native", "reminet", "classic"], fallback.appWindowStyle),
    appShadows: booleanValue(record.appShadows, fallback.appShadows),
    maxMediaHeight: numberValue(record.maxMediaHeight, fallback.maxMediaHeight, 0, 1200),
    postButtonClickly: booleanValue(record.postButtonClickly, fallback.postButtonClickly),
    postSound: booleanValue(record.postSound, fallback.postSound),
    sidebarBevel: booleanValue(record.sidebarBevel, fallback.sidebarBevel),
    sidebarSound: booleanValue(record.sidebarSound, fallback.sidebarSound),
    newPostsPill: booleanValue(record.newPostsPill, fallback.newPostsPill),
    newPostsSound: booleanValue(record.newPostsSound, fallback.newPostsSound),
    notificationUnreadTint: booleanValue(record.notificationUnreadTint, fallback.notificationUnreadTint),
    hideMessageRequestDot: booleanValue(record.hideMessageRequestDot, fallback.hideMessageRequestDot),
    hideBoostButton: booleanValue(record.hideBoostButton, fallback.hideBoostButton),
    remistatsBox: booleanValue(record.remistatsBox, fallback.remistatsBox),
    incomingPokeGold: booleanValue(record.incomingPokeGold, fallback.incomingPokeGold),
    reminetChatOverlay: booleanValue(record.reminetChatOverlay, fallback.reminetChatOverlay),
    pokePlacement: oneOf(record.pokePlacement, ["top", "actions"], fallback.pokePlacement),
    miladyOnly: booleanValue(record.miladyOnly, fallback.miladyOnly),
    disableMaxxer: booleanValue(record.disableMaxxer, fallback.disableMaxxer),
    disableSelfTracking: booleanValue(record.disableSelfTracking, fallback.disableSelfTracking),
    maxxerIntensity: oneOf(record.maxxerIntensity, ["subtle", "marked", "card"], fallback.maxxerIntensity),
    maxxerSeparators: oneOf(record.maxxerSeparators, ["subtle", "beveled", "none"], fallback.maxxerSeparators),
    maxxerShimmer: booleanValue(record.maxxerShimmer, fallback.maxxerShimmer),
    tweetPngIncludeDisplayName: booleanValue(record.tweetPngIncludeDisplayName, fallback.tweetPngIncludeDisplayName),
    tweetPngIncludeHandle: booleanValue(record.tweetPngIncludeHandle, fallback.tweetPngIncludeHandle),
    tweetPngIncludeImages: booleanValue(record.tweetPngIncludeImages, fallback.tweetPngIncludeImages),
    tweetPngIncludeQuoteText: booleanValue(record.tweetPngIncludeQuoteText, fallback.tweetPngIncludeQuoteText),
    tweetPngIncludeQuoteImages: booleanValue(record.tweetPngIncludeQuoteImages, fallback.tweetPngIncludeQuoteImages),
    tweetPngShrinkTallImages: booleanValue(record.tweetPngShrinkTallImages, fallback.tweetPngShrinkTallImages),
    tweetPngIncludeDate: booleanValue(record.tweetPngIncludeDate, fallback.tweetPngIncludeDate),
    tweetPngIncludeWatermark: booleanValue(record.tweetPngIncludeWatermark, fallback.tweetPngIncludeWatermark),
    tweetPngIncludeStats: booleanValue(record.tweetPngIncludeStats, fallback.tweetPngIncludeStats),
    tweetPngBorder: booleanValue(record.tweetPngBorder, fallback.tweetPngBorder),
    interfaceAccentColor: typeof record.interfaceAccentColor === "string" && /^#[0-9a-f]{6}$/i.test(record.interfaceAccentColor) ? record.interfaceAccentColor.toLowerCase() : "",
    tweetPngBorderPalette: typeof record.tweetPngBorderPalette === "string" && /^#[0-9a-f]{6}$/i.test(record.tweetPngBorderPalette)
      ? record.tweetPngBorderPalette.toLowerCase() as `#${string}`
      : oneOf(record.tweetPngBorderPalette, ["purple", "gray", "blue", "green"], fallback.tweetPngBorderPalette),
    tweetPngBackgroundColor: colorValue(record.tweetPngBackgroundColor, fallback.tweetPngBackgroundColor),
    tweetPngFontColor: colorValue(record.tweetPngFontColor, fallback.tweetPngFontColor),
  };
}

function colorValue(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
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

/** Sanitized profile personalization shared by settings and Full X appearance. */
export const REMILIA_PROFILE_ACCENT_KEY = "milxdy.remilia.profileAccent";
export function remiliaHueAccent(hue: unknown): string {
  if (typeof hue !== "number" || !Number.isFinite(hue)) return "";
  const h = ((hue % 360) + 360) % 360;
  const s = .55, l = .45, a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}
export function resolveXProfileAccent(theme: VisualThemeSettings, accent: unknown): string {
  const profileColor = typeof accent === "string" && /^#[0-9a-f]{6}$/i.test(accent) ? accent : "";
  return theme.profile === "max" ? (theme.useRemiliaProfileColor ? profileColor : "") || theme.interfaceAccentColor
    : "";
}
