# @epoch/supervision — Epoch Delivery Supervision kernel (W043)

Kernel layer. Owned surfaces of Work Order **W043**:
`packages/supervision/*`, `services/supervision/*`, `packages/alerts/*`,
`contracts/supervision/*`.

Policy-driven supervision of **ProgramOfWork** and **DeliveryRecord**
state (USL1.0/SD1.0, binding): the READ-ONLY observation layer that
produces typed, content-addressed **findings** — the severity and
escalation policy over those findings is `@epoch/alerts`' authority.

## The six check families (pure functions of sealed inputs)

| Family | Class | What it observes |
|---|---|---|
| Planned-vs-actual monitoring | `planned-vs-actual` | Plan lines vs actual state: `due` (in-window), `drifted` (forecast/late-start deviation), `late` (plan finish passed), `blocked` (impediment) + missed W036 milestones. |
| Critical-path & prerequisite checks | `critical-path-drift`, `missing-prerequisite` | A typed CPM traversal (forward/backward passes, zero-float criticality) over the W036 dependency graph — with the transitive downstream impact; started-without-completed-predecessor and threatened in-window starts. |
| Acquisition/lead-time risk | `lead-time-risk` | W037-shaped lead-time observations vs the prerequisite need instant — exact shortfall days when the realistic lead time cannot reach `requiredBy`. |
| Consumption/cost anomalies | `consumption-anomaly` | Typed threshold rules over the W036 `foldDeliveryActuals` shapes matched against the planned folds — breach class + magnitude (planned/actual/threshold values, signed variance). |
| Verification failures | `verification-failure` | W036 `VerificationGate` (overdue unpassed gates) + W038-shaped open defect issue records — findings, never gate mutations. |
| Unresolved high-impact unknowns | `unresolved-unknown` | W036 `DecisionImpact`-material information-acquisition requests still open past their freshness requirements (aging → due, stale → late). |

## Authority split (architecture lock rule 16 + the W038 precedent)

- **ProgramOfWork** (W036) — the authoritative schedule dimension.
  Supervision OBSERVES it; a supervision-side record or input carrying
  schedule-mutation vocabulary is a typed `re-schedule-rejected`
  (pre-validation, `SCHEDULE_MUTATION_FIELDS`).
- **DeliveryRecord** (W036) — the delivery-facts authority. Supervision
  folds its sealed actuals; it never writes delivery state.
- **Procurement** (W037) / **Execution Tracking** (W038) — sibling
  kernels consumed as OPAQUE typed input references
  (`ExecutionIssueSummary`, `LeadTimeRiskInput`) with devDep
  compile-time parity (`src/kernel-parity.ts`) + runtime parity tests —
  never runtime edges.
- **Alerts** (`@epoch/alerts`) — the severity/escalation authority. This
  kernel never names severities; the `supervision:alert-*` event payload
  fields owned by the alerts kernel stay bounded neutral strings.
- **Event log** (W010) — supervision events are W010-shaped append-only
  facts in the open `supervision:` payload namespace, one stream per
  supervised program (`stream:supervision-<suffix>`), digested by the
  canonical SHA-256 discipline.

## Determinism

Zero wall-clock, zero randomness, zero I/O: the evaluation instant is a
caller-supplied input. Findings derive stable ids from
(class, subject); identical inputs produce identical findings,
identical digests, and an identical sealed pass (replay-safe). Exact
decimal arithmetic (bigint-scaled) and integer-exact instant parsing —
no floating point anywhere.

## Runtime dependency policy (frozen, W043 pin)

`@epoch/solution-delivery`, `@epoch/agent-protocol`, `@epoch/tenancy`,
`zod` — NOTHING else. Parity devDependencies:
`@epoch/procurement`, `@epoch/execution-tracking`, `@epoch/event-log`,
`@epoch/evidence`, `@epoch/capability-registry`, `@epoch/verification`.

## Contract surface

- in-package full surface: `packages/supervision/schemas/` (26 entries
  + manifest), drift-pinned byte-for-byte by `test/contract-drift.test.ts`;
- public core-record projection: `contracts/supervision/` (the W012
  convention), composed with the alerts-kernel core records by the
  supervision-runtime service — the only W043 component depending on
  both kernels.

Regenerate committed schemas after an intentional change:

```
EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/supervision test contract-drift
```
