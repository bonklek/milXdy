type DetailReview = {
  blob: Blob;
  fileName: string;
  copy: (blob: Blob) => Promise<void>;
  download: (blob: Blob, fileName: string) => void;
  returnFocus: HTMLElement;
};

/** Inspect an immutable exported blob. Zoom and scrolling never redraw it. */
export function openPngDetailReview(options: DetailReview): (restoreFocus?: boolean) => void {
  const dialog = document.createElement('dialog');
  dialog.className = 'milxdy-png-detail';
  dialog.setAttribute('aria-label', 'Inspect PNG at full detail');
  dialog.innerHTML = `<style>${detailStyles}</style>
    <header><strong>Inspect PNG</strong><button type="button" data-detail-close>Back to editor</button></header>
    <div class="milxdy-png-detail-controls" role="group" aria-label="Preview inspection and export">
      <button type="button" data-detail-copy>Copy PNG</button><button type="button" data-detail-download>Download</button>
      <button type="button" data-detail-reset>Fit / reset</button>
      <label>Zoom <select aria-label="Preview zoom"><option value="fit">Fit width</option><option value="0.25">25%</option><option value="0.5">50%</option><option value="1" selected>100% (actual pixels)</option><option value="1.5">150%</option><option value="2">200%</option></select></label>
    </div>
    <p id="milxdy-png-detail-help">Scroll, drag or use arrow keys. 0: fit. 1: actual pixels. Home/End: start/end.</p>
    <div class="milxdy-png-detail-viewport" tabindex="0" role="region" aria-label="Scrollable full-detail PNG" aria-describedby="milxdy-png-detail-help" aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight PageUp PageDown Home End 0 1"><img alt="Reviewed PNG at inspection size" draggable="false"></div>
    <p class="milxdy-png-detail-status" role="status" aria-live="polite"></p>`;
  const viewport = dialog.querySelector<HTMLElement>('.milxdy-png-detail-viewport')!;
  const image = dialog.querySelector('img')!;
  const zoom = dialog.querySelector('select')!;
  const status = dialog.querySelector<HTMLElement>('[role="status"]')!;
  zoom.value = innerWidth < 680 ? '0.25' : '0.5';
  const url = URL.createObjectURL(options.blob);
  let closed = false;
  let stopImageWatch = () => {};
  const close = (restoreFocus = true) => {
    if (closed) return;
    closed = true; stopImageWatch(); dialog.close(); dialog.remove(); URL.revokeObjectURL(url);
    if (restoreFocus && options.returnFocus.isConnected) options.returnFocus.focus({ preventScroll: true });
  };
  const applyZoom = () => {
    image.style.width = zoom.value === 'fit' ? '100%' : `${Math.round(image.naturalWidth * Number(zoom.value))}px`;
    viewport.scrollLeft = 0; viewport.scrollTop = 0;
    status.textContent = zoom.value === 'fit' ? 'Fitted to width. Export size is unchanged.' : `${Math.round(Number(zoom.value) * 100)}% of PNG pixels. Export size is unchanged.`;
  };
  stopImageWatch = watchDetailImage(image, viewport, zoom, dialog.querySelector<HTMLButtonElement>('[data-detail-reset]')!, status, applyZoom);
  image.src = url;
  zoom.onchange = applyZoom;
  dialog.querySelector<HTMLButtonElement>('[data-detail-reset]')!.onclick = () => { zoom.value = 'fit'; applyZoom(); viewport.focus(); };
  dialog.querySelector<HTMLButtonElement>('[data-detail-close]')!.onclick = () => close();
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.querySelector<HTMLButtonElement>('[data-detail-copy]')!.onclick = async event => {
    const button = event.currentTarget as HTMLButtonElement; button.disabled = true;
    try { await options.copy(options.blob); if (!closed) status.textContent = 'Copied the inspected PNG to clipboard.'; }
    catch { if (!closed) status.textContent = 'Copy failed. Try again or use Download instead.'; }
    finally { if (!closed) button.disabled = false; }
  };
  dialog.querySelector<HTMLButtonElement>('[data-detail-download]')!.onclick = () => {
    try { options.download(options.blob, options.fileName); status.textContent = 'PNG download requested.'; }
    catch { status.textContent = 'Download failed. Try again or use Copy PNG instead.'; }
  };
  installInspectionNavigation(viewport, zoom, applyZoom);
  document.body.append(dialog); dialog.showModal(); viewport.focus();
  return close;
}

