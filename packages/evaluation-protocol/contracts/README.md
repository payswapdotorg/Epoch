# packages/evaluation-protocol/contracts — Epoch Evaluation Protocol contract surface

Owned by Work Order **W005** (`packages/simulation-protocol/*`,
`packages/evaluation-protocol/*`). Kernel layer.

This directory publishes the typed, versioned, provider-neutral contract
surface of the Epoch **Evaluation Protocol v1** at its ownership
boundary. W005 owns no repository-root `contracts/*` directory, so — by
Tech Lead design pin — the versioned contract surface is published
IN-PACKAGE. The runtime implementation is `@epoch/evaluation-protocol`
(kernel layer); consumers in later Work Orders (W007 adapter SDK, W021
execution fabric, W022 action gateway, W029 adapters) program against
the shapes published here.

## Contents

| Path | What it is |
|---|---|
| `index.d.ts` | Versioned TypeScript declaration surface (self-contained, no imports, no runtime code). |
| `parity.ts` | Compile-time conformance assertions: every published type must be *identical* to the implementation's zod-inferred type. Compiled by `packages/evaluation-protocol`'s `typecheck` script; any drift fails `pnpm typecheck`. |
| `manifest.json` | Exact-revision evidence anchor: contract version, protocol version, data-type inventory, message kinds, and a SHA-256 digest for every emitted schema file. |
| `schemas/*.schema.json` | Deterministic JSON Schema (draft 2020-12) projection of every surface type, emitted by `renderEvaluationContractFiles()` in `@epoch/evaluation-protocol`. |

## Versioning

- `protocolVersion` (`"1.0.0"`) is carried by every message and validated
  exactly — a differing version is a typed `version-mismatch` admission
  error, never a silent parse. Tolerance for compatible minor/patch
  versions is deliberately *not* implemented in v1 (recorded as a
  limitation in the W005 PR).
- `contractVersion` (`"1.0.0"`) versions this published surface. The two
  are currently in lockstep; they may diverge when a contract release
  re-exports unchanged protocol types.
- Breaking changes to any published type require a protocol major version
  bump; additions may ride a contract minor bump. The manifest inventory
  makes the published set machine-checkable.

## Determinism and evidence addressing

Admitted messages serialize to a canonical JSON form (sorted keys, no
whitespace; owned by `@epoch/agent-protocol` at `contracts/agent`)
whose SHA-256 digest addresses the exact revision of the message. The
evidence chain is:

- an **evaluator registration** is addressed by its canonical digest;
- an **evaluation request** binds the evaluator id to that registration
  digest, references the judged subject neutrally (kind, id, canonical
  digest), and is itself addressed by its canonical digest;
- a **verdict** binds the request id + request digest, echoes the
  subject, and is itself addressed by its canonical digest.

Verdicts deliberately carry NO wall-clock or measurement fields: a
deterministic evaluator's verdict digest must be a pure function of the
request digest (the subject is bound inside the request), so anything
time-varying is structurally inexpressible in the verdict message.

## JSON Schema fidelity

The schema files are a **structural-only** projection
(`jsonSchemaFidelity` in `manifest.json`). Zod refinements — cross-field
invariants such as "at least one criterion", "unique criteria names /
subject kinds / verdict forms", "score within a non-degenerate scale",
and the calendar validity of timestamps — are enforced by the runtime
validators in `@epoch/evaluation-protocol` and are intentionally absent
from the JSON Schema files. Consumers MUST validate messages with the
runtime package; the JSON Schema files describe the wire shapes for
tooling and documentation.

## Authority and neutrality (architecture lock rules 6/13)

- **Evaluation is distinct from simulation** (lock rule 6): this surface
  judges; it never predicts. It has no runtime dependency on
  `@epoch/simulation-protocol` — subjects are referenced neutrally by
  kind, id, and canonical digest, so judgment stays structurally
  separate from prediction. (The simulation package appears only as a
  devDependency of the end-to-end composition test.)
- **Verdicts are referenced, not vibes**: every verdict carries at least
  one `JustificationReference` naming the criterion, subject output,
  subject failure, assumption, or method it rests on; criterion
  references must resolve against the request's criteria
  (conformance-checked).
- **Not registrable without a declared basis**: a registration must
  declare subject kinds, criteria, verdict forms, and a judgment basis
  with at least one stated assumption (architecture.md,
  "Simulation / Evaluation").

## Reconciliation notes (architecture questions)

- `world-outcome` subject reference formats are owned by the canonical
  World Model (W002); `simulation-result` documents are owned by
  `@epoch/simulation-protocol` (same Work Order, separate surface).
- The registration's `registrationDigest` binding assumes registrars
  retain admitted registrations by digest; the capability registry that
  makes this lookup durable is W007.
- Tenancy/identity scoping of `evaluatorId` is owned by W009.
- Scoring-scale standardization (e.g. normalized [0, 1] scores) is a
  future protocol decision; v1 requires only a declared finite scale.
