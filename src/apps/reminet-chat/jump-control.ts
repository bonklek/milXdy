export const CHAT_JUMP_CONTROLS = `<div class="milxdy-chat-jump-controls" data-role="jump-controls" hidden>
        <button type="button" data-role="jump-bottom" aria-label="Jump to latest messages" title="Jump to latest messages">↓</button>
        <button type="button" data-role="dismiss-jump" aria-label="Dismiss jump to latest messages" title="Dismiss">×</button>
      </div>`;

const updates = new WeakMap<HTMLElement, (available: boolean) => void>();

/** Keep a dismissed prompt hidden while the user continues reading history. */
export function installChatJumpControl(root: HTMLElement): void {
  const messages = root.querySelector<HTMLElement>('[data-role="messages"]');
  const controls = root.querySelector<HTMLElement>('[data-role="jump-controls"]');
  const jump = controls?.querySelector<HTMLButtonElement>('[data-role="jump-bottom"]');
  const dismiss = controls?.querySelector<HTMLButtonElement>('[data-role="dismiss-jump"]');
  if (!messages || !controls || !jump || !dismiss) return;
  let dismissed = false;
  let available = false;
  const update = (nextAvailable = available) => {
    available = nextAvailable;
    const atBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight <= 48;
    if (atBottom) dismissed = false;
    controls.hidden = !available || atBottom || dismissed;
  };
  messages.addEventListener('scroll', () => update(), { passive: true });
  jump.addEventListener('click', () => {
    messages.scrollTop = messages.scrollHeight;
    update();
    messages.focus({ preventScroll: true });
  });
  dismiss.addEventListener('click', () => {
    dismissed = true;
    update();
    messages.focus({ preventScroll: true });
  });
  updates.set(root, update);
  update();
}

export function syncChatJumpControl(root: HTMLElement, available: boolean): void {
  updates.get(root)?.(available);
}
