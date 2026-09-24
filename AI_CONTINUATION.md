# Epoch Stateless Continuation

Fresh-session rule: recover the project from repository state and live GitHub state only.

Current:
- default branch: main
- architecture lock: E1.0 / X1.0
- work-order schema: WO1.0
- maximum concurrent workers: 3
- current authorized items: W009 + W011
- current main head: 6314365e74dff912b453ca3cbbeac0af351472a3
- PR #21 merged: ACR-001 target architecture and W036-W044 delivery program recorded
- PR #22 merged: W008 Extension SDK + Wasm
- PR #24 merged: post-W008 lockfile reconciliation

Approved architecture change:
- ACR-001 + ACR-002 approved 2026-09-24.
- Target adds live Solution Delivery, Program of Work, universal Acquire/Realize actualization, outcome learning/calibration, fine-grained access projections, supervision/alerts and an optional provider-neutral External Event Bridge with an Aurum Chat reference adapter. Universal lifecycle and domain-pack/Navigator rules are canonical in spec/universal-solution-lifecycle.md, spec/domain-pack-contract.md and spec/solution-navigator-architecture.md.
- ACR-001/ACR-002 targets are recorded but not effective for new implementation until W008/W009/W011 are stabilized and the lock transition is recorded.
- W036-W044 are dependency-gated and none are authorized.

Recovery rule:
After the current wave is merged and reconciled, the Architect/Tech Lead must perform the ACR-001 lock transition before authorizing W036. Then re-derive READY items from the dependency graph and select at most three pairwise-disjoint work orders. W036 is the sole entry point to the delivery program; its descendants must not bypass it.

Aurum rule:
Aurum Chat is optional. Epoch must remain complete for manual, file, and other-provider observation and communication paths. Never place Aurum-specific types in Epoch kernel contracts.

docs/LLM-ARCHITECT-HANDOFF.md supplements but never overrides the architecture lock, Work Orders, actual Git ancestry, and verified CI/evidence.


Domain-pack rule: future packs must adapt the universal lifecycle and expose domain schedules/BOQs/BOMs/roadmaps as projections. They may not create parallel lifecycle, baseline, delivery, actualization, verification or learning authorities.
