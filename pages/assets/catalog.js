// Compatibility entry point for browsers holding the catalog's former root HTML.
// The query makes the onboarding document a distinct cache key during migration.
const target = new URL("./", window.location.href);
target.searchParams.set("view", "onboarding");
window.location.replace(target);
