const STYLE_ID = "remilia-wiki-hyperlink-style";

export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .remilia-wiki-link {
      border: 0;
      color: var(--remilia-wiki-link-color, #ff4fbf);
      font: inherit;
      letter-spacing: inherit;
      line-height: inherit;
      padding: 0;
      text-decoration: underline;
      text-decoration-thickness: from-font;
      text-decoration-style: dotted;
      text-underline-offset: 0.18em;
      cursor: pointer;
    }

    .remilia-wiki-link:hover,
    .remilia-wiki-link:focus {
      text-decoration-style: solid;
    }

    html[data-remilia-wiki-debug="true"] .remilia-wiki-link {
      outline: 1px dashed var(--remilia-wiki-link-color, #ff4fbf);
      outline-offset: 2px;
    }

    html[data-remilia-wiki-debug="true"] .remilia-wiki-link::after {
      content: " [" attr(data-wiki-source) ":" attr(data-wiki-confidence) "]";
      font-size: 0.72em;
      opacity: 0.75;
    }

    .remilia-wiki-preview {
      position: fixed;
      z-index: 2147483647;
      width: min(340px, calc(100vw - 24px));
      max-height: min(360px, calc(100vh - 24px));
      overflow: hidden;
      border: 1px solid rgba(83, 100, 113, 0.35);
      border-radius: 8px;
      box-shadow: 0 12px 34px rgba(0, 0, 0, 0.25);
      background: rgb(255, 255, 255);
      color: rgb(15, 20, 25);
      font-family: TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.35;
    }

    .remilia-wiki-preview[data-theme="dark"] {
      border-color: rgba(139, 152, 165, 0.35);
      background: rgb(22, 24, 28);
      color: rgb(231, 233, 234);
      box-shadow: 0 12px 34px rgba(0, 0, 0, 0.55);
    }

    .remilia-wiki-preview__image {
      display: block;
      width: 100%;
      max-height: 150px;
      object-fit: cover;
      background: rgba(83, 100, 113, 0.16);
    }

    .remilia-wiki-preview__body {
      padding: 12px;
    }

    .remilia-wiki-preview__title {
      margin: 0 0 6px;
      font-size: 15px;
      font-weight: 700;
      line-height: 1.25;
    }

    .remilia-wiki-preview__extract {
      display: -webkit-box;
      margin: 0;
      overflow: hidden;
      color: inherit;
      opacity: 0.9;
      -webkit-line-clamp: 5;
      -webkit-box-orient: vertical;
    }

    .remilia-wiki-preview__footer {
      display: block;
      margin-top: 9px;
      color: var(--remilia-wiki-link-color, #ff4fbf);
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
    }
  `;
  document.documentElement.appendChild(style);
}
