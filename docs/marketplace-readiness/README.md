# Marketplace Readiness (W035)

Owned by Work Order **W035** (`docs/marketplace-readiness/*`). This
folder answers one question precisely: **what does "marketplace ready"
mean for this release, who proves it, and what is deliberately
deferred?**

The answer is typed data, not prose: the four marketplace readiness
checks are checklist items of the release model
(`release/src/version.ts` — the `marketplace` domain of
`DOMAIN_CHECK_TABLE`), they complete only with typed evidence produced
by driving the REAL W023 kernel, and they block the release manifest
until every one is green.

## Document index

| Document | What it covers |
| --- | --- |
| [`readiness-criteria.md`](./readiness-criteria.md) | The four typed criteria, the evidence each requires, and the named tests that prove them |
| [`portal-surfaces.md`](./portal-surfaces.md) | The host service + web portal surfaces that exist today, and what remains deferred |

## The one-page orientation

1. **The kernel is the authority.** `@epoch/marketplace` (W023) owns
   listings, trust metadata, versions, entitlements, usage accounting
   and developer revenue records as typed, versioned, evidence-grade
   data. Payment processors are adapters behind the `PaymentPort`
   seam; entitlement is NEVER payment state (architecture lock rule
   11).
2. **Readiness = four machine-checked criteria.** Listing chain
   verification, the entitlement flip, usage fold determinism, revenue
   provenance completeness — each proven by the kernel's own suites
   AND re-proven inside the release battery by the marketplace example
   composition.
3. **The portal surfaces exist as typed modules.** The marketplace
   host (service sessions) and the web feature module (view-model
   contracts + pure projections + presentational components) are
   merged; the billing, developer-portal and security/observability
   Work Orders (W024/W025/W030) remain open and are explicitly out of
   scope for this readiness statement.
