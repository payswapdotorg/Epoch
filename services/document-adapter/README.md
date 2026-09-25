# @epoch/document-adapter-host

Epoch Document-to-Adapter HOST (Work Order W028, **service layer**) —
the long-running in-memory reference model.

## Model

- **Ingestion session lifecycle** — typed bytes in, staged evidence out:
  `ingestDocument` admits documents through the kernel discipline
  (closed format vocabulary, content-address verification, tenant
  grammar, tenant ownership) and emits the `uploaded`-stage W006
  evidence record; sessions advance
  `Uploaded -> Parsed -> CandidatesExtracted -> ReviewPending ->
  Provisional` one stage at a time.
- **Deterministic stage driver** — advance-on-evidence: an advance
  commits only after the stage's evidence record validates and stores
  (a REAL `@epoch/evidence` `EvidenceStore`); the typed lifecycle is
  enforced (`policy-violation` on skips/regressions); re-running an
  applied advance is an idempotent no-op returning the ORIGINAL
  evidence digest (duplicate suppression — no second record, no state
  change).
- **Typed idempotency keys** — the same (key, document digest)
  re-ingestion replays the same session; the same key with a different
  digest is the typed `idempotency-conflict`.
- **Registration** — the terminal advance derives one provisional
  definition per candidate and registers each into a REAL
  `@epoch/capability-registry` `CapabilityRegistry` (source category,
  origin `provisional-document-derived`); identical re-registrations are
  suppressed, conflicting ones are typed `registration-conflict`.
- **Tenant isolation (R12)** — every read, advance, and escalation
  request is tenant-scoped; cross-tenant access is the kernel-typed
  `cross-tenant-denied`.
- **Trust floor** — `requestTrustEscalation` is ALWAYS the kernel-typed
  `trust-escalation-denied` (certify / execute / grant-capability): the
  floor, not the gate.
- **Health/liveness as typed data** — a pure state projection (counts +
  stage histogram); no wall clock, no randomness: all timestamps arrive
  as typed host inputs (`StageRunContext`).

In-memory reference behavior only: **no persistence, no network, no real
processes** — later Work Orders add those behind this seam. The typed
derivation model (documents, stages, candidates, definitions,
registrations, error taxonomy) is owned by `@epoch/document-adapter`
(kernel); the host consumes it at runtime and never recreates its
authority.

## Errors

The kernel taxonomy passes through unchanged (`unsupported-format`,
`digest-mismatch`, `malformed-document`, `broken-evidence-chain`,
`cross-tenant-denied`, `policy-violation`, `trust-escalation-denied`,
`unknown-capability-reference`), plus three service-specific codes:
`unknown-session`, `idempotency-conflict`, `registration-conflict`.
Every entry point is total — errors are values, never thrown.
