# Epoch Stateless Continuation — CURRENT

Fresh-session rule: recover project state from repository state and live GitHub state only.

## Current authoritative baseline

- main baseline: the ACR-005 productization program is COMPLETE (W001-W050, 50/50; W050 merged as 4ae6545e via PR #113 + this governance advance)
- architecture: E1.0/X1.0 with ACR-001/002/003/004/005 effective
- frontier: EMPTY — no active, eligible or blocked work orders
- max concurrent workers: 3 (moot — program complete)
- current work: NONE. Post-program work requires a NEW ACR per spec/architecture-lock.md; until one is approved and recorded, there is nothing to dispatch.

## Recovery reading order

1. AGENTS.md
2. spec/architecture-lock.md
3. spec/architecture-change-requests/ACR-005-productization-native-clients.md
4. spec/productization-architecture.md
5. spec/journey-validation.md
6. spec/PROJECT-STATE.md
7. spec/work-items.md
8. spec/dependency-graph.md
9. spec/worker-runbook.md
10. assigned Work Order
11. live GitHub state

## Dispatch

NONE — the roadmap is complete (50/50). A future program requires a new ACR (spec/architecture-change-requests/) with its own Work Order table before anything becomes dispatchable.

One Work Order = one branch = one PR. Workers never merge. Maximum three concurrent workers. Concurrent surfaces must be pairwise-disjoint. Root manifests/lockfiles are serial Tech Lead work.

## Productization reality

ACR-005 is complete: W046-W050 all landed and the real client productization/journey-validation program is closed.

- Web: production product and J01-J12 browser journey validation complete.
- Desktop: Tauri 2 product configuration and journey validation complete; native packaging is config-delivered where a Linux/Windows/macOS host toolchain was unavailable in the execution environment.
- Mobile: Expo/React Native product configuration and journey validation complete; Android/iOS packaging is config-delivered where SDK/Xcode infrastructure was unavailable in the execution environment.
- W050 cross-platform closure: 245/245 independent battery tasks, 4/4 CI checks in both contexts, 15 program defects closed, 0 unresolved P0/P1.

See release/clients/release-manifest.json for the exact platform artifact-status records.

## Product journey rule

A passing unit/integration suite is necessary but insufficient.

Every platform run follows:
Observe -> record -> reproduce -> regression test -> fix -> rerun -> close.

Journey evidence lives under docs/journeys/. Large binary traces stay in CI artifacts.

## Architecture invariants

World Model = semantic authority.
Solution/Delivery/ProgramOfWork = their existing authoritative records.
Constraint Engine = constraint authority.
Action Gateway = execution authority.
Simulation = prediction.
Evaluation = judgment.
Verification/Evidence = proof.
Experience/client state = projection.
Local cache/queue = replay/session/projection only.

No second lifecycle, semantic ledger, or client authority.

## Platform choices

Web: existing Next.js/React.
Desktop: Tauri 2 around W017.
Mobile: Expo + React Native around W018.

Platform toolchains are adapters, not semantic authorities.

## Scope discipline

W045 advisory questions are not part of ACR-005.
Any new semantic subsystem requires a new ACR + Work Order program.

Git + CI + journey evidence, not chat, is the completion oracle.


Historical recovery notes from earlier waves remain in PROJECT-STATE.md and Git history.