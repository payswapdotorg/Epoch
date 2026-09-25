# @epoch/marketplace-host — Marketplace host (W023, service layer)

The long-running in-memory reference **HOST** of the Epoch marketplace: it
drives the kernel's typed domain model (`@epoch/marketplace`) through
session-shaped operations and never recreates the kernel's authorities —
it consumes the real W007 `CapabilityRegistry` for capability-reference
resolution, the real kernel seals/verifiers for immutable publication, and
the real pure entitlement check.

## Session surfaces

- **Listing lifecycle sessions** — `createListing` (idempotent draft
  creation keyed by `(idempotencyKey, developer tenant)`), `updateDraft`,
  `submitListing` (draft → submitted), `publishListingVersion` (seals the
  immutable hash-chained version; replay of an identical publication is an
  idempotent duplicate; changed content at the same version is the typed
  `version-conflict`), `retireListing`, plus tenant-scoped reads
  (`getListing`, `listListings`, `getListingVersion`, `verifyListingChain`).
  Private listings are invisible to out-of-audience tenants (existence is
  not disclosed).
- **Entitlement evaluation sessions** — `grantEntitlement` (explicit
  Epoch-owned record, `direct` provenance), `revokeEntitlement` (the typed
  record that flips the check IMMEDIATELY), `checkEntitlementHost` (the
  kernel's pure check over host state — payment state is not an input,
  structurally), and `syncEntitlementFromPayment` (a settled /
  not-required port outcome PROPOSES a grant record with `payment-sync`
  provenance; every other outcome is the typed `entitlement-denied`).
- **Payment port seam** — `registerPaymentPort`, `checkPaymentHost`
  (passthrough; `payment-port-unavailable` when the seam is absent).
- **Usage metering intake** — `recordUsage` (idempotent,
  duplicate-suppressed: the key binds the INPUT identity, checked BEFORE
  any state change; the same input returns the ORIGINAL receipt), and
  `usageAccountHost` (the deterministic fold with exact decimal totals).
- **Developer revenue records** — `recordRevenue` (record-keeping only,
  idempotent; the acting tenant must be the listing's developer),
  `listRevenue` (sorted by `(recordedAt, revenueId)`).
- **Health/liveness** — `health()` / `describeService()`: typed data, pure
  state projections, no clock reads, deterministic key order.

Every entry point is total (`HostResult<T>` = the kernel's
`MarketplaceResult`: a value or a typed `MarketplaceError`); every
operation is tenant-scoped (R12 — cross-tenant access is the typed
`cross-tenant-denied` rejection).

In-memory reference behavior only: NO persistence, NO network, NO real
processes — later Work Orders add those behind this seam.
