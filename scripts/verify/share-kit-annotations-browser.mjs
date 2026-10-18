import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import esbuild from 'esbuild';
const root = await mkdtemp(path.join(tmpdir(), 'milxdy-share-kit-annotations-'));
let child, websocket;
try {
  await esbuild.build({ entryPoints: [process.env.SHARE_KIT_FIXTURE || (process.argv.includes('--settings') ? 'scripts/verify/share-kit-settings-browser.ts' : 'scripts/verify/share-kit-annotations-browser.ts')], outfile: path.join(root, 'fixture.js'), bundle: true, format: 'iife', platform: 'browser', target: 'chrome120' });
  const script = await readFile(path.join(root, 'fixture.js'), 'utf8');
  await writeFile(path.join(root, 'fixture.html'), `<!doctype html><meta charset="utf-8"><body><script>${script}</script>`);
  const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  child = spawn(chrome, ['--headless=new', '--disable-gpu', '--disable-extensions', '--no-first-run', '--user-data-dir=' + path.join(root, 'profile'), '--remote-debugging-port=0', 'about:blank']);
  const endpoint = await new Promise((resolve, reject) => {
    let stderr = ''; const timeout = setTimeout(() => reject(new Error('Chrome debugging endpoint unavailable')), 15000);
    child.stderr.on('data', data => { stderr += data; const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timeout); resolve(match[1]); } });
    child.on('error', error => { clearTimeout(timeout); reject(error); });
  });
  const origin = endpoint.replace(/^ws:/, 'http:').replace(/\/devtools\/browser\/.+$/, '');
  const page = await (await fetch(`${origin}/json/new?${encodeURIComponent("about:blank")}`, { method: 'PUT' })).json();
  websocket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { websocket.onopen = resolve; websocket.onerror = reject; });
  let sequence = 0; const pending = new Map();
  let pageLoaded; const loaded = new Promise(resolve => { pageLoaded = resolve; });
  websocket.onmessage = event => { const message = JSON.parse(event.data); if (message.method === "Page.loadEventFired") pageLoaded(); if (message.id && pending.has(message.id)) { const handler = pending.get(message.id); pending.delete(message.id); message.error ? handler.reject(new Error(JSON.stringify(message.error))) : handler.resolve(message.result); } };
  const send = (method, params) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); websocket.send(JSON.stringify({ id, method, params })); });
  await send('Page.enable', {});
  await send('Emulation.setDeviceMetricsOverride', { width: Number(process.env.VIEWPORT_WIDTH || 1280), height: Number(process.env.VIEWPORT_HEIGHT || 900), deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: pathToFileURL(path.join(root, 'fixture.html')).href });
  await loaded;
  const evaluated = await send('Runtime.evaluate', { expression: 'new Promise((resolve, reject) => { const started = Date.now(); const poll = () => { if (globalThis.__annotationResult) resolve(globalThis.__annotationResult); else if (Date.now() - started > 20000) reject(new Error("Browser fixture timed out")); else setTimeout(poll, 20); }; poll(); })', awaitPromise: true, returnByValue: true });
  if (evaluated.exceptionDetails) throw new Error(JSON.stringify(evaluated.exceptionDetails));
  const result = evaluated.result.value;
  if (process.env.PREVIEW_DETAIL_INPUT_CHECK && result.passed) {
    const before = (await send('Runtime.evaluate', { expression: `(() => { const v=document.querySelector('.milxdy-png-detail-viewport'), z=document.querySelector('.milxdy-png-detail select'), originalZoom=z.value, originalLeft=v.scrollLeft, originalTop=v.scrollTop; z.value='1'; z.dispatchEvent(new Event('change')); const r=v.getBoundingClientRect(); return {x:r.left+100,y:r.top+80,left:v.scrollLeft,top:v.scrollTop,originalZoom,originalLeft,originalTop}; })()`, returnByValue:true })).result.value;
    await send('Input.dispatchMouseEvent', { type:'mousePressed', x:before.x, y:before.y, button:'left', clickCount:1 });
    await send('Input.dispatchMouseEvent', { type:'mouseMoved', x:before.x-50, y:before.y-40, button:'left', buttons:1 });
    await send('Input.dispatchMouseEvent', { type:'mouseReleased', x:before.x-50, y:before.y-40, button:'left', clickCount:1 });
    const panned = (await send('Runtime.evaluate', { expression: `(() => { const v=document.querySelector('.milxdy-png-detail-viewport'); return v.scrollLeft >= ${before.left}+49 && v.scrollTop >= ${before.top}+39; })()`, returnByValue:true })).result.value;
    if (!panned) throw new Error('Native pointer drag failed'); result.nativePointerPan = true;
    for (const [key, code] of [['ArrowRight',39],['PageDown',34]]) { await send('Input.dispatchKeyEvent', { type:'keyDown', key, code:key, windowsVirtualKeyCode:code }); await send('Input.dispatchKeyEvent', { type:'keyUp', key, code:key, windowsVirtualKeyCode:code }); }
    const keyed = (await send('Runtime.evaluate', { expression: `(() => { const v=document.querySelector('.milxdy-png-detail-viewport'); return v.scrollLeft >= ${before.left}+129 && v.scrollTop > ${before.top}+41; })()`, returnByValue:true })).result.value;
    if (!keyed) throw new Error('Native keyboard pan failed'); result.nativeKeyboardPan = true;

    await send('Runtime.evaluate', { expression: `(() => {const v=document.querySelector('.milxdy-png-detail-viewport'),z=document.querySelector('.milxdy-png-detail select');z.value=${JSON.stringify(before.originalZoom)};z.dispatchEvent(new Event('change'));v.scrollTo(${before.originalLeft},${before.originalTop});})()` });
  }
  if (process.env.PREVIEW_DETAIL_SCREENSHOT_ACTUAL) {
    await send('Input.dispatchKeyEvent', { type:'keyDown', key:'1', code:'Digit1', windowsVirtualKeyCode:49 });
    await send('Input.dispatchKeyEvent', { type:'keyUp', key:'1', code:'Digit1', windowsVirtualKeyCode:49 });
    const actual = (await send('Runtime.evaluate', { expression: `(() => {const v=document.querySelector('.milxdy-png-detail-viewport'),z=document.querySelector('.milxdy-png-detail select');v.scrollTo(352,780);return z.value === '1';})()`, returnByValue:true })).result.value;
    if (!actual) throw new Error('Native actual-pixel shortcut failed'); result.nativeActualPixelShortcut = true;
  }
  if (process.env.SCREENSHOT_CASE) await send('Runtime.evaluate', { expression: `Array.from(document.querySelectorAll('h2')).find(element=>element.textContent===${JSON.stringify(process.env.SCREENSHOT_CASE)})?.scrollIntoView()` });
  if (process.env.SCREENSHOT_SIDE) await send('Runtime.evaluate', { expression: `document.querySelector('#milxdy-overlay-dock-root').dataset.side = ${JSON.stringify(process.env.SCREENSHOT_SIDE)}` });
  if (process.env.SCREENSHOT_PATH) { const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await writeFile(process.env.SCREENSHOT_PATH, Buffer.from(screenshot.data, 'base64')); }
  if (process.env.PREVIEW_DETAIL_INPUT_CHECK && result.passed) {
    await send('Input.dispatchKeyEvent', { type:'keyDown', key:'Tab', code:'Tab', windowsVirtualKeyCode:9 });
    await send('Input.dispatchKeyEvent', { type:'keyUp', key:'Tab', code:'Tab', windowsVirtualKeyCode:9 });
    const contained = (await send('Runtime.evaluate', { expression: `document.activeElement.closest('.milxdy-png-detail') !== null`, returnByValue:true })).result.value;
    if (!contained) throw new Error('Native Tab escaped detail dialog');
    await send('Input.dispatchKeyEvent', { type:'keyDown', key:'Escape', code:'Escape', windowsVirtualKeyCode:27 });
    await send('Input.dispatchKeyEvent', { type:'keyUp', key:'Escape', code:'Escape', windowsVirtualKeyCode:27 });
    const closed = (await send('Runtime.evaluate', { expression: `!document.querySelector('.milxdy-png-detail') && document.activeElement.dataset.action === 'inspect'`, returnByValue:true })).result.value;
    if (!closed) throw new Error('Native Escape did not close detail and restore focus'); result.nativeKeyboardFocus = true;
  }
  console.log(JSON.stringify(result, null, 2)); if (!result.passed) process.exitCode = 1;
} finally {
  websocket?.close();
  if (child && child.exitCode === null) await new Promise(resolve => {
    const timeout = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 3000);
    child.once('exit', () => { clearTimeout(timeout); resolve(); }); child.kill();
  });
  await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
