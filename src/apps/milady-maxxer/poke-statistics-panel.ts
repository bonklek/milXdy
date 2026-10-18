import { type PokeStatistics } from "./shared/poke-statistics";
let latestStatus = { scope: "", message: "", error: false };
export function pokeStatisticsSection(stats: PokeStatistics | null, scope: string | null, reset: (scope: string) => Promise<boolean>, refresh: () => void, retry: (scope: string) => Promise<void> = async () => undefined): HTMLElement {
  const section = document.createElement("section"); section.className = "miladymaxxer-panel-section"; section.setAttribute("aria-label", "Successful outgoing pokes");
  const heading = document.createElement("strong"); heading.textContent = "Successful outgoing pokes";
  section.dataset.pokeScope = scope || "";
  if (!stats) return unavailablePokeStatistics(section, heading, scope, retry, refresh);
  const total = document.createElement("p"); total.textContent = `${stats.totalSuccessfulPokes} successful · ${stats.trackedSuccessfulPokes} to tracked profiles`;
  const last = document.createElement("p"); last.textContent = stats.lastSuccessfulPokeAt === null ? "No successful pokes recorded yet." : `Last success: ${new Date(stats.lastSuccessfulPokeAt).toLocaleString()}`;
  const note = document.createElement("p"); note.textContent = "Stored locally for this X account. Totals stay until reset. No target names are saved. Recent success records expire after 90 days. Reset preserves XP and collection.";
  const status = document.createElement("p"); status.setAttribute("role", latestStatus.scope === scope && latestStatus.error ? "alert" : "status"); status.textContent = latestStatus.scope === scope ? latestStatus.message : "";
  const button = document.createElement("button"); button.type = "button"; button.dataset.maxxerPokeReset = "true"; button.textContent = "Reset poke counts"; button.disabled = !scope; button.style.cssText = "min-height:34px;padding:6px 10px";
  button.addEventListener("click", () => {
    button.hidden = true;
    const confirmation = document.createElement("div"); confirmation.setAttribute("role", "group"); confirmation.setAttribute("aria-label", "Confirm poke count reset");
    const question = document.createElement("p"); question.textContent = "Reset this account’s poke counts? XP and collection will stay.";
    const cancel = document.createElement("button"); cancel.type = "button"; cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => { confirmation.remove(); button.hidden = false; button.focus(); });
    const confirm = document.createElement("button"); confirm.type = "button"; confirm.textContent = "Confirm reset";
    confirm.addEventListener("click", async () => {
      confirm.disabled = true; cancel.disabled = true;
      let ok = false; try { ok = await reset(scope!); } catch { /* Show a local retryable failure without changing server poke behavior. */ }
      latestStatus = { scope: scope || "", error: !ok, message: ok ? "Poke counts reset. XP and collection are unchanged." : "Could not reset poke counts. Check the active account and try again." };
      status.textContent = latestStatus.message; status.setAttribute("role", ok ? "status" : "alert");
      if (ok) { total.textContent = "0 successful · 0 to tracked profiles"; last.textContent = "No successful pokes recorded yet."; }
      const active = document.activeElement, restoreFocus = active === document.body || section.contains(active);
      confirmation.remove(); button.hidden = false; refresh();
      const current = document.querySelector<HTMLElement>("[data-poke-scope]");
      if (restoreFocus && current?.dataset.pokeScope === scope && (document.activeElement === document.body || current.contains(document.activeElement))) current.querySelector<HTMLElement>("[data-maxxer-poke-reset]")?.focus();
    });
    for (const control of [cancel, confirm]) control.style.cssText = "min-height:34px;padding:6px 10px;margin-right:8px";
    confirmation.append(question, cancel, confirm); section.append(confirmation); cancel.focus();
  });
  section.append(heading, total, last, note, status, button); return section;
}
function unavailablePokeStatistics(section: HTMLElement, heading: HTMLElement, scope: string | null, retry: (scope: string) => Promise<void>, refresh: () => void): HTMLElement {
  const status = document.createElement("p"); status.setAttribute("role", "status"); status.textContent = "Poke statistics are unavailable. Your XP and collection are still available.";
  const reset = document.createElement("button"); reset.type = "button"; reset.textContent = "Reset poke counts"; reset.disabled = true;
  const button = document.createElement("button"); button.type = "button"; button.dataset.pokeRetry = "true"; button.textContent = "Retry poke statistics"; button.disabled = !scope;
  button.addEventListener("click", async () => {
    button.disabled = true; button.textContent = "Retrying…";
    try { await retry(scope!); } catch { /* The unavailable state remains truthful and retryable. */ }
    refresh();
    const current = document.querySelector<HTMLElement>("[data-poke-scope]");
    if (current?.dataset.pokeScope === scope) current.querySelector<HTMLElement>("[data-poke-retry], [data-maxxer-poke-reset]")?.focus();
  });
  for (const control of [reset, button]) control.style.cssText = "min-height:34px;padding:6px 10px";
  section.append(heading, status, reset, button); return section;
}
/** Legacy XP credit stays separate; DOM events never write authoritative poke counts. */
export function observeRemiNetPokeCredits(credit: (handle: string) => void, normalize: (value: string | null) => string, dispose: (cleanup: () => void) => void): void {
  const listener = (event: Event) => { const detail = (event as CustomEvent<{ handle?: unknown }>).detail; const handle = normalize(typeof detail?.handle === "string" ? detail.handle : null); if (handle) credit(handle); };
  window.addEventListener("milxdy:remistats-poke-credit", listener);
  dispose(() => window.removeEventListener("milxdy:remistats-poke-credit", listener));
}
