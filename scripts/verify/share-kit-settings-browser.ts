import { onContextualPostAction } from '../../examples/packages/first-party-replacements/tweetPng/src/content';
import type { MilxdyContextualPostActionContext } from '../../sdk/types';

const check = (value: unknown, message: string) => { if (!value) throw new Error(message); };
const query = <T extends Element>(selector: string) => document.querySelector<T>(selector)!;
const copy = () => query<HTMLButtonElement>('[data-action="copy"]');
const wait = async (ready: () => boolean) => { for (let i = 0; i < 300; i++) { if (ready()) return; await new Promise(resolve => setTimeout(resolve, 10)); } throw new Error('Timed out'); };

async function verify() {
  document.body.style.margin = '0';
  let writes = 0;
  let storage: Record<string, unknown> = { 'milxdy.settings.visualTheme': { unrelatedOption: 'preserved', interfaceAccentColor: '#123456', tweetPngBorderPalette: '#e65432' } };
  let copied: Blob | null = null;
  Object.defineProperty(navigator, 'clipboard', { value: { write: async (items: ClipboardItem[]) => { copied = await items[0].getType('image/png'); } } });
  const painted: string[] = [];
  const fillText = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (text, ...args) { painted.push(text); return fillText.call(this, text, ...args); };
  const tweet = document.createElement('article');
  tweet.innerHTML = '<div data-testid="User-Name"><a role="link" href="/example"><span>Example</span></a><span>@example</span></div><div data-testid="tweetText">A post with readable content.</div>';
  const dock = document.createElement('aside'); dock.id = 'milxdy-overlay-dock-root'; dock.dataset.side = 'left';
  document.body.append(tweet, dock);
  const context = {
    actionId: 'reviewPng', post: tweet, statusUrl: 'https://x.com/example/status/123', signal: new AbortController().signal,
    storage: { local: { get: async (defaults: object) => ({ ...defaults, ...storage }), set: async (value: object) => { writes++; storage = { ...storage, ...structuredClone(value) }; } } },
    resolveAssetUrl: () => '', probeRemiNetConnection: async () => ({ connected: false }),
  } as unknown as MilxdyContextualPostActionContext;
  const open = async () => { await onContextualPostAction(context); await wait(() => !copy().disabled); };
  const change = (key: string, value: boolean | string) => changePngSetting(key, value, painted);
  await open();
  const paletteControl = () => query<HTMLSelectElement>('[data-setting="tweetPngBorderPalette"]');
  check(paletteControl().value === '#e65432' && paletteControl().selectedOptions[0].textContent === 'Custom (#e65432)', 'Saved custom HEX must be visible as the actual selected palette');
  copy().click(); await wait(() => copied !== null); await assertParity(copied!); await assertCustomBorder(copied!, '#e65432'); copied = null;
  check(!document.querySelector('[data-action="refresh"], [data-action="reminet"]'), 'Unsupported upload must not show authorization recovery or sharing controls');
  check(painted.includes('Example') && painted.includes('@example'), 'Existing themes must retain both identity fields: ' + JSON.stringify(painted));
  const settingsButton = () => query<HTMLButtonElement>('[data-action="settings"]');
  settingsButton().click();
  check(query('#milxdy-tweet-png-settings').contains(document.activeElement), 'Opening settings must move focus inside');
  const leftOrder = getComputedStyle(settingsButton()).order;
  dock.dataset.side = 'right';
  check(Number(getComputedStyle(settingsButton()).order) > Number(leftOrder), 'Settings entry must mirror to right');
  await change('tweetPngIncludeDisplayName', false);
  check(!painted.includes('Example') && painted.includes('@example'), 'Display name must hide independently');
  await change('tweetPngIncludeHandle', false);
  check(!painted.includes('Example') && !painted.includes('@example'), 'Neither hidden identity may be painted');
  await change('tweetPngIncludeDisplayName', true);
  check(painted.includes('Example') && !painted.includes('@example'), 'Handle must hide independently');
  await change('tweetPngIncludeDate', false);
  await change('tweetPngIncludeStats', false);
  await change('tweetPngShrinkTallImages', false);
  await change('tweetPngBorder', false);
  await change('tweetPngBorderPalette', 'green');
  check(writes === 0, 'Preview changes must not overwrite global defaults');
  query<HTMLButtonElement>('[data-action="restore-defaults"]').click(); await wait(() => !copy().disabled);
  check(paletteControl().value === '#e65432' && paletteControl().selectedOptions[0].textContent === 'Custom (#e65432)', 'Restore must resynchronize a custom option after choosing a named palette');
  await change('tweetPngIncludeHandle', false);
  await change('tweetPngBorderPalette', 'green');
  query<HTMLButtonElement>('[data-action="close-settings"]').click();
  check(document.activeElement === copy(), 'Done must return focus to full review Copy PNG action');
  settingsButton().click();
  check(!query<HTMLInputElement>('[data-setting="tweetPngIncludeHandle"]').checked, 'Reopening settings must retain export choices');
  query('#milxdy-tweet-png-modal').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  check(query<HTMLElement>('#milxdy-tweet-png-settings').hidden && document.activeElement === settingsButton(), 'Escape must close only settings and return focus');
  copy().click(); await wait(() => copied !== null);
  await assertParity(copied!);
  let filename = '';
  const anchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { filename = this.download; };
  query<HTMLButtonElement>('[data-action="download"]').click();
  HTMLAnchorElement.prototype.click = anchorClick;
  check(/^milxdy-example-\d+\.png$/.test(filename), 'Hidden handle must remain usable for a stable source filename');
  query<HTMLButtonElement>('[data-action="close"]').click(); await open();
  check(query<HTMLInputElement>('[data-setting="tweetPngIncludeHandle"]').checked, 'Unsaved changes must reset on new export');
  check(paletteControl().value === '#e65432', 'Temporary named palette must not overwrite saved custom HEX');
  settingsButton().click(); await change('tweetPngIncludeHandle', false);
  query<HTMLButtonElement>('[data-action="save-defaults"]').click(); await wait(() => writes === 1);
  check((storage['milxdy.settings.visualTheme'] as Record<string, unknown>).tweetPngBorderPalette === '#e65432' && (storage['milxdy.settings.visualTheme'] as Record<string, unknown>).interfaceAccentColor === '#123456' && (storage['milxdy.settings.visualTheme'] as Record<string, unknown>).unrelatedOption === 'preserved', 'Saving defaults must preserve unrelated visual fields');
  await change('tweetPngBorderPalette', 'blue');
  await change('tweetPngIncludeHandle', true);
  query<HTMLButtonElement>('[data-action="restore-defaults"]').click(); await wait(() => !copy().disabled);
  check(paletteControl().value === '#e65432' && !query<HTMLInputElement>('[data-setting="tweetPngIncludeHandle"]').checked && writes === 1, 'Restore saved must discard only temporary choices');
  query<HTMLButtonElement>('[data-action="close"]').click(); await open();
  check(!query<HTMLInputElement>('[data-setting="tweetPngIncludeHandle"]').checked, 'Explicit saved defaults must survive reopen');
  settingsButton().click();
  checkSettingsLayout();
  return { passed: true, customHexInitialAndRestore: true, customHexPixelParity: true, customHexExplicitDefaults: true, independentIdentity: true, temporarySettings: true, explicitSavedDefaults: true, preservesUnrelatedSettings: true, exactPixelParity: true, sourceFilename: true, mirrored: true, keyboardFocus: true, noHorizontalClipping: true, viewport: innerWidth };
}
function checkSettingsLayout() {
  const dialog = query<HTMLElement>('.milxdy-tweet-png-dialog');
  check(dialog.scrollWidth <= dialog.clientWidth + 1, 'Dialog must not clip horizontally');
  const settings = query<HTMLElement>('#milxdy-tweet-png-settings');
  check(settings.scrollWidth <= settings.clientWidth + 1, 'Settings must not clip horizontally');
  const preview = query('.milxdy-tweet-png-preview-stage').getBoundingClientRect(), controls = settings.getBoundingClientRect();
  check(preview.top >= controls.bottom || preview.left >= controls.right, 'Settings must not overlay preview');
  check(query('.milxdy-tweet-png-actions').getBoundingClientRect().bottom <= settings.getBoundingClientRect().top, 'Settings must not cover primary actions');
  const summaries = document.querySelectorAll<HTMLElement>('.milxdy-tweet-png-edit-details summary');
  const first = query<HTMLButtonElement>('[data-action="settings"]'), last = summaries[summaries.length - 1];
  last.focus(); last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  check(document.activeElement === first, 'Tab must wrap after the last collapsed editor summary');
  first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
  check(document.activeElement === last, 'Shift Tab must wrap to the last collapsed editor summary');
  first.focus(); settings.scrollTop = 0; dialog.scrollTop = 0;
}

