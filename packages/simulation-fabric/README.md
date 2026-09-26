# @epoch/simulation-fabric

Epoch **Simulation Execution Fabric** kernel (Work Order W021, layer:
kernel) — the typed, versioned, provider-neutral **execution fabric** for
W005 simulations.

> architecture.md (binding): "Simulation predicts; evaluation judges."
> architecture lock rule 5: "Simulators remain external capabilities."
> This package is the EXECUTION fabric the W005 protocol explicitly
> reserved for W021 — never a solver, never an engine, never a second
> simulation-semantics authority.

## What this kernel owns

- **Job submission** — `SimulationFabric.submitJob` admits the W005
  simulator registration + invocation request through the REAL
  `@epoch/simulation-protocol` pipelines (version gate, kind gate, strict
  schema, canonical digest), enforces the W005 cross-document conformance
  checks, and seals a **deterministic, content-addressed run identity**
  (SHA-256 over the canonical invocation payload + tenant + simulator pin
  + canonically-ordered capability bindings — the W006-evidence
  exact-revision convention).
- **Submission idempotency** — typed keys (caller-supplied or
  kernel-derived): a replayed submission returns the SAME run identity
  through the typed `duplicate-run` admission (never a silent dedup);
  DIFFERENT content under a consumed key is the typed
  `idempotency-conflict`.
- **Capability binding** — a run binds W007 capability registrations by
  OPAQUE TYPED REFERENCE (`CapabilityBindingRef`: capability id + semver
  version + manifest digest) — never structural copies of registry
  records (strict-object `vendor-fields-rejected` on any attempt).
  `planExecution` resolves bindings against a caller-supplied admitted
  set (the service layer adapts the real registry).
- **The run state machine** — sealed, append-only state records (W023
  version-chain style: `previousRunDigest` chaining, content-addressed
  states, no in-place mutation):
  `submitted -> scheduled -> running -> completed | failed | cancelled`;
  every transition a typed record with provenance (actor principal) +
  timestamp. `verifyRunStateChain` walks the chain and rejects tampered
  digests / broken links (`digest-mismatch`).
- **Tenant isolation (R12)** — tenant-scoped runs; a host may pin one
  tenant; cross-tenant run access AND foreign-tenant operations are the
  typed `tenant-isolation-rejected`.
- **The execution-port seam** — `SimulationExecutionPort`: ALL concrete
  compute (solver engines, grids, clouds) lives behind this port; the
  core never names a vendor. ONE in-memory reference adapter ships inside
  the package (`ReferenceSimulationExecutionPort`, executing through the
  W005 reference simulator; `executionCount` is the replay-evidence hook).
- **Result ingestion** — `ingestResult` / the execute path admit result
  documents through the REAL W005 pipeline + cross-document conformance
  and seal them (exact-revision addressable evidence). A result that
  fails admission settles the run `failed` (cause `result-rejected`) and
  returns the typed rejection.
- **Idempotent replay** — re-executing a completed invocation returns the
  sealed prior result (the typed `replayed-result` disposition, no port
  call).
- **The `simulation:*` event vocabulary** — W010 event shapes (structural
  mirror, the W036 `delivery:*` precedent): one run = one stream
  (`stream:simulation-<suffix>`), 1-based contiguous sequences, causal
  chaining, append-only FACTS. Digests mirror `computeEventDigest` and
  are admitted by the REAL `sealEvent` (runtime parity tests).
- **Whole-host snapshots** — `snapshot()` /
  `SimulationFabric.fromSnapshot()` (deterministic, tamper-checked
  restoration through the FULL admission pipeline).

## Explicitly NOT (later Work Orders / out of scope)

Durable persistence, event distribution, work scheduling beyond the
typed lifecycle, marketplace entitlement, real solver backends
(adapters), evaluation (W005 keeps prediction and judgment distinct).

## Runtime dependency policy (W021, frozen)

Runtime deps: `@epoch/simulation-protocol`, `@epoch/agent-protocol`,
`@epoch/tenancy`, `zod` — NOTHING else. Compatibility with
`@epoch/capability-registry`, `@epoch/event-log`, `@epoch/verification`,
`@epoch/evidence` and `@epoch/authorization` is exercised via
devDependencies: `src/kernel-parity.ts` (compile-time type pins) + the
runtime parity tests — never runtime deps.

## Contract surface

Versioned surface: version constants + typed index export
(`src/index.ts`), runtime zod validators (`src/schema.ts`,
`src/events.ts`), compile-time parity (`src/parity.ts`,
`src/kernel-parity.ts`), and the committed in-package JSON Schema
projection under `schemas/` (the W007/W009/W010/W020 convention) pinned
by `test/contract-drift.test.ts`. Regenerate after an intentional schema
change with:

    EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/simulation-fabric test contract-drift
