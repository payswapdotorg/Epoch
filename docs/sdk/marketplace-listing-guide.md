# The Marketplace Listing Guide (W035)

How to PUBLISH and OPERATE a marketplace listing against the Epoch
marketplace kernel (`@epoch/marketplace`, Work Order W023) — the typed
domain model Epoch owns (architecture.md, binding: "Epoch owns
listings, trust metadata, versions, entitlements, usage accounting,
and developer revenue records. Payment processors are adapters."). The
runnable companion is
[`examples/sdk/marketplace-listing-example.ts`](../../examples/sdk/marketplace-listing-example.ts),
exercised by `release/test/examples.test.ts`.

## The listing lifecycle

1. **Build the listing version content** — identity
   (`listing:stress-suite`), semver version, developer tenant, display
   name/description, capability REFERENCES (pointing at the W007
   registry vocabulary — dangling references are typed rejections),
   typed PRICING (the closed vocabulary: free / one-time / subscription
   / seat-workspace / usage-metered / hybrid / enterprise-private,
   canonical decimal strings + ISO 4217 currencies), W006-shaped TRUST
   EVIDENCE pinned to the registered manifest digest, and visibility.
2. **Seal the version** — `sealListingVersion(content)` produces the
   immutable, content-addressed envelope (SHA-256 over the canonical
   JSON).
3. **Publish the next version** by linking `previousVersionDigest` to
   the PRIOR version's content digest — a hash chain. Publishing never
   mutates a published version; changed content ships as a NEW version
   (re-publishing different content at the same version is the typed
   `version-conflict`).
4. **Verify the chain** — `verifyListingVersionChain(versions)`
   verifies every envelope, the shared listing/developer identity,
   strictly ascending versions, and the unbroken hash links.

## Entitlements: Epoch-owned records, never payment state

The PURE `checkEntitlement({ grants, revocations, query })` reads
Epoch-owned grant/revoke records ONLY (architecture lock rule 11):

- a grant record (explicit `direct` provenance, or `payment-sync`
  provenance proposed from a settled port CHECK outcome) makes the
  check pass;
- a revocation record flips it IMMEDIATELY — no grace semantics;
- payment state is never an input, structurally.

## Usage accounting: append-only W010-shaped events

Metered usage is one append-only event stream per entitlement
(`stream:usage-<suffix>`, the W010 shapes): `sealUsageEvent(event)`
admits typed facts — entitlement id, listing id, the EXACT published
version digest, metered units (canonical decimal string), unit name,
metering instant. `foldUsageEvents(events, filter)` is the
deterministic projection: input order is irrelevant, totals are exact
decimal-string arithmetic.

## Developer revenue: record-keeping with full provenance

Revenue records carry complete provenance back to the GENERATING
record (e.g. the usage event digest); there is no payout logic
anywhere in the kernel — payouts are a future adapter concern.

## The PaymentPort seam (provider-neutral by construction)

`checkPayment` expresses CHECKS and record-shaped outcomes ONLY
(not-required / settled / unpaid / declined / refunded /
unknown-charge). No payment processing, no credentials, no network.
Payment state PROPOSES entitlement grants; Epoch records decide.

## Where the evidence lives

- Listing/pricing/entitlement/usage/revenue/payment-port positive and
  negative suites: `packages/marketplace/test/`.
- The host session surfaces (idempotent operations, tenant scoping):
  `services/marketplace` (W023).
- The runnable register → seal → chain-verify → resolve → grant →
  check → revoke → check → meter → fold (twice, different order) →
  revenue path: `release/test/examples.test.ts` — "examples/sdk —
  marketplace listing (W023)".

## Readiness

The marketplace readiness criteria of this release — what they are,
who proves them, and what remains deferred — are documented in
[`docs/marketplace-readiness/`](../marketplace-readiness/README.md).

## Version pins

The current published contract surface is pinned in
[`sdk-versions.md`](./sdk-versions.md) and machine-checked by
`release/test/contract-sync.test.ts`.
