import reskinCss from "./reskin.css";

export const RESKIN_STYLE_ID = "milxdy-reskin-profile-style";

export const RESKIN_CSS = reskinCss;

export function injectReskinStyles(): void {
  if (document.getElementById(RESKIN_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = RESKIN_STYLE_ID;
  style.textContent = RESKIN_CSS.replaceAll("__MILXDY_FONT_BASE__", chrome.runtime.getURL("remilia-fonts/"));
  document.documentElement.appendChild(style);
}
