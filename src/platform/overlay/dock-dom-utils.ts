export function updateDockIcon(icon: HTMLElement, value: string): void {
  if (icon.dataset.icon === value) return;
  icon.dataset.icon = value;
  icon.textContent = "";
  if (/^(https?:|chrome-extension:|moz-extension:|data:|\/)/.test(value)) {
    const image = document.createElement("img");
    image.src = value;
    image.alt = "";
    icon.append(image);
  } else icon.textContent = value;
}

export function dockItemIdAtPoint(
  hitTest: (x: number, y: number) => HTMLElement | null,
  pointer: { clientX: number; clientY: number },
): string | null {
  return hitTest(pointer.clientX, pointer.clientY)?.closest<HTMLElement>("[data-item-id]")?.dataset.itemId || null;
}
