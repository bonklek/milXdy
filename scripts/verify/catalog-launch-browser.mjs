import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import esbuild from 'esbuild';
const root = await mkdtemp(path.join(tmpdir(), 'milxdy-misc-browser-'));
let child, websocket;
try {
  await esbuild.build({ entryPoints: ['scripts/verify/catalog-launch-browser.ts'], outfile: path.join(root, 'fixture.js'), bundle: true, format: 'iife', platform: 'browser', target: 'chrome120', loader: { '.css': 'text' } });
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
  await send('Page.navigate', { url: pathToFileURL(path.join(root, 'fixture.html')).href });
  await loaded;
  await send('Page.bringToFront', {});
  await send('Emulation.setDeviceMetricsOverride', { width: 480, height: 850, deviceScaleFactor: 1, mobile: false });
  const evaluate = async expression => {
    const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  };
  const check = async (expression, label) => { if (!await evaluate(expression)) throw new Error(label + ' ' + JSON.stringify(await evaluate("({calls:catalogFixture.calls(),cues:catalogFixture.cues(),active:document.activeElement?.outerHTML,feedback:document.querySelector('[data-addons-catalog-feedback]')?.textContent})"))); };
  const screenshots = path.resolve('internal/issue-review/all-feature-audit/handoffs');
  await mkdir(screenshots, { recursive: true });
  for (const width of [320, 1280]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 720, deviceScaleFactor: 1, mobile: false });
    for (const side of ['left', 'right']) {
      await evaluate(`catalogFixture.side('${side}'); catalogFixture.reset();`);
      await evaluate(`catalogFixture.button().scrollIntoView({block:'center'}); catalogFixture.button().focus()`);
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      await check(`new Promise(r => setTimeout(() => r(catalogFixture.calls() === 1 && catalogFixture.cues() === 1), 50))`, 'Keyboard launch missing');
      await evaluate(`catalogFixture.button().click(); catalogFixture.button().click();`);
      await check(`catalogFixture.calls() === 1 && catalogFixture.cues() === 1`, 'Repeated activation duplicated navigation or sound');
      await check(`document.querySelector('[data-addons-catalog-feedback] [role=status]')?.textContent.includes('Opening')`, 'Pending feedback missing');
      await evaluate(`catalogFixture.fail()`);
      await check(`new Promise(r => setTimeout(() => r(!!document.querySelector('[data-addons-catalog-feedback] [role=alert]')?.textContent.includes('try again')), 50))`, 'Visible error missing');
      await check(`(() => { const r=document.querySelector('[data-addons-catalog-feedback]').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; })()`, 'Error panel clipped');
      await check(`!document.querySelector('[data-addons-catalog-feedback]').textContent.includes('private')`, 'Raw failure rendered');
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      await writeFile(path.join(screenshots, `catalog-launch-${width}-${side}.png`), Buffer.from(shot.data, 'base64'));
      await evaluate(`document.querySelector('[data-addons-catalog-feedback] button').focus(); document.querySelector('[data-addons-catalog-feedback] button').click()`);
      await check(`document.activeElement === catalogFixture.button() && !document.querySelector('[data-addons-catalog-feedback]')`, 'Dismiss lost retry focus');
      await evaluate(`catalogFixture.advance()`);
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32, text: ' ' });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
      await check(`new Promise(r => setTimeout(() => r(catalogFixture.calls() === 2), 50))`, 'Space retry missing');
      await evaluate(`catalogFixture.succeed()`);
      await check(`new Promise(r => setTimeout(() => r(!!document.querySelector('[data-addons-catalog-feedback] [role=status]')?.textContent.includes('opened')), 50))`, 'Success not announced');
    }
  }
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: 'dark' }] });
  await evaluate(`document.documentElement.style.zoom='2'; catalogFixture.reset(); catalogFixture.button().click(); catalogFixture.fail()`);
  await check(`new Promise(r => setTimeout(() => r(!!document.querySelector('[data-addons-catalog-feedback] [role=alert]')), 50))`, 'Zoom/reduced-motion error absent');
  console.log(JSON.stringify({ passed: true, widths: [320,1280], sides: ['left','right'], keyboard: ['Enter','Space'], pending: true, duplicateSoundAndLaunch: false, recoverableErrors: true, dismissRestoresFocus: true, zoom: 2, reducedMotion: true }));

} finally { websocket?.close(); child?.kill(); await new Promise(resolve => setTimeout(resolve, 100)); await rm(root, { recursive: true, force: true, maxRetries: 8, retryDelay: 200 }); }
