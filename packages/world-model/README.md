# @epoch/world-model

The Canonical World Model — the Epoch **semantic authority** (kernel layer,
Work Order W002). A typed property/relationship graph whose every state
change is an attributed, confidence-carrying, temporally-valid
**assertion**, with full append-only history, point-in-time
reconstruction, deterministic serialization, and epistemic
(task-sufficiency) queries.

## Architecture position

Implements `spec/architecture.md` (World Model) inside the frozen E1.0/X1.0
architecture and its lock rules:

- **World Model is semantic authority** (lock 1): this package is the only
  writer of durable world state; every value handed to readers is
  deep-frozen; there are no mutation APIs on views.
- **Agents are reasoning participants, not authority** (lock 2): the write
  surface is `applyAssertion` / `retractAssertion`, both of which
  structurally require provenance (an attributed actor, method, optional
  evidence). Agent-side proposal flows arrive with the action protocol
  (W003) and the Action Gateway (W022); this package is the
  authority-side ingest they target.
- **External standards map INTO the model** (lock 13, provider
  neutrality): `registerExternalMapping` stores pure-data mappings of
  external standards onto registered Epoch types. No provider semantics
  exist in kernel types; provider identifiers are legal only as opaque
  strings inside documented fields. Concrete adapters arrive with W007/W029.
- **History is never discarded**: superseded and retracted assertions stay
  addressable, feed history queries, and are carried in snapshots.

## Concepts

| Concept        | Where |
| -------------- | ----- |
| Entity / Relation (typed graph) | `core:` vocabulary + extension type registration (inheritance, typed properties, typed endpoints) |
| Assertion (unit of stated truth) | statement + provenance + confidence + validity + lifecycle |
| Reconciliation | latest-wins per reconciliation key with explicit supersession and retraction fallback (`model/reconcile.ts`) |
| Temporal history | append-only events; `asOf(at)` point-in-time views; validity windows |
| Evidence & uncertainty | `Provenance` (actor/method/evidence refs), `Confidence` (point/interval/set, bounded [0,1]) |
| Task-sufficient reconstruction | `decisionScope(spec)` — sub-world + information gaps (`model/sufficiency.ts`) |
| Serialization | `serialize()` — versioned, deterministic, sha-256-digested snapshots; `fromSnapshot` verifies integrity |

## Usage

```ts
import { WorldModel } from '@epoch/world-model';

const world = WorldModel.create(); // builtin core: vocabulary registered

world.registerEntityType({
  key: 'geo:building',
  extends: 'core:entity',
  properties: { floors: { type: 'integer', required: true } },
});

const assertion = world.applyAssertion({
  statement: { kind: 'entity', entityId: 'b-1', entityType: 'geo:building', properties: { floors: 3 } },
  provenance: {
    actor: { id: 'user:alice', role: 'human' },
    method: 'direct-observation',
    evidence: [{ id: 'ev:site-survey', kind: 'document' }],
  },
  confidence: { distribution: { kind: 'point', value: 0.9 }, method: 'measured' },
});

world.getEntity('b-1');                       // immutable view
world.asOf('2026-01-01T00:00:00.000Z');       // point-in-time projection
world.decisionScope({ entities: ['b-1'], relationDepth: 1 }); // + information gaps
world.serialize();                            // deterministic snapshot (digest)
```

## Contracts

The published type/JSON-Schema surface lives in `contracts/world/`
(versioned, types-only). This package re-exports it and ships the runtime
zod validators. Equivalence is enforced twice:

- **compile time** — `src/schema/type-sync.ts` proves every validator
  infers exactly the contract type;
- **test time** — `test/contracts-sync.test.ts` proves every published JSON
  Schema document equals `z.toJSONSchema()` of the matching validator, and
  that versions stay in sync.

## Tests

`pnpm --filter @epoch/world-model test` (or the workspace battery) runs the
positive/negative battery: lifecycle and reconciliation, temporal queries,
provenance retention, confidence bounds, authority/freeze guarantees,
provider-neutrality rejections, snapshot round-trip/determinism/tamper
rejection, and epistemic gap analysis.

## Limitations (v1)

- In-memory store; persistence interfaces are intentionally NOT implemented
  here (PostgreSQL durability belongs to later persistence Work Orders).
- Linear scans back some queries (per-key resolution is fine; entity
  materialization scans keys) — performance/scale is W034.
- Instant comparison has millisecond precision (ISO string parsing); the
  monotonic sequence counter is the strict ordering authority.
- One live relation per (type, source, target) key; parallel edges of the
  same type require distinct relation types (documented reconciliation
  granularity).
- `unsupported-claim` gaps flag every evidence-less contributing assertion
  by design (epistemic honesty); callers filter by `kind` when needed.
