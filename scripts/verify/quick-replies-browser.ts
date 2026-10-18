import { verifyMakerPanel } from "./maker-panel-browser";
import { waitForReplyComposerText, openNativeReply } from "../../src/platform/runtime/native-reply-insertion";
import { boot, onReplyAction } from "../../packages/maintainer/tweet-composer-kit/src/content.js";

const result = { passed: false, assertions: 0, checks: [] as string[], error: "" };
const assert = (value: unknown, message: string) => { if (!value) throw new Error(message); result.assertions++; result.checks.push(message); };
const frames = async (count = 4) => { for (let i = 0; i < count; i++) await new Promise(requestAnimationFrame); };
const fixture = (existing = "", pasteValue?: string) => {
  document.querySelectorAll('[role="dialog"]').forEach(node => node.remove());
  const dialog = document.createElement("section"); dialog.setAttribute("role", "dialog");
  dialog.innerHTML = '<div contenteditable="true" data-testid="tweetTextarea_0"></div><button data-testid="tweetButton">Mock native submit</button>';
  document.body.append(dialog);
  const editor = dialog.querySelector<HTMLElement>("[contenteditable]")!; editor.textContent = existing;
  let insertions = 0, submissions = 0;
  editor.addEventListener("paste", event => { event.preventDefault(); insertions++; editor.textContent = pasteValue ?? event.clipboardData!.getData("text/plain"); });
  dialog.querySelector("button")!.addEventListener("click", () => submissions++);
  return { dialog, editor, counts: () => [insertions, submissions] };
};
(async () => {
  try {
    let f = fixture(); let cancel = waitForReplyComposerText("milady"); await frames(35);
    assert(f.editor.innerText === "milady" && String(f.counts()) === "1,0", "Default inserts exact lowercase literal once without submitting"); cancel();
    f = fixture(); cancel = waitForReplyComposerText("remilio", { sendAfterInsert: true }); await frames();
    f.editor.append(document.createElement("span")); await frames();
    assert(String(f.counts()) === "1,1", "Opted-in template inserts and submits exactly once despite mutations"); cancel();
    f = fixture("existing draft"); cancel = waitForReplyComposerText("milady", { sendAfterInsert: true }); await frames();
    assert(String(f.counts()) === "0,0" && f.editor.innerText === "existing draft", "Existing draft is preserved and never submitted"); cancel();
    f = fixture("", "milady extra"); cancel = waitForReplyComposerText("milady", { sendAfterInsert: true }); await frames(35);
    assert(String(f.counts()) === "1,0", "Controlled-text mismatch fails closed without repeat insertion"); cancel();
    f = fixture(); cancel = waitForReplyComposerText("milady", { sendAfterInsert: true }); cancel(); await frames();
    assert(String(f.counts()) === "1,0", "Cancellation prevents a pending submit");
    f = fixture(); const other = document.createElement("section"); other.setAttribute("role", "dialog"); other.innerHTML = '<button data-testid="tweetButton">Other dialog</button>'; document.body.prepend(other);
    let otherClicks = 0; other.querySelector("button")!.addEventListener("click", () => otherClicks++);
    cancel = waitForReplyComposerText("milady", { sendAfterInsert: true }); await frames();
    assert(otherClicks === 0 && String(f.counts()) === "1,1", "Only the selected editor’s own dialog may submit"); cancel();
    f = fixture();
    const unrelated = f;
    const native = document.createElement("button"); document.body.append(native);
    let nativeOpens = 0;
    native.addEventListener("click", () => { nativeOpens++; });
    cancel = openNativeReply(native, "milady", { sendAfterInsert: true }); await frames();
    assert(String(unrelated.counts()) === "0,0" && nativeOpens === 0, "Existing unrelated empty composer never receives or submits the template"); cancel(); native.remove();
    document.querySelectorAll('[role="dialog"]').forEach(node => node.remove());
    const initiatingButton = document.createElement("button"); document.body.append(initiatingButton);
    let created: ReturnType<typeof fixture> | null = null;
    initiatingButton.addEventListener("click", () => { created = fixture(); });
    cancel = openNativeReply(initiatingButton, "remilio", { sendAfterInsert: true }); await frames();
    assert(String((created as ReturnType<typeof fixture> | null)?.counts()) === "1,1", "New composer created by native invocation receives one verified insertion and submit"); cancel(); initiatingButton.remove();
    document.querySelectorAll('[role="dialog"]').forEach(node => node.remove());
    const errorPanel = document.createElement("div"); document.body.append(errorPanel);
    boot({ recordDiagnostic: () => undefined, resolveAssetUrl: (path: string) => (globalThis as unknown as { __replyFixtureAssets: Record<string, string> }).__replyFixtureAssets[path] || "" });
    onReplyAction({ panel: errorPanel, signal: new AbortController().signal, templates: [{ id: "error", label: "retry" }], selectTemplate: async () => { throw new Error("Changed phrase"); }, openNativeReply: () => undefined, close: () => undefined });
    errorPanel.querySelectorAll<HTMLButtonElement>("button")[1].click(); await frames();
    assert(errorPanel.textContent!.includes("Quick reply could not open. Try again.") && !errorPanel.querySelector<HTMLButtonElement>("button")!.disabled, "Async selection failure restores controls and visible retry feedback"); errorPanel.remove();
    const refusalPanel = document.createElement("div"); document.body.append(refusalPanel);
    onReplyAction({ panel: refusalPanel, signal: new AbortController().signal, templates: [{ id: "refuse", label: "milady" }], selectTemplate: async () => { throw new Error("Close the existing reply draft before inserting a quick reply."); }, openNativeReply: () => undefined, close: () => undefined });
    const retry = refusalPanel.querySelectorAll<HTMLButtonElement>("button")[1]; retry.focus(); retry.click(); await frames();
    assert(refusalPanel.textContent!.includes("Close the existing reply draft before inserting a quick reply.") && document.activeElement === retry && !retry.disabled, "Existing-composer refusal explains recovery and preserves focus for retry"); refusalPanel.remove();
    let selected = "", plain = 0;
    const keyboard = { selected: "" }; Object.assign(globalThis, { __quickReplyKeyboard: keyboard });
    boot({ recordDiagnostic: () => undefined, resolveAssetUrl: (path: string) => (globalThis as unknown as { __replyFixtureAssets: Record<string, string> }).__replyFixtureAssets[path] || "" });
    await verifyMakerPanel(assert);
    for (const enabled of [false, true]) {
      const heading = document.createElement("h2"); heading.textContent = enabled ? "Explicit milady opt-in" : "Default type-only"; document.body.append(heading);
      const panel = document.createElement("div"); panel.style.width = "300px"; document.body.append(panel);
      onReplyAction({ panel, signal: new AbortController().signal, templates: [{ id: "milady", label: "milady", sendAfterInsert: enabled }, { id: "remilio", label: "remilio", sendAfterInsert: false }], selectTemplate: (id: string) => { selected = id; keyboard.selected = id; }, openNativeReply: () => { plain++; }, close: () => undefined });
      const buttons = panel.querySelectorAll<HTMLButtonElement>("button");
      assert(Array.from(buttons, button => button.textContent).join(",") === "reply,milady,remilio" && !panel.querySelector(".tweet-composer-kit__reply-note"), "Reply menu uses short labels without a caption");
      buttons[1].focus(); assert(document.activeElement === buttons[1], "Template button receives keyboard focus");
      if (!enabled) { buttons[0].click(); assert(plain === 1 && !selected, "Plain reply only invokes native-open callback"); buttons.forEach(button => { button.disabled = false; }); }
      assert(panel.scrollWidth <= panel.clientWidth + 1, "Narrow reply menu has no horizontal clipping");
    }
    result.passed = true;
  } catch (error) { result.error = String(error); }
  Object.assign(globalThis, { __quickReplyResult: result });
})();
