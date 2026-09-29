# Epoch Stateless Continuation

Fresh-session rule: recover the project from repository state and live GitHub state only.

Current:
- default branch: main
- architecture lock: E1.0 / X1.0
- work-order schema: WO1.0
- maximum concurrent workers: 3
- current authorized item: W029
- current main head: 34081bff7a84b15c9d81a9d89bd0df0a70d0f470
- PR #21 merged: ACR-001 target architecture and W036-W044 delivery program recorded
- PR #22 merged: W008 Extension SDK + Wasm
- PR #24 merged: post-W008 lockfile reconciliation
- PR #27 merged: universal Solution Navigator, lifecycle and domain-pack architecture
- PR #29 merged: Capability Foundation Policy and upstream integration/fork governance
- ACR-004 branch prepared against live main; supersedes stale PR #75

Approved architecture change:
- ACR-001 + ACR-002 + ACR-003 approved 2026-09-24.
- ACR-004 approved 2026-09-27.
- Target adds live Solution Delivery, Program of Work, universal Acquire/Realize actualization, outcome learning/calibration, fine-grained access projections, supervision/alerts and an optional provider-neutral External Event Bridge with an Aurum Chat reference adapter. Universal lifecycle and domain-pack/Navigator rules are canonical in spec/universal-solution-lifecycle.md, spec/domain-pack-contract.md and spec/solution-navigator-architecture.md. Capability foundation and upstream/fork policy is canonical in spec/capability-foundation-policy.md and spec/architecture-change-requests/ACR-003-capability-foundations.md. Autonomous discovery is canonical in spec/autonomous-role-capability-discovery.md and spec/capability-contribution-contract.md.
- ACR-001/ACR-002/ACR-003 targets are recorded but not effective for new implementation until W009/W011 are stabilized and the lock transition is recorded.
- W036-W044 continue according to live dependency state; W045 is blocked pending formal architecture-lock reconciliation.

Recovery rule:
After the current wave is merged and reconciled, the Architect/Tech Lead must do not authorize W045 until the applicable successor architecture lock/reconciliation state is explicit. Then re-derive READY items from the dependency graph and select at most three pairwise-disjoint work orders. W036 is the sole entry point to the delivery program; its descendants must not bypass it.

Aurum rule:
Aurum Chat is optional. Epoch must remain complete for manual, file, and other-provider observation and communication paths. Never place Aurum-specific types in Epoch kernel contracts.

docs/LLM-ARCHITECT-HANDOFF.md supplements but never overrides the architecture lock, Work Orders, actual Git ancestry, and verified CI/evidence.


Domain-pack rule: future packs must adapt the universal lifecycle and expose domain schedules/BOQs/BOMs/roadmaps as projections. They may not create parallel lifecycle, baseline, delivery, actualization, verification or learning authorities.
