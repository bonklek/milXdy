import type { PostDraft } from "./portal-contract";
import { boardTheme } from "./portal-data";

type ComposerOptions = {
  draft: PostDraft | null;
  notice: string;
  submit: (draft: Omit<PostDraft, "updatedAt">, button: HTMLButtonElement, notice: HTMLElement) => Promise<void>;
};

export function createPortalComposer(board: string, threadId: number | null, position: "top" | "bottom", options: ComposerOptions): HTMLElement {
  const form = document.createElement("section");
  form.className = "milxdy-chan-compose";
  form.dataset.boardTheme = boardTheme(board);
  form.dataset.threadId = threadId === null ? "" : String(threadId);
  form.dataset.composePosition = position;
  const destination = threadId === null ? `New thread in /${board}/` : `Reply in /${board}/ No. ${threadId}`;
  const heading = document.createElement("strong");
  heading.textContent = "Post to Miladychan";
  const target = document.createElement("span");
  target.className = "milxdy-chan-compose-target";
  target.textContent = `Destination: ${destination}`;
  const note = document.createElement("p");
  note.textContent = "Submit text anonymously without using a Miladychan, RemiNet, wallet, or extension session. Media, CAPTCHA, and unsupported board requirements stay on native Miladychan.";
  const name = document.createElement("input");
  name.type = "text";
  name.className = "milxdy-chan-compose-subject";
  name.placeholder = "Poster name";
  name.value = options.draft?.name || "milXdy";
  name.maxLength = 100;
  name.setAttribute("aria-label", `Poster name for ${destination}`);
  const subject = document.createElement("input");
  subject.type = "text";
  subject.className = "milxdy-chan-compose-subject";
  subject.placeholder = "Thread subject";
  subject.value = options.draft?.subject || "";
  subject.maxLength = 200;
  subject.hidden = threadId !== null;
  subject.setAttribute("aria-label", `Subject for ${destination}`);
  const textarea = document.createElement("textarea");
  textarea.placeholder = "Write a post…";
  textarea.value = options.draft?.body || "";
  textarea.rows = 1;
  textarea.setAttribute("aria-label", `Post for ${destination}`);
  const actions = document.createElement("div");
  actions.className = "milxdy-chan-compose-actions";
  const submit = document.createElement("button");
  submit.type = "button";
  submit.className = "milxdy-chan-compose-submit";
  submit.textContent = "Post";
  const notice = document.createElement("span");
  notice.className = "milxdy-chan-compose-notice";
  notice.textContent = options.notice;
  let posting = false;
  const updateActions = () => {
    submit.disabled = posting || !textarea.value.trim() || (threadId === null && !subject.value.trim());
  };
  textarea.addEventListener("input", () => {
    resizePostTextarea(textarea);
    updateActions();
  });
  name.addEventListener("input", updateActions);
  subject.addEventListener("input", updateActions);
  submit.addEventListener("click", async () => {
    if (posting) return;
    const poster = name.value.trim() || "anonymous";
    if (!window.confirm(`Post as ${poster} to ${destination}?`)) return;
    posting = true;
    updateActions();
    try {
      await options.submit({ board, threadId, name: name.value, subject: subject.value, body: textarea.value }, submit, notice);
    } catch {
      notice.textContent = "Could not complete submission. Review the result before retrying.";
    } finally {
      posting = false;
      updateActions();
    }
  });
  actions.append(submit);
  form.append(heading, target, note, name, subject, textarea, actions, notice);
  updateActions();
  requestAnimationFrame(() => resizePostTextarea(textarea));
  return form;
}

export function resizePostTextarea(textarea: HTMLTextAreaElement): void {
  textarea.style.height = "auto";
  const styles = getComputedStyle(textarea);
  const lineHeight = Number.parseFloat(styles.lineHeight) || 18;
  const verticalChrome = Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom)
    + Number.parseFloat(styles.borderTopWidth) + Number.parseFloat(styles.borderBottomWidth);
  const tenLineHeight = Math.ceil((lineHeight * 10) + verticalChrome);
  const panelHeight = textarea.closest<HTMLElement>(".milxdy-chan-body")?.clientHeight || tenLineHeight;
  const maxHeight = Math.max(38, Math.min(tenLineHeight, Math.floor(panelHeight * 0.45)));
  const desiredHeight = Math.max(38, textarea.scrollHeight);
  textarea.style.height = `${Math.min(desiredHeight, maxHeight)}px`;
  textarea.style.overflowY = desiredHeight > maxHeight ? "auto" : "hidden";
}