function watchDetailImage(image: HTMLImageElement, viewport: HTMLElement, zoom: HTMLSelectElement, reset: HTMLButtonElement, status: HTMLElement, applyZoom: () => void): () => void {
  let done = false;
  viewport.setAttribute('aria-busy', 'true');
  const failed = () => {
    if (done) return;
    done = true; clearTimeout(timeout); viewport.setAttribute('aria-busy', 'false');
    image.hidden = true; zoom.disabled = true; reset.disabled = true;
    status.textContent = 'Preview could not load. Return to the editor and try again, or download the PNG to inspect it.';
  };
  const loaded = () => {
    if (done) return;
    done = true; clearTimeout(timeout); viewport.setAttribute('aria-busy', 'false'); applyZoom();
  };
  const timeout = window.setTimeout(failed, 10000);
  image.addEventListener('load', loaded); image.addEventListener('error', failed);
  return () => { done = true; clearTimeout(timeout); image.removeEventListener('load', loaded); image.removeEventListener('error', failed); };
}

function installInspectionNavigation(viewport: HTMLElement, zoom: HTMLSelectElement, applyZoom: () => void): void {
  viewport.addEventListener('keydown', event => {
    if (zoom.disabled) return;
    const step = 80, page = viewport.clientHeight * 0.8;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step], PageUp: [0, -page], PageDown: [0, page] };
    if (moves[event.key]) { event.preventDefault(); const [x, y] = moves[event.key]; viewport.scrollBy(x, y); }
    else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); viewport.scrollTo(event.key === 'Home' ? 0 : viewport.scrollWidth, event.key === 'Home' ? 0 : viewport.scrollHeight); }
    else if (event.key === '0' || event.key === '1') { event.preventDefault(); zoom.value = event.key === '0' ? 'fit' : '1'; applyZoom(); }
  });
  let drag: { id: number; x: number; y: number; left: number; top: number } | null = null;
  viewport.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.pointerType === 'touch' || !(event.target instanceof HTMLImageElement)) return;
    event.preventDefault(); viewport.focus();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
    viewport.setPointerCapture(event.pointerId); viewport.dataset.dragging = 'true';
  });
  viewport.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    viewport.scrollLeft = drag.left + drag.x - event.clientX; viewport.scrollTop = drag.top + drag.y - event.clientY;
  });
  const end = () => { drag = null; delete viewport.dataset.dragging; };
  viewport.addEventListener('pointerup', end); viewport.addEventListener('pointercancel', end); viewport.addEventListener('lostpointercapture', end);
}

const detailStyles = `
.milxdy-png-detail { box-sizing:border-box; width:calc(100vw - 24px); max-width:1200px; height:calc(100dvh - 24px); max-height:calc(100dvh - 24px); margin:auto; padding:12px; border:1px solid #b67cff; border-radius:8px; background:#fffaff; color:#20122f; font:14px/1.4 system-ui; }
.milxdy-png-detail[open] { display:grid; grid-template-rows:auto auto auto minmax(0,1fr) auto; gap:10px; }
.milxdy-png-detail::backdrop { background:rgba(0,0,0,.65); }
.milxdy-png-detail header, .milxdy-png-detail-controls { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
.milxdy-png-detail header { justify-content:space-between; }
.milxdy-png-detail strong { font-size:18px; }
.milxdy-png-detail button, .milxdy-png-detail select { font:inherit; min-height:36px; max-width:100%; border:1px solid #b67cff; border-radius:5px; padding:6px 9px; color:#20122f; background:#f3e8ff; }
.milxdy-png-detail button { cursor:pointer; }
.milxdy-png-detail button:disabled { opacity:.65; cursor:wait; }
.milxdy-png-detail :focus-visible { outline:2px solid #6522aa; outline-offset:2px; }
.milxdy-png-detail p { margin:0; overflow-wrap:anywhere; }
.milxdy-png-detail-viewport { min-width:0; min-height:0; overflow:auto; overscroll-behavior:contain; background:#e8deee; border:1px solid #bfa5dd; touch-action:pan-x pan-y; cursor:grab; }
.milxdy-png-detail-viewport[data-dragging] { cursor:grabbing; }
.milxdy-png-detail-viewport img[hidden] { display:none; }
.milxdy-png-detail-viewport img { display:block; height:auto; max-width:none; user-select:none; }
.milxdy-png-detail-status { min-height:1.4em; font-size:12px; }
@media(max-width:480px) { .milxdy-png-detail { width:calc(100vw - 12px); height:calc(100dvh - 12px); max-height:calc(100dvh - 12px); padding:10px; } .milxdy-png-detail-controls { gap:6px; } }
`;
