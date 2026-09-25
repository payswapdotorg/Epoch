# @epoch/document-adapter

Epoch Document-to-Adapter kernel (Work Order W028, kernel layer).

The typed derivation MODEL that turns tenant-scoped, content-addressed
documents into PROVISIONAL Capability Fabric source mappings — using
upstream contracts instead of recreating authorities.

## Model

- **Documents are typed bytes + descriptors.** `DocumentContent` is one of
  two deterministic structured forms (`structured-text`,
  `structured-json`); `DocumentDescriptor` is content-addressed (SHA-256
  over the canonical bytes via `@epoch/agent-protocol`), format-typed,
  tenant-scoped, and verified against the actual content at admission
  (digest mismatch = tamper rejection). Real-world formats (PDF, office
  documents, vendor clouds) are future adapter work behind this seam —
  zero vendor document services exist here.
- **The pipeline is typed data.**
  `Uploaded -> Parsed -> CandidatesExtracted -> ReviewPending -> Provisional`
  with exactly one legal successor per stage and a TERMINAL provisional
  stage. Illegal advances are typed `policy-violation` rejections.
- **Evidence-first.** EVERY stage emits a W006-shaped
  `EvidenceRecord` (`@epoch/evidence` — genuine runtime consumption) whose
  subject is the exact document revision and whose digest is
  content-addressed. Stages chain into a `StageEvidenceChain`; a candidate
  derived through a missing, tampered, unanchored, mis-staged, or
  out-of-order chain is rejected with `broken-evidence-chain`. No stage
  mutates kernel state — derivation is a pure projection over document
  bytes.
- **Deterministic extraction.** Identical (document bytes, descriptor, run
  context) derive identical candidates and evidence. Candidate ids are
  content-derived (`cand:<sha256>`), definition ids are content-derived
  (`docmap:<sha256>`), and candidate listing is sorted by id (no
  insertion-order leaks). The src contains zero wall-clock reads and zero
  randomness — timestamps arrive as host-supplied typed
  `StageRunContext`s.
- **Provisional by construction.** Every document-derived mapping
  registers against the W007 source-category vocabulary
  (`@epoch/capability-registry` — genuine runtime consumption) with origin
  `provisional-document-derived`, sealed by
  `sealCapabilityManifest`. Trust escalation — `certify`, `execute`,
  `grant-capability` — is the typed rejection `trust-escalation-denied`
  (the floor, not the gate; `spec/extension-architecture.md`, binding).
- **Tenant isolation (R12).** Documents, candidates, evidence, and
  definitions are tenant-scoped; cross-tenant access is the typed
  rejection `cross-tenant-denied`.
- **Typed error taxonomy (total entry points).** `unsupported-format`,
  `digest-mismatch`, `malformed-document`, `broken-evidence-chain`,
  `cross-tenant-denied`, `policy-violation`, `trust-escalation-denied`,
  `unknown-capability-reference` — values, never thrown.

## Contract surface

Versioned in-package contract (W007/W009 convention): version constants +
typed index export (`src/index.ts`), runtime zod validators
(`src/schema.ts`), compile-time parity (`src/parity.ts`), and the
committed JSON Schema projection under `schemas/` pinned byte-for-byte by
`test/contract-drift.test.ts`. Regenerate with:

```
EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/document-adapter test contract-drift
```

## Dependencies

Runtime (Tech Lead pin — the ONLY @epoch runtime dependencies):
`@epoch/agent-protocol` (ids, digests, canonical JSON, version
discriminators), `@epoch/evidence` (W006 stage evidence records),
`@epoch/capability-registry` (W007 source-category vocabulary).

Compatibility with `@epoch/world-model`, `@epoch/constraint-language`,
`@epoch/extension-sdk`, `@epoch/verification`, `@epoch/provenance`,
`@epoch/tenancy` is pinned via devDependencies + compile-time parity
tests (`test/kernel-parity.test.ts`) — kernel-to-kernel devDep precedent
(W002, W006-W009, W011, W013).

The long-running HOST model (ingestion sessions, idempotency, replay,
health) lives in `services/document-adapter`
(`@epoch/document-adapter-host`).
