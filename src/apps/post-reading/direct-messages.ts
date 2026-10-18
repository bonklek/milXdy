import { visibleText } from "./visible-text";
// Only explicit conversation containers; never infer message content from the inbox or page text.
export const DM_CONVERSATION = '[data-testid="DmActivityViewport"], [data-testid="dm-conversation-panel"]';
export const DM_TEXT = '[data-testid="messageEntry"] [data-testid="messageText"], [data-testid^="message-text-"]';
const DM_ENTRY = '[data-testid="messageEntry"], [data-testid^="message-"]:not([data-testid^="message-text-"])';
export type ConversationReading = { text: string; bodies: { body: HTMLElement; text: string; start: number; end: number }[] };

export function isDirectMessageRoute(pathname: string): boolean {
  return /^\/messages\/[^/]+\/?$/.test(pathname) || /^\/i\/chat(?:\/[^/]+)?\/?$/.test(pathname);
}

/** A user-invoked immutable snapshot of rendered message bodies, never inbox previews. */
export function extractConversationReading(conversation: HTMLElement): ConversationReading {
  const bodies: ConversationReading["bodies"] = [];
  const seenIds = new Set<string>();
  let text = "";
  for (const body of Array.from(conversation.querySelectorAll<HTMLElement>(DM_TEXT))) {
    if (body.closest(DM_CONVERSATION) !== conversation) continue;
    const entry = body.closest<HTMLElement>(DM_ENTRY);
    if (!entry) continue;
    const testId = entry.getAttribute("data-testid");
    const id = entry.getAttribute("data-message-id") || (testId?.startsWith("message-") ? testId : null);
    if (id && seenIds.has(id)) continue;
    const readable = visibleText(body).replace(/\s+/g, " ").trim();
    if (!readable) continue;
    if (id) seenIds.add(id);
    const direction = entry?.getAttribute("data-message-direction");
    const speaker = direction === "outgoing" ? "You" : direction === "incoming" ? "Other person" : "Message";
    text += `${text ? "\n\n" : ""}${speaker}: `;
    const start = text.length;
    text += readable;
    bodies.push({ body, text: readable, start, end: text.length });
  }
  return { text, bodies };
}

function findConversation(): HTMLElement | null {
  // X Chat renders inside these observed open shadow hosts. Do not traverse arbitrary page shadows.
  const roots: ParentNode[] = [document];
  for (const host of document.querySelectorAll('[data-testid="xchatEmbedRoute"], [data-testid="xchatEmbedDrawer"]')) {
    if (host.shadowRoot) roots.push(host.shadowRoot);
  }
  return roots.flatMap((root) => Array.from(root.querySelectorAll<HTMLElement>(DM_CONVERSATION))).find((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== "hidden";
  }) || null;
}

export function setupConversationReadAction(read: (snapshot: ConversationReading) => void, active: () => boolean, schedule: (callback: () => void, delay: number) => () => void): () => void {
  let button: HTMLButtonElement | null = null;
  let review: HTMLDialogElement | null = null;
  const closeReview = () => { review?.remove(); review = null; button?.focus({ preventScroll: true }); };
  const clear = () => { button?.remove(); review?.remove(); button = null; review = null; };
  const openReview = () => {
    if (!active() || !isDirectMessageRoute(window.location.pathname)) return;
    review?.remove();
    const conversation = findConversation();
    // Capture private content only on this explicit click, never during the discovery poll.
    const snapshot = conversation ? extractConversationReading(conversation) : null;
    const route = window.location.pathname;
    review = document.createElement("dialog");
    review.dataset.postReadingDmReview = "true";
    review.id = "post-reading-dm-review";
    review.setAttribute("aria-label", "Review conversation reading");
    review.style.cssText = "box-sizing:border-box;max-width:min(620px,calc(100vw - 32px));width:620px;max-height:calc(100vh - 32px);overflow:auto;padding:24px;border:1px solid #888;border-radius:16px;background:Canvas;color:CanvasText;font:14px/1.5 system-ui,sans-serif";
    const heading = document.createElement("h2");
    heading.textContent = "Read visible messages aloud";
    const notice = document.createElement("p");
    notice.textContent = snapshot?.text
      ? "Review the currently loaded messages, in displayed conversation order. Uses your selected browser voice; the browser may use a remote voice service. Custom HTTP TTS is bypassed for private messages. Messages loaded later are included only when you start a new reading."
      : "Open a conversation and load its messages, then try again. milXdy could not identify supported message bodies in this view. It will not read inbox previews, the composer, or unrelated page text. Some X Chat layouts are not supported yet.";
    review.append(heading, notice);
    if (snapshot?.text && conversation) {
      const preview = document.createElement("textarea");
      preview.value = snapshot.text;
      preview.readOnly = true;
      preview.style.cssText = "box-sizing:border-box;width:100%;min-height:220px;font:inherit";
      preview.setAttribute("aria-label", "Visible messages to read");
      const start = document.createElement("button");
      start.type = "button";
      start.textContent = "Read with browser voice";
      start.onclick = () => {
        if (active() && window.location.pathname === route && findConversation() === conversation
          && snapshot.bodies.every(({ body, text }) => body.isConnected && conversation.contains(body)
            && visibleText(body).replace(/\s+/g, " ").trim() === text)) read(snapshot);
        closeReview();
      };
      review.append(preview, start);
    }
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    cancel.autofocus = true;
    cancel.onclick = closeReview;
    review.addEventListener("close", () => { review?.remove(); review = null; });
    review.append(cancel);
    document.body.append(review);
    review.showModal();
    cancel.focus();
  };
  const refresh = () => {
    if (!active() || !isDirectMessageRoute(window.location.pathname)) { clear(); return; }
    if (!button?.isConnected) {
      button = document.createElement("button");
      button.type = "button";
      button.textContent = "Read visible messages aloud";
      button.dataset.postReadingDmButton = "true";
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-controls", "post-reading-dm-review");
      // A document-level control stays discoverable when X virtualizes or scrolls its message viewport.
      button.style.cssText = "position:fixed;top:76px;right:24px;z-index:2147483000;max-width:calc(100vw - 32px);padding:10px 14px;border:1px solid #536471;border-radius:999px;background:Canvas;color:CanvasText;box-shadow:0 2px 10px #0003;font:600 14px/1.4 system-ui,sans-serif;cursor:pointer";
      button.addEventListener("click", openReview);
      document.body.append(button);
    }
  };
  let disposed = false;
  let cancelRefresh: (() => void) | null = null;
  const tick = () => {
    if (disposed) return;
    refresh();
    cancelRefresh = schedule(tick, 750);
  };
  tick();
  return () => { disposed = true; cancelRefresh?.(); clear(); };
}
