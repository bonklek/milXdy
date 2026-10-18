/** Source roots alone never confer trust; callers also verify exact package and manifest hashes. */
export function matchesReviewedSourceRoot(policy, actualRoot, expectedRoot, normalize) {
  if (expectedRoot === actualRoot) return true;
  return (policy.allowedStagedRootSuffixes || []).map(normalize)
    .some(suffix => actualRoot === suffix || actualRoot.endsWith(`/${suffix}`));
}
