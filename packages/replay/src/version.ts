/**
 * Replay contract versions and closed vocabularies.
 *
 * architecture.md (binding): "Replay is deterministic reconstruction:
 * given the same ordered event sequence, replay reconstructs the same
 * state — ZERO wall-clock, ZERO randomness; any timestamp a consumer
 * needs comes FROM event payload data, not from reading the clock during
 * replay. Divergence detection: two replays of the same log MUST produce
 * identical state digests."
 *
 * Versioning policy (v1, mirrors @epoch/capability-registry / W009
 * tenancy): a serialized replay record (checkpoint or snapshot) is
 * admitted only when its `schemaVersion` equals
 * {@link REPLAY_RECORD_VERSION} exactly; skew surfaces as a typed
 * `version-unsupported` error before any other schema diagnostic.
 * {@link REPLAY_CONTRACT_VERSION} versions the published contract surface
 * (`schemas/` + the typed index export).
 */

/** Version of the published replay contract surface (schemas/ + types). */
export const REPLAY_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized replay record. */
export const REPLAY_RECORD_VERSION = 1 as const;

/**
 * The canonical multi-stream fold order: events apply in CAUSAL
 * topological order — an event never applies before its causal parent —
 * with the deterministic tie-break (streamId ascending, then sequence
 * ascending) among ready events. A single stream therefore always folds
 * in plain sequence order; intersecting streams fold in a
 * causality-respecting, byte-stable interleaving.
 */
export const REPLAY_FOLD_ORDER = 'causal-topological' as const;

/**
 * The fold-order key of one event under {@link REPLAY_FOLD_ORDER}:
 * (streamId, sequence) — the deterministic tie-break. Exported so
 * consumers (and tests) can reason about the interleaving.
 */
export function replayOrderKey(streamId: string, sequence: number): string {
  return `${streamId}#${sequence}`;
}
