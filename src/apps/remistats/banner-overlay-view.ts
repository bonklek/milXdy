export function getBannerStage(root: HTMLElement): HTMLElement {
    let stage = root.querySelector<HTMLElement>(":scope > .milxdy-banner-stage");
    if (stage)
        return stage;
    stage = document.createElement("div");
    stage.className = "milxdy-banner-stage";
    root.appendChild(stage);
    return stage;
}
export function clearBannerNftLabel(root: HTMLElement): void {
    root.querySelector(":scope > .milxdy-banner-nft-label")?.remove();
}
export function setBannerNftLabel(root: HTMLElement, nft: {
    tokenId?: number;
    tokenUrl?: string;
} | null): void {
    clearBannerNftLabel(root);
    if (!nft?.tokenId || !nft.tokenUrl)
        return;
    const link = document.createElement("a");
    link.className = "milxdy-banner-nft-label";
    link.href = nft.tokenUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = `Banners NFT #${nft.tokenId}`;
    link.addEventListener("click", (event) => event.stopPropagation());
    root.appendChild(link);
}
export function makeBannerPanel(type: string, url: string, role: "current" | "next"): HTMLElement {
    const panel = document.createElement("div");
    panel.className = `milxdy-banner-panel milxdy-banner-panel--${role}`;
    panel.dataset.milxdyBannerOverlay = type;
    panel.style.backgroundImage = `url("${url}")`;
    return panel;
}
export function originalBannerUrl(root: HTMLElement): string {
    const image = root.querySelector<HTMLImageElement>('img[src*="/profile_banners/"], img[src*="profile_banners"]')
        || document.querySelector<HTMLImageElement>('main img[src*="/profile_banners/"], main img[src*="profile_banners"]');
    return image?.currentSrc || image?.src || "";
}
export function transitionBannerOverlay(root: HTMLElement, type: string, url: string): Promise<void> {
    const stage = getBannerStage(root);
    let current = stage.querySelector<HTMLElement>(":scope > .milxdy-banner-panel--current");
    if (!current)
        current = appendOriginalPanel(root, stage);
    const next = makeBannerPanel(type, url, "next");
    stage.appendChild(next);
    if (!current) {
        delete root.dataset.milxdyBannerLoading;
        next.classList.replace("milxdy-banner-panel--next", "milxdy-banner-panel--current");
        return Promise.resolve();
    }
    delete root.dataset.milxdyBannerLoading;
    stage.dataset.spinning = "true";
    current.classList.add("milxdy-banner-panel--exit");
    return finishPanelTransition(stage, current, next);
}
function appendOriginalPanel(root: HTMLElement, stage: HTMLElement): HTMLElement | null {
    const url = originalBannerUrl(root);
    if (!url)
        return null;
    const panel = makeBannerPanel("original", url, "current");
    stage.appendChild(panel);
    return panel;
}
function finishPanelTransition(stage: HTMLElement, current: HTMLElement, next: HTMLElement): Promise<void> {
    return new Promise((resolve) => {
        let done = false;
        const finish = () => {
            if (done)
                return;
            done = true;
            current.remove();
            next.classList.remove("milxdy-banner-panel--next", "milxdy-banner-panel--enter");
            next.classList.add("milxdy-banner-panel--current");
            delete stage.dataset.spinning;
            resolve();
        };
        next.addEventListener("transitionend", finish, { once: true });
        window.setTimeout(finish, 900);
        requestAnimationFrame(() => next.classList.add("milxdy-banner-panel--enter"));
    });
}
export function clearBannerOverlay(root: HTMLElement): void {
    root.querySelector(":scope > .milxdy-banner-stage")?.remove();
    clearBannerNftLabel(root);
}
export function transitionBannerToOriginal(root: HTMLElement): Promise<void> {
    const stage = root.querySelector<HTMLElement>(":scope > .milxdy-banner-stage");
    const current = stage?.querySelector<HTMLElement>(":scope > .milxdy-banner-panel--current");
    clearBannerNftLabel(root);
    if (!stage || !current)
        return Promise.resolve();
    delete root.dataset.milxdyBannerLoading;
    stage.dataset.spinning = "true";
    current.classList.add("milxdy-banner-panel--exit");
    return new Promise((resolve) => {
        let done = false;
        const finish = () => {
            if (!done) {
                done = true;
                stage.remove();
                resolve();
            }
        };
        current.addEventListener("transitionend", finish, { once: true });
        window.setTimeout(finish, 900);
        requestAnimationFrame(() => {
            current.style.transform = "translateY(-100%)";
        });
    });
}
