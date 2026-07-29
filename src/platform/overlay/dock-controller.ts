import { itemOrder, mergeStackableOrder, moveBefore, moveBy, stackableOrder } from "./dock-order-policy";
import type { DockPersistencePort, DockSnapshot, DockViewActions, DockViewPort, OverlayDockApi, OverlayDockItem, OverlayDockItemUpdate, OverlayDockRegistration, OverlayDockSettingsAction, OverlayDockSettingsOptions, OverlayDockSide } from "./dock-types";

export type DockControllerDependencies = {
  persistence: DockPersistencePort;
  view: DockViewPort;
  setStackOrder: (ids: readonly string[]) => void;
};

export class OverlayDockController implements OverlayDockApi, DockViewActions {
  readonly #items = new Map<string, OverlayDockItem>();
  readonly #hiddenItems = new Set<string>();
  readonly #settingsActions = new Map<string, OverlayDockSettingsAction>();
  readonly #registrationTokens = new Map<string, object>();
  readonly #sideListeners = new Set<(side: OverlayDockSide) => void>();
  readonly #persistence: DockPersistencePort;
  readonly #view: DockViewPort;
  readonly #setStackOrder: (ids: readonly string[]) => void;
  #side: OverlayDockSide = "right";
  #order: string[] = [];
  #reorderMode = false;
  #loaded = false;
  #loadPromise: Promise<void> | null = null;
  #disposed = false;

  constructor(dependencies: DockControllerDependencies) {
    this.#persistence = dependencies.persistence;
    this.#view = dependencies.view;
    this.#setStackOrder = dependencies.setStackOrder;
  }

  register(item: OverlayDockItem): OverlayDockRegistration {
    if (this.#disposed) return { update() {}, remove() {} };
    const token = {};
    this.#registrationTokens.set(item.id, token);
    this.#items.set(item.id, { ...item });
    if (!this.#order.includes(item.id)) this.#order.push(item.id);
    this.#syncStackOrder();
    void this.#ensureLoaded().then(() => {
      const current = this.#items.get(item.id);
      if (this.#disposed || this.#registrationTokens.get(item.id) !== token || !current) return;
      this.#view.mount();
      this.#render();
      current.onSideChange?.(this.#side);
    });
    return {
      update: (update) => this.#update(item.id, token, update),
      remove: () => this.#remove(item.id, token),
    };
  }

  getSide(): OverlayDockSide { return this.#side; }

  setSide(side: OverlayDockSide): void {
    if (this.#disposed || this.#side === side) return;
    this.#side = side;
    this.#persistence.saveSide(side);
    this.#notifySide();
    this.#render();
  }

  setHiddenItems(ids: readonly string[]): void {
    if (this.#disposed) return;
    this.#hiddenItems.clear();
    for (const id of ids) this.#hiddenItems.add(id);
    this.#render();
  }

  setSettingsAction(id: string, action: OverlayDockSettingsAction | null): void {
    if (this.#disposed) return;
    if (action) this.#settingsActions.set(id, action);
    else this.#settingsActions.delete(id);
    this.#render();
  }

  getAppOrder(): string[] { return stackableOrder(this.#order, this.#items); }

  setAppOrder(ids: readonly string[]): void {
    if (this.#disposed) return;
    this.#order = mergeStackableOrder(this.#order, ids, this.#items);
    this.#saveOrder();
    this.#syncStackOrder();
    this.#render();
  }

  createSettingsPanel(onUpdate?: () => void, options: OverlayDockSettingsOptions = {}): HTMLElement {
    return this.#view.createSettingsPanel(this.#snapshot(), this, onUpdate, options);
  }

  subscribeSide(callback: (side: OverlayDockSide) => void): () => void {
    if (this.#disposed) return () => {};
    this.#sideListeners.add(callback);
    callback(this.#side);
    return () => this.#sideListeners.delete(callback);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#sideListeners.clear();
    this.#items.clear();
    this.#registrationTokens.clear();
    this.#settingsActions.clear();
    this.#view.dispose();
  }

  #update(id: string, token: object, update: OverlayDockItemUpdate): void {
    if (this.#registrationTokens.get(id) !== token) return;
    const current = this.#items.get(id);
    if (!current || !hasItemChanges(current, update)) return;
    this.#items.set(id, { ...current, ...update });
    this.#render();
  }

  #remove(id: string, token: object): void {
    if (this.#registrationTokens.get(id) !== token) return;
    this.#registrationTokens.delete(id);
    if (!this.#items.delete(id)) return;
    this.#syncStackOrder();
    this.#render();
  }

  async #ensureLoaded(): Promise<void> {
    if (this.#loaded || this.#disposed) return;
    if (this.#loadPromise) return this.#loadPromise;
    this.#loadPromise = this.#persistence.load()
      .then(({ side, order }) => {
        if (this.#disposed) return;
        this.#side = side;
        this.#order = itemOrder(order, this.#items);
        this.#loaded = true;
        this.#syncStackOrder();
        this.#notifySide();
      })
      .catch(() => {
        this.#loaded = true;
      });
    return this.#loadPromise;
  }

  activate(id: string): void {
    if (this.#disposed) return;
    const item = this.#items.get(id);
    if (!item) return;
    // App mounts can update their dock state asynchronously.  Flip the
    // controller's snapshot before calling into the app so consecutive rail
    // clicks never decide against the state from the preceding render.
    const deactivate = item.active === true && Boolean(item.onDeactivate);
    this.#items.set(id, { ...item, active: !deactivate });
    this.#render();
    if (deactivate) item.onDeactivate?.();
    else item.onActivate();
  }

  moveBefore(id: string, targetId: string): void {
    if (this.#disposed) return;
    this.#order = moveBefore(this.#order, id, targetId);
    this.#syncStackOrder();
    this.#render();
  }

  moveBy(id: string, delta: -1 | 1): void {
    if (this.#disposed) return;
    this.#order = moveBy(this.#order, id, delta);
    this.#saveOrder();
    this.#syncStackOrder();
    this.#render();
  }

  setReorderMode(active: boolean): void {
    if (this.#disposed) return;
    if (this.#reorderMode === active) return;
    this.#reorderMode = active;
    if (!active) this.#saveOrder();
    this.#render();
  }

  resetOrder(): void {
    if (this.#disposed) return;
    this.#order = Array.from(this.#items.keys());
    this.#saveOrder();
    this.#syncStackOrder();
    this.#render();
  }

  invokeSettingsAction(id: string): void {
    if (this.#disposed) return;
    const action = this.#settingsActions.get(id);
    if (!action) return;
    action.onActivate();
    this.#render();
  }

  commitOrder(): void { if (!this.#disposed) this.#saveOrder(); }

  #saveOrder(): void { this.#persistence.saveOrder(this.#order); }

  #syncStackOrder(): void { this.#setStackOrder(this.getAppOrder()); }

  #notifySide(): void {
    for (const listener of this.#sideListeners) listener(this.#side);
    for (const item of this.#items.values()) item.onSideChange?.(this.#side);
  }

  #render(): void { if (!this.#disposed) this.#view.render(this.#snapshot(), this); }

  #snapshot(): DockSnapshot {
    return {
      side: this.#side,
      order: this.#order,
      items: this.#items,
      hiddenItems: this.#hiddenItems,
      settingsActions: this.#settingsActions,
      reorderMode: this.#reorderMode,
    };
  }
}

function hasItemChanges(current: OverlayDockItem, update: OverlayDockItemUpdate): boolean {
  return (Object.keys(update) as Array<keyof OverlayDockItemUpdate>).some((key) => current[key] !== update[key]);
}
