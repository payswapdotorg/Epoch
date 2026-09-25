# @epoch/event-log

Epoch **Event Log** kernel — the authoritative change history (Work Order
W010, layer: kernel).

> architecture.md (binding): "The event log is the authoritative change
> history: append-only, totally-ordered per stream, typed events carrying
> actor/tenant scoping, causal references, and content digests. Events are
> FACTS (immutable); corrections are new events, never mutations."

## What this package owns

- The **event envelope** (`EventContent`): stream id, sequence, tenant
  scope, actor reference, causal parent, payload discriminator + data,
  producer-supplied occurrence instant, and the content digest.
- The **append machinery** (`EventLog.appendEvent`): total admission with
  a fixed precedence — version → schema → digest → kernel payload →
  tenant → sequence → causal. Per-stream sequences are strictly
  contiguous from 1; gaps, duplicates, out-of-order appends, digest
  tamper, and cross-tenant appends are typed rejections.
- **Cursor/read primitives** (`readStream`, `streamInfo`, `listStreams`,
  `snapshot`): deterministic, in-memory; every read path sorts (no
  insertion-order leaks).
- The **kernel payload contracts** for the reserved event-kind
  namespaces: `world:subjects` (payloads referencing world entities/
  relations, W002 vocabulary) and `action:lifecycle` (action-derived
  events referencing action proposals at an exact revision, W003
  vocabulary).

## What it deliberately is NOT

- **Not durable persistence** — the architecture's durable stores and
  event brokers are future adapters; this package owns the reference
  machinery and the typed contract.
- **Not world semantics** — events REFERENCE world entities opaquely
  (@epoch/world-model is the semantic authority).
- **Not authorization** — action lifecycle events record FACTS; decisions
  are @epoch/authorization's authority.
- **Not a clock** — ZERO wall-clock reads and ZERO randomness in src;
  occurrence instants are producer-supplied payload data.

## Causality

`causalParent` references an appended event of any stream: cross-stream
references are how streams **intersect** (the replay package folds
intersecting streams). Invariants: a same-stream parent must be strictly
earlier (`causal-cycle`), and every parent coordinate must already exist
in history (`unknown-parent`).

## Contract surface

In-package versioned contracts (the W007/W008/W009 convention): version
constants + typed index export, runtime zod validators (`src/schema.ts`),
compile-time parity (`src/parity.ts`, `src/kernel-parity.ts`), and the
committed JSON Schema projection under `schemas/` pinned byte-identically
by `test/contract-drift.test.ts`. Regenerate after intentional changes:

```
EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/event-log test contract-drift
```

## Dependencies (W010 runtime policy)

Runtime: `@epoch/agent-protocol` (canonical JSON, SHA-256, timestamp and
JSON primitives), `@epoch/world-model` (EntityId vocabulary),
`@epoch/action-protocol` (ProposalReference/ActionTypeReference
vocabulary), `zod`. Tenancy/identity shape compatibility is pinned via
devDependencies + compile-time and runtime parity tests — never runtime
deps.

## Tests

Positive round-trips plus named negatives: sequence gap, duplicate
sequence, out-of-order, digest tamper, cross-tenant append (R12),
unknown/cyclic causal parents, version skew, vendor-field rejection,
reserved-namespace payload enforcement, snapshot tamper (reorder,
duplicate coordinate, inconsistent projection), determinism (source scan
for wall-clock/randomness), and kernel parity.
