type Selection = { start: number | null; end: number | null; direction: "forward" | "backward" | "none" | null };
type Bookmark = { active: HTMLElement | null; key: string | undefined; child: number; selection: Selection | null };
const pendingRestores = new WeakMap<HTMLElement, { cancel: () => void; bookmark: Bookmark }>();
const focusable = 'button, input, select, textarea, a[href], summary, [tabindex]';
const findKey = (root: HTMLElement, key: string) => Array.from(root.querySelectorAll<HTMLElement>('[data-hub-focus-id]')).find(el => el.dataset.hubFocusId === key);

/** Restore only focus owned by the old panel, never steal focus from another surface. */
export function captureHubRenderState(root: HTMLElement): () => void {
  const pending = pendingRestores.get(root);
  const carried = document.activeElement === document.body ? pending?.bookmark : undefined;
  pending?.cancel();
  const active = carried?.active ?? (document.activeElement instanceof HTMLElement && root.contains(document.activeElement) ? document.activeElement : null);
  const owner = active?.closest<HTMLElement>('[data-hub-focus-id]');
  const key = carried?.key ?? owner?.dataset.hubFocusId;
  const child = carried?.child ?? (owner && active !== owner ? Array.from(owner.querySelectorAll(focusable)).indexOf(active!) : -1);
  const selection: Selection | null = carried?.selection ?? (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
    ? { start: active.selectionStart, end: active.selectionEnd, direction: active.selectionDirection } : null);
  const scroll = root.scrollTop;
  const openDetails = new Set(Array.from(root.querySelectorAll('details[open]')).map(el => detailKey(el, root)));
  return () => {
    root.querySelectorAll('details').forEach(detail => { if (openDetails.has(detailKey(detail, root))) detail.open = true; });
    root.scrollTop = scroll;
    if (!active || !key || !root.isConnected || document.activeElement !== document.body) return;
    const nextOwner = findKey(root, key);
    const target = child < 0 ? nextOwner : nextOwner?.querySelectorAll<HTMLElement>(focusable)[child];
    const restore = () => {
      if (target && usableControl(target)) {
        target.focus({ preventScroll: true });
        if (document.activeElement !== target) return false;
        if (selection && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) && selection.start !== null) {
          try { target.setSelectionRange(selection.start, selection.end, selection.direction || undefined); } catch { /* Non-text inputs have no selection. */ }
        }
        root.scrollTop = scroll;
        return true;
      }
      return false;
    };
    if (restore()) return;
    if (!target || !visibleControl(target)) { focusHubInitialControl(root); return; }
    waitForEnabledControl(root, restore, { active, key, child, selection });
  };
}

function waitForEnabledControl(root: HTMLElement, restore: () => boolean, bookmark: Bookmark): void {
  const abandon = (event: Event) => { if (event.target instanceof Node && !root.contains(event.target)) finish(); };
  const finish = () => {
    observer.disconnect(); clearTimeout(timeout); pendingRestores.delete(root);
    document.removeEventListener('pointerdown', abandon, true);
    document.removeEventListener('focusin', abandon, true);
  };
  const observer = new MutationObserver(() => {
    if (!root.isConnected || document.activeElement !== document.body || restore()) finish();
  });
  const timeout = window.setTimeout(() => { if (root.isConnected && document.activeElement === document.body) focusHubInitialControl(root); finish(); }, 2000);
  observer.observe(root, { attributes: true, subtree: true, attributeFilter: ['disabled'] });
  document.addEventListener('pointerdown', abandon, true);
  document.addEventListener('focusin', abandon, true);
  pendingRestores.set(root, { cancel: finish, bookmark });
}

export function handleHubEscape(event: KeyboardEvent, root: HTMLElement, close: () => void): void {
  if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
  const target = event.target instanceof Element ? event.target : null;
  if (!target || !root.contains(target) || target.closest('dialog[open], [role="dialog"], [role="alertdialog"]')) return;
  event.stopPropagation();
  if (target instanceof HTMLSelectElement || target instanceof HTMLInputElement && target.type === 'search' && target.value) return;
  const detail = target.closest('details[open]');
  if (detail) { event.preventDefault(); detail.removeAttribute('open'); detail.querySelector<HTMLElement>('summary')?.focus(); return; }
  event.preventDefault(); close();
}

export function focusHubInitialControl(root: HTMLElement): void {
  const candidates = Array.from(root.querySelectorAll<HTMLElement>('[data-hub-focus-id="search"], button, input, select, textarea, a[href], summary, [tabindex]'));
  const search = candidates.find(el => el.dataset.hubFocusId === "search" && usableControl(el));
  (search ?? candidates.find(usableControl))?.focus({ preventScroll: true });
}

function detailKey(detail: Element, root: HTMLElement): string {
  const owner = detail.closest<HTMLElement>('[data-hub-app-id]') || root;
  return `${owner.dataset.hubAppId || 'panel'}:${Array.from(owner.querySelectorAll('details')).indexOf(detail as HTMLDetailsElement)}:${detail.querySelector('summary')?.textContent}`;
}

function visibleControl(target: HTMLElement): boolean {
  return target.isConnected && !target.closest("[inert], [hidden]") && target.getClientRects().length > 0 && getComputedStyle(target).visibility !== "hidden";
}
function usableControl(target: HTMLElement): boolean {
  return visibleControl(target) && !target.matches(":disabled") && !target.closest("fieldset[disabled]");
}
