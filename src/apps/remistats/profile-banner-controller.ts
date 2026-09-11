type Identity = {
    remiliaUsername: string;
};
type Scheduler = {
    idle: (callback: () => void, options: {
        timeout: number;
    }) => void;
    timeout: (callback: () => void, delay: number) => void;
};
type Dependencies = {
    profileUsername: () => string;
    exactXHandle: (value: string) => string;
    cleanXHandle: (value: string) => string;
    cleanRemilia: (value: string) => string;
    fetchIdentity: (xHandle: string) => Promise<Identity | null>;
    confirmed: (username: string, xHandle: string) => boolean;
    findRoot: (xHandle: string) => HTMLElement | null;
    clearOverlay: (root: HTMLElement) => void;
    transitionOverlay: (root: HTMLElement, type: string, url: string) => Promise<void>;
    clearNftLabel: (root: HTMLElement) => void;
    renderBanner: (username: string) => Promise<string | null>;
    ensureCycleButton: (root: HTMLElement) => void;
    phase: (channel: string, phase: string) => void;
    scheduler: () => Scheduler;
    pathname: () => string;
};
export function createProfileBannerController(deps: Dependencies) {
    let reconcileGeneration = 0;
    let requestGeneration = 0;
    const isCurrent = (generation: number, path: string, username: string, handle: string) => generation === requestGeneration && path === deps.pathname() && deps.confirmed(username, handle);
    const reset = () => {
        reconcileGeneration += 1;
        requestGeneration += 1;
        document.querySelectorAll<HTMLElement>("[data-milxdy-trophy-banner-user], [data-milxdy-trophy-banner-state]").forEach((root) => clearRoot(root, deps));
    };
    const upgrade = (username: string, handle: string, path: string) => upgradeBanner(username, handle, path, deps, () => ++requestGeneration, isCurrent);
    const reconcile = (input = deps.profileUsername(), path = deps.pathname()) => reconcileBanner(input, path, deps, () => ++reconcileGeneration, () => reconcileGeneration, reset, upgrade);
    return { reconcile, reset, upgrade };
}
async function reconcileBanner(input: string, path: string, deps: Dependencies, next: () => number, current: () => number, reset: () => void, upgrade: (username: string, handle: string, path: string) => Promise<void>): Promise<void> {
    const handle = deps.exactXHandle(input);
    if (!handle || deps.exactXHandle(deps.profileUsername()) !== handle)
        return;
    deps.phase("profile", "route-observed");
    const generation = next();
    const identity = await deps.fetchIdentity(handle);
    if (generation !== current() || path !== deps.pathname() || deps.exactXHandle(deps.profileUsername()) !== handle)
        return;
    if (!identity) {
        reset();
        return;
    }
    await upgrade(identity.remiliaUsername, handle, path);
}
function clearRoot(root: HTMLElement, deps: Dependencies): void {
    deps.clearOverlay(root);
    root.querySelector(":scope > .milxdy-banner-cycle-button")?.remove();
    delete root.dataset.milxdyTrophyBannerUser;
    delete root.dataset.milxdyTrophyBannerState;
    root.dataset.milxdyBannerMode = "original";
}
async function upgradeBanner(username: string, handle: string, path: string, deps: Dependencies, next: () => number, isCurrent: (generation: number, path: string, username: string, handle: string) => boolean): Promise<void> {
    const clean = deps.cleanRemilia(username);
    const cleanHandle = deps.cleanXHandle(handle);
    if (!clean || !cleanHandle || !deps.confirmed(clean, cleanHandle))
        return;
    const generation = next();
    deps.phase("profile", "banner-waiting");
    await waitIdle(deps);
    if (!isCurrent(generation, path, clean, cleanHandle))
        return;
    const root = await waitForRoot(generation, path, clean, cleanHandle, deps, isCurrent);
    if (!root) {
        deps.phase("profile", "banner-root-missing");
        return;
    }
    prepareRoot(root, deps);
    await mountBanner(root, generation, path, clean, cleanHandle, deps, isCurrent);
}
function waitIdle(deps: Dependencies): Promise<void> {
    return new Promise((resolve) => deps.scheduler().idle(resolve, { timeout: 1500 }));
}
async function waitForRoot(generation: number, path: string, username: string, handle: string, deps: Dependencies, isCurrent: (generation: number, path: string, username: string, handle: string) => boolean): Promise<HTMLElement | null> {
    for (const delay of [0, 200, 600, 1400]) {
        if (delay)
            await new Promise<void>((resolve) => deps.scheduler().timeout(resolve, delay));
        if (!isCurrent(generation, path, username, handle))
            return null;
        const root = deps.findRoot(handle);
        if (root)
            return root;
    }
    return null;
}
function prepareRoot(root: HTMLElement, deps: Dependencies): void {
    if (getComputedStyle(root).position === "static")
        root.style.position = "relative";
    root.style.overflow = "hidden";
    deps.ensureCycleButton(root);
    deps.phase("profile", "banner-control-mounted");
}
async function mountBanner(root: HTMLElement, generation: number, path: string, username: string, handle: string, deps: Dependencies, isCurrent: (generation: number, path: string, username: string, handle: string) => boolean): Promise<void> {
    const key = username.toLowerCase();
    if (root.dataset.milxdyTrophyBannerUser === key && root.dataset.milxdyTrophyBannerState === "ready") {
        deps.phase("profile", "banner-ready");
        verifyMount(root, generation, path, username, handle, "banner-ready", deps, isCurrent);
        return;
    }
    if (root.dataset.milxdyTrophyBannerUser !== key)
        deps.clearOverlay(root);
    root.dataset.milxdyTrophyBannerUser = key;
    root.dataset.milxdyTrophyBannerState = "loading";
    try {
        const url = await deps.renderBanner(username);
        if (!isCurrent(generation, path, username, handle))
            return;
        if (!url) {
            mountEmpty(root, generation, path, username, handle, deps, isCurrent);
            return;
        }
        await deps.transitionOverlay(root, "shelf", url);
        if (!isCurrent(generation, path, username, handle))
            return;
        deps.clearNftLabel(root);
        root.dataset.milxdyBannerMode = "shelf";
        root.dataset.milxdyTrophyBannerState = "ready";
        deps.phase("profile", "banner-ready");
        verifyMount(root, generation, path, username, handle, "banner-ready", deps, isCurrent);
    }
    catch (error) {
        if (isCurrent(generation, path, username, handle)) {
            root.dataset.milxdyTrophyBannerState = "error";
            deps.phase("profile", "banner-error");
        }
        console.debug("RemiStats trophy banner skipped:", error);
    }
}
function mountEmpty(root: HTMLElement, generation: number, path: string, username: string, handle: string, deps: Dependencies, isCurrent: (generation: number, path: string, username: string, handle: string) => boolean): void {
    deps.phase("profile", "banner-empty");
    root.dataset.milxdyTrophyBannerState = "empty";
    deps.clearOverlay(root);
    root.dataset.milxdyBannerMode = "original";
    verifyMount(root, generation, path, username, handle, "banner-empty", deps, isCurrent);
}
function verifyMount(root: HTMLElement, generation: number, path: string, username: string, handle: string, stablePhase: string, deps: Dependencies, isCurrent: (generation: number, path: string, username: string, handle: string) => boolean): void {
    deps.scheduler().timeout(() => {
        if (!isCurrent(generation, path, username, handle))
            return;
        const control = root.querySelector(":scope > .milxdy-banner-cycle-button");
        if (!root.isConnected || deps.findRoot(handle) !== root || !control?.isConnected) {
            deps.phase("profile", "banner-removed");
            return;
        }
        deps.phase("profile", stablePhase);
    }, 1200);
}
