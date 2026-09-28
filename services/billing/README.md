# @epoch/billing-host — Epoch Billing runtime service (W024)

Service layer. Owned surfaces of Work Order **W024**:
`services/billing/*`, `packages/entitlements/*` (the kernel — see
`packages/entitlements/README.md`).

The thin typed HOST FACADE over the `@epoch/entitlements` kernel.

## Surface

- **Billing-account sessions** — idempotent opening (the account id is
  derived from (idempotencyKey, tenant)); one settlement currency per
  account.
- **W023 adoption** — entitlement grant/revocation records enter through
  the REAL marketplace validators (idempotent by entitlement id;
  same-id-different-content is the typed `idempotency-conflict`).
- **W036 registration** — sealed delivery records verified at admission
  (the REAL `verifySealedDeliveryRecord`): only VALIDATED actuals ever
  bill.
- **Usage intake** — sealed W023 usage events (verified; idempotent by
  (streamId, sequence); folded through the REAL marketplace
  `foldUsageEvents`).
- **Seat operations** — kernel admission (capacity, duplicates,
  revocation) with `entitlements:seat-assigned` / `seat-released` events
  on the entitlement's stream.
- **Invoice sessions** — draft → issued → settled | void. Line amounts
  are NEVER caller-supplied: the kernel derives them from the W023
  pricing vocabulary (typed data validated through the REAL marketplace
  parser — listing-version content is the marketplace service's state,
  not this host's), the folded usage accounts, the folded seat accounts,
  and the registered W036 validated actuals.
- **Settlement** — the SettlementPort adapter seam: the port outcome
  PROPOSES the settled transition; the invoice record (with the
  settlement id + port reference recorded on it) is the settlement
  authority — lock rule 11 applied to settlement.
- **Events** — `billing:*` on one stream per billing account
  (`stream:billing-<suffix>`), `entitlements:*` on one stream per
  entitlement — W010-shaped, digests sealed by the kernel.

## Guards

- The **W009 authorization gate** denies unauthorized operations BEFORE
  any kernel admission (the W022/W037/W043 pattern; action kinds
  `billing.<operation>`).
- **Tenant isolation** (R12): typed `cross-tenant-denied` on every
  tenant-scoped record path; optional single-tenant
  `expectedTenantId` guard (`tenant-isolation-rejected`).

## Determinism

Zero wall-clock reads and zero randomness — every instant is
caller-supplied; every listing/snapshot is sorted. Two hosts fed the
same operations hold byte-identical state (pinned by test).

## Runtime dependency policy (frozen, W024 pin)

`@epoch/agent-protocol`, `@epoch/authorization`,
`@epoch/entitlements`, `@epoch/marketplace`,
`@epoch/solution-delivery`, `@epoch/tenancy`, `zod` — NOTHING else
(`@epoch/event-log` is a devDep parity pin, never a runtime edge).
