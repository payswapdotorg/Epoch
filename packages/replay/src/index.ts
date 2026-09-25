/**
 * @epoch/replay — public API (kernel layer, Work Order W010).
 *
 * DETERMINISTIC RECONSTRUCTION (architecture.md, binding): "Replay is
 * deterministic reconstruction: given the same ordered event sequence,
 * replay reconstructs the same state — ZERO wall-clock, ZERO randomness;
 * any timestamp a consumer needs comes FROM event payload data, not from
 * reading the clock during replay. Divergence detection: two replays of
 * the same log MUST produce identical state digests."
 *
 * - Fold order is CAUSAL-TOPOLOGICAL with the (streamId, sequence)
 *   tie-break: an event never applies before its causal parent; a single
 *   stream folds in plain sequence order; intersecting streams fold in a
 *   causality-respecting, byte-stable interleaving.
 * - The state digest is the SHA-256 of the canonical JSON serialization
 *   of the spec's `projectState` projection (identical inputs serialize
 *   identically).
 * - Divergence detection: `verifyReconstruction` / `verifyDigest` turn a
 *   replayed-vs-recorded digest mismatch into the typed
 *   `replay-divergence` error — never a silent difference.
 * - Checkpointing: `checkpointOf` records the fold position (cursors +
 *   digest); `resumeFold` re-enters from a checkpoint + the checkpointed
 *   state (tampered states are `checkpoint-mismatch`).
 * - ZERO wall-clock reads and ZERO randomness in src (pinned by the
 *   determinism source-scan test).
 *
 * Runtime dependency policy (W010 Tech Lead pin): @epoch/agent-protocol
 * (canonical JSON + SHA-256 digests) and @epoch/event-log (the W010
 * sibling whose typed history is folded — an intra-W010 workspace
 * dependency, not a foreign Work Order surface) are the ONLY @epoch
 * runtime dependencies.
 *
 * Versioned contract surface: version constants + typed index export
 * (this file), runtime zod validators (src/schema.ts), compile-time
 * parity (src/parity.ts), and the committed JSON Schema projection under
 * schemas/ pinned by test/contract-drift.test.ts.
 */

// Version + fold-order vocabulary.
export { REPLAY_CONTRACT_VERSION, REPLAY_FOLD_ORDER, REPLAY_RECORD_VERSION, replayOrderKey } from './version';

// Published contract types (generic runtime surfaces included).
export type {
  FoldedEventEntry,
  FoldOptions,
  Reconstruction,
  ReconstructionSnapshot,
  ReplayCheckpoint,
  ReplayCursor,
  ReplayError,
  ReplayResult,
  ReplaySpec,
  ResumeOptions,
  TracedReconstruction,
  TypedEventHandler,
} from './types';

// Runtime validators.
export {
  FoldedEventEntrySchema,
  ReconstructionSnapshotSchema,
  ReplayCheckpointSchema,
  ReplayCursorSchema,
  ReplayErrorSchema,
  ReplayIssueSchema,
  ReplayRecordVersionSchema,
} from './schema';

// The fold machinery.
export {
  causalTopologicalOrder,
  checkpointOf,
  foldEventRecords,
  foldStream,
  foldStreams,
  resumeFold,
  snapshotOf,
  stateDigestOf,
  verifyDigest,
  verifyReconstruction,
} from './fold';

// Total admission of serialized documents.
export { parseReconstructionSnapshot, parseReplayCheckpoint } from './parse';

// Issue helpers (zod -> typed issues; the W006/W007 style).
export { flattenZodIssues, validationError } from './issues';

// Schema surface registry + deterministic contract emission.
export { renderReplayContractFiles, REPLAY_CONTRACT_DIR, typeToKebabCase } from './contract-emission';
export { REPLAY_SCHEMA_SURFACE } from './surface';
export type { SchemaSurfaceEntry } from './surface';

// Compile-time parity assertions (compiled by tsc --noEmit).
export type { ReplaySchemaSync, ReplayResultSync, ReplayGenericSync } from './parity';
