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
};
export function createBannerCycleService(deps: Dependencies) {
    let ready: Nft | null = null;
    let pending: Promise<Nft | null> | null = null;
    const prefetch = () => {
        if (!ready && !pending)
            pending = loadNft(deps, randomNft()).then((nft) => {
                ready = nft;
                return nft;
            }).catch((error) => {
                console.debug("RemiStats Banners NFT prefetch skipped:", error);
                return null;
            }).finally(() => {
                pending = null;
            });
    };
    const take = async () => {
        const value = ready || await pending || await loadNft(deps, randomNft());
        ready = null;
        prefetch();
        return value;
    };
    const cycleBanner = (root: HTMLElement) => cycle(root, deps, take);
    return { prefetch, cycle: cycleBanner, ensureButton: (root: HTMLElement) => ensureButton(root, prefetch, cycleBanner, deps) };
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
async function cycle(root: HTMLElement, deps: Dependencies, take: () => Promise<Nft>): Promise<void> {
    const username = deps.cleanUsername(root.dataset.milxdyTrophyBannerUser);
    if (!username || root.dataset.milxdyBannerCycling === "true")
        return;
    root.dataset.milxdyBannerCycling = "true";
    root.dataset.milxdyBannerLoading = "true";
    deps.playSpin();
    const modes = ["original", "shelf", "nft"];
    const start = Math.max(0, modes.indexOf(root.dataset.milxdyBannerMode || "shelf"));
    try {
        for (let offset = 1; offset <= modes.length; offset += 1) {
            const mode = modes[(start + offset) % modes.length]!;
            if (await applyMode(root, mode, username, deps, take)) {
                const button = root.querySelector<HTMLButtonElement>(":scope > .milxdy-banner-cycle-button");
                if (button)
                    button.title = `Banner mode: ${mode}. Click to cycle.`;
                return;
            }
        }
    }
    catch (error) {
        console.debug("RemiStats banner cycle skipped:", error);
    }
    finally {
        delete root.dataset.milxdyBannerLoading;
        delete root.dataset.milxdyBannerCycling;
    }
}
async function applyMode(root: HTMLElement, mode: string, username: string, deps: Dependencies, take: () => Promise<Nft>): Promise<boolean> {
    root.dataset.milxdyBannerMode = mode;
    if (mode === "original") {
        await deps.toOriginal(root);
        return true;
    }
    if (mode === "shelf") {
        const url = await deps.renderTrophy(username);
        if (!url)
            return false;
        await deps.transition(root, "shelf", url);
        deps.clearLabel(root);
        root.dataset.milxdyTrophyBannerState = "ready";
        return true;
    }
    if (mode === "nft") {
        const nft = await take();
        await deps.transition(root, "nft", nft.displayUrl);
        deps.setLabel(root, nft);
        return true;
    }
    return false;
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
