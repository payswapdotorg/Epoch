# Epoch Architecture Lock E1.0 / X1.0

1. World Model is semantic authority.
2. Agents never become semantic authority.
3. Actions execute only through Action Gateway.
4. Constraints are authoritative in Constraint Engine.
5. Simulators remain external capabilities.
6. Evaluation is distinct from simulation.
7. Verification/Evidence is first-class.
8. Experience is a projection, never a second source of truth.
9. Extensions are capability-scoped.
10. Public arbitrary code is sandboxed.
11. Marketplace entitlement is separate from payment processor state.
12. Identity, tenancy, authorization and policy are distinct.
13. Provider-specific behavior is adapterized.
14. Web/desktop/mobile share semantic contracts.
15. PostgreSQL is durable authoritative state for v1.
16. One responsibility has one authority.

## Approved architecture targets and lock transition record

ACR-001 was approved on 2026-09-24. It adds Solution Delivery, Program of Work, Resource Acquisition/Procurement, Realization/Execution, Actualization, Outcome Learning, Fine-Grained Access Projections, Supervision/Alerts and an optional provider-neutral External Event Bridge with an Aurum Chat reference adapter.

ACR-002 clarifies the same target as a universal engineering lifecycle and Solution Navigator with domain packs as projections of the canonical lifecycle. It does not introduce a second authority or new parallel runtime.

ACR-003 was approved on 2026-09-24. It establishes the Capability Foundation Policy: mature open-source engineering products are replaceable capabilities behind the Capability/Adapter Fabric, not Epoch semantic authorities. Integrate before forking; any fork requires an Architecture Change Request plus explicit license/dependency, isolation, divergence and upstream/reconciliation planning.

### Lock transition — recorded 2026-09-29 (Tech Lead, with the ACR-004 review-rebase of PR #76)

1. The ACR-001/ACR-002/ACR-003 targets are DELIVERED: their implementation program W036-W044 is complete on main (final merge W025, PR #93 squash cfaf5c42; program 44/44; all CI green). The E1.0/X1.0 numbered invariants above remain binding — the ACR targets extend them and introduce no second authority.
2. The ACR-001/ACR-002/ACR-003 targets are EFFECTIVE for all new implementation from this transition forward. The historical gating text ("remains E1.0/X1.0 for the currently authorized W009/W011 wave") is superseded and retired.
3. ACR-004 (approved 2026-09-27, ratified by this review) is EFFECTIVE at this same transition. Its implementation entry point is W045 (Autonomous Role & Capability Discovery), defined in spec/work-orders/W045-autonomous-role-capability-discovery.md with all dependencies complete. Frontier update: W045 ELIGIBLE.
4. ACR-003's capability-foundation policy is binding capability policy from this transition (as required at the original approval).

Forbidden without an Architecture Change Request:
- second world database/ledger/lifecycle authority;
- provider semantics in kernel types;
- direct agent-to-durable-state mutation;
- UI-as-authority;
- unrestricted public extension host access;
- vertical frontend forks;
- silent new domains/subsystems;
- promotion of a third-party editor/CAD/game/simulation/IDE project into Epoch's semantic authority;
- source-level fork of a third-party foundation without the ACR-003 fork gate.

ACR-004 was approved on 2026-09-27. It establishes the universal Role & Capability Discovery Plane and scheduled ecosystem discovery. It adds no lifecycle authority.

An Architecture Change Request requires impact analysis, revised acceptance criteria, version/lock update, and frontier update before implementation.

## Universal-domain invariants

- The lifecycle spine is Understand → Decide → Plan → Acquire → Realize → Observe/Actualize → Verify → Forecast → Close → Learn.
- Acquire and Realize are universal concepts; procurement and execution are domain/profession projections.
- Domain packs may specialize representation and capability use, but may not define competing lifecycle, schedule, baseline, delivery, actualization, verification or learning authorities.
- The Solution Navigator is a synchronized projection, not a new semantic store.
- Third-party foundations remain capability providers behind declared boundaries.
- Provider-native project files, scene graphs, repositories, solver state and editor timelines are not Epoch semantic authority.

## Autonomous-discovery invariants

- Task-specific roles are derived from evidence and capability demands, not model names.
- Domain packs may provide reusable role/capability templates, but the universal discovery plane owns task-specific organization construction.
- External discovery may enrich candidate capability knowledge but may not alter authoritative state merely from external claims.
- Untrusted model/code artifacts remain outside the Epoch trust domain until applicable sandbox/security gates pass.
- Discovery does not grant execution authority.
\n\n## ACR-005 — Productization, Native Clients & Journey Validation\n\nACR-005 is EFFECTIVE (2026-09-29). It introduces no semantic authority. It productizes the existing architecture through one client-facing Application Gateway, authoritative persistence adapters, the canonical web application, native desktop/mobile hosts, release automation and mandatory real-product journey validation.\n\nBinding implementation: W046-W050. W046 freezes shared client/runtime contracts; W047/W048/W049 are pairwise-disjoint platform implementations; W050 is serialized cross-platform hardening and release closure.\n\nPlatform technologies are adapters, not semantic authorities: Next.js/React remains the canonical web client; Tauri 2 hosts desktop; Expo/React Native hosts mobile. E1.0/X1.0 authority invariants remain binding.\n\nA client cache/queue is projection/replay state only. A UI/native host may not become a second World, Solution, Delivery, Verification or Learning authority. Journey closure requires a built/running artifact plus reproduce -> regression test -> fix -> rerun evidence.\n