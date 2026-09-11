# SDK adherence checks

Run `npm run verify:app-sdk-adherence` for the migration ratchet. It is also part of `verify:app-sdk-production`.

The check walks runtime imports and re-exports from registered first-party content entry points, including app-owned helpers. It parses syntax with the TypeScript compiler API; comments, strings that resemble code and type-only imports do not count. It records direct browser storage, asset and message access, private platform imports, legacy context hooks, native scheduling, document observers and selected module-evaluation effects. The presence of a scheduler elsewhere in a file does not suppress observations.

`scripts/verify/app-sdk-adherence-baseline.json` records the remaining debt by app, source file and rule, with an owner, reason and removal condition. These are migration exceptions, not declarations that a package is portable. New observations and increases fail. Removing observations also requires reducing the exception ceiling so later changes cannot spend old allowances. When code moves between files, review the moved behavior explicitly; never regenerate the ledger to silence a failure.

The initial ledger comes from the pre-remediation source snapshot. Reductions are tightened as migrations land. Behavioral tests remain necessary: a count can stay constant when one call is replaced by a different call, and a syntactically present adapter may be unreachable. Review the diff as well as the gate result.

## Coverage limits

This gate covers registered first-party content import graphs. It does not follow separately loaded frame/background entries, extension workers, aliases of browser globals, computed import paths, external dependencies or every possible import-time side effect. The existing internal messaging, package-validation and architecture checks cover different boundaries. Browser acceptance still requires a built extension exercised on supported sites.

Use four separate review outcomes: registered in the manifest, compliant with the host lifecycle, portable through the public SDK, and accepted in a browser. Passing this ratchet alone establishes none of the latter three. Preserve reviewed streaming/frame bridges until the host exposes an equivalent capability and sender-validation tests remain in place.

## Regression fixtures

`app-sdk-adherence-fixtures.mjs` proves transitive detection, type-only exclusion, comment/string exclusion, immediate effects, native scheduling beside an SDK scheduler, and rejection of new/increased debt and stale ceilings. The SDK production checks also compile real public consumers and run the author harness and docked starter lifecycle probes. These complement app and runtime behavioral tests rather than replacing them.
