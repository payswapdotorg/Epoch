# @epoch/simulation-protocol

Epoch **Simulation Protocol v1** — runtime implementation (kernel layer,
Work Order W005). Provider-neutral simulator registration, invocation
request/result messages, cross-document conformance checks, and a
reference-grade deterministic simulator.

Simulation **predicts**; evaluation **judges** (architecture lock rule 6)
— evaluation lives in `@epoch/evaluation-protocol`, a distinct package
with a distinct contract surface; the two are never fused. Simulators
remain **external capabilities** (lock rule 5): this package is the
protocol — not a simulation engine, not an execution fabric (W021), and
no concrete solver adapters (W029).

The published contract surface for this package lives IN-PACKAGE at
`contracts/` (TypeScript declarations, JSON Schema projection, manifest
with digests) because W005 owns no repository-root `contracts/*`
directory. `contracts/parity.ts` proves type identity at compile time.

## Layer and dependencies

- Epoch layer: `kernel` (declared in `package.json` under `epoch.layer`).
- Runtime dependencies: `zod` and `@epoch/agent-protocol` (kernel →
  kernel edge; canonical JSON serialization, SHA-256 digests, message
  admission pipeline, parameter specs, and cost/latency profiles are
  reused from the base protocol package, per the frozen dependency
  baseline in `scripts/DEPENDENCY-BASELINE.md`).
- No Node APIs in runtime code; `node:` imports appear only in tests.

## Public API overview

- `parseSimulatorRegistration(input)` /
  `validateSimulatorRegistration(input)` — admit a
  `simulation.registration` message (version gate → kind gate → zod
  validation → canonical serialization → digest). A simulator that cannot
  declare its validity domain and assumptions is not registrable: both
  are required and non-empty, alongside inputs, outputs, fidelity,
  reproducibility, cost, and latency.
- `parseSimulationInvocationRequest(input)` /
  `validateSimulationInvocationRequest(input)` — admit a
  `simulation.invocation-request` binding the simulator id to the exact
  registration digest.
- `parseSimulationResult(input)` / `validateSimulationResult(input)` —
  admit a `simulation.result` (completed/failed outcome union, exact
  request + simulator bindings, determinism claim; NO wall-clock fields —
  deterministic result digests must be pure functions of request
  digests).
- Cross-document conformance: `checkInvocationConformance`,
  `checkResultConformance`, `registrationDigest`,
  `invocationRequestDigest`, `valueConformsToSpec` — typed violations
  for binding, input/output-contract, and seed-discipline checks.
- Reference simulator (REFERENCE-GRADE, NOT AN ENGINE):
  `REFERENCE_SIMULATOR_REGISTRATION`, `runReferenceSimulation(input)` —
  a deterministic affine scalar simulator that proves the protocol
  end-to-end.
- Contract emission: `renderSimulationContractFiles()` — deterministic
  JSON Schema projection + manifest for the in-package `contracts/`
  surface (drift-tested byte-for-byte).

## Evidence chain

registration digest → invocation request (binds registration digest) →
request digest → result (binds request digest + simulator reference) →
result digest. Every admitted message is exact-revision addressable
evidence.
