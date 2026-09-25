# @epoch/experience-runtime

Epoch Experience Runtime **host model** (Work Order W013, experience layer).

The deterministic, typed-data HOST surface of the Experience Runtime
(architecture.md — binding): tenant-scoped **device sessions** over the
W011 device-descriptor vocabulary (typed capabilities/limits; the abstract
slot W019 fills — adaptation is not this package's surface), a
**deterministic virtual-time frame/tick scheduling model** (integer
virtual time only — the runtime is testable without real clocks),
**typed runtime events** (frame, state, lifecycle), session **lifecycle
transitions**, and a typed **session-error taxonomy**.

## Non-negotiables

- **Pure typed data.** Zero concrete renderers, zero engine vocabulary,
  zero UI-framework dependencies; strict zod objects reject unknown
  (vendor/engine) fields with precise typed paths (architecture lock
  rule 13).
- **Deterministic virtual time.** Zero wall-clock, zero randomness in
  `src/` — time advances only through explicit caller-supplied deltas, so
  two sessions fed identical schedules produce identical event traces
  (byte-identical canonical serialization, equal SHA-256 digests).
- **Content-addressed records.** Device-session records and event traces
  are digest-sealed (canonical JSON → SHA-256, machinery reused from
  `@epoch/agent-protocol`); admission rejects a claimed digest that does
  not match the recomputed one (tamper detection).
- **Tenant isolation (R12).** Sessions and traces are tenant-scoped;
  cross-tenant operations and admissions are typed
  `cross-tenant-denied` rejections.
- **Projection, never authority (lock rules 8/16).** Mounted render states
  are opaque content digests; the host never interprets kernel state.

## Runtime dependencies (the W013 pin)

- `@epoch/agent-protocol` — canonical digest machinery and shared
  primitives (reused, never re-implemented).
- `@epoch/experience-protocol` — the consumed W011 device-descriptor
  vocabulary (genuine runtime consumption).

No other `@epoch` runtime dependencies. The sibling hosting surface
(`@epoch/renderer-runtime`) pins its device-session snapshot to this
package via devDependency parity tests, never a runtime dep.

## Surface

Versioned in-package contract surface (the W007/W008/W009 convention):
the typed index export (`src/index.ts`), runtime zod validators, and the
committed JSON Schema projection under `schemas/` pinned by the contract
drift test. Regenerate after an intentional schema change with:

```
EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/experience-runtime test contract-drift
```

## Battery

```
pnpm --filter @epoch/experience-runtime typecheck
pnpm --filter @epoch/experience-runtime lint
pnpm --filter @epoch/experience-runtime test
```