async function assertParity(blob: Blob) {
  const image = await createImageBitmap(blob);
  const preview = query<HTMLImageElement>('.milxdy-tweet-png-preview'); await preview.decode();
  const annotations = query<HTMLCanvasElement>('.milxdy-tweet-png-annotation-canvas');
  const expected = document.createElement('canvas'); expected.width = image.width; expected.height = image.height;
  const actual = document.createElement('canvas'); actual.width = image.width; actual.height = image.height;
  const a = actual.getContext('2d')!, e = expected.getContext('2d')!;
  e.drawImage(preview, 0, 0); e.drawImage(annotations, 0, 0); a.drawImage(image, 0, 0);
  const pixels = e.getImageData(0, 0, image.width, image.height).data;
  const output = a.getImageData(0, 0, image.width, image.height).data;
  check(pixels.every((value, index) => value === output[index]), 'Export must exactly match current preview');
}
verify().then(result => { (globalThis as any).__annotationResult = result; }).catch(error => { (globalThis as any).__annotationResult = { passed: false, error: String(error) }; });

async function assertCustomBorder(blob: Blob, color: string) {
  const image = await createImageBitmap(blob); const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
  const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0); const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const expected = [1, 3, 5].map(index => Number.parseInt(color.slice(index, index + 2), 16));
  check(pixels.some((value, index) => index % 4 === 0 && value === expected[0] && pixels[index + 1] === expected[1] && pixels[index + 2] === expected[2]), 'Actual PNG must paint the saved custom border color');
}

async function changePngSetting(key: string, value: boolean | string, painted: string[]): Promise<void> {

    painted.length = 0;
    const input = query<HTMLInputElement | HTMLSelectElement>(`[data-setting="${key}"]`);
    if (input instanceof HTMLInputElement && input.type === 'checkbox') input.checked = value === true;
    else input.value = String(value);
    input.dispatchEvent(new Event('change'));
    check(copy().disabled, 'Changed settings must immediately disable stale export'); await wait(() => !copy().disabled);
}
