import { readPokeCooldownMs, formatPokeCooldown } from "../../src/apps/remistats/poke-cooldown-time";
import { createPokeClickHandler, renderPokeButtonState } from "../../src/apps/remistats/poke-feedback";
const result = { passed: false, assertions: 0, checks: [] as string[], error: "" };
const assert = (value: unknown, message: string) => { if (!value) throw new Error(message); result.assertions++; result.checks.push(message); };
const hostile = "Bearer secret-private-target@example.invalid";
(async () => {
  const originalWarn = console.warn;
  const warnings: unknown[][] = [];
  console.warn = (...args) => { warnings.push(args); };
  try {
    document.body.style.cssText = "margin:0;padding:24px;font:14px system-ui;background:#eee;display:grid;grid-template-columns:repeat(2,360px);gap:20px";
    for (const theme of ["light", "dark"]) {
      const section = document.createElement("section");
      section.style.cssText = `padding:24px;background:${theme === "dark" ? "#15202b" : "#fff"};color:${theme === "dark" ? "#e7e9ea" : "#111"};border:1px solid #aaa`;
      section.innerHTML = `<h2>${theme} — mocked poke results</h2>`;
      document.body.append(section);
      for (const [title, response] of [
        ["Request failure", { ok: false, category: hostile, code: hostile, status: Infinity, message: hostile, headers: { Authorization: hostile } }],
        ["Authentication required", { authRequired: true, message: hostile }],
        ["Poke permission required", { scopeRequired: true, message: hostile }],
        ["Unknown cooldown", { code: "poke_cooldown", message: hostile }],
      ] as const) {
        const row = document.createElement("div"); row.style.cssText = "position:relative;height:130px;padding:20px 0 0";
        const label = document.createElement("p"); label.textContent = title; row.append(label);
        const button = document.createElement("button"); button.type = "button"; button.className = "reminet-poke-button"; button.style.cssText = "display:block;margin-left:145px;margin-top:30px"; row.append(button); section.append(row);
        const handler = createPokeClickHandler({
          target: () => ({ username: "example", xHandle: "example" }), cooldown: () => 0,
          startCooldown: () => undefined, request: async () => response,
          state: (target, state, message) => renderPokeButtonState(target, state, message, target => { target.textContent = "☞"; }),
          success: () => { throw new Error("Failure must not credit success"); }, playSound: () => undefined,
          successful: () => false, cooldownMs: () => 0, explicitCooldown: value => value?.code === "poke_cooldown",
        });
        await handler(button);
        assert(button.dataset.reminetPokeState === "error" && !button.disabled, `${theme} ${title}: recoverable error control`);
        assert(button.getAttribute("aria-label") === button.dataset.reminetPokeMessage, `${theme} ${title}: accessible feedback matches visible message`);
        const bubble = getComputedStyle(button, "::after");
        assert(bubble.content.includes(button.title) && bubble.color !== bubble.backgroundColor, `${theme} ${title}: feedback is rendered with distinct text/background`);
      }
      const now = Date.now();
      for (const [title, response, expected] of [
        ["Repaired legacy deadline", { ok: false, code: "poke_cooldown", cooldownUntil: (now + 90_000) * 1000, cooldownMs: (now + 90_000) * 1000 - now }, "1m"],
        ["500 milliseconds", { ok: false, code: "poke_cooldown", cooldownMs: 500 }, "1s"],
      ] as const) {
        const row = document.createElement("div"); row.style.cssText = "height:85px;padding:8px 0";
        const label = document.createElement("p"); label.textContent = title; row.append(label);
        const button = document.createElement("button"); button.className = "reminet-poke-button"; row.append(button); section.append(row);
        const handler = createPokeClickHandler({ target: () => ({ username: "example", xHandle: "example" }), cooldown: () => 0,
          startCooldown: (_username, ms) => { renderPokeButtonState(button, "cooldown", `Available in ${formatPokeCooldown(ms)}`, () => undefined); button.textContent = formatPokeCooldown(ms); },
          request: async () => response, state: (target, state, message) => renderPokeButtonState(target, state, message, () => undefined), success: () => { throw new Error("Cooldown is not success"); },
          playSound: () => undefined, successful: () => false, cooldownMs: value => readPokeCooldownMs(value, now), explicitCooldown: () => true });
        await handler(button);
        assert(button.textContent === expected && button.disabled, `${theme} ${title}: canonical time rendered ${expected}`);
      }
    }
    assert(!JSON.stringify(warnings).includes(hostile), "Console warnings exclude hostile identifiers, headers and tokens");
    assert(warnings.length === 2, "Only generic failures emit one bounded warning each");
    result.passed = true;
  } catch (error) { result.error = String(error); }
  finally { console.warn = originalWarn; }
  Object.assign(globalThis, { __pokeFeedbackResult: result });
})();
