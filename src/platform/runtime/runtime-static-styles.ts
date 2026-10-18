import composerActionStyles from "./composer-action.css";
import contextualPostActionStyles from "./contextual-post-action.css";
import tweetScaffoldStyles from "./tweet-scaffold.css";

export function injectComposerActionStyles(): void {
  injectRuntimeStyle("milxdy-composer-action-styles", composerActionStyles, "    ");
}

export function injectContextualPostActionStyles(): HTMLStyleElement | null {
  return injectRuntimeStyle("milxdy-contextual-post-action-styles", contextualPostActionStyles, "    ");
}

export function injectTweetScaffoldStyles(styleId = "milxdy-tweet-scaffold-style"): void {
  injectRuntimeStyle(styleId, tweetScaffoldStyles, "  ");
}

function injectRuntimeStyle(id: string, styles: string, closingIndent: string): HTMLStyleElement | null {
  if (document.getElementById(id)) return null;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `\n${styles.replace(/(?:\r?\n)+$/, "")}\n${closingIndent}`;
  document.documentElement.appendChild(style);
  return style;
}
