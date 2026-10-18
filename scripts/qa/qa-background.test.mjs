import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';
const template = await readFile(new URL('./runtime/qa-background.js', import.meta.url), 'utf8');
const build = { buildId: 'synthetic-current', coordinatorPort: 7319, output: 'synthetic-output', extensionId: 'synthetic-extension' };
async function boot(values, { failWrite = false, failRead = false, failGuardRead = false, failRemove = false, failedTab = null, pollMessage = null } = {}) {
  const refreshed = [], queries = [];
  let reloads = 0;
  const chrome = {
    runtime: { onMessage: { addListener() {} }, reload() { reloads += 1; } },
    storage: { local: {
      get: async keys => {
        if (failRead || failGuardRead && keys === 'milxdy.qa.reloadGuard') throw new Error('unavailable');
        return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter(key => key in values).map(key => [key, values[key]]));
      },
      set: async entries => { if (failWrite) throw new Error('unavailable'); Object.assign(values, entries); },
      remove: async keys => { if (failRemove) throw new Error('unavailable'); for (const key of keys) delete values[key]; },
    } },
    tabs: {
      query: async query => { queries.push(query); return [{ id: 1 }, { id: 2 }]; },
      reload: async id => { if (id === failedTab) throw new Error('closed'); refreshed.push(id); },
    },
  };
  vm.runInNewContext(template.replace('__MILXDY_QA_BUILD_JSON__', JSON.stringify(build)), {
    chrome, console: { info() {}, warn() {} }, setTimeout() {},
    fetch: pollMessage ? async () => ({ ok: true, json: async () => pollMessage }) : () => new Promise(() => {}),
  });
  await new Promise(resolve => setImmediate(resolve));
  return { refreshed, queries, reloads };
}
test('a newly loaded QA build refreshes matching content tabs once, not on worker restart', async () => {
  const values = {};
  const first = await boot(values);
  assert.deepEqual(first.refreshed, [1, 2]);
  assert.ok(first.queries[0].url.includes('https://remilia.net/*'));
  assert.equal(values['milxdy.qa.lastReloadResult'].mode, 'extensionReload');
  const restarted = await boot(values);
  assert.deepEqual(restarted.refreshed, []);
});
test('a new build refreshes and records partial tab failures without a reload loop', async () => {
  const values = { 'milxdy.qa.loadedBuildId': 'synthetic-old' };
  await boot(values, { failedTab: 2 });
  assert.equal(values['milxdy.qa.lastReloadResult'].failedTabs, 1);
  assert.equal(values['milxdy.qa.lastReloadResult'].refreshedTabs, 1);
  assert.deepEqual((await boot(values)).refreshed, []);
});
test('an explicit popup reload refreshes even when the same build already ran', async () => {
  const values = { 'milxdy.qa.loadedBuildId': build.buildId,
    'milxdy.qa.reloadRequest': { desiredBuildId: build.buildId, mode: 'manual' },
    'milxdy.qa.reloadGuard': { pair: 'synthetic' } };
  assert.deepEqual((await boot(values)).refreshed, [1, 2]);
  assert.equal(values['milxdy.qa.lastReloadResult'].mode, 'manual');
  assert.equal(values['milxdy.qa.reloadRequest'], undefined);
  assert.equal(values['milxdy.qa.reloadGuard'], undefined);
});
test('failure to persist the once-per-build marker does not refresh tabs repeatedly', async () => {
  assert.deepEqual((await boot({}, { failWrite: true })).refreshed, []);
});
test('an unreadable prior build marker does not trigger a refresh', async () => {
  assert.deepEqual((await boot({}, { failRead: true })).refreshed, []);
});
test('an unconsumed explicit request never refreshes on repeated worker boots', async () => {
  const values = { 'milxdy.qa.reloadRequest': { desiredBuildId: build.buildId, mode: 'manual' } };
  assert.deepEqual((await boot(values, { failRemove: true })).refreshed, []);
  assert.deepEqual((await boot(values, { failRemove: true })).refreshed, []);
  assert.deepEqual((await boot(values)).refreshed, [1, 2]);
});
test('an unreadable poll reload guard never requests another extension reload', async () => {
  const values = { 'milxdy.qa.loadedBuildId': build.buildId };
  const pollMessage = { action: 'reload', buildId: 'synthetic-next', output: build.output, extensionId: build.extensionId };
  const result = await boot(values, { failGuardRead: true, pollMessage });
  assert.equal(result.reloads, 0);
  assert.equal(values['milxdy.qa.reloadRequest'], undefined);
});
