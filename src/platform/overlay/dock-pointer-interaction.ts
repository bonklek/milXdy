export type DockPointer = { pointerId: number; clientX: number; clientY: number };
export type DockPointerTarget = {
  setPointerCapture?: (pointerId: number) => void;
  releasePointerCapture?: (pointerId: number) => void;
};
export type DockPointerHandlers = {
  move: (event: DockPointer, targetId: string | null) => void;
  end: (event: DockPointer) => void;
  cancel: (event: DockPointer) => void;
};
export type DockPointerHost = {
  scheduleLongPress: (activate: () => void) => () => void;
  listen: (handlers: DockPointerHandlers) => () => void;
};
export type DockPointerActions = {
  getReorderMode: () => boolean;
  setReorderMode: (active: boolean) => void;
  moveBefore: (id: string, targetId: string) => void;
  commitOrder: () => void;
  suppressNextClick: () => void;
};

type PointerSession = DockPointer & { id: string; moved: boolean; target: DockPointerTarget };

export class DockPointerInteraction {
  readonly #host: DockPointerHost;
  readonly #actions: DockPointerActions;
  #session: PointerSession | null = null;
  #cancelTimer: (() => void) | null = null;
  #unlisten: (() => void) | null = null;

  constructor(host: DockPointerHost, actions: DockPointerActions) {
    this.#host = host;
    this.#actions = actions;
  }

  start(pointer: DockPointer, id: string, target: DockPointerTarget): void {
    this.dispose();
    this.#session = { ...pointer, id, moved: false, target };
    target.setPointerCapture?.(pointer.pointerId);
    this.#unlisten = this.#host.listen({
      move: (event, targetId) => this.move(event, targetId),
      end: (event) => this.end(event),
      cancel: (event) => this.cancel(event),
    });
    this.#cancelTimer = this.#host.scheduleLongPress(() => {
      this.#cancelTimer = null;
      if (this.#session) this.#actions.setReorderMode(true);
    });
  }

  move(pointer: DockPointer, targetId: string | null): void {
    const session = this.#matchingSession(pointer);
    if (!session || Math.abs(pointer.clientY - session.clientY) < 8) return;
    session.moved = true;
    this.#clearTimer();
    if (this.#actions.getReorderMode() && targetId && targetId !== session.id) this.#actions.moveBefore(session.id, targetId);
  }

  end(pointer: DockPointer): void {
    if (this.#matchingSession(pointer)) this.#finish(true);
  }

  cancel(pointer: DockPointer): void {
    if (this.#matchingSession(pointer)) this.#finish(false);
  }

  dispose(): void { this.#finish(false); }

  #matchingSession(pointer: DockPointer): PointerSession | null {
    return this.#session?.pointerId === pointer.pointerId ? this.#session : null;
  }

  #clearTimer(): void {
    this.#cancelTimer?.();
    this.#cancelTimer = null;
  }

  #finish(commit: boolean): void {
    const session = this.#session;
    this.#clearTimer();
    session?.target.releasePointerCapture?.(session.pointerId);
    if (commit && session?.moved) this.#actions.suppressNextClick();
    if (commit && session?.moved && this.#actions.getReorderMode()) this.#actions.commitOrder();
    this.#session = null;
    this.#unlisten?.();
    this.#unlisten = null;
  }
}
