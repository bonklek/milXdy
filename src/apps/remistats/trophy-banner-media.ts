import { legacyBeetleTrophyShelfUrl } from "../beetol/legacy-beetle-actions";
type Trophy = {
    id?: string | number;
    icon?: string;
};
type ShelfTrophy = {
    slot: number;
    icon: string;
};
type TrophyProfile = {
    trophyShelves?: unknown;
    allTrophies?: unknown;
};
type RuntimeResponse = {
    ok?: boolean;
    profile?: TrophyProfile;
};
type Dependencies = {
    baseUrl: string;
    cleanUsername: (value: unknown) => string;
    send: (message: object, type: string) => Promise<unknown>;
};
type CacheEntry = {
    url: string;
    touchedAt: number;
};
export type TrophyBannerMedia = {
    render: (username: string) => Promise<string | null>;
    dispose: () => void;
};
export function createTrophyBannerMedia(deps: Dependencies): TrophyBannerMedia {
    const cache = new Map<string, CacheEntry>();
    const pending = new Map<string, Promise<string | null>>();
    return { render: (username) => renderBanner(username, deps, cache, pending), dispose: () => disposeCache(cache) };
}
async function renderBanner(username: string, deps: Dependencies, cache: Map<string, CacheEntry>, pending: Map<string, Promise<string | null>>): Promise<string | null> {
    const clean = deps.cleanUsername(username);
    if (!clean)
        return null;
    const key = clean.toLowerCase();
    const cached = cache.get(key);
    if (cached) {
        cached.touchedAt = Date.now();
        return cached.url;
    }
    const existing = pending.get(key);
    if (existing)
        return existing;
    const task = buildBanner(clean, deps, cache).finally(() => pending.delete(key));
    pending.set(key, task);
    return task;
}
async function buildBanner(username: string, deps: Dependencies, cache: Map<string, CacheEntry>): Promise<string | null> {
    const shelfUrl = legacyBeetleTrophyShelfUrl(username, deps.baseUrl);
    if (!shelfUrl)
        return null;
    const trophies = firstShelfRow(await fetchProfile(username, deps));
    if (!trophies.length)
        return cacheDisplayImage(username, shelfUrl, cache);
    const texture = await loadImage(shelfUrl, true);
    const icons = await Promise.all(trophies.map(async (trophy) => ({
        slot: trophy.slot,
        image: await loadImage(new URL(trophy.icon, deps.baseUrl).href, true),
    })));
    const canvas = paintBanner(texture, icons);
    if (!canvas)
        return null;
    const blob = await canvasToBlob(canvas);
    if (!blob)
        return null;
    const url = URL.createObjectURL(blob);
    remember(cache, username, url);
    return url;
}
async function fetchProfile(username: string, deps: Dependencies): Promise<TrophyProfile | null> {
    try {
        const value = await deps.send({ type: "reminetIdentity:getProfile", remiliaUsername: username, maxAgeMs: 86400000 }, "reminetIdentity:getProfile");
        const response = value && typeof value === "object" ? value as RuntimeResponse : null;
        return response?.ok ? response.profile || null : null;
    }
    catch {
        return null;
    }
}
function firstShelfRow(profile: TrophyProfile | null): ShelfTrophy[] {
    const shelves = Array.isArray(profile?.trophyShelves) ? profile.trophyShelves.slice(0, 5) : [];
    const trophies = Array.isArray(profile?.allTrophies) ? profile.allTrophies.filter(isTrophy) : [];
    const byId = new Map(trophies.map((trophy) => [String(trophy.id), trophy]));
    return shelves.flatMap((id, slot) => {
        const trophy = id ? byId.get(String(id)) : undefined;
        return trophy?.icon ? [{ slot, icon: trophy.icon }] : [];
    });
}
function isTrophy(value: unknown): value is Trophy { return Boolean(value) && typeof value === "object"; }
async function cacheDisplayImage(username: string, url: string, cache: Map<string, CacheEntry>): Promise<string | null> {
    try {
        await loadImage(url, false);
        remember(cache, username, url);
        return url;
    }
    catch {
        return null;
    }
}
function remember(cache: Map<string, CacheEntry>, username: string, url: string): void {
    cache.set(username.toLowerCase(), { url, touchedAt: Date.now() });
    if (cache.size <= 50)
        return;
    const oldest = [...cache.entries()].sort((left, right) => left[1].touchedAt - right[1].touchedAt)[0];
    if (!oldest)
        return;
    if (oldest[1].url.startsWith("blob:"))
        URL.revokeObjectURL(oldest[1].url);
    cache.delete(oldest[0]);
}
function loadImage(src: string, cors: boolean): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => { const image = new Image(); if (cors)
        image.crossOrigin = "anonymous"; image.onload = () => resolve(image); image.onerror = reject; image.src = src; });
}
function paintBanner(texture: HTMLImageElement, icons: { slot: number; image: HTMLImageElement }[]): HTMLCanvasElement | null {
    const canvas = document.createElement('canvas');
    canvas.width = 1500;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return null;
    drawCover(ctx, texture, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const shelfY = Math.round(canvas.height * 0.72);
    const ledgeHeight = Math.round(canvas.height * 0.07);
    ctx.fillStyle = 'rgba(38, 20, 8, 0.5)';
    ctx.fillRect(0, shelfY, canvas.width, ledgeHeight);
    ctx.fillStyle = 'rgba(255, 236, 188, 0.22)';
    ctx.fillRect(0, shelfY, canvas.width, 4);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(0, shelfY + ledgeHeight - 5, canvas.width, 5);
    const slotWidth = canvas.width / 5;
    const iconSize = Math.round(canvas.height * 0.62);
    const iconY = shelfY - iconSize + Math.round(canvas.height * 0.05);
    for (const { slot, image } of icons) {
        const x = Math.round(slot * slotWidth + (slotWidth - iconSize) / 2);
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.58)';
        ctx.shadowBlur = 24;
        ctx.shadowOffsetY = 13;
        ctx.drawImage(image, x, iconY, iconSize, iconSize);
        ctx.restore();
    }
    return canvas;
}
function drawCover(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number): void { const scale = Math.max(width / image.width, height / image.height); const scaledWidth = image.width * scale; const scaledHeight = image.height * scale; context.drawImage(image, x + (width - scaledWidth) / 2, y + (height - scaledHeight) / 2, scaledWidth, scaledHeight); }
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> { return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.9)); }
function disposeCache(cache: Map<string, CacheEntry>): void { for (const { url } of cache.values())
    if (url.startsWith("blob:"))
        URL.revokeObjectURL(url); cache.clear(); }

export function preloadDisplayImage(src: string): Promise<HTMLImageElement> {
    return loadImage(src, false);
}
