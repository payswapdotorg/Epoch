# Epoch Stateless Continuation — CURRENT

Fresh-session rule: recover project state from repository state and live GitHub state only.

## Current authoritative baseline

- main baseline: 6912e4af4bab7a77e43d835b6bfc573aacee81f6
- W001-W045 complete: 45/45
- architecture: E1.0/X1.0 with ACR-001/002/003/004 effective
- successor program: ACR-005 / WO2.0
- max concurrent workers: 3
- current work: W046 authorized/active
- W047/W048/W049/W050 blocked by dependency

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

W046 first.

After W046 acceptance and any required lockfile reconciliation:
W047 | W048 | W049 concurrently.

After all three merge:
W050.

One Work Order = one branch = one PR. Workers never merge. Maximum three concurrent workers. Concurrent surfaces must be pairwise-disjoint. Root manifests/lockfiles are serial Tech Lead work.

## Productization reality

apps/web is not yet the finished product.
apps/desktop is a typed reference host, not a downloadable native app.
apps/mobile is a typed reference host, not a downloadable native app.

W047/W048/W049 must turn these into real products and execute the visible UI journeys defined in spec/journey-validation.md.

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