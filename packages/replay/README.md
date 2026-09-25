# @epoch/replay

Epoch **Replay** kernel — deterministic reconstruction (Work Order W010,
layer: kernel).

> architecture.md (binding): "Replay is deterministic reconstruction:
> given the same ordered event sequence, replay reconstructs the same
> state — ZERO wall-clock, ZERO randomness; any timestamp a consumer
> needs comes FROM event payload data, not from reading the clock during
> replay. Divergence detection: two replays of the same log MUST produce
> identical state digests."

## What this package owns

- The **fold machinery** (`foldStream`, `foldStreams`,
  `foldEventRecords`): folding one stream — or INTERSECTING streams —
  through typed event handlers (`TypedEventHandler`) into a
  `Reconstruction` with a canonical state digest.
- The **fold order** (`causal-topological`): an event never applies
  before its causal parent; among ready events the deterministic
  tie-break is (streamId, sequence) ascending. Single streams fold in
  plain sequence order; intersecting streams fold in a
  causality-respecting, byte-stable interleaving (code-unit
  comparisons only — never locale-sensitive).
- **Divergence detection** (`verifyReconstruction`, `verifyDigest`): a
  replayed digest that differs from a recorded digest is the TYPED
  `replay-divergence` error (with expected/encountered digests) — never
  a silent difference.
- **Checkpointing** (`checkpointOf`, `resumeFold`): a fold position
  (cursors + state digest) is resumable; the supplied checkpoint state
  is verified against the checkpoint digest first (`checkpoint-mismatch`
  on tamper).

## Determinism guarantees

- ZERO wall-clock reads and ZERO randomness in `src` (pinned by a
  source-scan test; instants come from event payload data).
- The state digest is the SHA-256 of the canonical JSON serialization of
  the spec's `projectState` projection: identical inputs serialize
  identically, so two folds of the same ordered events through the same
  spec produce identical digests.
- Handler-level nondeterminism is DETECTABLE: a fold that cannot
  reproduce a recorded checkpoint digest is a typed divergence.

## What it deliberately is NOT

- **Not a projection store** — replay reconstructs; it never writes
  world state or replaces the event log.
- **Not a clock** — no `Date`, no `performance.now`, no randomness.
- **Not handler policy** — handlers are caller-supplied pure functions;
  the engine guarantees deterministic ORDERING and digests, and detects
  (rather than prevents) handler impurity.

## Contract surface

In-package versioned contracts (the W007/W008/W009/W010 convention):
version constants + typed index export, runtime zod validators
(`src/schema.ts`), compile-time parity (`src/parity.ts`), and the
committed JSON Schema projection under `schemas/` pinned byte-identically
by `test/contract-drift.test.ts`. The generic runtime types
(`ReplaySpec`, `Reconstruction`, `TypedEventHandler`) are TypeScript-only
surfaces; their serialized counterparts (`ReplayCheckpoint`,
`ReconstructionSnapshot`) carry the JSON Schema projection.

```
EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/replay test contract-drift
```

## Dependencies (W010 runtime policy)

Runtime: `@epoch/agent-protocol` (canonical JSON + SHA-256 digests) and
`@epoch/event-log` (the W010 sibling whose typed history is folded — an
intra-W010 workspace dependency), `zod`. No other `@epoch` runtime
dependencies.

## Tests

Positive folds plus named negatives: unknown stream, unknown event kind,
empty/duplicate stream sets, duplicate handler discriminators, causal
cycles in record lists, checkpoint mismatch (tampered state), and typed
`replay-divergence` on recorded-vs-replayed digest mismatches — plus the
determinism source scan and the neutrality blocklist.
