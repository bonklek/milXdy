/**
 * Tracks event listeners owned by this content-runtime instance.
 *
 * X can clone a mounted toolbar button while reconciling a composer. Dataset
 * attributes survive that clone, but DOM event listeners do not. A per-runtime
 * WeakSet keeps a copied marker from being mistaken for a live binding.
 */
export function createComposerActionBindingRegistry() {
  const boundButtons = new WeakSet<HTMLButtonElement>();

  return {
    needsBinding(button: HTMLButtonElement | null, token: string): boolean {
      return !button
        || button.dataset.milxdyComposerActionBinding !== token
        || !boundButtons.has(button);
    },
    remember(button: HTMLButtonElement): void {
      boundButtons.add(button);
    },
  };
}
