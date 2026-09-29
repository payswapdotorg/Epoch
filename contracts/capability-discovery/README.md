# contracts/capability-discovery — Epoch Capability Discovery contract surface

Owned by Work Order **W045** (`packages/capability-discovery/*`,
`services/capability-discovery/*`, `contracts/capability-discovery/*`,
`docs/capability-discovery/*`). Kernel layer.

This directory publishes the typed, versioned, provider-neutral contract
surface of the Epoch **Role & Capability Discovery Plane v1** (ARCD1.0 /
ACR-004, W045): the universal capability-demand compiler's record types
(`CapabilityDemand`, `RoleProposal`), candidate profiles (agent / human /
capability / external), the capability-gap lifecycle, candidate
organizations and their declared-criteria evaluation, content-addressed
discovery runs with digest-chained lineage, source-adapter artifacts,
the promotion boundary, ecosystem proposals and the scheduler schedule
records. The runtime implementation is `@epoch/capability-discovery`
(kernel layer); this contract defines only the typed shapes — no
admission logic, no persistence, no UI lives here.

## Contents

| Path | What it is |
|---|---|
| `index.d.ts` | Versioned TypeScript declaration surface (self-contained, no imports, no runtime code, no provider/model/vendor vocabulary). |
| `parity.ts` | Compile-time conformance assertions: every published type must be *identical* to the implementation's zod-inferred type. Compiled by `packages/capability-discovery`'s `typecheck` script (`tsconfig.contracts.json`); any drift fails `pnpm typecheck`. |
| `manifest.json` | Exact-revision evidence anchor: contract version, data-type inventory, and a SHA-256 digest for every emitted schema file. |
| `schemas/*.schema.json` | Deterministic JSON Schema (draft 2020-12) projection of every surface type, emitted by `renderCapabilityDiscoveryContractFiles()` in `@epoch/capability-discovery`. |

## Versioning

- `contractVersion` (`"1.0.0"`) versions this published surface; the
  record discriminator is `CapabilityDiscoveryRecordVersion` (`1`), and
  the universal compiler carries its own `DiscoveryCompilerVersion`
  (part of every run's content-addressed identity).
- Breaking changes to any published type require a contract major bump;
  additions may ride a minor bump. The manifest inventory makes the
  published set machine-checkable.

## Determinism and evidence addressing

Every derived record identity is content-addressed (SHA-256 over the
canonical JSON of the record body, digest-suffix ids). Discovery-run
lineage is digest-CHAINED (`inputs -> demands -> roles -> resolution ->
organizations -> evaluation -> selection` for problem-driven runs;
`inputs -> candidates -> gap-updates -> promotions` for ecosystem runs),
and `verifyDiscoveryRun` re-derives the whole chain from the artifact's
own self-contained inputs. No wall-clock, no randomness: instants are
caller-supplied data and are excluded from identity digests.

## JSON Schema fidelity

The schema files are a **structural-only** projection. Zod refinements —
cross-field invariants such as "external candidates below `verified`
must be sandbox-required and outside the Epoch trust domain",
"hard-constraint and evidence-coverage criteria must declare a
threshold", "objective criteria must declare a weight", "p95 >= p50" and
the unique-signal-id rules — are enforced by the runtime validators in
`@epoch/capability-discovery` and are intentionally absent from the JSON
Schema files. Consumers MUST validate records with the runtime package.

## Authority and neutrality (architecture lock rules 13, 16; ACR-004)

- Discovery owns DISCOVERY records only; world/solution/delivery/
  constraint/evidence/verification state is referenced OPAQUELY (ids +
  content digests), never embedded.
- `executionAuthority` admits exactly `"none"` on demands and role
  proposals (the W003 convention): discovery never grants execution
  authority.
- The surface is provider-neutral: no vendor, model, product or API
  vocabulary exists anywhere in the published types or schemas (enforced
  by the kernel's neutrality battery with a provider blocklist).

## Reconciliation notes (architecture questions)

- The tenant-id grammar mirrors `@epoch/tenancy` (W009) pattern-for-
  pattern; tenancy semantics stay W009's authority.
- The `Timestamp` grammar mirrors `@epoch/agent-protocol` (W003).
- The candidate claim surface (`ClaimedCapability`) is this plane's
  provider-neutral compatibility vocabulary; concrete capability
  contracts remain the Capability Registry's authority (W007).
