# Long-Running Goal Sub-Agent Policy

Date: 2026-06-27

Use this policy for large `/goal` work where the main agent would otherwise lose strategic context to repeated repo exploration, audits, or broad implementation loops.

## Core Model

Use a main architect plus bounded sub-agents.

The main agent owns:

- The overall goal and current plan.
- Architecture and shared interfaces.
- Sequencing and prioritization.
- Final integration.
- Conflict resolution.
- Verification and final status.

Sub-agents own:

- Bounded research tasks.
- Bounded implementation tasks with clear file/module ownership.
- Focused test additions.
- Focused documentation updates.
- Migration slices that do not require independent architecture decisions.

The purpose is speed and context control, not abdication. The main agent must still inspect and integrate the work.

## When To Use Sub-Agents

Use sub-agents aggressively for context-heavy or independent work.

Good sub-agent tasks:

- Audit all dynamic HTML usage.
- Map manifest permissions to code paths.
- Inventory auth and token flows.
- Inventory storage keys.
- Find missing tests and validators.
- Migrate a single isolated feature module.
- Replace unsafe rendering in one feature.
- Write tests for one subsystem.
- Draft one documentation section.

Good parallel implementation slices:

- Beetol background TypeScript migration.
- RemiStats tooltip rendering replacement.
- Update-check tests.
- Scanner and URL validation tests.
- Permissions rationale documentation.
- Storage key inventory.
- Media/upload limit tests.

Avoid sub-agents for tiny local edits where direct reading is cheaper.

## What Not To Parallelize Blindly

Do not allow multiple sub-agents to concurrently redesign or edit the same shared system.

Shared systems requiring main-agent ownership:

- `src/shared/backgroundRouter.ts`
- RemiliaNET auth architecture
- Manifest generation
- Storage key registry
- Unified verification scripts
- Shared test utilities
- Content runtime architecture
- Feature registry contracts
- Build pipeline structure

Sub-agents may research these areas or write tests against a main-agent-defined contract, but the main agent should own the final design and integration.

## Instructions For Implementation Sub-Agents

Before spawning an implementation sub-agent, the main agent should define:

- The precise objective.
- Files or modules the sub-agent may edit.
- Files or modules the sub-agent must not edit.
- Expected public API or behavior.
- Tests to add or update.
- Verification commands to run.
- Output summary format.

Sub-agents must return concise summaries, not raw logs.

Required sub-agent summary:

- Files changed.
- Behavior changed.
- Tests added or updated.
- Commands run and results.
- Remaining risks.
- Integration notes.

The main agent must inspect diffs before accepting sub-agent output.

## Conflict Handling

If two sub-agent outputs conflict:

- Do not stack patches blindly.
- Identify the overlapping files and assumptions.
- Choose one design or synthesize a third design.
- Re-run affected tests.
- Update docs if the selected design changes architecture.

The main agent is responsible for coherence.

## Suggested Parallel Waves For Remediation Work

### Wave 1: Discovery

Run these in parallel:

- Audit dynamic HTML and unsafe rendering.
- Map permissions to code paths.
- Inventory auth/token flows.
- Inventory storage keys.
- Inventory missing tests and validators.

Expected output: concise findings with file references and recommended action order.

### Wave 2: Foundation

Main agent:

- Implement unified verify script.
- Establish test harness if missing.

Sub-agents:

- Write update-check tests.
- Write scanner and URL validation tests.
- Draft permissions/auth documentation.

### Wave 3: Security

Main agent:

- Design background sender policy and shared router contract.
- Integrate router changes.

Sub-agents:

- Write sender-policy tests.
- Audit existing message senders and required allowed origins.
- Identify feature-specific payload validators.

### Wave 4: Feature Remediation

Run bounded implementations in parallel where file ownership is clean:

- Migrate Beetol background to TypeScript.
- Replace RemiStats unsafe tooltip rendering.
- Add RemiNet Chat renderer tests.
- Add media/upload limit tests.
- Add update-check timeout/backoff tests.

Main agent integrates shared helper changes and resolves conflicts.

### Wave 5: Hardening

Sub-agents:

- Reduce manifest permissions from feature metadata.
- Build storage key registry and migration docs.
- Clean temp artifacts, encoding issues, and release hygiene.
- Expand docs.

Main agent:

- Run full verification.
- Inspect final diff.
- Close remaining acceptance criteria.

## Completion Standard

Sub-agent use is successful only if it improves throughput without degrading architecture. The final repository should feel like one engineer made coherent decisions, not several agents produced unrelated patches.

The main agent should never mark a long-running remediation goal complete until:

- All sub-agent outputs have been reviewed.
- Conflicts are resolved.
- Shared abstractions are coherent.
- Verification passes.
- Remaining risks are documented.
