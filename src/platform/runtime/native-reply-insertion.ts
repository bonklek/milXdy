const REPLY_EDITOR_SELECTOR = '[role="dialog"] [contenteditable="true"][data-testid^="tweetTextarea_"]';

export function hasVisibleNativeReplyComposer(): boolean {
  return Array.from(document.querySelectorAll<HTMLElement>(REPLY_EDITOR_SELECTOR)).some((editor) => editor.offsetParent !== null);
}

/** Existing composers must never be mistaken for the reply opened by this invocation. */
export function openNativeReply(button: HTMLElement, text = "", options: { sendAfterInsert?: boolean } = {}): () => void {
  const existingEditors = new Set(document.querySelectorAll<HTMLElement>(REPLY_EDITOR_SELECTOR));
  const unrelatedVisibleComposer = [...existingEditors].some((editor) => editor.offsetParent !== null);
  if (text && unrelatedVisibleComposer) return () => undefined;
  const cancel = text ? waitForReplyComposerText(text, { ...options, excludedEditors: existingEditors }) : () => undefined;
  button.dataset.milxdyNativeReply = "true";
  button.click();
  return cancel;
}

export function waitForReplyComposerText(text: string, { sendAfterInsert = false, excludedEditors = new Set<HTMLElement>() }: { sendAfterInsert?: boolean; excludedEditors?: ReadonlySet<HTMLElement> } = {}): () => void {
    let cancelled = false;
    let inserted = false;
    let insertionAttempted = false;
    let verificationFrames = 0;
    let submitted = false;
    let attempts = 0;
    let observer: MutationObserver | null = null;
    let timeout = 0;
    const normalizedText = (value: string) => value.replace(/\u00a0/gu, " ");
    const submitWhenReady = (editor: HTMLElement) => {
      if (cancelled || submitted || !editor.isConnected) return;
      const submit = Array.from(editor.closest('[role="dialog"]')?.querySelectorAll<HTMLButtonElement>('[data-testid="tweetButton"]') || [])
        .find((candidate) => candidate.offsetParent !== null && !candidate.disabled && candidate.getAttribute("aria-disabled") !== "true");
      // Fail closed: never submit if X has not rendered exactly the explicit
      // reviewed template the user chose.
      if (!submit || normalizedText(editor.innerText || editor.textContent || "") !== normalizedText(text)) {
        if (++attempts < 30) window.requestAnimationFrame(() => submitWhenReady(editor));
        return;
      }
      submitted = true;
      submit.click();
    };
    const tryInsert = () => {
      if (cancelled || inserted || insertionAttempted) return inserted;
      // X gives its rich-text input and several wrapping containers matching
      // `tweetTextarea_*` IDs. `isContentEditable` is inherited, so it also
      // matches those wrappers. Restrict this bridge to the real editor: a
      // wrapper's text includes X's placeholder and makes both verification
      // and React's editor state unreliable.
      const editor = Array.from(document.querySelectorAll<HTMLElement>(REPLY_EDITOR_SELECTOR))
        .find((candidate) => !excludedEditors.has(candidate) && candidate.offsetParent !== null);
      if (!editor) return false;
      // A template action must never append to an existing native draft. It
      // is safer to leave that draft alone than to guess whether it is stale
      // platform text or user-authored content.
      if (normalizedText(editor.innerText || editor.textContent || "").trim()) return false;
      insertionAttempted = true;
      editor.focus();
      // X's reply composer is DraftJS. Raw DOM insertion and synthetic
      // beforeinput can be ignored by its controlled editor, leaving a visual
      // artifact and a disabled Reply button. DraftJS owns text pasted into
      // its focused editor, so use that text-transfer contract and verify its
      // rendered controlled value before ever considering submission.
      const clipboardData = new DataTransfer();
      clipboardData.setData("text/plain", text);
      editor.dispatchEvent(new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        composed: true,
        clipboardData,
      }));
      const verifyControlledInsertion = () => {
        if (cancelled || !editor.isConnected) return;
        if (normalizedText(editor.innerText || editor.textContent || "") === normalizedText(text)) {
          inserted = true;
          if (sendAfterInsert) window.requestAnimationFrame(() => submitWhenReady(editor));
          return;
        }
        // State updates can render on the following animation frame. Do not
        // mutate the DOM or dispatch a second insertion while waiting.
        if (++verificationFrames < 30) window.requestAnimationFrame(verifyControlledInsertion);
      };
      window.requestAnimationFrame(verifyControlledInsertion);
      return true;
    };
    const cancel = () => { cancelled = true; observer?.disconnect(); window.clearTimeout(timeout); };
    if (tryInsert()) return cancel;
    observer = new MutationObserver(() => {
      if (!tryInsert()) return;
      observer?.disconnect();
      window.clearTimeout(timeout);
    });
    timeout = window.setTimeout(() => observer?.disconnect(), 1500);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return cancel;
  }
