# @epoch/simulation-runner

Epoch **Simulation Runner** service (Work Order W021, layer: service) —
the thin, typed HOST FACADE over `@epoch/simulation-fabric` (mirroring
`services/agent-runtime` over `@epoch/agent-orchestration`).

## What this service owns

- **Job intake** — `SimulationRunner.submitJob` delegates admission to
  the kernel's REAL W005 pipelines and adds REAL W007 pre-resolution:
  every capability binding must pin a registry record
  (`unknown-capability-binding` when it does not, or when the pinned
  digest disagrees with the record at that id+version); a binding to a
  RETIRED record is the typed `lifecycle-conflict` (deprecation is
  advisory and still binds — the W020 binder semantics).
- **Run supervision** — `planRun` (execution planning with the
  registry-derived admitted set), `executeRun` (pull-style execution
  through the `SimulationExecutionPort` seam), `startRun` +
  `publishResult` (push-style dispatch + result publication),
  `cancelRun`; reads: `getRun`, `runEvents`, `listRuns`.
- **The one-shot driver** — `driveSimulationJob` folds a complete
  submission -> planning -> execution pass over a fabric host in a fixed
  order with typed short-circuits; `admittedCapabilitiesFromRegistry`
  adapts the REAL W007 registry to the fabric's opaque resolution seam
  (retired records excluded).
- **Tenant isolation (R12)** — the runner may pin one tenant
  (`expectedTenantId`); every operation is tenant-gated (the typed
  `tenant-isolation-rejected`).
- **Idempotent replay** — surfaced through the façade: `duplicate-run`
  admissions, `idempotency-conflict` rejections, and the typed
  `replayed-result` disposition (sealed prior result, no re-execution).
- **Health/liveness as typed data** — `health()`: deterministic
  derivation, `degraded` exactly when a hosted run has settled `failed`.
- **Whole-host snapshots** — `snapshot()` /
  `SimulationRunner.fromSnapshot()` (the kernel fabric projection;
  deterministic, tamper-checked restoration).

## Explicitly NOT (later Work Orders / out of scope)

Durable persistence, event distribution, real solver backends (adapters
behind the fabric's port seam), HTTP servers — the service is a typed
library surface with a driver, not an HTTP server (zero wall-clock, zero
randomness: instants are caller-supplied).

## Runtime dependencies (W021)

`@epoch/simulation-fabric` (the kernel), `@epoch/simulation-protocol` +
`@epoch/agent-protocol` (the executed contracts and timestamps),
`@epoch/capability-registry` (the real registry the intake
pre-resolution uses), `@epoch/tenancy` (the tenant grammar), `zod`.
Compatibility with `@epoch/event-log` and `@epoch/authorization` is
exercised via devDependency parity tests — never runtime deps.
