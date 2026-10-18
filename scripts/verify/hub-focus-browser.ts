import { captureHubRenderState, handleHubEscape } from "../../src/platform/runtime/hub-focus";
(async () => {
  const checks: string[] = [];
  const check = (pass: boolean, text: string) => { if (!pass) throw new Error(text); checks.push(text); };
  const root = document.createElement("aside"), outside = document.createElement("button"); document.body.append(root, outside);
  const render = (disabled = false, hidden = "") => { root.innerHTML = `<input type="search" data-hub-focus-id="search"><div data-hub-focus-id="setting"><input value="draft" ${disabled ? "disabled" : ""} ${hidden}></div>`; };
  const input = () => root.querySelector<HTMLInputElement>('[data-hub-focus-id="setting"] input')!;
  const rerender = (disabled = false, hidden = "") => { const restore = captureHubRenderState(root); render(disabled, hidden); restore(); };
  render(); input().focus(); input().setSelectionRange(2, 4); rerender(true);
  check(document.activeElement === document.body, "Disabled save waits without focus stealing");
  rerender(true); input().disabled = false; await new Promise(r => setTimeout(r, 0));
  check(document.activeElement === input() && input().selectionStart === 2 && input().selectionEnd === 4, "Second rerender retains nested control and caret");
  rerender(true); outside.focus(); input().disabled = false; await new Promise(r => setTimeout(r, 0));
  check(document.activeElement === outside, "Pending save never steals outside focus");
  render(); input().focus(); rerender(true); document.body.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true})); input().disabled=false; await new Promise(r=>setTimeout(r,0));
  check(document.activeElement === document.body, 'Clicking outside blank space abandons pending focus');
  for (const hidden of ['style="display:none"', 'inert', 'hidden']) { render(); input().focus(); rerender(false, hidden); check((document.activeElement as HTMLElement)?.dataset.hubFocusId === "search", `Unavailable target uses visible fallback: ${hidden}`); }
  render(); input().focus(); const restore = captureHubRenderState(root); root.innerHTML = '<input type="search" data-hub-focus-id="search">'; restore();
  check((document.activeElement as HTMLElement)?.dataset.hubFocusId === "search", "Removed control uses search fallback");
  let closed = 0; root.addEventListener("keydown", event => handleHubEscape(event, root, () => closed++));
  root.innerHTML = '<details open><summary>Group</summary><input></details><div role="dialog"><button>Child dialog</button></div><input type="search" value="query">';
  const dispatch = (target: Element) => target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  dispatch(root.querySelector('[role="dialog"] button')!); check(closed === 0, "Child dialog owns Escape");
  dispatch(root.querySelector('input[type="search"]')!); check(closed === 0, "Populated search owns Escape");
  dispatch(root.querySelector('details input')!); check(closed === 0 && !root.querySelector('details')!.open && document.activeElement === root.querySelector('summary'), "Expanded group closes before nonmodal panel");
  dispatch(root.querySelector('summary')!); check(closed === 1, "Unclaimed Escape closes panel");
  (globalThis as any).__hubFocusResult = { passed: true, checks };
})().catch(error => { (globalThis as any).__hubFocusResult = { passed: false, error: String(error) }; });
