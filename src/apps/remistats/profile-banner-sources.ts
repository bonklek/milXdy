export type BannerMode = "original" | "shelf" | "nft";
export type BannerSettings = Record<BannerMode, boolean>;
export const BANNER_SETTING_DEFAULTS = {
  "milxdy.remistats.banners.nft": true,
  "milxdy.remistats.banners.shelf": true,
  "milxdy.remistats.banners.original": true,
};
export function readBannerSettings(stored: Record<string, unknown>): BannerSettings {
  return {
    nft: stored["milxdy.remistats.banners.nft"] !== false,
    shelf: stored["milxdy.remistats.banners.shelf"] !== false,
    original: stored["milxdy.remistats.banners.original"] !== false,
  };
}
export function enabledBannerModes(settings: BannerSettings, current?: string): BannerMode[] {
  const order: BannerMode[] = current === undefined ? ["shelf", "original", "nft"] : ["original", "shelf", "nft"];
  const start = current === undefined ? 0 : (order.indexOf(current as BannerMode) + 1) % order.length;
  return [...order.slice(start), ...order.slice(0, start)].filter(mode => settings[mode]);
}
export type BannerSelection<Nft> = { mode: BannerMode | "blank"; url?: string; nft?: Nft };
export async function selectProfileBanner<Nft extends { displayUrl: string }>(
  modes: BannerMode[],
  renderShelf: () => Promise<string | null>,
  loadNft: () => Promise<Nft>,
): Promise<BannerSelection<Nft>> {
  for (const mode of modes) {
    try {
      if (mode === "original") return { mode };
      if (mode === "shelf") {
        const url = await renderShelf();
        if (url) return { mode, url };
      } else {
        const nft = await loadNft();
        return { mode, url: nft.displayUrl, nft };
      }
    } catch { /* Try the next enabled source if an image cannot be loaded. */ }
  }
  return { mode: "blank" };
}

export function updateBannerSettings(settings: BannerSettings, changes: Record<string, { newValue?: unknown }>): BannerSettings {
  return Object.fromEntries((['original', 'shelf', 'nft'] as const).map(mode => {
    const key = `milxdy.remistats.banners.${mode}`;
    return [mode, changes[key] ? changes[key].newValue !== false : settings[mode]];
  })) as BannerSettings;
}
