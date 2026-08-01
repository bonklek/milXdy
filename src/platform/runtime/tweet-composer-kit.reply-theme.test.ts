import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Composer Kit quick-reply theme", () => {
  it("uses a scoped pink and purple treatment in light, dim, and dark modes", async () => {
    const css = await readFile(
      new URL("../../../examples/packages/local-dev/tweet-composer-kit/styles/composer-kit.css", import.meta.url),
      "utf8",
    );
    const replyTheme = css.slice(
      css.indexOf(".tweet-composer-kit__reply-menu"),
      css.indexOf(".tweet-composer-kit__notice"),
    );

    expect(replyTheme).toContain("--tck-reply-surface: #fff3fa;");
    expect(replyTheme).toContain("--tck-reply-frame: #7b356a;");
    expect(replyTheme).toContain('html[data-milxdy-x-theme="dim"] .tweet-composer-kit__reply-menu');
    expect(replyTheme).toContain('html[data-milxdy-x-theme="dark"] .tweet-composer-kit__reply-menu');
    expect(replyTheme).toContain("background: linear-gradient(180deg");
    expect(replyTheme).toContain("border-inline-start: 4px solid var(--tck-reply-accent)");
    expect(replyTheme).toContain("outline: 2px solid var(--tck-reply-focus)");
  });
});
