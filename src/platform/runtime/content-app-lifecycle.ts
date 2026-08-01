import type { MilxdyContentAppContext, MilxdyContentAppModule, MilxdyRouteChange } from "../app-sdk/app-platform";

export type ContentAppActivation = "enabled" | "inactive-after-boot";

type ContentAppHook = "boot" | "enable" | "disable" | "dispose" | "route" | "open" | "close";

export class ContentAppLifecycleOwner {
  readonly #module: MilxdyContentAppModule;
  readonly #context: MilxdyContentAppContext;
  readonly #isActive: () => boolean;
  readonly #onDisposed: () => void;
  readonly #onAbort: () => void;
  readonly #activeHooks = new Set<Promise<void>>();
  #bootPromise: Promise<void> | null = null;
  #enablePromise: Promise<void> | null = null;
  #activationPromise: Promise<ContentAppActivation> | null = null;
  #teardownPromise: Promise<void> | null = null;
  #deactivationRequested = false;
  #shutdownRequested = false;
  #abortRequested = false;

  constructor(
    module: MilxdyContentAppModule,
    context: MilxdyContentAppContext,
    isActive: () => boolean,
    onDisposed: () => void = () => undefined,
    onAbort: () => void = () => undefined,
  ) {
    this.#module = module;
    this.#context = context;
    this.#isActive = isActive;
    this.#onDisposed = onDisposed;
    this.#onAbort = onAbort;
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

  route(route: MilxdyRouteChange): Promise<void> {
    return this.#invokeOperationalHook("route", () => this.#module.onRouteChange?.(route));
  }

  open(): Promise<void> {
    return this.#invokeOperationalHook("open", () => this.#module.open?.());
  }

  close(): Promise<void> {
    return this.#invokeOperationalHook("close", () => this.#module.close?.());
  }

  async #activate(): Promise<ContentAppActivation> {
    try {
      this.#bootPromise = invokeHook(() => this.#module.boot?.(this.#context));
      await this.#bootPromise;
      if (this.#deactivationRequested || !this.#isActive()) {
        this.#deactivationRequested = true;
        await this.#teardownWhenReady();
        return "inactive-after-boot";
      }
      this.#enablePromise = invokeHook(() => this.#module.enable?.());
      await this.#enablePromise;
      if (this.#deactivationRequested || !this.#isActive()) {
        this.#deactivationRequested = true;
        await this.#teardownWhenReady();
        return "inactive-after-boot";
      }
      return "enabled";
    } catch (error) {
      this.#deactivationRequested = true;
      throw await this.#failureWithTeardown(error, "activation");
    }
  }

  async #invokeOperationalHook(hook: Extract<ContentAppHook, "route" | "open" | "close">, invoke: () => Promise<void> | void | undefined): Promise<void> {
    if (this.#teardownPromise || this.#deactivationRequested) return;
    const operation = invokeHook(invoke);
    this.#activeHooks.add(operation);
    try {
      await operation;
    } catch (error) {
      this.#deactivationRequested = true;
      throw await this.#failureWithTeardown(error, hook);
    } finally {
      this.#activeHooks.delete(operation);
    }
  }

  async #failureWithTeardown(primaryError: unknown, hook: string): Promise<unknown> {
    let teardownError: unknown;
    try {
      await this.#teardownWhenReady();
    } catch (error) {
      teardownError = error;
    }
    return combineErrors([primaryError, teardownError], `milXdy app ${hook} and teardown failed`);
  }

  #teardownWhenReady(): Promise<void> {
    this.#teardownPromise ||= (async () => {
      const errors: unknown[] = [];
      this.#requestAbort(errors);

      // Hooks may have registered work before rejecting. Wait until each hook is
      // settled, but preserve its error on the caller that invoked it rather
      // than allowing it to suppress the independent teardown stages below.
      await Promise.allSettled([
        ...(this.#bootPromise ? [this.#bootPromise] : []),
        ...(this.#enablePromise ? [this.#enablePromise] : []),
        ...this.#activeHooks,
      ]);

      await collectHookError(errors, () => this.#module.disable?.());
      await collectHookError(errors, () => this.#module.dispose?.());
      try {
        this.#onDisposed();
      } catch (error) {
        errors.push(error);
      }
      throwCollected(errors, this.#shutdownRequested ? "milXdy app shutdown failed" : "milXdy app teardown failed");
    })();
    return this.#teardownPromise;
  }

  #requestAbort(errors: unknown[]): void {
    if (this.#abortRequested) return;
    this.#abortRequested = true;
    try {
      this.#onAbort();
    } catch (error) {
      errors.push(error);
    }
  }
}

export async function disableContentApp(module: MilxdyContentAppModule): Promise<void> {
  const errors: unknown[] = [];
  await collectHookError(errors, () => module.disable?.());
  await collectHookError(errors, () => module.dispose?.());
  throwCollected(errors, "milXdy app teardown failed");
}

export async function disposeContentApp(module: MilxdyContentAppModule): Promise<void> {
  const errors: unknown[] = [];
  await collectHookError(errors, () => module.disable?.());
  await collectHookError(errors, () => module.dispose?.());
  throwCollected(errors, "milXdy app shutdown failed");
}

function invokeHook(invoke: () => Promise<void> | void | undefined): Promise<void> {
  try {
    return Promise.resolve(invoke());
  } catch (error) {
    return Promise.reject(error);
  }
}

async function collectHookError(errors: unknown[], invoke: () => Promise<void> | void | undefined): Promise<void> {
  try {
    await invokeHook(invoke);
  } catch (error) {
    errors.push(error);
  }
}

function throwCollected(errors: unknown[], message: string): void {
  const combined = combineErrors(errors, message);
  if (combined !== undefined) throw combined;
}

function combineErrors(errors: unknown[], message: string): unknown {
  const present = errors.filter((error) => error !== undefined);
  if (present.length === 0) return undefined;
  if (present.length === 1) return present[0];
  return new AggregateError(present, message);
}
