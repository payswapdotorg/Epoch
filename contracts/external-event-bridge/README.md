# contracts/external-event-bridge — Epoch External Event Bridge contract surface

Owned by Work Order **W042** (`packages/external-event-bridge/*`,
`adapters/aurum-chat/*`, `contracts/external-event-bridge/*`,
`docs/integrations/aurum-chat/*`). Kernel layer.

This directory publishes the typed, versioned, provider-neutral contract
surface of the Epoch **External Event Bridge v1** kernel at its ownership
boundary: the normalized INBOUND external-event records (source adapter
identity, event class, opaque payload, correlation/causation ids,
caller-supplied instants, W006-shaped provenance) admitted as
W036-shaped observation intake proposals through the existing authority
path; the normalized OUTBOUND request records with exactly four classes
(information / status / alert / acknowledgement-request) carrying
least-privilege filtered payloads under a W041 projection-policy typed
reference; the typed retry policies (caller-supplied instant sequences —
no timers) and content-addressed per-attempt receipts; the provider
registrations with class-based resolution; the provider-unavailability
records with fallback / manual-queue / alternative-provider semantics;
and the `bridge:*` event vocabulary over the W010 event shapes. The
runtime implementation is `@epoch/external-event-bridge`; the reference
provider adapter is `@epoch/adapter-aurum-chat` (fixture-driven, no
network). This contract defines only the typed shapes — no admission
logic, no persistence, no UI lives here.

## Contents

| Path | What it is |
|---|---|
| `index.d.ts` | Versioned TypeScript declaration surface (self-contained, no imports, no runtime code, no provider/vendor vocabulary). |
| `parity.ts` | Compile-time conformance assertions: every published type must be *identical* to the implementation's zod-inferred type. Compiled by `packages/external-event-bridge`'s `typecheck` script (`tsconfig.contracts.json`); any drift fails `pnpm typecheck`. |
| `manifest.json` | Exact-revision evidence anchor: contract version, data-type inventory, and a SHA-256 digest for every emitted schema file. |
| `schemas/*.schema.json` | Deterministic JSON Schema (draft 2020-12) projection of the CORE record types, emitted by `renderExternalEventBridgePublicContractFiles()` in `@epoch/external-event-bridge`. |

The full (33-entry) schema surface is additionally published in-package
at `packages/external-event-bridge/schemas/` (the W007/W009/W023/W036
in-package convention); this directory carries the W012-convention
public projection of the core record types. Both sets are
drift-pinned byte-for-byte by
`packages/external-event-bridge/test/contract-drift.test.ts`.

## Authority split (the W042 dispatch pins)

- **The delivery authority (W036)** owns observations: the bridge
  produces observation INTAKE PROPOSALS through the existing authority
  path and never writes observations directly
  (`observation-bypass-rejected`).
- **The authorization decision point (W009)** answers allow/deny before
  any kernel admission (`authorization-bypass-rejected`,
  `tenant-isolation-rejected`).
- **The projection policy (W041)** decides what an outbound recipient
  may see: every dispatched payload is filtered to the recipient's
  minimum-necessary allowlist (`least-privilege-violation-rejected`).
- **The event log (W010)** owns change history: `bridge:*` events are
  W010-shaped facts over the open `bridge:` payload namespace.
- Everything else is referenced OPAQUELY (providers, recipients,
  capabilities, domain-pack subjects). One responsibility has one
  authority.

## Provider neutrality (lock rule 13)

No vendor, brand, marketplace, or API vocabulary exists in these types.
A blocklist test fails the build if any provider token appears in the
kernel source or emitted artifacts. The reference chat adapter is ONE
satisfying implementation; compatible providers may be substituted
without changing these semantic types.

## Lifecycle neutrality (the universal-domain invariants)

The bridge carries ZERO pack-specific vocabulary — it may acquire
information or relay supervision for ANY domain pack, so no pack name,
pack namespace, or pack branch exists anywhere in this surface (the
`pack-branching-rejected` source-scan test).

## Versioning

`schemaVersion` (`1`) is carried by every serialized record and
validated exactly — skew is a typed `version-unsupported` error at the
precise path, never a silent parse. `contractVersion` (`1.0.0`)
versions this published surface.

## JSON Schema fidelity and determinism

Structural-only projection; runtime refinements (canonical ordering,
digest verification, tenant checks, scope chains) are enforced by
`@epoch/external-event-bridge`. The committed artifacts are
byte-identical to the deterministic emission; regeneration is only
possible through the documented update mode:

    EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/external-event-bridge test contract-drift
