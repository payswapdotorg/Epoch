# apps/web/src/features/marketplace — Marketplace feature module (W023)

A TYPED feature library inside the existing Next.js app: view-model
contracts + pure deterministic projections + presentational components for
the marketplace. It consumes ONLY the `@epoch/marketplace` public surface —
structurally.

## Why this module stands alone (the frozen-manifest constraint)

W023's owned surface is `apps/web/src/features/marketplace/*` ONLY.
`apps/web/package.json` (and every other app file) belongs to W014's
surface and is frozen to this Work Order, so the module CANNOT declare
`@epoch/marketplace` as a dependency and cannot import it. The
record-facing input types in `contracts.ts` are therefore STRUCTURAL
MIRRORS of the exact kernel public-surface subset the feature consumes:

| Feature input (`contracts.ts`)       | Kernel type (`@epoch/marketplace`)          |
| ------------------------------------ | ------------------------------------------- |
| `PricingModelInput`                  | `PricingModel`                              |
| `ListingSnapshotInput`              | host `ListingSnapshot` (service projection) |
| `SealedListingVersionInput`          | `SealedListingVersion`                      |
| `EntitlementEvaluationInput`         | `EntitlementCheckPositive`                  |
| `UsageAccountInput`                  | `UsageAccount`                              |
| `RevenueRecordInput`                 | `RevenueRecord`                             |
| `MarketplaceErrorInput`              | `MarketplaceError`                          |

TypeScript structural typing makes the kernel records assignable to these
interfaces as-is. The projection functions (`project.ts`) never fabricate
kernel semantics: they render exactly what the records carry (pricing
models, digests, provenance, counts, instants).

## Wiring contract for W014

When the app shell (W014) wires features, it should:

1. add `@epoch/marketplace` (and, if it drives the host, the service API)
   to the app manifest and route data to this module through the app's
   data layer;
2. feed kernel records / host projections straight into the projectors
   (`toListingCatalog`, `toListingVersionHistory`, `toEntitlementStatus`,
   `toUsageSummary`, `toRevenueLedger`, `toErrorNotice`);
3. render the returned view models with the presentational components in
   `components/`;
4. pin the structural compatibility (this module ↔ the kernel surface) with
   a parity test once the app workspace gains a test harness — the mirrors
   live in one file (`contracts.ts`) precisely so that pin is cheap.

No route changes, no app-shell changes, no global provider changes were
made by this module.
