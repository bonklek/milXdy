import type { AppWindowCreateOptions, AppWindowHandle, AppWindowService, MilxdyAppId } from "../app-sdk/app-platform";
import { markOverlayAppLayoutReady } from "../overlay/app-chrome";
import { bringOverlayAppToFront, registerOverlayAppRoot } from "../overlay/app-layout";
import { cancelOverlayPanelPointerSession, clampOverlayPanelBox, restoreOverlayPanelBox, startOverlayPanelDrag, startOverlayPanelResize, type OverlayPanelBox, type OverlayPanelPointerOptions } from "../overlay/panel-base";
import type { OverlayDockSide } from "../overlay/dock";
import type { Disposable } from "./disposables";
import { createAppWindowView } from "./app-window-view";
type WindowState = ReturnType<typeof createAppWindowView> & {
    windowId: string;
    minWidth: number;
    minHeight: number;
    side: OverlayDockSide;
    box: OverlayPanelBox;
    opened: boolean;
    disposed: boolean;
    priorFocus: HTMLElement | null;
    layoutVersion: number;
    cleanup: Array<() => void>;
};
export function createAppWindowService(appId: MilxdyAppId, signal: AbortSignal, addDisposable: (disposable: Disposable) => void): AppWindowService {
    return { create: (options) => createManagedWindow(appId, signal, addDisposable, options) };
}
function createManagedWindow(appId: MilxdyAppId, signal: AbortSignal, addDisposable: (disposable: Disposable) => void, options: AppWindowCreateOptions): AppWindowHandle {
    if (signal.aborted)
        throw new DOMException("App activation has ended", "AbortError");
    if (!options.id.trim() || !options.title.trim())
        throw new Error("Managed windows require an id and title");
    const state = createWindowState(appId, options);
    const handle = createWindowHandle(state, signal, options);
    wireWindowInteractions(state, handle, options);
    document.body.append(state.root);
    applyLayout(state);
    if (options.persistKey)
        void restoreLayout(state, signal);
    addDisposable(handle.dispose);
    signal.addEventListener("abort", handle.dispose, { once: true });
    state.cleanup.push(() => signal.removeEventListener("abort", handle.dispose));
    return handle;
}
function createWindowState(appId: MilxdyAppId, options: AppWindowCreateOptions): WindowState {
    const windowId = `${appId}:window:${options.persistKey || options.id}`;
    const minWidth = Math.max(160, Math.floor(options.minWidth ?? 320));
    const minHeight = Math.max(120, Math.floor(options.minHeight ?? 180));
    return {
        ...createAppWindowView(options, windowId), windowId, minWidth, minHeight,
        side: options.initialBounds?.side ?? "right",
        box: {
            width: Math.max(minWidth, Math.floor(options.initialBounds?.width ?? 440)),
            height: Math.max(minHeight, Math.floor(options.initialBounds?.height ?? 320)),
            topOffset: Math.max(8, Math.floor(options.initialBounds?.top ?? 24)),
        },
        opened: false, disposed: false, priorFocus: null, layoutVersion: 0, cleanup: [],
    };
}
function createWindowHandle(state: WindowState, signal: AbortSignal, options: AppWindowCreateOptions): AppWindowHandle {
    const { root } = state;
    const handle: AppWindowHandle = {
        element: root,
        get isOpen() { return state.opened; },
        open() {
            if (state.disposed || signal.aborted || state.opened)
                return;
            state.priorFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            state.opened = true;
            root.hidden = false;
            handle.focus();
        },
        close() {
            if (!state.opened)
                return;
            state.opened = false;
            cancelOverlayPanelPointerSession(root);
            root.hidden = true;
            try {
                options.onClose?.();
            }
            finally {
                if (state.priorFocus?.isConnected)
                    state.priorFocus.focus({ preventScroll: true });
            }
        },
        focus() {
            if (state.disposed || !state.opened)
                return;
            bringOverlayAppToFront(root, state.windowId);
            const target = root.querySelector<HTMLElement>("[autofocus], button, [tabindex]:not([tabindex='-1'])") || root;
            target.focus({ preventScroll: true });
        },
        dispose() {
            if (state.disposed)
                return;
            state.disposed = true;
            try {
                handle.close();
            }
            finally {
                for (const cleanup of state.cleanup.splice(0))
                    cleanup();
                cancelOverlayPanelPointerSession(root);
                root.remove();
            }
        },
    };
    return handle;
}
function wireWindowInteractions(state: WindowState, handle: AppWindowHandle, options: AppWindowCreateOptions): void {
    const { root, header, closeButton } = state;
    const pointer = pointerOptions(state, options.persistKey !== undefined);
    header.addEventListener("pointerdown", (event) => {
        if ((event.target as HTMLElement | null)?.closest("button"))
            return;
        root.dataset.dragging = "true";
        startOverlayPanelDrag(event, pointer);
    });
    header.addEventListener("pointerup", () => { delete root.dataset.dragging; });
    closeButton.addEventListener("click", handle.close);
    root.addEventListener("pointerdown", () => { bringOverlayAppToFront(root, state.windowId); });
    const keydown = (event: KeyboardEvent) => {
        if (event.defaultPrevented || event.key !== "Escape" || !state.opened || !root.contains(document.activeElement))
            return;
        event.preventDefault();
        event.stopImmediatePropagation();
        handle.close();
    };
    const viewportResize = () => { if (!state.disposed)
        applyLayout(state); };
    window.addEventListener("keydown", keydown, true);
    window.addEventListener("resize", viewportResize, { passive: true });
    state.cleanup.push(() => window.removeEventListener("keydown", keydown, true), () => window.removeEventListener("resize", viewportResize));
    if (options.resizable === false)
        return;
    const resize = document.createElement("button");
    resize.type = "button";
    resize.className = "milxdy-sdk-app-window-resize";
    resize.setAttribute("aria-label", `Resize ${options.title}`);
    resize.addEventListener("pointerdown", (event) => startOverlayPanelResize(event, pointer));
    root.append(resize);
}
function pointerOptions(state: WindowState, persist: boolean): OverlayPanelPointerOptions {
    return {
        minWidth: state.minWidth, minHeight: state.minHeight,
        appId: persist ? state.windowId : undefined, root: state.root,
        side: () => state.side, box: () => state.box,
        setBox(next) { state.layoutVersion += 1; state.box = { ...state.box, ...next }; },
        apply: () => applyLayout(state),
        persist: () => { delete state.root.dataset.dragging; },
        disabled: () => state.disposed || !state.opened,
    };
}
function applyLayout(state: WindowState): void {
    const { root, side, minWidth, minHeight } = state;
    const box = state.box = clampOverlayPanelBox(state.box, { minWidth, minHeight, dockSide: side });
    registerOverlayAppRoot(state.windowId, root);
    root.style.left = typeof box.x === "number" ? `${box.x}px` : side === "left" ? "104px" : "auto";
    root.style.right = typeof box.x === "number" ? "auto" : side === "right" ? "104px" : "auto";
    root.style.top = `${box.topOffset}px`;
    root.style.width = `${box.width}px`;
    root.style.height = `${box.height}px`;
    markOverlayAppLayoutReady(root);
}
async function restoreLayout(state: WindowState, signal: AbortSignal): Promise<void> {
    const version = state.layoutVersion;
    try {
        const restored = await restoreOverlayPanelBox(state.windowId, {
            side: state.side, minWidth: state.minWidth, minHeight: state.minHeight,
            defaultWidth: state.box.width, defaultHeight: state.box.height,
            legacy: { width: state.box.width, height: state.box.height, topOffset: state.box.topOffset },
        });
        if (state.disposed || signal.aborted || state.layoutVersion !== version)
            return;
        state.box = restored;
        applyLayout(state);
    }
    catch {
        // In-memory initial bounds remain usable when persisted layout is unavailable.
    }
}
