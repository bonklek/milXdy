export type Disposable = (() => void) | { dispose: () => void };

export class DisposableStore {
  private readonly disposables = new Set<Disposable>();
  private disposed = false;

  add<T extends Disposable>(disposable: T): T {
    if (this.disposed) {
      disposeOne(disposable);
      return disposable;
    }
    this.disposables.add(disposable);
    return disposable;
  }

  addEvent<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    listener: (event: WindowEventMap[K]) => void,
    options?: AddEventListenerOptions | boolean,
  ): void;
  addEvent<K extends keyof DocumentEventMap>(
    target: Document,
    type: K,
    listener: (event: DocumentEventMap[K]) => void,
    options?: AddEventListenerOptions | boolean,
  ): void;
  addEvent(
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean,
  ): void {
    target.addEventListener(type, listener, options);
    this.add(() => target.removeEventListener(type, listener, options));
  }

  addChromeStorageListener(listener: Parameters<typeof chrome.storage.onChanged.addListener>[0]): void {
    chrome.storage.onChanged.addListener(listener);
    this.add(() => chrome.storage.onChanged.removeListener(listener));
  }

  addObserver(observer: MutationObserver | IntersectionObserver | ResizeObserver): void {
    this.add(() => observer.disconnect());
  }

  addTimer(timer: number, clear: (timer: number) => void = window.clearTimeout): void {
    this.add(() => clear(timer));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const disposable of Array.from(this.disposables).reverse()) disposeOne(disposable);
    this.disposables.clear();
  }
}

function disposeOne(disposable: Disposable): void {
  try {
    if (typeof disposable === "function") disposable();
    else disposable.dispose();
  } catch {
    // Best-effort cleanup; disposal should not prevent remaining cleanup.
  }
}

