# @epoch/execution-tracking-runtime

Epoch Execution Tracking Runtime service (**Work Order W038**): the thin
typed HOST FACADE over the `@epoch/execution-tracking` kernel.

## What it owns

- **Registration** — the sealed W036 ProgramOfWork (the schedule
  authority input → the opaque linkage index) and the sealed W036
  DeliveryRecord (the delivery-facts authority state), both idempotent
  by digest.
- **The low-friction field-capture intake** — direct or through the
  `FieldCapturePort` adapter seam (ONE in-memory reference adapter; the
  core never names a vendor): linkage inference, the mandatory
  uncertainty state, and idempotent replay (the typed
  `duplicate-observation` admission; the state and the event streams
  are unchanged by a replay).
- **Tracking-state transitions, issue raising/resolution** — append-only
  chains and the five issue families through the kernel gates.
- **Reconciliation** — proposals recorded as typed data; application
  flows EXCLUSIVELY through the W036 DeliveryRecord authority path
  (`recordObservation → acceptObservation → actualizeObservation`); the
  hosted delivery state advances to the returned sealed state.
- **`execution:*` events** — one stream per work package
  (`stream:execution-<suffix>`), W010-shaped, digests sealed by the
  kernel and pinned by REAL `sealEvent` parity tests.
- **The derived execution-state projection, health, snapshot.**

The W009 authorization gate denies unauthorized operations BEFORE any
kernel admission; tenant isolation is typed `tenant-isolation-rejected`
(R12). In-memory reference behavior: NO persistence, NO network, NO
real field systems; zero wall-clock reads and zero randomness — every
instant is caller-supplied.

## Runtime dependencies (frozen, W038 pin)

`@epoch/execution-tracking`, `@epoch/authorization`,
`@epoch/tenancy`, `zod` — nothing else. The parity devDependencies
(`@epoch/event-log`, `@epoch/evidence`, `@epoch/verification`,
`@epoch/capability-registry`, `@epoch/solution-delivery`) power the
test-time gates only, never the runtime.
