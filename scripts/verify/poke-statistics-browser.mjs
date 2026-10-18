import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import esbuild from 'esbuild';
const root = await mkdtemp(path.join(tmpdir(), 'milxdy-misc-browser-'));
let child, websocket;
try {
  await esbuild.build({ stdin: { contents: `
import { pokeStatisticsSection, observeRemiNetPokeCredits } from './src/apps/milady-maxxer/poke-statistics-panel';
import { createMaxxerAccountStateLoader } from './src/apps/milady-maxxer/account-state-loader';
import { injectStyles } from './src/apps/milady-maxxer/styles';
injectStyles();
const host = document.createElement('div'); host.className = 'miladymaxxer-panel'; host.style.cssText = 'position:relative;top:0;right:auto;margin:12px;width:340px;height:auto;max-height:none'; document.body.append(host);
let summary = { schemaVersion:1, totalSuccessfulPokes:12, trackedSuccessfulPokes:5, lastSuccessfulPokeAt:1800000000000, resetAt:null };
let calls=0, fail=false, xp=0, unavailable=false, failRead=false, existingXp=0, scope='synthetic', oldRead=null, deferReset=false, finishReset;
const loader = createMaxxerAccountStateLoader({ currentScope:()=>scope, readBase:async account=>({xp:account==='second'?23:12}), readPokes:async account=>{if(account==='older')return oldRead;if(failRead)throw new Error('host read failed');return summary;}, applyBase:base=>{existingXp=base.xp;unavailable=true;}, applyPokes:value=>{unavailable=value===null;if(value)summary=value;redraw();} });
function redraw() { host.replaceChildren(pokeStatisticsSection(unavailable?null:summary, scope, async requestedScope => { calls++; if(deferReset)await new Promise(resolve=>finishReset=resolve); if(fail) return false; if(requestedScope===scope)summary = {...summary,totalSuccessfulPokes:0,trackedSuccessfulPokes:0,lastSuccessfulPokeAt:null}; return true; }, redraw, loader.retry)); }
redraw(); observeRemiNetPokeCredits(() => xp++, value => value || '', () => undefined);
globalThis.pokeFixture = { deferReset:value=>deferReset=value, async finishReset(){finishReset();deferReset=false;await new Promise(resolve=>setTimeout(resolve,0));}, switchAccount(){scope='third';summary={...summary,totalSuccessfulPokes:11};redraw();}, outsideFocus(){let input=document.querySelector('#outside-focus');if(!input){input=document.createElement('input');input.id='outside-focus';document.body.append(input);}input.focus();}, calls:()=>calls, xp:()=>xp, fail: value=>fail=value, summary:()=>summary, existingXp:()=>existingXp, async unavailable(){failRead=true;await loader.load('synthetic');await new Promise(resolve=>setTimeout(resolve,0));}, recoverRead(){failRead=false;summary={...summary,totalSuccessfulPokes:7};}, async scopeRace(kind){let resolveOld,rejectOld;oldRead=new Promise((resolve,reject)=>{resolveOld=resolve;rejectOld=reject;});scope='older';await loader.load(scope);scope='second';failRead=false;summary={...summary,totalSuccessfulPokes:8};await loader.load(scope);await new Promise(resolve=>setTimeout(resolve,0));if(kind==='value')resolveOld({...summary,totalSuccessfulPokes:99});else rejectOld(new Error('old scope failed'));await new Promise(resolve=>setTimeout(resolve,0));return document.querySelector('[data-poke-scope]')?.dataset.pokeScope==='second' && document.querySelector('section').textContent.includes('8 successful') && !document.querySelector('[data-poke-retry]') && existingXp===23;} };
`, resolveDir: process.cwd(), loader:'ts' }, outfile: path.join(root, 'fixture.js'), bundle: true, format: 'iife', platform: 'browser', target: 'chrome120' });
  const script = await readFile(path.join(root, 'fixture.js'), 'utf8');
  await writeFile(path.join(root, 'fixture.html'), `<html><head><style>body{margin:0;font:14px system-ui}.miladymaxxer-panel-section p{margin:0;line-height:1.5}</style></head><body><script>${script}</script></body></html>`);
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
  await send('Emulation.setDeviceMetricsOverride', { width: 380, height: 850, deviceScaleFactor: 1, mobile: false });
  const evaluate = async expression => {
    const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  };
  const check = async (expression, label) => { if (!await evaluate(expression)) throw new Error(label); };
  await check(`document.documentElement.scrollWidth<=innerWidth`, 'Poke statistics overflow narrow viewport');
  await evaluate(`window.dispatchEvent(new CustomEvent('milxdy:remistats-poke-credit',{detail:{handle:'synthetic'}}))`);
  await check(`pokeFixture.xp()===1 && pokeFixture.summary().totalSuccessfulPokes===12`, 'XP hook changed or DOM event inflated authoritative counts');
  const screenshots = path.resolve('internal/issue-review/all-feature-audit/handoffs'); await mkdir(screenshots,{recursive:true});
  await evaluate(`document.querySelector('[data-maxxer-poke-reset]').focus()`);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
  await check(`document.activeElement.textContent==='Cancel'`, 'Reset confirmation should focus Cancel');
  let shot = await send('Page.captureScreenshot',{format:'png'}); await writeFile(path.join(screenshots,'poke-statistics-review.png'),Buffer.from(shot.data,'base64'));
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
  await check(`pokeFixture.calls()===0 && document.activeElement.dataset.maxxerPokeReset==='true'`, 'Canceled reset wrote or lost focus');
  await evaluate(`pokeFixture.fail(true); document.querySelector('[data-maxxer-poke-reset]').click(); Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Confirm reset').click()`);
  await check(`document.querySelector('[role=alert]')?.textContent.includes('Could not reset') && pokeFixture.summary().totalSuccessfulPokes===12 && document.activeElement.dataset.maxxerPokeReset==='true'`, 'Reset failure lost counts/status/focus');
  shot = await send('Page.captureScreenshot',{format:'png'}); await writeFile(path.join(screenshots,'poke-statistics-failure.png'),Buffer.from(shot.data,'base64'));
  await evaluate(`pokeFixture.fail(false); document.querySelector('[data-maxxer-poke-reset]').click(); Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Confirm reset').click()`);
  await check(`pokeFixture.summary().totalSuccessfulPokes===0 && document.querySelector('[role=status]')?.textContent.includes('XP and collection are unchanged') && document.activeElement.dataset.maxxerPokeReset==='true'`, 'Successful reset missing result or keyboard focus');
  await evaluate(`pokeFixture.unavailable()`);
  await check(`document.querySelector('[data-poke-retry]') && document.querySelector('section').textContent.includes('unavailable') && !document.querySelector('section').textContent.includes('0 successful') && Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Reset poke counts').disabled && pokeFixture.existingXp()===12`, 'Optional read failure hid XP or presented false zero history');
  shot = await send('Page.captureScreenshot',{format:'png'}); await writeFile(path.join(screenshots,'poke-statistics-unavailable.png'),Buffer.from(shot.data,'base64'));
  await evaluate(`pokeFixture.recoverRead(); document.querySelector('[data-poke-retry]').focus()`);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
  await check(`new Promise(resolve=>setTimeout(()=>resolve(document.querySelector('section').textContent.includes('7 successful') && !document.querySelector('[data-poke-retry]') && document.activeElement.dataset.maxxerPokeReset==='true' && pokeFixture.existingXp()===12),50))`, 'Counter retry failed or lost XP/focus');
  await check(`pokeFixture.scopeRace('value')`, 'Old scope value replaced current statistics');
  await check(`pokeFixture.scopeRace('error')`, 'Old scope failure replaced current statistics');
  const space = async () => { await send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32}); await send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32}); };
  for (const switchAccount of [true, false]) {
    await evaluate(`pokeFixture.deferReset(true);document.querySelector('[data-maxxer-poke-reset]').focus()`); await space();
    await evaluate(`Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='Confirm reset').focus()`); await space();
    await evaluate(`${switchAccount ? 'pokeFixture.switchAccount();' : ''}pokeFixture.outsideFocus();pokeFixture.finishReset()`);
    await check(`document.activeElement.id==='outside-focus' && document.querySelector('[data-poke-scope]').dataset.pokeScope==='third' ${switchAccount ? "&& document.querySelector('section').textContent.includes('11 successful')" : ""}`, 'Pending reset stole focus after account switch or outside interaction');
  }
  console.log(JSON.stringify({passed:true,pendingResetAccountFocus:true,pendingResetOutsideFocus:true,scopeRaceValuesAndErrors:true,optionalReadFailureKeepsXp:true,unavailableRetry:true,narrowViewport:true,cancelNoWrites:true,nativeSpaceActivation:true,resetFailurePreservesCounts:true,resetSuccess:true,rerenderFocus:true,legacyXpCredit:true,domCannotCount:true},null,2));

} finally { websocket?.close(); child?.kill(); await new Promise(resolve => setTimeout(resolve, 100)); await rm(root, { recursive: true, force: true, maxRetries: 8, retryDelay: 200 }); }
