# @epoch/evidence

Epoch Evidence kernel — Work Order W006 (Verification/Evidence/Provenance).
Layer: `kernel`.

Evidence is **exact-revision addressable** (architecture.md): every evidence
record refers to the exact artifact revision it is about via a proof-grade
SHA-256 content digest, and a record's own identity is the SHA-256 of its
canonical JSON serialization (content addressing over the runtime-neutral
canonical machinery from `@epoch/agent-protocol` — deliberately NOT the
non-cryptographic FNV-1a change detectors the constraint language pins for
compiled-constraint tamper detection; evidence digests are identity).

## Core concepts

- **EvidenceRecord** — `schemaVersion: 1`, `kind` (the W002 world-model
  `EvidenceKind` vocabulary: document / measurement / observation /
  computation / assertion / external / other), `subject`
  (`ExactRevisionRef`: opaque artifact id + revision label + SHA-256 content
  digest), `producedBy` (opaque run/actor/method ids), `observedAt`
  (canonical UTC instant), `content` (media-typed JSON payload + optional
  opaque out-of-band `locator`), and `confidence` (uncertainty travels with
  evidence).
- **Confidence** — structurally identical to the W002 world-model
  `Confidence` model (point / interval / weighted-set distribution +
  acquisition method + rationale). Compile-time identity is pinned by
  `test/w002-parity.types.ts`; runtime fixture exchange by
  `test/w002-parity.test.ts`. Evidence semantics and formats are owned here
  (W006); the world model holds only opaque `EvidenceRef`s.
- **Digest discipline** — `computeEvidenceDigest(record)` is the record's
  address; `verifyEvidenceRecord(record, digest?)` detects tampering
  (content no longer matches its address); `verifyArtifactRevision(record,
  artifact)` verifies the exact-revision discipline against artifact content
  (canonical digest of the artifact must equal `subject.digest`).
- **EvidenceStore** — in-memory, content-addressed reference registry (no
  persistence by design): index by digest, by artifact id, and by exact
  revision (label and/or digest). Within one store an `(artifactId,
  revision)` pair pins exactly one content digest — a second record claiming
  different content for the same revision label is rejected
  (`subject-conflict`). Adding identical content twice is idempotent.
- **Versioned contract surface** — `EVIDENCE_CONTRACT_VERSION` 1.0.0;
  serialized records carry the `schemaVersion: 1` discriminator and the
  parser reports a distinct `version-mismatch` issue on skew. The published
  JSON Schema projection lives in `schemas/` (byte-pinned by
  `test/contract-drift.test.ts`; regenerate via
  `EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/evidence test contract-drift`).

## Public API

| Export | Purpose |
| --- | --- |
| `parseEvidenceRecord(input)` | total parse: distinct `version-mismatch` / typed `schema` issues |
| `computeEvidenceDigest(record)` | canonical SHA-256 content address |
| `verifyEvidenceRecord(record, digest?)` | tamper / address-mismatch check |
| `verifyArtifactRevision(record, artifact)` | exact-revision referent check |
| `EvidenceStore.create()` | content-addressed registry: `add`, `byDigest`, `byArtifact(artifactId, {revision, revisionDigest})` |
| `EvidenceRecordSchema` / `ConfidenceSchema` / … | runtime zod validators (strict shapes) |
| `renderEvidenceContractFiles()` | deterministic emission of `schemas/` |
| `EVIDENCE_KINDS` / `CONFIDENCE_METHODS` / … | closed, W002-aligned vocabularies |

All entry points are total: never throw, typed issues on invalid input
(`computeEvidenceDigest` throws `EvidenceError` only on programming errors).

## Neutrality

Artifact, revision, run, actor, and method identifiers are opaque strings
owned by their producing domains; the out-of-band locator is an opaque
free string with no URI/provider structure. Provider- and storage-specific
resolution belongs behind adapters (lock rule 13). Pinned by
`test/neutrality.test.ts`.

## Tests

- `evidence.positive.test.ts` — valid records, deterministic key-order-
  insensitive digests, exact-revision lookup, tamper detection.
- `evidence.negative.test.ts` — strict-shape rejection, malformed digests
  and timestamps, confidence bound violations, version skew, digest
  mismatch, subject conflicts.
- `w002-parity.test.ts` / `w002-parity.types.ts` — W002 confidence-model
  alignment (runtime + compile-time).
- `contract-drift.test.ts` — committed JSON Schema artifacts byte-identical
  to emission.
- `neutrality.test.ts` — no provider vocabulary in the contract surface.

## Limitations (v1)

- No persistence and no byte-level artifact storage: payloads are
  JSON-representable; large binaries live out-of-band behind the opaque
  `locator` (adapters own resolution).
- `verifyArtifactRevision` verifies against JSON-representable artifact
  content in canonical form; binary-artifact digest conventions are a
  future adapter/contract decision.
- No confidence aggregation across records (composition policy belongs to
  evaluation, W005).
