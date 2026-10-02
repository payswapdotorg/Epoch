# Epoch Stateless Continuation — CURRENT

Fresh-session rule: recover project state from repository state and live GitHub state only.

## Current authoritative baseline

- main state: ACR-005 productization is COMPLETE (W001-W050, 50/50; W050 merged as 4ae6545e via PR #113 + governance advance 598210a2; later commits are state/handoff cleanup only). ACR-006 (Public Deployment, Free-Tier Infrastructure & Production Operations) is now EFFECTIVE (operator directive 2026-10-02): the completed product is being made publicly deployable and actually accessible over the internet on free-tier infrastructure.
- architecture: E1.0/X1.0 with ACR-001/002/003/004/005/006 effective (ACR-006 adds NO semantic authority — deployment/operations only)
- frontier: eligible=[W052,W053,W054]; blocked=[W055]
- max concurrent workers: 3 — the concurrent wave is AUTHORIZED (pairwise-disjoint: W052 apps/web product+Vercel | W053 infrastructure live verification | W054 Apify acquisition + ops)
- current work: ACR-006 program. W051 COMPLETE (PR #117 -> 9dff75e + pg intake #116 -> 2b3ab89 + lockfile reconcile #118 -> 2e4aafd): the six production specs, the RequestGuard port + adapters (S3/Upstash, real implementations), the production binding layer, health/readyz, vercel.json, the verified free-tier cost contract. W055 unlocks after W052+W053+W054 merge.
- credential boundary: NO provider credentials exist (Vercel/Neon/R2/Upstash/Apify are operator input); work orders deliver to the boundary and record VERIFIED/NOT-VERIFIED honestly; never fabricate deployment URLs.

## Recovery reading order

1. AGENTS.md
2. spec/architecture-lock.md
3. spec/architecture-change-requests/ACR-006-public-deployment.md
4. spec/deployment-architecture.md, spec/production-environment.md, spec/free-tier-infrastructure.md (W051 deliverables)
5. spec/journey-validation.md (J01-J12 + production P01-P18)
6. spec/PROJECT-STATE.md
7. spec/work-items.md (ACR-006 section)
8. spec/dependency-graph.md (ACR-006 section)
9. spec/worker-runbook.md
10. assigned Work Order
11. live GitHub state

## Dispatch

W052/W053/W054 are ELIGIBLE concurrently (max 3 workers, pairwise-disjoint surfaces). After all three merge + Tech Lead reconciliation: W055 (serialized closure).

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