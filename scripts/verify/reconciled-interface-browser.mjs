import { spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import esbuild from 'esbuild';
const root = await mkdtemp(path.join(tmpdir(), 'milxdy-reconciled-interface-'));
let child, websocket;
try {
  await esbuild.build({ entryPoints: ['scripts/verify/reconciled-interface-browser.ts'], outfile: path.join(root, 'fixture.js'), bundle: true, format: 'iife', platform: 'browser', target: 'chrome120', loader: { '.css': 'text' } });
  const script = await readFile(path.join(root, 'fixture.js'), 'utf8');
  const css = await readFile('assets/extension/popup/popup.css', 'utf8');
  const popup = await readFile('assets/extension/popup/popup.html', 'utf8');
  await cp('assets/extension/popup/remilia-login', path.join(root, 'remilia-login'), { recursive: true });
  await cp('assets/brand', path.join(root, 'brand'), { recursive: true });
  await cp('assets/extension/popup/connection-status.svg', path.join(root, 'connection-status.svg'));
  await writeFile(path.join(root, 'popup.css'), css);
  const html = popup.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '').replace('</head>', `<style>${css}</style></head>`).replace('</body>', `<script>${script}</script></body>`);
  await writeFile(path.join(root, 'fixture.html'), html);
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
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: Number(process.env.VIEWPORT_WIDTH || 1280), height: Number(process.env.VIEWPORT_HEIGHT || 900), deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: pathToFileURL(path.join(root, 'fixture.html')).href });
  await loaded;
  const evaluated = await send('Runtime.evaluate', { expression: 'new Promise((resolve, reject) => { const started = Date.now(); const poll = () => { if (globalThis.__reconciledInterfaceResult) resolve(globalThis.__reconciledInterfaceResult); else if (Date.now() - started > 20000) reject(new Error("Browser fixture timed out")); else setTimeout(poll, 20); }; poll(); })', awaitPromise: true, returnByValue: true });
  if (evaluated.exceptionDetails) throw new Error(JSON.stringify(evaluated.exceptionDetails));
  const result = evaluated.result.value;
  if (process.env.SCREENSHOT_PATH) { const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await writeFile(process.env.SCREENSHOT_PATH, Buffer.from(screenshot.data, 'base64')); }
  await mkdir('internal/issue-review/all-feature-audit/handoffs', { recursive: true });
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile('internal/issue-review/all-feature-audit/handoffs/reconciled-interface.png', Buffer.from(screenshot.data, 'base64'));
  console.log(JSON.stringify(result, null, 2)); if (!result.passed) process.exitCode = 1;
} finally { websocket?.close(); child?.kill(); await new Promise(resolve => setTimeout(resolve, 100)); await rm(root, { recursive: true, force: true }); }
