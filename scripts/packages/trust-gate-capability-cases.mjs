import { runReplyConsentTrustCases } from "./trust-gate-reply-consent-cases.mjs";
/** Capability declarations must fail before the composer emits a build plan. */
export async function runCapabilityDeclarationTrustCases({
  copyLocalPackage,
  readManifest,
  runRejectedComposerCaseWithoutPlan,
  writeManifest,
}) {
  await runReplyConsentTrustCases({ copyLocalPackage, readManifest, runRejectedComposerCaseWithoutPlan, writeManifest });
  const missingEnablementPackage = await copyLocalPackage("dev-note", "missing-enablement-package");
  const missingEnablementManifest = await readManifest(missingEnablementPackage);
  delete missingEnablementManifest.settings;
  missingEnablementManifest.storageKeys = { local: [] };
  await writeManifest(missingEnablementPackage, missingEnablementManifest);
  await runRejectedComposerCaseWithoutPlan("novel package without enablement is rejected before plan emission", [
    `--package=${missingEnablementPackage}`,
    "--allow-local-review",
    "--acknowledge-package-consent",
  ], "novel local package must declare a toggle setting with role \"enablement\"");

  const unknownHostActionPackage = await copyLocalPackage("dev-note", "unknown-host-action-package");
  const unknownHostActionManifest = await readManifest(unknownHostActionPackage);
  unknownHostActionManifest.hostActions = ["wiki.loadAppById"];
  await writeManifest(unknownHostActionPackage, unknownHostActionManifest);
  await runRejectedComposerCaseWithoutPlan("unknown host action is rejected before plan emission", [
    `--package=${unknownHostActionPackage}`,
    "--allow-local-review",
    "--acknowledge-package-consent",
  ], "unsupported host action wiki.loadAppById");

  const undeclaredStorageResourcePackage = await copyLocalPackage("dev-note", "undeclared-storage-resource-package");
  const undeclaredStorageResourceManifest = await readManifest(undeclaredStorageResourcePackage);
  undeclaredStorageResourceManifest.storageResources = [{
    area: "local",
    key: "milxdy.local.dev-note.authoredDraft",
    kind: "authoredData",
  }];
  await writeManifest(undeclaredStorageResourcePackage, undeclaredStorageResourceManifest);
  await runRejectedComposerCaseWithoutPlan("storage resource without storage access is rejected before plan emission", [
    `--package=${undeclaredStorageResourcePackage}`,
    "--allow-local-review",
    "--acknowledge-package-consent",
  ], "must also appear in storageKeys.local");
}
