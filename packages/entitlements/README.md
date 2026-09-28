# @epoch/entitlements — Epoch Billing + Entitlements kernel (W024)

Kernel layer. Owned surfaces of Work Order **W024**:
`packages/entitlements/*`, `services/billing/*` (the host runtime — see
`services/billing/README.md`).

The typed domain model for entitlement **resolution** and **billing**
records (architecture.md, binding: *"Epoch owns listings, trust metadata,
versions, entitlements, usage accounting, and developer revenue records.
Payment processors are adapters."*; architecture lock rule 11:
*"Marketplace entitlement is separate from payment processor state."*).

## Authority split (lock rule 16 — consume, never redefine)

| Authority | Owner | How this kernel consumes it |
| --- | --- | --- |
| Entitlement grant/revoke records + the pure grant check | `@epoch/marketplace` (W023) | runtime dependency, public API only; `resolveEntitlement` DELEGATES grant matching to `checkEntitlement` |
| Tenancy containment hierarchy + tenant grammar | `@epoch/tenancy` (W009) | runtime dependency; scope queries validate against the real `TenancyHierarchy` |
| Delivery facts (validated actuals) | `@epoch/solution-delivery` (W036) | runtime dependency; `deriveDeliveryActualLines` verifies the sealed record first — only VALIDATED actuals may bill |
| Developer revenue records | `@epoch/marketplace` (W023) | NOT re-owned — billing owns invoices (the buyer-side document), not revenue |
| W010 event shapes | `@epoch/event-log` | devDep parity only (compile-time type equality + runtime parity tests) — never a runtime edge |
| Settlement execution state | external adapters | behind the `SettlementPort` seam (checks + record-shaped outcomes only); the invoice record is the settlement authority |

## Surface

- **Resolution** — `resolveEntitlement`: workspace/project scope
  validation against the W009 hierarchy, project → workspace narrowing,
  then delegation to the W023 `checkEntitlement` authority.
- **Seat accounting** — sealed seat assignments + releases (append-only
  facts), pure admission (`admitSeatAssignment` / `admitSeatRelease`
  with typed rejections: capacity undefined/exceeded, duplicates,
  revocation), deterministic `foldSeatAssignments`.
- **Billing accounts** — sealed, content-addressed, tenant-scoped, one
  settlement currency.
- **Invoices** — sealed immutable lines; typed lifecycle
  `draft → issued → settled | voided` (`issueInvoice`, `settleInvoice`,
  `voidInvoice`); exact decimal `foldInvoiceTotals`. No `overdue` state,
  no wall clock: due dates are caller-supplied instants.
- **Pure line derivation** — `deriveOneTimeLine`, `deriveSubscriptionLine`,
  `deriveSeatLine`, `deriveUsageLine` (W023 pricing + usage accounts),
  `deriveDeliveryActualLines` (W036 validated actuals; cost measures bill
  at their recorded amount, quantity measures at caller-supplied rates —
  never a silent zero), `classifyPricingForBilling` (free /
  enterprise-private derive nothing — typed `unsupported-pricing-model`).
- **SettlementPort** — the provider-neutral adapter seam
  (`InMemorySettlementPort` reference impl; no charge execution, no
  credentials, no network).
- **Events** — `entitlements:*` / `billing:*` append-only typed events
  over the W010 shapes (`sealEntitlementsEvent`; one stream per billing
  account `stream:billing-<suffix>`, one per entitlement
  `stream:entitlements-<suffix>`).

## Determinism

Zero wall-clock reads and zero randomness — every instant is
caller-supplied; every listing/fold is sorted (no insertion-order leaks);
decimal arithmetic is exact bigint-scaled canonical strings. Two call
sequences with the same inputs produce byte-identical records (pinned by
the determinism test).

## Runtime dependency policy (frozen, W024 pin)

`@epoch/agent-protocol`, `@epoch/marketplace`,
`@epoch/solution-delivery`, `@epoch/tenancy`, `zod` — NOTHING else.
`@epoch/event-log`, `@epoch/identity` and `@epoch/authorization`
compatibility is pinned via devDependencies + `src/kernel-parity.ts`
(compile time) + `test/parity.test.ts` (runtime).

## Contract surface

W024 owns no `contracts/` tree, so the published contract surface lives
INSIDE the package (the W023 marketplace precedent): the typed index
export, the runtime zod validators, and the committed JSON Schema
projection under `schemas/` pinned byte-for-byte by
`test/contract-drift.test.ts`:

```
EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/entitlements test contract-drift
```
