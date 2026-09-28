# @epoch/supervision-runtime — Epoch Delivery Supervision Runtime (W043)

Service layer. Owned surfaces of Work Order **W043**:
`packages/supervision/*`, `services/supervision/*`, `packages/alerts/*`,
`contracts/supervision/*`.

The thin typed HOST FACADE over the `@epoch/supervision` +
`@epoch/alerts` kernels.

## Surface

- **Registration** — programs/deliveries (the REAL W036 sealed records,
  verified at admission; idempotent by digest; replay-conflict on
  same-id-different-content) and escalation policies (policy as data;
  the ACTIVE policy is the latest activation).
- **Evaluation passes** — at CALLER-DRIVEN instants (no timers, no
  wall-clock): the six supervision check families produce findings,
  alerts raise idempotently with append-only revisions across
  due → late → blocked transitions, notifications dispatch through the
  NotificationPort seam.
- **Alert lifecycle** — escalation through typed W003 proposals +
  verifiable gateway decisions (policy decision FIRST: all three
  outcomes), terminal resolution, policy-driven re-notify cadence
  sweeps.
- **Projections + reads** — the derived supervision-state projection
  (findings + alert chains + receipts) and sealed stream reads.
- **Events** — `supervision:*` on one stream per supervised program
  (`stream:supervision-<suffix>`), W010-shaped, digests sealed by the
  kernel; tenant host-level steps use `stream:supervision-host-<suffix>`.

## Guards

- The **W009 authorization gate** denies unauthorized operations BEFORE
  any kernel admission.
- **Tenant isolation** (R12): typed `tenant-isolation-rejected`
  (including the single-tenant `expectedTenantId` guard).
- Supervision **OBSERVES, never re-schedules**: `rescheduleProgram()`
  is the typed `re-schedule-rejected` trap.
- **Gateway bypass**: an escalation without a verifiable decision is
  rejected before any kernel admission.

## Determinism

Zero wall-clock reads and zero randomness — every instant is
caller-supplied; every listing/snapshot is sorted. Two runtimes fed the
same operations hold byte-identical state (pinned by test).

## Runtime dependency policy (frozen, W043 pin)

`@epoch/authorization`, `@epoch/supervision`, `@epoch/alerts`,
`@epoch/tenancy`, `zod` — NOTHING else.

## Contract emission

`renderSupervisionPublicContractFiles()` composes BOTH kernels'
core-record surfaces into `contracts/supervision/` (the W012
convention), drift-pinned byte-for-byte by the service's
contract-drift test:

```
EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/supervision-runtime test contract-drift
```
