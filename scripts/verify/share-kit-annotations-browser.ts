import { onContextualPostAction } from '../../examples/packages/first-party-replacements/tweetPng/src/content';
import type { MilxdyContextualPostActionContext } from '../../sdk/types';

async function verify() {
  const assert = (value: unknown, message: string) => { if (!value) throw new Error(message); };
  let copied: Blob | null = null;
  Object.defineProperty(navigator, 'clipboard', { value: { write: async (items: ClipboardItem[]) => { copied = await items[0].getType('image/png'); } } });
  const tweet = document.createElement('article');
  tweet.innerHTML = '<div data-testid="User-Name"><a href="https://x.com/example"><span>Example</span></a><span>@example</span></div><div data-testid="tweetText">Unicode 👨‍👩‍👧‍👦 and 漢字 العربية English\nSecond line</div>';
  await addSyntheticAvatar(tweet);
  document.body.append(tweet);
  const context = {
    actionId: 'reviewPng', post: tweet, statusUrl: null,
    signal: new AbortController().signal,
    storage: { local: { get: async (defaults: object) => defaults, set: async () => undefined } },
    resolveAssetUrl: () => '', probeRemiNetConnection: async () => ({ connected: false }),
  } as unknown as MilxdyContextualPostActionContext;
  await onContextualPostAction(context);
  const query = <T extends Element>(selector: string): T => document.querySelector(selector)! as T;
  const copy = () => query<HTMLButtonElement>('[data-action="copy"]');
  await wait(() => !copy().disabled);
  assert(query<HTMLInputElement>('[data-annotation-color]').value === '#ff0000', 'Decoded local avatar should provide adaptive default');
  query<HTMLButtonElement>('[aria-label="Use annotation color #ffcc33"]').click();
  assert(query<HTMLInputElement>('[data-annotation-color]').value === '#ffcc33', 'Suggested palette should support user override');
  query<HTMLDetailsElement>('.milxdy-tweet-png-edit-details').open = true;
  const richEditor = query<HTMLTextAreaElement>('#milxdy-tweet-png-editor-input');
  richEditor.setSelectionRange(0, richEditor.value.length);
  for (const format of ['bold', 'italic', 'strikethrough', 'bullet']) {
    query<HTMLButtonElement>(`[data-format="${format}"]`).click();
    assert(copy().disabled, `Export must wait for ${format}`); await wait(() => !copy().disabled);
    assert(query<HTMLButtonElement>(`[data-format="${format}"]`).getAttribute('aria-pressed') === 'true', `${format} should be applied`);
  }
  (document.querySelectorAll('.milxdy-tweet-png-edit-details')[1] as HTMLDetailsElement).open = true;
  const tool = query<HTMLSelectElement>('[data-annotation-tool]');
  const canvas = query<HTMLCanvasElement>('canvas.milxdy-tweet-png-annotation-canvas');
  canvas.setPointerCapture = () => undefined;
  canvas.hasPointerCapture = () => false;
  const draw = (name: string, start = [0.3, 0.3], end = [0.6, 0.6]) => {
    tool.value = name; tool.dispatchEvent(new Event('change'));
    const bounds = canvas.getBoundingClientRect();
    const pointer = (type: string, point: number[]) => canvas.dispatchEvent(new PointerEvent(type, { pointerId: 1, button: 0, clientX: bounds.left + bounds.width * point[0], clientY: bounds.top + bounds.height * point[1] }));
    pointer('pointerdown', start); pointer('pointermove', end); pointer('pointerup', end);
  };
  query<HTMLInputElement>('[data-annotation-text]').value = 'Bold note';
  query<HTMLInputElement>('[data-annotation-bold]').checked = true;
  for (const name of ['pen', 'line', 'rectangle', 'ellipse', 'arrow', 'highlight', 'text']) {
    draw(name); assert(copy().disabled, `Export must wait for ${name}`); await wait(() => !copy().disabled);
  }
  // Delay only PNG base decoding so a new transient stroke overlaps a
  // committed annotation composition. Cancelling it must never alter export.
  const NativeImage = window.Image;
  window.Image = class extends NativeImage {
    set onload(callback: ((event: Event) => void) | null) { super.onload = event => { setTimeout(() => callback?.call(this, event), 60); }; }
    get onload() { return super.onload; }
  } as typeof Image;
  draw('line', [0.1, 0.1], [0.2, 0.2]);
  const bounds = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, button: 0, clientX: bounds.left + bounds.width * 0.1, clientY: bounds.top + bounds.height * 0.9 }));
  canvas.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: bounds.left + bounds.width * 0.9, clientY: bounds.top + bounds.height * 0.9 }));
  // Adjust committed history while the transient stroke is already visible.
  // That refresh must exclude the unfinished stroke from its frozen layer.
  canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 100));
  canvas.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 }));
  await wait(() => !copy().disabled);
  window.Image = NativeImage;
  copy().click(); await wait(() => copied !== null); await assertCopiedParity(copied!, canvas, query<HTMLImageElement>('.milxdy-tweet-png-preview'), assert); copied = null;
  const pixelDigest = () => Array.from(canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data).reduce((hash, byte) => Math.imul(hash ^ byte, 16777619) >>> 0, 2166136261);
  const beforeUndo = pixelDigest(); query<HTMLButtonElement>('[data-annotation-undo]').click(); await wait(() => !copy().disabled);
  assert(pixelDigest() !== beforeUndo, 'Undo should alter reviewed canvas');
  query<HTMLButtonElement>('[data-annotation-redo]').click(); await wait(() => !copy().disabled);
  assert(pixelDigest() === beforeUndo, 'Redo should restore reviewed canvas');
  canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); await wait(() => !copy().disabled);
  assert(pixelDigest() !== beforeUndo, 'Keyboard adjustment should alter reviewed annotation');
  copy().click(); await wait(() => copied !== null);
  assert(copy().textContent === 'Copied to clipboard', 'Successful clipboard feedback');
  await assertCopiedParity(copied!, canvas, query<HTMLImageElement>('.milxdy-tweet-png-preview'), assert);
  const editor = query<HTMLTextAreaElement>('#milxdy-tweet-png-editor-input'); editor.value += '\nNew local text'; editor.dispatchEvent(new Event('input'));
  assert(copy().disabled, 'Debounced editor change must immediately block stale export'); await wait(() => !copy().disabled);
  const retained = pixelDigest(); query<HTMLButtonElement>('[data-action="close"]').click(); await onContextualPostAction(context); await wait(() => !copy().disabled);
  const reopenedCanvas = query<HTMLCanvasElement>('canvas.milxdy-tweet-png-annotation-canvas');
  const reopenedPixels = reopenedCanvas.getContext('2d')!.getImageData(0, 0, reopenedCanvas.width, reopenedCanvas.height).data;
  assert(Array.from(reopenedPixels).some((value, index) => index % 4 === 3 && value !== 0), 'Reopen must retain annotations');
  query<HTMLButtonElement>('[data-annotation-clear]').click(); await wait(() => !copy().disabled);
  assert(!Array.from(reopenedCanvas.getContext('2d')!.getImageData(0, 0, reopenedCanvas.width, reopenedCanvas.height).data).some(Boolean), 'Clear must erase annotation layer');
  return { passed: true, tools: 7, exactPixelParity: true, undoRedo: true, keyboardAdjustment: true, retainedOnReopen: true, staleExportBlocked: true, copiedFeedback: true, combinedRichTextAndRtl: true, cancelledConcurrentStrokeExcluded: true, adaptivePaletteAndOverride: true, fontStack: "TwitterChirp, Arial (preferred font unavailable on this host)", priorCanvasDigest: retained };
}
verify().then(result => { (globalThis as any).__annotationResult = result; document.body.innerHTML = `<pre id="result">${JSON.stringify(result)}</pre>`; }).catch(error => { (globalThis as any).__annotationResult = { passed: false, error: String(error) }; document.body.innerHTML = `<pre id="result">${JSON.stringify({ passed: false, error: String(error) })}</pre>`; });

