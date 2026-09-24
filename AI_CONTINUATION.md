# Epoch Stateless Continuation

Fresh-session rule: recover the project from repository state and live GitHub state only.

Current:
- default branch: main
- architecture lock: E1.0 / X1.0
- work-order schema: WO1.0
- maximum concurrent workers: 3
- current authorized items: W008 + W009 + W011
- current main head at this handoff branch base: c7430b6478213b0fe9e97f4c159ff9608be77b32

Approved architecture change:
- ACR-001 approved 2026-09-24.
- Target adds live Solution Delivery, Program of Work, procurement/execution actualization, outcome learning/calibration, fine-grained access projections, supervision/alerts and an optional provider-neutral External Event Bridge with an Aurum Chat reference adapter.
- ACR-001 target is recorded but not effective for new implementation until W008/W009/W011 are stabilized and the lock transition is recorded.
- W036-W044 are dependency-gated and none are authorized.

Recovery rule:
After the current wave is merged and reconciled, the Architect/Tech Lead must perform the ACR-001 lock transition before authorizing W036. Then re-derive READY items from the dependency graph and select at most three pairwise-disjoint work orders. W036 is the sole entry point to the delivery program; its descendants must not bypass it.

Aurum rule:
Aurum Chat is optional. Epoch must remain complete for manual, file, and other-provider observation and communication paths. Never place Aurum-specific types in Epoch kernel contracts.

docs/LLM-ARCHITECT-HANDOFF.md supplements but never overrides the architecture lock, Work Orders, actual Git ancestry, and verified CI/evidence.
