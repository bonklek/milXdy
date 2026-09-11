import postReadingStyles from "./post-reading.css";

export function injectStyles(): void {
  if (document.getElementById("post-reading-style")) return;
  const style = document.createElement("style");
  style.id = "post-reading-style";
  style.textContent = postReadingStyles;
  document.head.appendChild(style);
}
