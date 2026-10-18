import { observeReadingMotion } from "./motion-policy";
import postReadingStyles from "./post-reading.css";

export function injectStyles(addDisposable?: (dispose: () => void) => void, stopSmooth?: () => void): void {
  if (addDisposable && stopSmooth) addDisposable(observeReadingMotion(stopSmooth));
  if (document.getElementById("post-reading-style")) return;
  const style = document.createElement("style");
  style.id = "post-reading-style";
  style.textContent = postReadingStyles;
  document.head.appendChild(style);
}
