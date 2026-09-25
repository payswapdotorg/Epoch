# @epoch/marketplace — Marketplace kernel (W023)

Epoch Marketplace **domain model** — the typed, versioned, evidence-grade data
Epoch owns (architecture.md, binding: "Epoch owns listings, trust metadata,
versions, entitlements, usage accounting, and developer revenue records.
Payment processors are adapters.").

## What this package owns

- **Listings + immutable published versions** (W011 sealed-envelope style):
  canonically ordered content, SHA-256 content digests (exact-revision
  addressing), hash-chained via `previousVersionDigest`, verification via
  `verifyListingVersionChain`. Publishing a new version never mutates a
  published one; re-publishing the same version with different content is a
  typed `version-conflict`. Version references point at the W007
  capability-registry vocabulary (`admitCapabilityReferences` resolves
  (capabilityId, version) pins — dangling references are typed
  `unknown-capability-reference` rejections).
- **Pricing models as typed data only**: the closed vocabulary
  free / one-time / subscription / seat-workspace / usage-metered / hybrid /
  enterprise-private with per-model typed fields (canonical decimal strings +
  ISO 4217 currencies). NO monetization logic beyond record shape +
  validation.
- **Trust metadata as W006-shaped evidence records**: a structural mirror of
  `@epoch/evidence`'s `EvidenceRecord`, pinned WITHOUT a runtime dependency
  (compile-time type equality + runtime parity tests).
- **Entitlements**: explicit Epoch-owned grant records (direct or
  payment-sync provenance) + revocation records + the PURE
  `checkEntitlement` function. Payment state is NEVER authority
  (architecture lock rule 11): the check reads Epoch records only, and a
  revocation flips it IMMEDIATELY (no grace semantics).
- **Usage accounting**: append-only typed events over the W010 event shapes
  (structural mirror of `EventContent`, pinned by parity), one stream per
  entitlement, the `marketplace:usage` payload family, and the deterministic
  `foldUsageEvents` projection with exact decimal-string totals.
- **Developer revenue records**: record-keeping only — full provenance back
  to the generating record; NO payout logic.
- **PaymentPort seam**: a provider-neutral adapter interface expressing
  CHECKS and record-shaped outcomes ONLY (`checkPayment` →
  not-required / settled / unpaid / declined / refunded / unknown-charge),
  plus an in-memory reference port. No payment processing, no payment
  credentials, no network calls anywhere.

## Runtime dependency policy (W023 Tech Lead pin)

`@epoch/agent-protocol` (ids, digests, canonical JSON, version
discriminators), `@epoch/capability-registry` (the W007
capability/version vocabulary listings reference), and `@epoch/tenancy`
(the W009 tenant grammar) are the ONLY @epoch runtime dependencies.
Compatibility with `@epoch/evidence`, `@epoch/identity`,
`@epoch/authorization`, `@epoch/extension-sdk`, and `@epoch/event-log` is
pinned via devDependencies + compile-time parity (`src/kernel-parity.ts`)
and runtime parity tests (`test/parity.test.ts`) — never runtime deps.

**Deviation (reported in the PR):** the dispatch listed
`@epoch/experience-protocol` among the devDep-parity packages, but the
binding layer model (boundary-check `LAYER_RULES`, architecture lock) forbids
kernel → experience imports entirely, so no experience-protocol pin exists;
the shared digest discipline is pinned against the kernel mirrors instead.

## Versioned contract surface

Version constants + typed index export (`src/index.ts`), runtime zod
validators (the domain modules), compile-time parity (`src/kernel-parity.ts`),
and the committed JSON Schema projection under `schemas/` pinned by
`test/contract-drift.test.ts` (regenerate with
`EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/marketplace test contract-drift`).

## Not this package's concern

Trust scoring, catalog search, persistence, event distribution, payment
execution, payouts, listing workflow sessions, and UI — those live in
`@epoch/marketplace-host` (the service-layer host model), later Work Orders,
or behind adapters. The long-running host model is
`services/marketplace` (W023, service layer).
