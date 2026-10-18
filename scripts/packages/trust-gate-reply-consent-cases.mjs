/** Invalid send declarations must never reach a generated runtime registry. */
export async function runReplyConsentTrustCases({ copyLocalPackage, readManifest, writeManifest, runRejectedComposerCaseWithoutPlan }) {
  const cases = [
    { name: "missing", expected: "replyAction sendAfterInsert requires per-template persisted consent" },
    { name: "default-true", expected: "replyAction send consent requires a declared local default-false toggle" },
    { name: "shared", expected: "replyAction send consent must be separate for each template" },
  ];
  for (const test of cases) {
    const directory = await copyLocalPackage("dev-note", `reply-consent-${test.name}`);
    const manifest = await readManifest(directory);
    const key = "milxdy.local.dev-note.replySend";
    const template = { id: "hello", label: "Hello", text: "hello", sendAfterInsert: true };
    if (test.name !== "missing") {
      template.sendAfterInsertStorageKey = key;
      manifest.storageKeys.local.push(key);
      manifest.settings.push({ id: "dev-note.replySend", label: "Insert and send Hello", scope: "app", location: "appsAndFeatures", storage: { area: "local", key }, defaultValue: test.name === "default-true", control: { type: "toggle" }, reset: { behavior: "restoreDefault" } });
    }
    manifest.replyAction = { templates: test.name === "shared" ? [template, { ...template, id: "second", label: "Second", text: "second" }] : [template] };
    manifest.surfaces = [...new Set([...manifest.surfaces, "replyAction"])];
    manifest.loadTriggers = [...new Set([...manifest.loadTriggers, "userAction"])];
    await writeManifest(directory, manifest);
    await runRejectedComposerCaseWithoutPlan(`reply send consent ${test.name} is rejected before plan emission`, [
      `--package=${directory}`, "--allow-local-review", "--acknowledge-package-consent",
    ], test.expected);
  }
}
