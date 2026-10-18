import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import esbuild from 'esbuild';
import { createServer } from 'node:http';
const root = await mkdtemp(path.join(tmpdir(), 'milxdy-dm-reader-'));
let child, websocket, server;
try {
  await esbuild.build({ entryPoints: ['scripts/verify/direct-messages-browser.ts'], outfile: path.join(root, 'fixture.js'), bundle: true, format: 'iife', platform: 'browser', target: 'chrome120', loader: { '.css': 'text' }, plugins: [] });
  const script = await readFile(path.join(root, 'fixture.js'), 'utf8');
  const css = '';
  await writeFile(path.join(root, 'fixture.html'), `<!doctype html><meta charset="utf-8"><body><style>${css}</style><script>${script}</script>`);
  server = createServer((request, response) => { response.setHeader('Content-Type', 'text/html'); response.end(`<!doctype html><meta charset="utf-8"><body><script>${script}</script>`); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const fixtureUrl = `http://127.0.0.1:${server.address().port}/i/chat/controlled-fixture`;
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
  await send('Page.navigate', { url: fixtureUrl });
  await loaded;
  const proof = await send('Runtime.evaluate', {expression:'new Promise((resolve,reject)=>{const start=Date.now();const poll=()=>{if(globalThis.__dmHighlightReady)resolve(true);else if(Date.now()-start>12000)reject(new Error("Synthetic highlight did not become ready"));else setTimeout(poll,20);};poll();})',awaitPromise:true,returnByValue:true});
  if(proof.exceptionDetails) throw new Error(JSON.stringify(proof.exceptionDetails));
  const proofBounds = await send('Runtime.evaluate',{expression:'globalThis.__dmHighlightProofRect',returnByValue:true});
  const highlighted = await send('Page.captureScreenshot', {format:'png',clip:proofBounds.result.value});
  await writeFile(path.join(root,'highlight.png'),Buffer.from(highlighted.data,'base64'));
  const pixels = spawnSync(process.env.PYTHON || 'python3',['-c','from PIL import Image;import sys;im=Image.open(sys.argv[1]).convert("RGB");n=sum(1 for r,g,b in im.getdata() if r>230 and 180<g<240 and 80<b<160);print(n);sys.exit(0 if n>20 else 1)',path.join(root,'highlight.png')],{encoding:'utf8'});
  if(pixels.status!==0) throw new Error('Native shadow CSS highlight did not produce expected visible yellow pixels: '+pixels.stdout+pixels.stderr);
  if (process.env.HIGHLIGHT_SCREENSHOT_PATH) {
    await mkdir(path.dirname(process.env.HIGHLIGHT_SCREENSHOT_PATH), { recursive: true });
    await writeFile(process.env.HIGHLIGHT_SCREENSHOT_PATH, Buffer.from(highlighted.data, 'base64'));
  }
  await send('Runtime.evaluate',{expression:'globalThis.__dmHighlightCaptured = true'});
  const evaluated = await send('Runtime.evaluate', { expression: 'new Promise((resolve, reject) => { const started = Date.now(); const poll = () => { if (globalThis.__dmReaderResult) resolve(globalThis.__dmReaderResult); else if (Date.now() - started > 20000) reject(new Error("Browser fixture timed out")); else setTimeout(poll, 20); }; poll(); })', awaitPromise: true, returnByValue: true });
  if (evaluated.exceptionDetails) throw new Error(JSON.stringify(evaluated.exceptionDetails));
  const result = evaluated.result.value;
  if (process.env.SCREENSHOT_PATH) { const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await writeFile(process.env.SCREENSHOT_PATH, Buffer.from(screenshot.data, 'base64')); }
  console.log(JSON.stringify(result, null, 2)); if (!result.passed) process.exitCode = 1;
} finally { websocket?.close(); child?.kill(); server?.close(); await new Promise(resolve => setTimeout(resolve, 100)); await rm(root, { recursive: true, force: true }); }
