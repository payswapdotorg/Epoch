# apps/web/src/features/developers — Developer Portal feature module (W025)

A TYPED feature library inside the existing Next.js app: view-model
contracts + pure deterministic projections + presentational components
for the Developer Portal (the developer-facing authoring, publishing,
and analytics surface of W025). It consumes ONLY the
`@epoch/developer-portal-host` public surface — structurally.

## Why this module stands alone (the frozen-manifest constraint)

W025's owned surface is `apps/web/src/features/developers/*` ONLY.
`apps/web/package.json` (and every other app file) belongs to W014's
surface and is frozen to this Work Order, so the module CANNOT declare
`@epoch/developer-portal-host` as a dependency and cannot import it. The
record-facing input types in `contracts.ts` are therefore STRUCTURAL
MIRRORS of the exact service public-surface subset the feature consumes
(the `services/developer-portal/contracts` declaration tree is the
versioned source of truth; `contracts/parity.ts` there pins the
implementation to those declarations):

| Feature input (`contracts.ts`)       | Service surface                            |
| ------------------------------------ | ------------------------------------------ |
| `ListingSnapshotInput`               | host `ListingSnapshot`                     |
| `SealedListingVersionInput`          | W023 `SealedListingVersion` (re-exported)  |
| `CapabilityRecordInput`              | W007 `CapabilityRecord` (re-exported)      |
| `EntitlementAdoptionInput`           | W023 `EntitlementGrantRecord` + derived status |
| `RevenueRecordInput`                 | W023 `RevenueRecord` (re-exported)        |
| `PayoutAccountInput`                 | host `PayoutAccountSummary`                |
| `PortalEventInput`                   | host `SealedPortalEvent`                  |
| `DeveloperPortalErrorInput`          | host `DeveloperPortalError`               |

TypeScript structural typing makes the service records assignable to
these interfaces as-is. The projection functions (`project.ts`) never
fabricate service semantics: they render exactly what the records carry
(digests, lifecycle states, counts, instants, amounts).

## Wiring contract for W014

When the app shell (W014) wires features, it should:

1. add `@epoch/developer-portal-host` (and, if it drives the service
   seam, the upstream `@epoch/marketplace`,
   `@epoch/capability-registry`, `@epoch/entitlements`) to the app
   manifest and route data to this module through the app's data layer;
2. feed service records / host projections straight into the projectors
   (`toDeveloperListings`, `toListingVersionHistory`,
   `toCapabilityRows`, `toEntitlementAdoptions`, `toRevenueLedger`,
   `toPayoutAccount`, `toPortalEventFeed`, `toErrorNotice`);
3. render the resulting view models with the presentational components
   in `components/` (semantic markup only; the shell owns the design
   system — no styling dependencies here).

## Conventions

- **Self-contained**: the module imports NOTHING outside `apps/web`
  (react + relative paths only). The logic files (`contracts.ts`,
  `project.ts`) import no react at all.
- **Pure view models**: deterministic display models (sorted rows,
  derived labels) — no clock, no randomness, no environment access
  (lock rule 8: a projection, never a second source of truth).
- **Presentational components**: `components/` renders the view models
  with semantic markup only; the app shell (W014) owns the design
  system and route mounting.
