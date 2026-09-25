/**
 * @epoch/replay — published contract types (v1).
 *
 * Hand-written where they are object shapes, exported from the package
 * index as the versioned contract surface. `src/parity.ts` proves at
 * compile time that the zod validators in `src/schema.ts` infer exactly
 * these types; `test/contract-drift.test.ts` proves the committed JSON
 * Schema files under `schemas/` are byte-identical to the deterministic
 * emission of those validators.
 *
 * Determinism contract (architecture.md, binding): replay NEVER reads a
 * clock and NEVER samples randomness; timestamps come from event payload
 * data (EventContent.occurredAt). Two replays of the same ordered event
 * sequence MUST produce identical state digests — divergence is a typed
 * error, never a silent difference.
 */
import type { JsonValue, Sha256Hex } from '@epoch/agent-protocol';
import type {
  EventContent,
  EventKindDiscriminator,
  EventSequence,
  EventStreamId,
} from '@epoch/event-log';
import type { REPLAY_RECORD_VERSION } from './version';

/** One cursor position of a folded stream (the resume coordinate). */
export interface ReplayCursor {
  readonly streamId: EventStreamId;
  readonly lastSequence: EventSequence;
}

/**
 * A recorded fold position: the folded streams, their per-stream
 * cursors, and the state digest AT that position. The checkpoint is the
 * durable anchor for BOTH resume (`resumeFold`) and divergence
 * verification (`verifyReconstruction`): a replay that cannot reproduce
 * a recorded checkpoint digest has diverged.
 */
export interface ReplayCheckpoint {
  readonly schemaVersion: typeof REPLAY_RECORD_VERSION;
  readonly streamIds: readonly EventStreamId[];
  readonly cursors: readonly ReplayCursor[];
  readonly stateDigest: Sha256Hex;
  readonly eventCount: number;
}

/** Options of the fold entry points. */
export interface FoldOptions {
  /**
   * Per-stream cursor to resume AFTER (exclusive): events with sequence
   * > cursor apply; `initialState` is then the state AT the cursor. When
   * omitted, folding starts from the spec's initial state at sequence 0
   * of every stream.
   */
  readonly after?: readonly ReplayCursor[];
}

/** Options of `resumeFold`: the checkpoint plus the state it anchors. */
export interface ResumeOptions<S> {
  /** The state recorded at the checkpoint (must match its digest). */
  readonly checkpointState: S;
}

/** Total-result wrapper of every replay entry point. */
export type ReplayResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ReplayError };

/**
 * The typed replay error taxonomy (W010 Tech Lead pin). Every entry
 * point is total — errors are values, never exceptions:
 *
 * - `validation` — malformed specs/checkpoints (strict objects reject
 *   unknown fields; duplicate handler discriminators);
 * - `version-unsupported` — checkpoint schemaVersion skew;
 * - `unknown-stream` — folding a stream that does not exist;
 * - `unknown-event-kind` — an event whose discriminator has no handler;
 * - `checkpoint-mismatch` — the supplied checkpoint state does not match
 *   the checkpoint's recorded digest (tamper detection);
 * - `replay-divergence` — a replayed digest differs from a recorded
 *   digest (the architecture's divergence detection, typed).
 */
export type ReplayError =
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly { readonly path: string; readonly message: string }[];
    }
  | {
      readonly code: 'version-unsupported';
      readonly message: string;
      readonly expected: string;
      readonly encountered: string;
    }
  | {
      readonly code: 'unknown-stream';
      readonly message: string;
      readonly streamId: EventStreamId;
    }
  | {
      readonly code: 'unknown-event-kind';
      readonly message: string;
      readonly discriminator: EventKindDiscriminator;
      readonly streamId: EventStreamId;
      readonly sequence: EventSequence;
    }
  | {
      readonly code: 'checkpoint-mismatch';
      readonly message: string;
      readonly expected: string;
      readonly encountered: string;
    }
  | {
      readonly code: 'replay-divergence';
      readonly message: string;
      readonly expected: string;
      readonly encountered: string;
      readonly streamIds: readonly EventStreamId[];
      readonly eventCount: number;
    };

/**
 * One typed event handler: applies one event kind to the state. Handlers
 * MUST be pure and deterministic (no clocks, no randomness, no I/O) —
 * the state digest machinery makes any violation DETECTABLE (two folds
 * of the same log produce different digests, and
 * `verifyReconstruction` reports the divergence).
 */
export interface TypedEventHandler<S> {
  readonly discriminator: EventKindDiscriminator;
  readonly apply: (state: S, event: EventContent) => S;
}

/**
 * The fold specification: how a state is reconstructed from events.
 *
 * - `initialState` — the state before any event (folded from nothing);
 * - `handlers` — one handler per event kind (unique discriminators);
 * - `projectState` — the CANONICAL state projection used for digests:
 *   the state as a JSON value. Two equivalent states MUST project to
 *   equal JSON values (the digest is computed over the projection's
 *   canonical JSON serialization).
 */
export interface ReplaySpec<S> {
  readonly initialState: S;
  readonly handlers: readonly TypedEventHandler<S>[];
  readonly projectState: (state: S) => JsonValue;
}

/**
 * The result of one fold: the reconstructed state, the fold position,
 * and the state digest. The state itself is typed (`S`); the SERIALIZED
 * projection of a reconstruction is {@link ReconstructionSnapshot}
 * (state via `projectState`).
 */
export interface Reconstruction<S> {
  readonly streamIds: readonly EventStreamId[];
  readonly cursors: readonly ReplayCursor[];
  readonly eventCount: number;
  readonly state: S;
  readonly stateDigest: Sha256Hex;
}

/**
 * The serialized, deterministic projection of a reconstruction: fold
 * position plus the canonical state projection (the exact-revision
 * address of the reconstructed state).
 */
export interface ReconstructionSnapshot {
  readonly schemaVersion: typeof REPLAY_RECORD_VERSION;
  readonly streamIds: readonly EventStreamId[];
  readonly cursors: readonly ReplayCursor[];
  readonly eventCount: number;
  readonly state: JsonValue;
  readonly stateDigest: Sha256Hex;
}

/** One folded event trace entry (audit of the applied order). */
export interface FoldedEventEntry {
  readonly streamId: EventStreamId;
  readonly sequence: EventSequence;
  readonly discriminator: EventKindDiscriminator;
}

/** The reconstruction plus the applied-order trace (every fold is traced). */
export interface TracedReconstruction<S> extends Reconstruction<S> {
  /** The exact application order (causal topological + tie-break). */
  readonly appliedOrder: readonly FoldedEventEntry[];
}
