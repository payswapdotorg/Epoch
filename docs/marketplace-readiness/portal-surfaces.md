# Marketplace Portal Surfaces (W035)

The marketplace surfaces a user or developer can actually touch today,
and their exact boundaries. Everything here is typed, deterministic and
provider-neutral; everything not here is a named, deferred Work Order.

## The kernel (the authority)

`@epoch/marketplace` (`packages/marketplace/`) — the typed DOMAIN MODEL:
listings with immutable hash-chained versions, the pricing vocabulary,
W006-shaped trust metadata, entitlement grant/revoke records + the pure
check, append-only usage accounting over the W010 event shapes,
developer revenue records, and the provider-neutral `PaymentPort` seam.
See the package README and
[`docs/sdk/marketplace-listing-guide.md`](../sdk/marketplace-listing-guide.md).

## The host (the session surface)

`@epoch/marketplace-host` (`services/marketplace/`) — the long-running
in-memory reference HOST that drives the kernel through session-shaped
operations:

| Session | Operations |
| --- | --- |
| Listing lifecycle | `createListing` (idempotent by `(idempotencyKey, developer tenant)`), `updateDraft`, `submitListing`, `publishListingVersion` (seals the immutable chain; identical replay is an idempotent duplicate; changed content at the same version is the typed `version-conflict`), `retireListing`, tenant-scoped reads, chain verification |
| Entitlement evaluation | `grantEntitlement`, `revokeEntitlement`, `checkEntitlementHost` (the pure kernel check over host state), `syncEntitlementFromPayment` (a settled/not-required port outcome PROPOSES a grant with `payment-sync` provenance) |
| Payment port seam | `registerPaymentPort`, `checkPaymentHost` (passthrough; `payment-port-unavailable` when absent) |
| Usage metering | `recordUsage` (idempotent, duplicate-suppressed BEFORE any state change), `usageAccountHost` (the deterministic fold) |
| Developer revenue | `recordRevenue` (idempotent; the acting tenant must be the listing's developer), `listRevenue` |
| Health | `health()` / `describeService()` — typed data, no clock reads |

Every entry point is total (`HostResult<T>`) and every operation is
tenant-scoped (cross-tenant access is the typed `cross-tenant-denied`
rejection). In-memory reference behavior only: no persistence, no
network, no real processes.

**Evidence:** `services/marketplace/test/` (the host suites).

## The web portal (the view surface)

`apps/web/src/features/marketplace/` (W023) — a TYPED feature module
inside the Next.js app shell: view-model contracts + pure deterministic
projections + presentational components for the marketplace. It
consumes ONLY the `@epoch/marketplace` public surface — STRUCTURALLY:
the record-facing input types in `contracts.ts` are structural mirrors
of the exact kernel subset the feature consumes (the frozen-manifest
constraint of the W023 dispatch — the module could not declare the
kernel as a dependency without touching W014's app manifest). The
projections (`project.ts`) render exactly what the records carry:
pricing models, digests, provenance, counts, instants.

**Evidence:** the feature module's own tests; the structural-mirror
table in `apps/web/src/features/marketplace/README.md`.

## What the portal does NOT include (the deferred surface map)

| Deferred surface | Owning Work Order | Status |
| --- | --- | --- |
| Billing + entitlements service | W024 | open |
| Developer portal / publishing UX | W025 | open |
| Security / isolation / observability | W030 | open |
| Trust scoring, catalog search | later Work Orders | not started |
| Persistence (PostgreSQL), event distribution (NATS) | architecture-level adapters | future |
| Payment processor integrations | adapters behind `PaymentPort` | future |

## Readiness statement

For the surfaces that EXIST — kernel, host, web feature module — this
release's readiness is the four typed criteria of
[`readiness-criteria.md`](./readiness-criteria.md), each machine-proven
inside the release battery by the marketplace example composition
(`release/test/examples.test.ts`). The deferred surface map above is
the honest boundary of that statement.