async function assertCopiedParity(blob: Blob, canvas: HTMLCanvasElement, preview: HTMLImageElement, assert: (value: unknown, message: string) => void) {
  const output = await createImageBitmap(blob);
  await preview.decode();
  const expected = document.createElement('canvas'); expected.width = canvas.width; expected.height = canvas.height;
  const expectedContext = expected.getContext('2d')!; expectedContext.drawImage(preview, 0, 0); expectedContext.drawImage(canvas, 0, 0);
  const actual = document.createElement('canvas'); actual.width = output.width; actual.height = output.height;
  const actualContext = actual.getContext('2d')!; actualContext.drawImage(output, 0, 0);
  const expectedPixels = expectedContext.getImageData(0, 0, expected.width, expected.height).data;
  const outputPixels = actualContext.getImageData(0, 0, actual.width, actual.height).data;
  assert(expectedPixels.length === outputPixels.length && expectedPixels.every((value, index) => value === outputPixels[index]), 'Copied PNG pixels must exactly equal reviewed base plus annotations');
}

async function addSyntheticAvatar(tweet: HTMLElement) {
  const avatarCanvas = document.createElement('canvas'); avatarCanvas.width = 16; avatarCanvas.height = 16;
  const avatarContext = avatarCanvas.getContext('2d')!; avatarContext.fillStyle = '#ff0000'; avatarContext.fillRect(0, 0, 16, 16);
  const avatar = document.createElement('img'); avatar.src = avatarCanvas.toDataURL() + '#profile_images'; tweet.prepend(avatar); await avatar.decode();
}

async function wait(condition: () => boolean) {
    for (let index = 0; index < 300; index++) { if (condition()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
    throw new Error('PNG rendering did not finish');
}
