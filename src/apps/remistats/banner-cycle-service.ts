import { enabledBannerModes, readBannerSettings, selectProfileBanner, type BannerSettings } from "./profile-banner-sources";
type Nft = {
    tokenId: number;
    imageUrl: string;
    tokenUrl: string;
    displayUrl: string;
};
type MessageResponse = {
    ok?: boolean;
    dataUrl?: string;
};
type Dependencies = {
    send: (message: object, type: string) => Promise<unknown>;
    preload: (url: string) => Promise<unknown>;
    renderTrophy: (username: string) => Promise<string | null>;
    transition: (root: HTMLElement, type: string, url: string) => Promise<void>;
    toOriginal: (root: HTMLElement) => Promise<void>;
    clearLabel: (root: HTMLElement) => void;
    setLabel: (root: HTMLElement, nft: Nft) => void;
    cleanUsername: (value: unknown) => string;
    runtimeUrl: (path: string) => string;
    playSpin: () => void;
    settings?: () => BannerSettings;
    pathname?: () => string;
};
export function createBannerCycleService(deps: Dependencies) {
    let ready: Nft | null = null;
    let pending: Promise<Nft | null> | null = null;
    let generation = 0;
    const settings = () => deps.settings?.() ?? readBannerSettings({});
    const prefetch = () => {
        if (!settings().nft || ready || pending) return;
        const version = generation;
        const task = loadNft(deps, randomNft()).then(nft => {
            if (version !== generation || !settings().nft) return null;
            ready = nft;
            return nft;
        }).catch(() => null).finally(() => { if (pending === task) pending = null; });
        pending = task;
    };
    const take = async () => {
        const value = ready || await pending || await loadNft(deps, randomNft());
        ready = null;
        prefetch();
        return value;
    };
    const renderInitial = async (root: HTMLElement, username: string, isCurrent: () => boolean) => {
        const version = generation;
        const valid = () => version === generation && isCurrent();
        const selection = await selectProfileBanner(enabledBannerModes(settings()), () => deps.renderTrophy(username), take);
        if (valid()) await applySelection(root, selection, deps, valid);
    };
    const cycleBanner = (root: HTMLElement) => cycle(root, deps, take, settings(), generation, () => generation);
    const cycleAvailable = () => enabledBannerModes(settings()).length > 1;
    return {
        prefetch, cycle: cycleBanner, renderInitial, cycleAvailable,
        invalidate() { generation += 1; ready = null; pending = null; },
        ensureButton(root: HTMLElement) {
            if (!cycleAvailable()) { root.querySelector(":scope > .milxdy-banner-cycle-button")?.remove(); return; }
            ensureButton(root, prefetch, cycleBanner, deps);
        },
    };
}
function randomNft(): Omit<Nft, "displayUrl"> {
    const tokenId = Math.floor(Math.random() * 2000) + 1;
    return { tokenId, imageUrl: `https://miladymaker.net/banners/nft/${tokenId}.png`, tokenUrl: `https://etherscan.io/nft/0x1352149Cd78D686043B504e7e7D96C5946b0C39c/${tokenId}` };
}
async function loadNft(deps: Dependencies, nft: Omit<Nft, "displayUrl">): Promise<Nft> {
    const value = await deps.send({ type: "milxdy:fetchImageDataUrl", url: nft.imageUrl }, "milxdy:fetchImageDataUrl");
    const response = value && typeof value === "object" ? value as MessageResponse : null;
    const displayUrl = response?.ok && typeof response.dataUrl === "string" ? response.dataUrl : nft.imageUrl;
    await deps.preload(displayUrl);
    return { ...nft, displayUrl };
}
async function cycle(root: HTMLElement, deps: Dependencies, take: () => Promise<Nft>, settings: BannerSettings, generation: number, current: () => number): Promise<void> {
    const username = deps.cleanUsername(root.dataset.milxdyBannerRemiliaUser || root.dataset.milxdyTrophyBannerUser);
    if (!root.dataset.milxdyTrophyBannerUser || root.dataset.milxdyBannerCycling === "true") return;
    const path = deps.pathname?.();
    const owner = root.dataset.milxdyTrophyBannerUser;
    const isCurrent = () => root.isConnected && generation === current() && path === deps.pathname?.() && owner === root.dataset.milxdyTrophyBannerUser;
    root.dataset.milxdyBannerCycling = "true";
    root.dataset.milxdyBannerLoading = "true";
    deps.playSpin();
    try {
        const selection = await selectProfileBanner(enabledBannerModes(settings, root.dataset.milxdyBannerMode || "shelf"), () => deps.renderTrophy(username), take);
        if (isCurrent()) await applySelection(root, selection, deps, isCurrent);
    } finally {
        delete root.dataset.milxdyBannerLoading;
        delete root.dataset.milxdyBannerCycling;
    }
}
async function applySelection(root: HTMLElement, selection: { mode: string; url?: string; nft?: Nft }, deps: Dependencies, isCurrent: () => boolean): Promise<void> {
    if (selection.mode === "original") await deps.toOriginal(root);
    else {
        await deps.transition(root, selection.mode, selection.url || "");
        if (!isCurrent()) return;
        if (selection.nft) deps.setLabel(root, selection.nft);
        else deps.clearLabel(root);
    }
    if (!isCurrent()) return;
    root.dataset.milxdyBannerMode = selection.mode;
    root.dataset.milxdyTrophyBannerState = "ready";
    const button = root.querySelector<HTMLButtonElement>(":scope > .milxdy-banner-cycle-button");
    if (button) { button.title = `Banner mode: ${selection.mode}. Click to cycle.`; button.setAttribute("aria-label", button.title); }
}
function ensureButton(root: HTMLElement, prefetch: () => void, cycleBanner: (root: HTMLElement) => Promise<void>, deps: Dependencies): void {
    prefetch();
    if (root.querySelector(":scope > .milxdy-banner-cycle-button"))
        return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "milxdy-banner-cycle-button";
    button.title = "Cycle banner: original, trophy shelf, random Banners NFT";
    button.setAttribute("aria-label", button.title);
    button.innerHTML = `<img class="milxdy-banner-lever milxdy-banner-lever--idle" src="${deps.runtimeUrl("remistats/banner-lever-idle.png")}" alt="" /><img class="milxdy-banner-lever milxdy-banner-lever--pulled" src="${deps.runtimeUrl("remistats/banner-lever-pulled.png")}" alt="" />`;
    button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        void cycleBanner(root);
    });
    root.appendChild(button);
}
