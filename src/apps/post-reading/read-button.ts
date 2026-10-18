import { icon } from "./icons";

export function createReadAloudButton(onRead: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "post-reading-button";
  button.dataset.postReadingButton = "true";
  button.setAttribute("aria-label", "Read aloud");
  button.title = "Read aloud";
  button.innerHTML = icon("speaker");
  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    onRead();
  });
  return button;
}
