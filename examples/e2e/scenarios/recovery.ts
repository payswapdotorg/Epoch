// W031 Reference E2E slice 5 — the RECOVERY scenario definition.
//
// Replay + recovery evidence over slice 1's event stream:
//
//   - REPLAY FROM SCRATCH: the W010 event stream recorded by the
//     construction-delivery scenario is re-folded from an EMPTY state;
//     the reconstructed derived state's digest is IDENTICAL across runs
//     (twice in-process, and again from a restored EventLog snapshot).
//   - LIVE CROSS-CHECK: the replayed derived state EQUALS the live
//     kernel state (the same observation ids + digests, the same actual
//     ids, the same delivery-record head digest) — the event-sourced
//     reconstruction and the authoritative kernel agree.
//   - TAMPER DETECTION: a record tampered mid-stream (payload mutated,
//      claimed digest kept) fails verifyEventDigest with the TYPED
//      `digest-mismatch` error, and the EventLog refuses its append.
//   - VERIFIED-PREFIX CONTINUATION: the fold halts at the first
//     integrity failure and CONTINUES FROM THE VERIFIED PREFIX — the
//     prefix state is byte-identical to folding the untampered records
//     up to the same point.
//
// This is the Work Order's recovery acceptance: replay determinism +
// tamper detection + verified-prefix continuation.
import {
  EventLog,
  verifyEventDigest,
  type EventContent,
  type EventLogError,
  type EventRecord,
} from '@epoch/event-log';
import { canonicalDigest, type JsonValue } from '@epoch/action-policy';
import {
  runConstructionDeliveryScenario,
  DELIVERY_STREAM_ID,
  type ConstructionDeliveryScenario,
} from './construction-delivery';

// --------------------------------------------------------------------------------
// The replay model: the derived state of the delivery lifecycle.
// --------------------------------------------------------------------------------

/** The derived state folded from the delivery lifecycle event stream. */
export interface DeliveryLifecycleState {
  readonly solutionDigest: string | null;
  readonly baselineApprovalDigest: string | null;
  readonly programDigest: string | null;
  readonly poDigest: string | null;
  readonly observations: Readonly<Record<string, string>>;
  readonly actualIds: readonly string[];
  readonly deliveryDigest: string | null;
  readonly variance: { readonly varianceId: string; readonly contentDigest: string } | null;
  readonly attribution: { readonly attributionId: string; readonly contentDigest: string } | null;
}

/** The empty state every replay starts from. */
export function emptyDeliveryLifecycleState(): DeliveryLifecycleState {
  return {
    solutionDigest: null,
    baselineApprovalDigest: null,
    programDigest: null,
    poDigest: null,
    observations: {},
    actualIds: [],
    deliveryDigest: null,
    variance: null,
    attribution: null,
  };
}

/** The deterministic reducer: one event advances the derived state. */
export function applyDeliveryLifecycleEvent(
  state: DeliveryLifecycleState,
  event: EventContent,
): DeliveryLifecycleState {
  const data = event.payload.data as Record<string, unknown>;
  switch (event.payload.discriminator) {
    case 'delivery:solution-sealed':
      return { ...state, solutionDigest: (data.contentDigest as string) ?? null };
    case 'delivery:baseline-approved':
      return { ...state, baselineApprovalDigest: (data.baselineDigest as string) ?? null };
    case 'delivery:program-built':
      return { ...state, programDigest: (data.contentDigest as string) ?? null };
    case 'delivery:po-issued':
      return { ...state, poDigest: (data.contentDigest as string) ?? null };
    case 'delivery:observation-recorded':
      return {
        ...state,
        observations: {
          ...state.observations,
          [String(data.observationId)]: String(data.contentDigest),
        },
      };
    case 'delivery:actualization-applied':
      return {
        ...state,
        actualIds: [...(data.actualIds as string[])].sort(),
        deliveryDigest: String(data.deliveryDigest),
      };
    case 'delivery:variance-computed':
      return {
        ...state,
        variance: { varianceId: String(data.varianceId), contentDigest: String(data.contentDigest) },
      };
    case 'delivery:attribution-recorded':
      return {
        ...state,
        attribution: { attributionId: String(data.attributionId), contentDigest: String(data.contentDigest) },
      };
    default:
      return state;
  }
}

/** The canonical state digest (byte-identical across identical folds). */
export function deliveryLifecycleStateDigest(state: DeliveryLifecycleState): string {
  return canonicalDigest(state as unknown as JsonValue);
}

// --------------------------------------------------------------------------------
// The verified fold: replay with per-record integrity verification.
// --------------------------------------------------------------------------------

/** The outcome of a verified fold (halts at the first integrity failure). */
export interface VerifiedFold {
  /** The derived state of the VERIFIED PREFIX. */
  readonly state: DeliveryLifecycleState;
  /** How many records verified + folded (the prefix length). */
  readonly verifiedCount: number;
  /** The typed integrity failure, iff one occurred. */
  readonly failure: EventLogError | null;
}

/**
 * Fold records with per-record verification: every record's claimed
 * digest is recomputed (verifyEventDigest) BEFORE it applies. The fold
 * halts at the first integrity failure and CONTINUES FROM THE VERIFIED
 * PREFIX — the returned state is exactly the fold of records [0,
 * verifiedCount).
 */
