let active: { cleanup: () => void; owner: HTMLElement | null } | null = null;

export function setPointerSession(cleanup: () => void, owner: HTMLElement | null): void {
  active = { cleanup, owner };
}

export function clearPointerSession(cleanup: () => void): void {
  if (active?.cleanup === cleanup) active = null;
}

/** Returns false when another panel owns the session. */
export function cancelPointerSession(owner?: HTMLElement): boolean {
  if (owner && active?.owner !== owner) return false;
  const session = active;
  active = null;
  session?.cleanup();
  return true;
}
