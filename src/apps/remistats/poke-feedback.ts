const FAILURE_CATEGORIES = new Set(["request", "authentication", "authorization", "not_found", "rate_limit", "cooldown", "server", "network", "timeout", "aborted", "invalid_response"]);
const FAILURE_CODES = new Set(["invalid_request", "unauthorized", "invalid_token", "insufficient_scope", "requires_user", "forbidden", "not_found", "user_not_found", "method_not_allowed", "rate_limited", "poke_cooldown", "internal_error", "invalid_reply", "invalid_response", "network_error", "request_timeout", "request_aborted", "auth_unavailable", "unknown_error"]);
type Response = Record<string, unknown> | null | undefined;
type State = "loading" | "idle" | "error" | "cooldown";
type Target = { username: string; xHandle: string };
type Dependencies = {
  target(button: HTMLButtonElement): Target | null;
  cooldown(username: string): number;
  startCooldown(username: string, ms: number, source?: unknown): void;
  request(payload: Record<string, string>): Promise<Response>;
  state(button: HTMLButtonElement, state: State, label: string): void;
  success(button: HTMLButtonElement, username: string): void;
  playSound(): void;
  successful(response: Response): boolean;
  cooldownMs(response: Response): number;
  explicitCooldown(response: Response): boolean;
};

export function boundedPokeFailure(response: Response) {
  return {
    category: typeof response?.category === "string" && FAILURE_CATEGORIES.has(response.category) ? response.category : "unknown",
    code: typeof response?.code === "string" && FAILURE_CODES.has(response.code) ? response.code : "unknown_error",
    status: typeof response?.status === "number" && Number.isInteger(response.status) && response.status >= 100 && response.status <= 599 ? response.status : 0,
  };
}

/** The content handler keeps useful user state but never forwards response bodies to the console or UI. */
export function createPokeClickHandler(deps: Dependencies) {
  return async (button: HTMLButtonElement): Promise<void> => {
    const target = deps.target(button);
    if (!target || button.disabled) return;
    const { username, xHandle } = target;
    const until = deps.cooldown(username);
    if (until > Date.now()) { deps.startCooldown(username, until - Date.now()); return; }
    deps.playSound();
    button.dataset.reminetPokeShaking = "true";
    deps.state(button, "loading", `Poking ${username}...`);
    let response: Response;
    try {
      response = await deps.request({ type: "remistats:pokeXAuthor", xHandle, expectedRemiliaUsername: username });
    } catch {
      delete button.dataset.reminetPokeShaking;
      deps.state(button, "error", "Poke unavailable. Try again.");
      return;
    }
    delete button.dataset.reminetPokeShaking;
    if (response?.authRequired === true) { deps.state(button, "error", "Reconnect Remilia to poke"); return; }
    if (response?.scopeRequired === true) { deps.state(button, "error", "Reconnect Remilia with poke permission"); return; }
    if (response?.ok === true && deps.successful(response)) {
      deps.success(button, username);
      deps.state(button, "idle", response.localPokeStatsRecorded === false ? `Poked ${username}. Local poke count could not be saved; do not retry the poke.` : `Poked ${username}`);
      return;
    }
    const cooldownMs = deps.cooldownMs(response);
    if (cooldownMs > 0 || deps.explicitCooldown(response)) {
      if (cooldownMs > 0) deps.startCooldown(username, cooldownMs, response?.cooldownSource === "offline-fallback" ? "offline-fallback" : "official");
      else deps.state(button, "error", "Already poked. Cooldown time is unavailable.");
      return;
    }
    const failure = boundedPokeFailure(response);
    console.warn("RemiNet poke failed", failure);
    deps.state(button, "error", failure.category === "network" ? "Poke unavailable while offline. Try again." : "Poke unavailable. Try again.");
  };
}

export function renderPokeButtonState(button: HTMLButtonElement, state: State, label: string, restoreIcon: (button: HTMLButtonElement) => void) {
  button.dataset.reminetPokeState = state;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.disabled = state === "loading" || state === "cooldown";
  if (state === "error") button.dataset.reminetPokeMessage = label;
  else delete button.dataset.reminetPokeMessage;
  if (state === "loading") button.textContent = String.fromCodePoint(0x1FAF5);
  else if (state !== "cooldown") restoreIcon(button);
}