export function foldVerified(records: readonly EventRecord[]): VerifiedFold {
  let state = emptyDeliveryLifecycleState();
  for (const [index, record] of records.entries()) {
    const verified = verifyEventDigest({ event: record.event, digest: record.contentDigest });
    if (!verified.ok) {
      return { state, verifiedCount: index, failure: verified.error };
    }
    state = applyDeliveryLifecycleEvent(state, record.event);
  }
  return { state, verifiedCount: records.length, failure: null };
}

// --------------------------------------------------------------------------------
// The scenario result + runner.
// --------------------------------------------------------------------------------

export interface RecoveryScenario {
  /** The underlying construction-delivery scenario (slice 1). */
  readonly base: ConstructionDeliveryScenario;
  /** The sealed records of the delivery lifecycle stream. */
  readonly records: readonly EventRecord[];
  /** The replayed derived state (from scratch, verified). */
  readonly replayedState: DeliveryLifecycleState;
  /** The digest of the replayed derived state. */
  readonly replayedStateDigest: string;
  /** The digest of the SECOND in-process replay (determinism evidence). */
  readonly secondReplayDigest: string;
  /** The digest of the replay from a RESTORED EventLog snapshot. */
  readonly restoredReplayDigest: string;
  /** The index of the tampered record (mid-stream). */
  readonly tamperIndex: number;
  /** The tampered records (payload mutated, claimed digest kept). */
  readonly tamperedRecords: readonly EventRecord[];
  /** The verified fold over the tampered records (prefix continuation). */
  readonly tamperedFold: VerifiedFold;
  /** The digest of folding the UNTAMPERED records up to the tamper index. */
  readonly prefixDigest: string;
}

/** Unwrap helper. */
function need<T>(result: { ok: true; value: T } | { ok: false; error: unknown }, label: string): T {
  if (!result.ok) {
    throw new Error(`recovery scenario: ${label} failed: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

export function runRecoveryScenario(): RecoveryScenario {
  const base = runConstructionDeliveryScenario();
  const records = need(base.log.readStream(DELIVERY_STREAM_ID), 'read delivery lifecycle stream');

  // Replay 1: from scratch, with per-record verification.
  const foldOne = foldVerified(records);
  if (foldOne.failure !== null) {
    throw new Error(`recovery scenario: untampered replay failed: ${JSON.stringify(foldOne.failure)}`);
  }

  // Replay 2: identical inputs, identical derived-state digest.
  const foldTwo = foldVerified(records);
  const replayedStateDigest = deliveryLifecycleStateDigest(foldOne.state);
  const secondReplayDigest = deliveryLifecycleStateDigest(foldTwo.state);

  // Replay 3: from a RESTORED EventLog snapshot (log-level recovery).
  const restoredLog = need(EventLog.fromSnapshot(base.log.snapshot()), 'restore event log from snapshot');
  const restoredRecords = need(restoredLog.readStream(DELIVERY_STREAM_ID), 'read restored stream');
  const restoredFold = foldVerified(restoredRecords);
  const restoredReplayDigest = deliveryLifecycleStateDigest(restoredFold.state);

  // TAMPER: mutate a mid-stream record's payload, KEEP the claimed digest.
  const tamperIndex = Math.floor(records.length / 2);
  const tamperedRecords = records.map((record, index) => {
    if (index !== tamperIndex) return record;
    const mutated: EventRecord = {
      event: {
        ...record.event,
        payload: {
          ...record.event.payload,
          data: {
            ...record.event.payload.data,
            contentDigest: 'f'.repeat(64),
          },
        },
      },
      contentDigest: record.contentDigest,
    };
    return mutated;
  });
  const tamperedFold = foldVerified(tamperedRecords);

  // The verified-prefix continuation: the tampered fold's state is exactly
  // the fold of the UNTAMPERED records up to the tamper index.
  const prefixFold = foldVerified(records.slice(0, tamperIndex));
  const prefixDigest = deliveryLifecycleStateDigest(prefixFold.state);

  return {
    base,
    records,
    replayedState: foldOne.state,
    replayedStateDigest,
    secondReplayDigest,
    restoredReplayDigest,
    tamperIndex,
    tamperedRecords,
    tamperedFold,
    prefixDigest,
  };
}

// --------------------------------------------------------------------------------
// The digest projection (determinism evidence).
// --------------------------------------------------------------------------------

export function recoveryDigestProjection(
  scenario: RecoveryScenario,
): Record<string, string | readonly string[]> {
  return {
    replayedStateDigest: scenario.replayedStateDigest,
    secondReplayDigest: scenario.secondReplayDigest,
    restoredReplayDigest: scenario.restoredReplayDigest,
    recordDigests: scenario.records.map((record) => record.contentDigest),
    tamperIndex: String(scenario.tamperIndex),
    tamperedFoldVerifiedCount: String(scenario.tamperedFold.verifiedCount),
    tamperedPrefixStateDigest: deliveryLifecycleStateDigest(scenario.tamperedFold.state),
    prefixDigest: scenario.prefixDigest,
  };
}
