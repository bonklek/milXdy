export function boot(context) {
  context.recordDiagnostic("localPackage.dev-note.booted", {
    packageId: context.manifest.id,
    enabled: true,
    updatedAt: Date.now()
  });
}
