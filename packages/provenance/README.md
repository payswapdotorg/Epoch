# @epoch/provenance

Epoch Provenance kernel — Work Order W006 (Verification/Evidence/Provenance).
Layer: `kernel`.

Provenance is **first-class** (R5 evidence/provenance, R17 auditability):
typed **actor -> activity -> entity** chains in a PROV-DM-adapted model —
who/what produced an artifact, by which method, from which inputs, when.
The mapping surface is PROV-friendly (typed agents/activities/entities plus
the six core PROV binary relations) without importing a PROV library.

## Core concepts

- **Agents** (who): `agentId`, `agentKind` ∈ person / organization /
  software / hardware / system (PROV agent kinds, adapted).
- **Activities** (how/when): `activityId`, open-slug `activityKind`,
  optional `startedAt`/`endedAt` (canonical UTC instants).
- **Entities** (what): `entityId`, open-slug `entityKind`, optional
  content `digest` — content-addressed entities (e.g. evidence records)
  carry their exact SHA-256 address.
- **Statements** — the six core PROV relations as a discriminated union:
  `was-generated-by`, `used`, `was-associated-with`, `was-attributed-to`,
  `was-derived-from`, `acted-on-behalf-of` (PROV time/role qualifiers
  become optional fields).
- **ProvenanceGraph** — a closed bundle of nodes + statements carrying the
  `schemaVersion: 1` discriminator; its identity is the SHA-256 of its
  canonical JSON serialization (`computeProvenanceDigest`).

## Validation (`validateProvenanceGraph` / `admitProvenanceGraph`)

Total reference validation, typed issues, never throws:

- reference integrity: every statement reference must resolve within the
  graph — **unknown agents, unknown activities, and dangling entities are
  rejected** (issue codes `unknown-agent` / `unknown-activity` /
  `unknown-entity`);
- node ids unique per collection (`duplicate-agent` / `duplicate-activity` /
  `duplicate-entity`);
- temporal sanity: `startedAt <= endedAt` (`activity-time-order`);
- derivation is a strict partial order: self-derivation and derivation
  cycles are rejected (`self-derivation` / `derivation-cycle`);
- strict schemas: unknown keys/relations/kinds and malformed digests and
  timestamps rejected (`schema`); version skew reported distinctly
  (`version-mismatch`).

## Public API

| Export | Purpose |
| --- | --- |
| `parseProvenanceGraph(input)` | total schema parse with distinct version-mismatch reporting |
| `admitProvenanceGraph(input)` | parse + semantic validation in one call |
| `validateProvenanceGraph(graph)` | semantic reference/ordering validation of a typed graph |
| `computeProvenanceDigest(graph)` | canonical SHA-256 content address of a graph |
| `ProvenanceGraphSchema` / `ProvenanceStatementSchema` / … | runtime zod validators (strict shapes) |
| `renderProvenanceContractFiles()` | deterministic emission of `schemas/` |
| `PROVENANCE_AGENT_KINDS` / `PROVENANCE_RELATIONS` | closed vocabularies |

## Contract surface

`PROVENANCE_CONTRACT_VERSION` 1.0.0. Serialized graphs carry
`schemaVersion: 1`. The published JSON Schema projection lives in `schemas/`
(byte-pinned by `test/contract-drift.test.ts`; regenerate via
`EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/provenance test contract-drift`).
Compile-time parity between the zod validators and the published types is
pinned by `src/parity.ts` (part of `pnpm typecheck`).

## Neutrality

Node and statement identifiers are opaque strings; `entityKind` /
`activityKind` are open kebab-case slugs so domain packs own their
vocabulary while the kernel owns only the relational structure. Pinned by
`test/neutrality.test.ts`.

## Tests

- `provenance.positive.test.ts` — full six-relation graphs, derivation
  chains, key-order-insensitive digests, empty graphs.
- `provenance.negative.test.ts` — unknown agent/activity, dangling entity
  (every relation), duplicate ids, self-derivation, 2- and 3-node
  derivation cycles, time-order violations, schema violations, version
  skew.
- `contract-drift.test.ts` — committed artifacts byte-identical to emission.
- `neutrality.test.ts` — no provider vocabulary; open slug vocabularies.

## Limitations (v1)

- Single-graph closure: cross-graph references (PROV bundles/accounts) are
  not modeled; compose graphs explicitly at a higher layer.
- No blank nodes, no alternate/specialization relations (PROV-DM beyond the
  six core relations); add behind a versioned contract change if needed.
- No digital signatures over statements: authenticity is out of scope for
  the kernel model (identity/tenancy is W009).
