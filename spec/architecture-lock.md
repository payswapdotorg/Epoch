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

## Approved but not-yet-effective ACR-001

ACR-001 was approved on 2026-09-24. It adds Solution Delivery, Program of Work, Procurement, Execution/Actualization, Outcome Learning, Fine-Grained Access Projections, Supervision/Alerts and an optional provider-neutral External Event Bridge with an Aurum Chat reference adapter.

This architecture lock remains E1.0/X1.0 for the currently authorized W008/W009/W011 wave. The ACR-001 target becomes effective only when the Tech Lead/Architect records the lock transition and corresponding frontier update after the current wave is stabilized.

Forbidden without an Architecture Change Request:
- second world database/ledger/lifecycle authority;
- provider semantics in kernel types;
- direct agent-to-durable-state mutation;
- UI-as-authority;
- unrestricted public extension host access;
- vertical frontend forks;
- silent new domains/subsystems.

An Architecture Change Request requires impact analysis, revised acceptance criteria, version/lock update, and frontier update before implementation.
