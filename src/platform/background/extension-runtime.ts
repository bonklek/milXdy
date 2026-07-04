let invalidated = false;

export function hasExtensionRuntime(): boolean {
  return !invalidated && typeof globalThis.chrome?.runtime?.id === "string" && globalThis.chrome.runtime.id.length > 0;
}

export function markExtensionInvalidated(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/extension context invalidated|context invalidated|extension context/i.test(message)) {
    invalidated = true;
    return true;
  }
  return false;
}

export async function safeLocalGet<T extends Record<string, unknown>>(defaults: T): Promise<T | null>;
export async function safeLocalGet(key: string): Promise<Record<string, unknown> | null>;
export async function safeLocalGet(input: string | Record<string, unknown>): Promise<Record<string, unknown> | null> {
  if (!hasExtensionRuntime()) return null;
  try {
    if (typeof input === "string") {
      return await chrome.storage.local.get([input] as never[]);
    }
    return await chrome.storage.local.get(input as never);
  } catch (error) {
    if (!markExtensionInvalidated(error)) throw error;
    return null;
  }
}

export async function safeLocalSet(values: Record<string, unknown>): Promise<boolean> {
  if (!hasExtensionRuntime()) return false;
  try {
    await chrome.storage.local.set(values);
    return true;
  } catch (error) {
    if (!markExtensionInvalidated(error)) throw error;
    return false;
  }
}

export async function safeLocalRemove(keys: readonly string[]): Promise<boolean> {
  if (!hasExtensionRuntime() || keys.length === 0) return false;
  try {
    await chrome.storage.local.remove([...keys] as never[]);
    return true;
  } catch (error) {
    if (!markExtensionInvalidated(error)) throw error;
    return false;
  }
}

export async function safeSyncRemove(keys: readonly string[]): Promise<boolean> {
  if (!hasExtensionRuntime() || keys.length === 0) return false;
  try {
    await chrome.storage.sync.remove([...keys] as never[]);
    return true;
  } catch (error) {
    if (!markExtensionInvalidated(error)) throw error;
    return false;
  }
}

export async function safeRuntimeMessage<T>(message: unknown): Promise<T | null> {
  if (!hasExtensionRuntime()) return null;
  try {
    return await chrome.runtime.sendMessage(message) as T;
  } catch (error) {
    if (!markExtensionInvalidated(error)) throw error;
    return null;
  }
}
