# contracts/supervision — Epoch Delivery Supervision + Alerts contract surface

Owned by Work Order **W043** (`packages/supervision/*`,
`services/supervision/*`, `packages/alerts/*`, `contracts/supervision/*`).

This directory publishes the typed, versioned, provider-neutral contract
surface of the Epoch **Delivery Supervision + Alerts v1** domain (W043)
at its ownership boundary: the supervision finding production over the
W036 sealed authorities (planned-vs-actual, critical-path, prerequisite,
lead-time, consumption, verification, unresolved-unknown checks), the
W038-shaped execution-issue summaries and W037-shaped lead-time risk
inputs (opaque typed references), the typed anomaly thresholds, the
sealed supervision pass, the severity/escalation **policy as data**, the
alert revision chains, the gateway-bound escalation outcomes, and the
typed notifications. The runtime implementations are
`@epoch/supervision` and `@epoch/alerts`; this contract defines only
the typed shapes — no admission logic, no persistence, no UI lives here.

## Contents

| Path | What it is |
|---|---|
| `index.d.ts` | Versioned TypeScript declaration surface (self-contained, no imports, no runtime code, no vendor/provider vocabulary). |
| `parity.ts` | Compile-time conformance assertions: every published type must be *identical* to the implementations' zod-inferred types. Compiled by `services/supervision`'s `typecheck` script (`tsconfig.contracts.json`) — the only W043 component depending on BOTH kernels; any drift fails `pnpm typecheck`. |
| `manifest.json` | Exact-revision evidence anchor: contract version, data-type inventory, and a SHA-256 digest for every emitted schema file. |
| `schemas/*.schema.json` | Deterministic JSON Schema (draft 2020-12) projection of the CORE record types, emitted by `renderSupervisionPublicContractFiles()` in `@epoch/supervision-runtime` (composed from both kernels' core-record surfaces). |

The full in-package schema surfaces are additionally published at
`packages/supervision/schemas/` (26 entries) and
`packages/alerts/schemas/` (21 entries) — the W007/W009/W023/W036/W038
in-package convention; this directory carries the W012-convention
public projection of the core record types. All sets are drift-pinned
byte-for-byte by their packages' / the service's contract-drift tests.

## Authority split (architecture lock rule 16)

- **ProgramOfWork / DeliveryRecord** (W036) — the schedule and
  delivery-facts authorities. Supervision OBSERVES them (re-schedule
  attempts are typed `re-schedule-rejected`); it never writes delivery
  state.
- **Action Gateway** (W022) — escalation actions are typed W003
  proposals authorized by the gateway FIRST; the alerts kernel never
  executes anything (`gateway-bypass-rejected`).
- **Event log** (W010) — supervision events are W010-shaped append-only
  facts in the open `supervision:` payload namespace, one stream per
  supervised program (`stream:supervision-<suffix>`).
- **NotificationPort** — external channels stay behind the seam; the
  channel/target vocabularies are closed and provider-neutral
  (`provider-vocabulary-rejected`).

Regenerate after an intentional schema change:

```
EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/supervision-runtime test contract-drift
```
