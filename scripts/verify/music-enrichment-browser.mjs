import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import esbuild from 'esbuild';
import { createServer } from 'node:http';
const root = await mkdtemp(path.join(tmpdir(), 'milxdy-misc-browser-'));
let child, websocket, server;
try {
  await esbuild.build({ entryPoints: ['src/apps/music/content.ts'], outfile: path.join(root, 'fixture.js'), bundle: true, external: ['@unimusic/chromaprint'], format: 'iife', platform: 'browser', target: 'chrome120', plugins: [{ name: 'music-fixture-access', setup(build) { build.onLoad({ filter: /music\/content\.ts$/ }, async args => ({ loader: 'ts', contents: await readFile(args.path, 'utf8') + `
booted = true;
const requestSpy = []; let failWrites = false;
appSdkSendMessage = async message => { requestSpy.push(message); return { ok: true, data: { recordings: [] } }; };
sdkServices = { assetUrl: () => "", readLocal: async values => values, writeLocal: async () => { if (failWrites) throw new Error("synthetic storage failure"); }, observeLocal: () => () => undefined };
globalThis.musicFixture = {
  requestSpy, state, disable, failWrites: value => failWrites = value,
  async index(priorConsent) {
    const handle = await navigator.storage.getDirectory();
    const file = await handle.getFileHandle("Synthetic Artist - Synthetic Track.wav", { create: true });
    const writer = await file.createWritable();
    const bytes = new Uint8Array(8044), view = new DataView(bytes.buffer);
    const text = (offset, value) => [...value].forEach((char, i) => bytes[offset+i] = char.charCodeAt(0));
    text(0,"RIFF"); view.setUint32(4,8036,true); text(8,"WAVEfmt "); view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,1,true); view.setUint32(24,8000,true); view.setUint32(28,8000,true); view.setUint16(32,1,true); view.setUint16(34,8,true); text(36,"data"); view.setUint32(40,8000,true); bytes.fill(128,44);
    await writer.write(bytes); await writer.close();
    state.enrichmentServices = musicEnrichmentChoices(priorConsent ? { musicbrainz:true, acoustid:true, revision:"prior" } : null);
    enrichmentSession.update(state.enrichmentServices);
    window.showDirectoryPicker = async () => handle;
    if (!state.folders.length) await addFolder(); await rescanFolders();
    return { calls: requestSpy.length, tracks: state.tracks.length, error: state.error, status: state.status };
  },
  async lifecycleFences() {
    const grant = { musicbrainz: true, acoustid: false, revision: "lifecycle-review" };
    state.enrichmentServices = grant; enrichmentSession.update(grant);
    const clickStart = () => [...document.querySelectorAll("dialog button")].find(b => b.textContent === "Enrich selected services").click();
    const review = runEnrichmentQueue(); clickStart(); activationGeneration++; await review;
    if (requestSpy.length) throw new Error("Accepted stale activation review sent a request");
    const replies = []; appSdkSendMessage = message => { requestSpy.push(message); return new Promise(resolve => replies.push(resolve)); };
    const wait = async count => { for (let i=0;i<150 && replies.length<count;i++) await new Promise(resolve => setTimeout(resolve,20)); if(replies.length<count) throw new Error("Batch request did not begin"); };
    const first = runEnrichmentQueue(); clickStart(); await wait(1);
    disable(); activationGeneration++; state.enrichmentServices = grant; enrichmentSession.update(grant);
    const second = runEnrichmentQueue(); clickStart(); await wait(2);
    replies[0]({ ok: true, data: { recordings: [] } }); await first;
    if (!state.enrichActive || state.tracks[0].enrichment.status !== "pending") throw new Error("Old batch changed new activation state");
    replies[1]({ ok: true, data: { recordings: [] } }); await second;
    requestSpy.length=0; return true;
  },
  show() {
    state.enrichmentServices = { musicbrainz: true, acoustid: false, revision: "review" };
    const host = document.createElement("section"); document.body.append(host);
    const preferences = bindMusicEnrichmentPreferences(state, () => sdkServices, lifecycleActive, enrichmentSession, redraw);
    function redraw() { host.replaceChildren(musicEnrichmentControls({ choices: state.enrichmentServices, key: state.acoustIdClientKey, busy: preferences.pending(), update: choices => preferences.save({ choices }), saveKey: key => preferences.save({ key }) })); if (state.error) { const p = document.createElement("p"); p.setAttribute("role","alert"); p.textContent = state.error; host.append(p); } }
    redraw();
    const button = document.createElement("button"); button.textContent = "Enrich"; button.onclick = () => confirmMusicEnrichment(state.enrichmentServices, ""); document.body.append(button); return true;
  }
};` })); } }] });
  const script = await readFile(path.join(root, 'fixture.js'), 'utf8');
  const css = await readFile('src/apps/music/content.css', 'utf8');
  const html = `<html><head><style>body{font:14px system-ui;padding:16px;background:#fff;color:#222}button{padding:8px;margin:4px}input[type=password]{max-width:100%;box-sizing:border-box} .milxdy-music-settings{max-width:340px} ${css}</style></head><body><script>${script}</script></body></html>`;
  server = createServer((_request, response) => { response.setHeader('Content-Type', 'text/html'); response.end(html); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
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
  await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}` });
  await loaded;
  await send('Emulation.setDeviceMetricsOverride', { width: 380, height: 850, deviceScaleFactor: 1, mobile: false });
  const evaluate = async expression => {
    const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  };
  const check = async (expression, label) => { if (!await evaluate(expression)) throw new Error(label); };
  const clean = await evaluate(`musicFixture.index(false)`);
  if (clean.calls || clean.tracks !== 1 || clean.error) throw new Error('Clean indexing failed: ' + JSON.stringify(clean));
  const prior = await evaluate(`musicFixture.index(true)`);
  if (prior.calls || prior.tracks !== 1 || prior.error) throw new Error('Prior-consent rescan sent requests or damaged library: ' + JSON.stringify(prior));
  await check(`musicFixture.lifecycleFences()`, 'Stale activation/batch not fenced');
  await evaluate(`musicFixture.show()`);
  await check(`document.querySelector('input[type=checkbox]:disabled') !== null`, 'AcoustID missing key gate');
  await check(`document.documentElement.scrollWidth <= innerWidth`, 'Narrow service controls overflow');
  await evaluate(`musicFixture.failWrites(true); document.querySelector('[data-role=musicbrainz-consent]').focus(); document.querySelector('[data-role=musicbrainz-consent]').click()`);
  await check(`document.querySelector('[data-role=musicbrainz-consent]').checked && document.querySelector('[role=alert]')?.textContent.includes('previously saved')`, 'Failed save changed consent or hid error');
  await check(`document.activeElement.dataset.role === 'musicbrainz-consent'`, 'Service focus lost after async rerender');
  await evaluate(`musicFixture.failWrites(false); document.querySelector('[data-role=musicbrainz-consent]').click()`);
  await evaluate(`document.querySelector('[data-role=musicbrainz-consent]').click()`);
  const screenshots = path.resolve('internal/issue-review/all-feature-audit/handoffs');
  await mkdir(screenshots, { recursive: true });
  let screenshot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(path.join(screenshots, 'music-enrichment-settings.png'), Buffer.from(screenshot.data, 'base64'));
  await evaluate(`(() => { const button = Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Enrich'); button.focus(); button.click(); })()`);
  await check(`document.activeElement.textContent === 'Cancel'`, 'Enrichment dialog safe focus missing');
  await check(`document.querySelector('dialog').textContent.includes('musicbrainz.org') && !document.querySelector('dialog').textContent.includes('api.acoustid.org')`, 'Selected recipient disclosure incorrect');
  screenshot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(path.join(screenshots, 'music-enrichment-review.png'), Buffer.from(screenshot.data, 'base64'));
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await check(`!document.querySelector('dialog') && document.activeElement.textContent === 'Enrich' && musicFixture.requestSpy.length === 0`, 'Escape changed consent/sent data/lost focus');
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Enrich').click(); musicFixture.disable()`);
  await check(`!document.querySelector('dialog') && musicFixture.requestSpy.length === 0`, 'Disable left stale modal or sent data');
  console.log(JSON.stringify({ activationAndBatchFence: true, reviewDisable: true, settingsRerenderFocus: true, storageFailureRollback: true, passed: true, cleanFolderAddRescan: clean, priorConsentFolderAddRescan: prior, narrowControls: true, keyGate: true, selectedDisclosure: true, cancelFocus: true }, null, 2));

} finally { websocket?.close(); child?.kill(); server?.close(); await new Promise(resolve => setTimeout(resolve, 100)); await rm(root, { recursive: true, force: true, maxRetries: 8, retryDelay: 200 }); }
