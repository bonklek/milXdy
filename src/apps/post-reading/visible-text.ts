export function cloneVisibleContent(host: HTMLElement): HTMLElement {
  const copy = host.cloneNode(true) as HTMLElement;
  for (let ancestor = host.parentElement; ancestor; ancestor = ancestor.parentElement) {
    const style = ancestor.ownerDocument?.defaultView?.getComputedStyle(ancestor);
    if (ancestor.hidden || ancestor.getAttribute('aria-hidden') === 'true'
      || style?.display === 'none' || style?.visibility === 'hidden' || style?.visibility === 'collapse') {
      copy.textContent = '';
      return copy;
    }
  }
  const originals = [host, ...Array.from(host.querySelectorAll<HTMLElement>('*'))];
  const clones = [copy, ...Array.from(copy.querySelectorAll<HTMLElement>('*'))];
  for (const [index, original] of originals.entries()) {
    const style = original.ownerDocument?.defaultView?.getComputedStyle(original);
    const inline = original.getAttribute('style') || '';
    if (original.hidden || original.getAttribute('aria-hidden') === 'true'
      || style?.display === 'none' || style?.visibility === 'hidden' || style?.visibility === 'collapse'
      || /(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse))/i.test(inline)) {
      if (index === 0) { copy.textContent = ''; break; }
      clones[index]?.remove();
    }
  }
  return copy;
}

/** Text from a rendered source with CSS-hidden descendants excluded. */
export function visibleText(host: HTMLElement | null): string {
  return host ? (cloneVisibleContent(host).textContent || '').trim() : '';
}
