# @epoch/developer-portal-host — Epoch Developer Portal runtime service (W025)

Service layer. Owned surfaces of Work Order **W025**:
`services/developer-portal/*`, `apps/web/src/features/developers/*` (the
web feature — see its README).

The thin typed HOST FACADE for **Developer Portal/Publishing**: the
developer-facing authoring, publishing, and analytics surface over the
upstream authorities — the W007 capability registry and the W023
marketplace kernel — with the W024 billing account as the developer
payout surface.

## Surface

- **Capability browsing (W007)** — `browseCapabilities` (deterministic
  filtered listings over the REAL registry browse seam;
  `CapabilityRegistry` satisfies it structurally) and
  `resolveCapability` (version-constrained resolution with the registry's
  own semantics: retired records never resolve, deprecation is advisory,
  the highest satisfying version wins). The registry stays the authority;
  the portal never registers or mutates it.
- **Listing authoring/publishing sessions (W023)** —
  `createListingDraft` (idempotent; the listing id derives from
  (idempotencyKey, developer tenant) — the SAME derivation as the W023
  marketplace host, so the same (key, tenant) names the same listing on
  both surfaces), `updateListingDraft`, `submitListing`,
  `retireListing` (the REAL lifecycle transition table), and
  `publishListingVersion`: the draft fields are validated through the
  REAL kernel listing-version admission (pricing, trust evidence,
  canonical ordering), publication seals the IMMUTABLE,
  content-addressed, hash-chained version through the REAL kernel
  sealer, admits every capability reference against the REAL W007
  registry (dangling references are typed rejections), and verifies the
  chain BEFORE any state commits. Publication is idempotent: replaying
  the head version with identical content returns `duplicate: true`;
  different content at the same version is the typed `version-conflict`.
- **Reads** — `getListing`, `listListings` (developer-owned, sorted),
  `getListingVersion` (by pin or digest, digest-verified),
  `listListingVersions` (semver-ascending), `verifyListingChain`
  (the REAL kernel chain verification projected), `readStream`.
- **Developer analytics adoption** — `adoptEntitlementGrant`,
  `adoptEntitlementRevocation`, `adoptRevenueRecord` (W023 records
  through the REAL validators), and `adoptBillingAccount` (the W024
  sealed billing account through the REAL verifier). Adoptions must
  concern the developer's OWN listings; all are idempotent by record
  identity with typed `idempotency-conflict` on same-id-different-content.
- **Developer dashboard** — `getDeveloperDashboard`: a pure deterministic
  projection (listing/lifecycle counts, active vs revoked entitlement
  analytics through the REAL marketplace `checkEntitlement`, revenue
  folds per currency through the REAL decimal arithmetic, the adopted
  payout account, registry/stream counters). Fail-closed: an unexpected
  entitlement-check error propagates as the typed carrier.
- **Events** — every lifecycle step emits a sealed `portal:*` event over
  the W010 event shapes (one stream per listing
  `stream:portal-listing-<suffix>`, one developer stream
  `stream:portal-developer-<tenantSuffix>`); digests are sealed
  in-package and parity-pinned against the REAL W010 sealEvent.
- **Health/describe** — typed data projections (`health`, `describe`).

## Guards

- **Authorization (W009)** — every operation sits behind the fail-closed
  authorization gate (`portal.<operation>` action kinds) BEFORE any
  kernel admission.
- **Tenancy (R12)** — every read/write is tenant-scoped;
  `expectedTenantId` provides the single-tenant guard; cross-tenant
  access is the typed `cross-tenant-denied` rejection.
- **Strict objects** — unknown (vendor/provider) fields on inputs are
  typed `vendor-fields-rejected` rejections.
- **Determinism** — zero wall-clock, zero randomness, zero I/O; every
  instant is caller-supplied; sorted deterministic projections.

## Contract surface

- The typed index export (`src/index.ts`).
- The runtime zod validators (`src/events.ts`, `src/projections.ts`).
- The declaration-only contract tree under `contracts/` (the W012
  convention: `index.d.ts` + `manifest.json` + `parity.ts` +
  `schemas/`, NO package.json). `contracts/parity.ts` proves at compile
  time that the declarations are type-identical to the implementation
  (and that the event content is W010-shaped);
  `test/contract-drift.test.ts` proves the committed artifacts are
  byte-identical to the deterministic emission
  (`EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/developer-portal-host
  test contract-drift` regenerates).

## Runtime dependency policy (frozen)

`@epoch/agent-protocol`, `@epoch/authorization`,
`@epoch/capability-registry`, `@epoch/entitlements`,
`@epoch/marketplace`, and `zod` — NOTHING ELSE.
`@epoch/event-log` is a devDependency parity pin (never a runtime edge);
`test/runtime-deps.test.ts` enforces the exact set.

## In-memory reference behavior

NO persistence, NO network, NO real processes (later Work Orders add
those behind this seam).

## Verification

```
pnpm install
pnpm check
pnpm exec turbo run typecheck lint test build --concurrency=1 --force
```
