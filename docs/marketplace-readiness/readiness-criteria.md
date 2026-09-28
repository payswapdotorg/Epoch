# Marketplace Readiness Criteria (W035)

The four typed criteria of marketplace readiness — exactly the four
`marketplace`-domain check kinds of the release model's closed
vocabulary (`release/src/version.ts`). Each criterion names the
evidence shape (the closed union in `release/src/evidence.ts`), the
kernel authority that produces it, and the named tests that prove it.

## 1. `listing-chain-verified`

**The claim.** A published listing's version chain is immutable and
hash-linked: every envelope verifies individually (schema + digest),
versions are strictly ascending with no duplicates, the first links to
null and every later version links to the PRIOR version's content
digest. Publishing never mutates; changed content ships as a NEW
version.

**The evidence.** `ListingChainVerifiedEvidence` — listing id, the
number of published versions, the head (latest) sealed version's
digest, `chainVerified: true` (a literal — false is inconstructible).

**The authority.** `@epoch/marketplace`'s
`verifyListingVersionChain` (the kernel's public verifier —
`packages/marketplace/src/listing.ts`).

**The named tests.**

- Kernel: `packages/marketplace/test/listing.positive.test.ts`
  (chain verification, immutability, hash links) and
  `listing.negative.test.ts` (broken links, mixed identities,
  duplicate versions — the typed `version-conflict`).
- Release battery: `release/test/examples.test.ts` — "examples/sdk —
  marketplace listing (W023)" seals two chained versions and verifies
  the chain through the real verifier; the outcome feeds the typed
  evidence.

## 2. `entitlement-flip-verified`

**The claim.** Entitlement is Epoch-owned record state: a matching
grant makes the pure check pass; a revocation record flips it
IMMEDIATELY (no grace semantics); payment state is not an input,
structurally (lock rule 11).

**The evidence.** `EntitlementFlipVerifiedEvidence` — listing id,
entitlement id, the observed grant and revocation counts (each at
least one — the flip witness), `grantedThenDenied: true` (literal).

**The authority.** `@epoch/marketplace`'s `checkEntitlement`
(`packages/marketplace/src/entitlement.ts`) — the PURE check over
grant/revoke records.

**The named tests.**

- Kernel: `packages/marketplace/test/entitlement.positive.test.ts`
  (grant → entitled; scope coverage) and
  `entitlement.negative.test.ts` (no matching grant —
  `entitlement-denied`; every matching grant revoked —
  `entitlement-revoked`; payment outcomes cannot flip either).
- Host layer: `services/marketplace/test/` — the session surfaces
  (grant/revoke/check/sync-from-payment).
- Release battery: `release/test/examples.test.ts` — the same
  composition drives grant → check-positive → revoke →
  check-negative through the real kernel.

## 3. `usage-fold-verified`

**The claim.** Metered usage is append-only typed events over the W010
event shapes (one stream per entitlement), and the account fold is
DETERMINISTIC: the same events in any input order fold to the same
account with exact decimal-string totals.

**The evidence.** `UsageFoldVerifiedEvidence` — entitlement id, the
sealed event count, the exact decimal total, `foldsAgree: true`
(literal — asserted by folding twice in DIFFERENT input orders).

**The authority.** `@epoch/marketplace`'s `sealUsageEvent` +
`foldUsageEvents` (`packages/marketplace/src/usage.ts`).

**The named tests.**

- Kernel: `packages/marketplace/test/usage.positive.test.ts`
  (sealing, ordering irrelevance, exact totals) and
  `usage.negative.test.ts` (cross-tenant folds, mixed streams,
  mixed entitlements); the W010 shape parity in
  `packages/marketplace/test/parity.test.ts`.
- Release battery: `release/test/examples.test.ts` — the composition
  meters two events and folds twice (forward and reversed),
  asserting `foldsAgree`.

## 4. `revenue-provenance-complete`

**The claim.** Every developer revenue record carries COMPLETE
provenance back to its generating record (e.g. the usage event it
meters from) — record-keeping only, no payout logic.

**The evidence.** `RevenueProvenanceEvidence` — listing id, the
record count, `complete: true` (literal), the digest of the latest
record.

**The authority.** `@epoch/marketplace`'s `validateRevenueRecord`
(`packages/marketplace/src/revenue.ts`).

**The named tests.**

- Kernel: `packages/marketplace/test/revenue.positive.test.ts` and
  `revenue.negative.test.ts` (provenance shape, decimal amounts,
  tamper paths).
- Release battery: `release/test/examples.test.ts` — the composition
  records revenue whose provenance points at the REAL sealed usage
  event digest and asserts completeness.

## What readiness deliberately does NOT claim

- **No billing.** W024 (billing + entitlements service) is open;
  payment execution, invoicing and payouts do not exist and are not
  implied by any criterion here.
- **No developer portal.** W025 (developer portal/publishing) is open;
  listing workflow sessions exist at the host layer, the portal UX
  does not.
- **No trust scoring or catalog search.** Trust metadata is W006-shaped
  evidence DATA; scoring/ranking is a future surface.
- **No persistence or event distribution.** The kernel and host are
  in-memory reference models; PostgreSQL/NATS are future adapter
  concerns per the architecture.
- **No payment processor integration.** The `PaymentPort` seam carries
  CHECKS and record-shaped outcomes only; any real processor is an
  adapter behind it (provider-neutral by construction).

These deferrals are honest scope statements, not gaps in the criteria
above: the four criteria are complete for what the kernel OWNS today.
