import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { resolveCreationPlan } from '../build/reviewed-creation-defaults.mjs';

test('normal full Chromium ships reviewed creation tools with toolbar metadata', async () => {
  const plan = await resolveCreationPlan({target:'chromium',profile:'full',outputDir:'tmp/default-creation-test-output'});
  assert.deepEqual([...plan.selectedPackageIds].sort(), ['tweet-composer-kit','tweetPng']);
  const factory = plan.apps.find(app=>app.id==='tweet-composer-kit');
  assert.equal(factory.defaultEnabled,true);
  assert.equal(factory.composerAction.label,'Factory');
  assert.ok(factory.hostComposerActions.includes('nativeDrafts'));
  assert.ok(plan.diagnostics.every(item=>item.trust.reviewStatus==='reviewed'));
});

test('explicit custom selections, even empty, override bundled defaults', async () => {
  await mkdir('tmp',{recursive:true}); const dir=await mkdtemp('tmp/explicit-creation-test-');
  try {
    const explicit = {selectedPackageIds:[],apps:[]};
    await writeFile(`${dir}/plan.json`,JSON.stringify(explicit));
    assert.deepEqual(await resolveCreationPlan({target:'chromium',profile:'full',explicitPlan:`${dir}/plan.json`,outputDir:'tmp/unused-output'}),explicit);
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test('smaller and unsupported build profiles keep their own package coverage', async () => {
  for(const [target,profile] of [['firefox','full'],['chromium','lite'],['chromium','balanced']]) {
    assert.equal(await resolveCreationPlan({target,profile,outputDir:'tmp/unused-output'}),null);
  }
});
