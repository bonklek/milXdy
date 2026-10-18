import { openPngDetailReview } from '../../examples/packages/first-party-replacements/tweetPng/src/preview-detail';
import { onContextualPostAction, disable } from '../../examples/packages/first-party-replacements/tweetPng/src/content';
import type { MilxdyContextualPostActionContext } from '../../sdk/types';
const check = (value: unknown, message: string) => { if (!value) throw new Error(message); };
const query = <T extends Element>(selector: string) => document.querySelector<T>(selector)!;
async function wait(ready: () => boolean) { for (let i = 0; i < 300; i++) { if (ready()) return; await new Promise(resolve => setTimeout(resolve, 10)); } throw new Error('Timed out'); }
async function verify() {
  let copied: Blob | null = null, downloaded = '', copyFailure = false, downloadFailure = false;
  let pendingCopy: (() => Promise<void>) | null = null;
  const errors: string[] = []; addEventListener('unhandledrejection', event => errors.push(String(event.reason))); addEventListener('error', event => errors.push(event.message));
  Object.defineProperty(navigator, 'clipboard', { value: { write: async (items: ClipboardItem[]) => { if (pendingCopy) await pendingCopy(); if (copyFailure) throw new Error('Synthetic copy denial'); copied = await items[0].getType('image/png'); } } });
  const originalAnchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if (downloadFailure) throw new Error('Synthetic download denial'); downloaded = this.download; };
  const tweet = document.createElement('article');
  tweet.innerHTML = '<div data-testid="User-Name"><a role="link" href="/example"><span>Example</span></a><span>@example</span></div><div data-testid="tweetText"></div>';
  tweet.querySelector('[data-testid="tweetText"]')!.textContent = Array.from({ length: 24 }, (_, i) => `Line ${i + 1}: readable PNG detail, العربية 漢字 and emoji 🌸. This image remains exactly the reviewed export.`).join('\n');
  document.body.append(tweet);
  const context = { actionId: 'reviewPng', post: tweet, statusUrl: 'https://x.com/example/status/123', signal: new AbortController().signal,
    storage: { local: { get: async (defaults: object) => defaults, set: async () => undefined } }, resolveAssetUrl: () => '',
  } as unknown as MilxdyContextualPostActionContext;
  await onContextualPostAction(context); await wait(() => !query<HTMLButtonElement>('[data-action="copy"]').disabled);
  query<HTMLButtonElement>('[data-action="copy"]').click(); await wait(() => copied !== null);
  const expected = new Uint8Array(await copied!.arrayBuffer()); copied = null;
  query<HTMLButtonElement>('[data-action="settings"]').click();
  query<HTMLButtonElement>('[data-action="inspect"]').click();
  await wait(() => query<HTMLImageElement>('.milxdy-png-detail img')?.complete === true);
  const dialog = query<HTMLDialogElement>('.milxdy-png-detail'), image = dialog.querySelector('img')!;
  const viewport = query<HTMLElement>('.milxdy-png-detail-viewport');
  check(dialog.open && document.activeElement === viewport, 'Detail view must open and focus its scrollable region');
  const initialZoom = dialog.querySelector('select')!;
  check(initialZoom.value === (innerWidth < 680 ? '0.25' : '0.5'), 'Inspection should start at readable text scale');
  initialZoom.value = '1'; initialZoom.dispatchEvent(new Event('change'));
  check(image.clientWidth === image.naturalWidth, 'Actual pixels must be rendered at1 CSS pixel per PNG pixel');
  check(viewport.scrollWidth > viewport.clientWidth && viewport.scrollHeight > viewport.clientHeight, 'Long PNG must be scrollable on both axes');
  viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
  check(viewport.scrollLeft > 0 && viewport.scrollTop > 0, 'Keyboard must pan both axes');
  checkPersistentActions(dialog);
  viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  check(viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 1, 'End must reach the final pixels');
  viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  check(viewport.scrollLeft === 0 && viewport.scrollTop === 0, 'Home must reset pan');
  dialog.querySelector<HTMLButtonElement>('[data-detail-reset]')!.click();
  check(image.clientWidth <= viewport.clientWidth && viewport.scrollLeft === 0 && viewport.scrollTop === 0, 'Fit/reset must return to width without horizontal clipping');
  const zoom = dialog.querySelector('select')!; zoom.value = '2'; zoom.dispatchEvent(new Event('change'));
  check(image.clientWidth === image.naturalWidth * 2, '200% must magnify inspection pixels only');
  viewport.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
  check(image.clientWidth === image.naturalWidth, '1 must return to actual pixels');
  copyFailure = true; const detailCopy = dialog.querySelector<HTMLButtonElement>('[data-detail-copy]')!; detailCopy.click();
  await wait(() => !detailCopy.disabled && dialog.querySelector('[role=status]')!.textContent!.startsWith('Copy failed'));
  copyFailure = false; detailCopy.click(); await wait(() => copied !== null);
  const actual = new Uint8Array(await copied!.arrayBuffer());
  check(expected.length === actual.length && expected.every((byte, index) => byte === actual[index]), 'Inspection zoom/pan must not change a single exported byte');
  downloadFailure = true; const detailDownload = dialog.querySelector<HTMLButtonElement>('[data-detail-download]')!; detailDownload.click();
  check(dialog.querySelector('[role=status]')!.textContent!.startsWith('Download failed') && !detailDownload.disabled, 'Download failure must remain recoverable');
  downloadFailure = false; detailDownload.click();
  check(/^milxdy-example-\d+\.png$/.test(downloaded), 'Detail download must preserve source filename');
  dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
  check(!dialog.isConnected && document.activeElement === query('[data-action="inspect"]'), 'Escape/cancel returns to invoking Inspect control');
  check(!query<HTMLElement>('#milxdy-tweet-png-settings').hidden, 'Inspection must preserve open settings');
  query<HTMLButtonElement>('[data-action="inspect"]').click(); await wait(() => query<HTMLImageElement>('.milxdy-png-detail img')?.complete === true);
  const pendingDialog = query<HTMLDialogElement>('.milxdy-png-detail');
  const pendingStatus = pendingDialog.querySelector('[role=status]')!; const oldStatus = pendingStatus.textContent;
  let rejectCopy!: (error: Error) => void; pendingCopy = () => new Promise<void>((_, reject) => { rejectCopy = reject; });
  pendingDialog.querySelector<HTMLButtonElement>('[data-detail-copy]')!.click();
  disable(); check(!document.querySelector('.milxdy-png-detail'), 'Disable/route teardown must close detail view');
  rejectCopy(new Error('Synthetic late denial')); await new Promise(resolve => setTimeout(resolve, 20)); pendingCopy = null;
  check(pendingStatus.textContent === oldStatus && errors.length === 0, 'Pending copy rejection after teardown must be caught without detached state updates');
  const brokenClose = openPngDetailReview({ blob: new Blob(['invalid PNG'], { type: 'image/png' }), fileName: 'broken.png', copy: async () => {}, download: () => {}, returnFocus: tweet });
  await wait(() => query('.milxdy-png-detail [role=status]')?.textContent?.startsWith('Preview could not load') === true);
  const broken = query<HTMLDialogElement>('.milxdy-png-detail');
  check(broken.querySelector('select')!.disabled && broken.querySelector<HTMLImageElement>('img')!.hidden, 'Broken preview must show feedback and disable misleading zoom');
  query<HTMLElement>('.milxdy-png-detail-viewport').dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
  check(broken.querySelector('[role=status]')!.textContent!.startsWith('Preview could not load'), 'Zoom shortcut must preserve load failure feedback');
  checkPersistentActions(broken); brokenClose(false);
  await onContextualPostAction(context); await wait(() => !query<HTMLButtonElement>('[data-action="inspect"]').disabled);
  query<HTMLButtonElement>('[data-action="inspect"]').click(); await wait(() => query<HTMLImageElement>('.milxdy-png-detail img')?.complete === true);
  const finalZoom = query<HTMLSelectElement>('.milxdy-png-detail select'); finalZoom.value = innerWidth < 680 ? '0.25' : '0.5'; finalZoom.dispatchEvent(new Event('change'));
  const finalViewport = query<HTMLElement>('.milxdy-png-detail-viewport'); finalViewport.scrollLeft = innerWidth < 680 ? 88 : 170; finalViewport.scrollTop = innerWidth < 680 ? 195 : 390;
  checkPersistentActions(query('.milxdy-png-detail'));
  HTMLAnchorElement.prototype.click = originalAnchorClick;
  return { passed: true, viewport: innerWidth, nativePixels: true, zoomAndReset: true, keyboardPan: true, persistentActions: true, exportByteParity: true, sourceFilename: true, focusRestored: true, settingsPreserved: true, teardown: true, copyFailureRecovery: true, downloadFailureRecovery: true, pendingCopyTeardown: true, imageFailureFeedback: true, unhandledErrors: errors };
}
function checkPersistentActions(dialog: Element) {
  const bounds = dialog.getBoundingClientRect();
  for (const selector of ['[data-detail-close]', '[data-detail-copy]', '[data-detail-download]']) {
    const rect = dialog.querySelector(selector)!.getBoundingClientRect();
    check(rect.left >= bounds.left && rect.right <= bounds.right && rect.top >= 0 && rect.bottom <= innerHeight, 'Close/copy/download must remain visible without scrolling image');
  }
}
verify().then(result => { (globalThis as any).__annotationResult = result; }).catch(error => { (globalThis as any).__annotationResult = { passed: false, error: String(error) }; });
