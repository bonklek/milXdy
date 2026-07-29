import type { MilxdyContentAppContext, MilxdyContentAppModule } from "../app-sdk/app-platform";

export type ContentAppActivation = "enabled" | "inactive-after-boot";

export class ContentAppLifecycleOwner {
  readonly #module: MilxdyContentAppModule;
  readonly #context: MilxdyContentAppContext;
  readonly #isActive: () => boolean;
  readonly #onDisposed: () => void;
  #bootPromise: Promise<void> | null = null;
  #enablePromise: Promise<void> | null = null;
  #activationPromise: Promise<ContentAppActivation> | null = null;
  #teardownPromise: Promise<void> | null = null;
  #deactivationRequested = false;
  #shutdownRequested = false;

  constructor(
    module: MilxdyContentAppModule,
    context: MilxdyContentAppContext,
    isActive: () => boolean,
    onDisposed: () => void = () => undefined,
  ) {
    this.#module = module;
    this.#context = context;
    this.#isActive = isActive;
    this.#onDisposed = onDisposed;
  }

  activate(): Promise<ContentAppActivation> {
    this.#activationPromise ||= this.#activate();
    return this.#activationPromise;
  }

  deactivate(): Promise<void> {
    this.#deactivationRequested = true;
    return this.#teardownWhenReady();
  }

  dispose(): Promise<void> {
    this.#shutdownRequested = true;
    this.#deactivationRequested = true;
    return this.#teardownWhenReady();
  }

  async #activate(): Promise<ContentAppActivation> {
    this.#bootPromise = Promise.resolve(this.#module.boot?.(this.#context));
    await this.#bootPromise;
    if (this.#deactivationRequested || !this.#isActive()) {
      this.#deactivationRequested = true;
      await this.#teardownWhenReady();
      return "inactive-after-boot";
    }
    this.#enablePromise = Promise.resolve(this.#module.enable?.());
    await this.#enablePromise;
    if (this.#deactivationRequested || !this.#isActive()) {
      this.#deactivationRequested = true;
      await this.#teardownWhenReady();
      return "inactive-after-boot";
    }
    return "enabled";
  }

  #teardownWhenReady(): Promise<void> {
    this.#teardownPromise ||= (async () => {
      try {
        if (this.#bootPromise) await this.#bootPromise;
        if (this.#enablePromise) await this.#enablePromise;
        let disableFailed = false;
        let disableError: unknown;
        try {
          await this.#module.disable?.();
        } catch (error) {
          disableFailed = true;
          disableError = error;
        }
        // A runtime shutdown may arrive while the ordinary async disable is in
        // flight. Re-read the flag after that await so shutdown still guarantees
        // disposal without starting a second teardown sequence.
        if (!disableFailed || this.#shutdownRequested) await this.#module.dispose?.();
        if (disableFailed) throw disableError;
      } finally {
        this.#onDisposed();
      }
    })();
    return this.#teardownPromise;
  }
}

export async function disableContentApp(module: MilxdyContentAppModule): Promise<void> {
  await module.disable?.();
  await module.dispose?.();
}

export async function disposeContentApp(module: MilxdyContentAppModule): Promise<void> {
  try {
    await module.disable?.();
  } finally {
    await module.dispose?.();
  }
}
