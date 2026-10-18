// Hover details also appear on keyboard focus. Escape dismisses them without
// moving focus; a fresh pointer/focus entry allows them to appear again.
(() => {
  const init = () => document.querySelectorAll('.rmn-status-wrap').forEach(wrap => {
    if (wrap.dataset.detailsBound) return;
    wrap.dataset.detailsBound = 'true';
    wrap.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        wrap.dataset.detailsDismissed = 'true';
        event.stopPropagation();
      }
    });
    wrap.addEventListener('mouseenter', () => delete wrap.dataset.detailsDismissed);
    wrap.addEventListener('focusin', () => delete wrap.dataset.detailsDismissed);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
