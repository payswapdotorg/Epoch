# ACR-001 — Solution Delivery, Procurement, Execution, Learning & Realtime Event Bridge

Status: APPROVED
Approved by product/architecture authority: 2026-09-24
Effective architecture version: pending next lock transition after the currently authorized W008/W009/W011 wave
Current implementation lock remains E1.0 / X1.0 until that transition

## Intent

Extend Epoch so an approved solution remains a live, traceable object through procurement, execution, verification, payment and outcome measurement, while preserving the original approved prediction as immutable historical truth.

Add an optional provider-neutral real-world event bridge. External systems may supply observations/events and may receive information-acquisition requests, reminders, alerts, approvals or other authorized actions. Aurum Chat is a reference integration, not a platform dependency.

Add a Program of Work as a first-class schedule dimension of the universal Solution Package. Construction presents that schedule alongside the BOQ and spatial/decision views.

## Approved architectural additions

1. Solution Package includes a versioned baseline plus delivery plan.
2. Delivery Record tracks live procurement, execution, changes, verification, commitments, actuals, forecasts and outcomes without mutating the baseline.
3. Program of Work is a schedule of executable work packages, activities, dependencies, milestones, planned dates, actual dates and forecasts.
4. BOQ is a synchronized construction projection of the quantity/cost/work schedule, not a separate authority.
5. Observation, Commitment, Actual, Forecast and Prediction remain distinct semantic states.
6. Variance and root-cause attribution are first-class.
7. Missing information is allowed. Unknown/estimated/assumed/inferred/observed states carry provenance and confidence.
8. Information acquisition may be passive, manual, connector-driven or delegated to an external communication/intelligence system.
9. External events use provider-neutral contracts. Epoch never imports Aurum-specific domain types.
10. Aurum Chat may act as an optional acquisition/communication bridge: Epoch requests information, Aurum acquires it through authorized channels, and Aurum returns normalized evidence/events.
11. Epoch remains fully functional without Aurum.
12. Supervision and alerts operate natively in Epoch; channel relays are optional adapters.
13. Access control is object/action/field aware and produces authorized projections rather than requiring one universal data view.
14. Learning uses validated actual outcomes and preserves prediction-vs-actual lineage.
15. The same solution graph is retained across design, procurement, execution, verification, payment and learning.

## Invariants

- No second lifecycle/ledger authority.
- Solution baseline is immutable once approved; revisions create new versions.
- Delivery state is authoritative for delivery facts; World Model remains semantic authority for the represented world.
- External providers remain authoritative for their own communication/system records.
- LLM output is never authoritative without domain validation.
- Missing information lowers confidence; it does not block use unless a declared hard constraint/verification gate requires it.
- External integrations are capability-advertised and optional.
- One provider failure cannot make core project state unusable.
- Historical predictions and actuals are never overwritten.
- Every consequential external request/action is policy checked and auditable.

## Required implementation sequence

W036-W044 below operationalize this approved architecture. No item may start until its dependencies and the lock transition are satisfied.
