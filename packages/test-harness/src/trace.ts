/**
 * The execution TRACE: the typed, per-step record the runner produces for
 * one scenario run. Traces are SEALED (content-addressed via the canonical
 * SHA-256 discipline) and REPLAYABLE: re-running the same scenario against
 * the same driver must produce a byte-identical trace (`traceDigest`
 * equality — the `trace-replay-deterministic` gate).
 *
 * Per step the trace records: the step-definition digest, the input
 * digest, the output digest, the events emitted, the provenance records,
 * the identity observations, and the state-digest delta (before/after).
 */
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import type {
  EmittedEventRecord,
  IdentityObservation,
  ProvenanceRecord,
  StepOutcome,
} from './driver';
import type { AssertStep, CallStep, ScenarioStep } from './scenario';

export const TRACE_RECORD_VERSION = 1 as const;

/** One assert step's recorded findings. */
export interface AssertFinding {
  readonly invariant: string;
  readonly satisfied: boolean;
  readonly detail: string;
}

/** The per-step trace entry (all derived data — digest-stable by construction). */
export interface TraceStepEntry {
  readonly stepId: string;
  readonly kind: 'call' | 'assert';
  /** Canonical digest of the step definition (scenario addressability). */
  readonly stepDigest: string;
  /** Call steps: digest of the input payload as dispatched. */
  readonly inputDigest: string | null;
  /** Call steps: digest of the ok value; assert steps: digest of the argument. */
  readonly outputDigest: string | null;
  readonly outcome: StepOutcome | 'asserted';
  readonly errorCode: string | null;
  /** Events emitted during this step (each digest-bearing). */
  readonly events: readonly EmittedEventRecord[];
  /** Digest-bearing records produced during this step. */
  readonly provenance: readonly ProvenanceRecord[];
  /** Canonical ids observed on projection surfaces during this step. */
  readonly identities: readonly IdentityObservation[];
  readonly stateDigestBefore: string;
  readonly stateDigestAfter: string;
  /** True when the driver world's state digest changed during this step. */
  readonly stateDelta: boolean;
  /** Assert steps only: the recorded invariant findings. */
  readonly assertFindings: readonly AssertFinding[] | null;
}

/** The sealed execution trace of one scenario run. */
export interface ExecutionTrace {
  readonly schemaVersion: typeof TRACE_RECORD_VERSION;
  readonly traceId: string;
  readonly scenarioId: string;
  readonly scenarioDigest: string;
  readonly driverName: string;
  readonly steps: readonly TraceStepEntry[];
  /** The driver world's final state digest. */
  readonly finalStateDigest: string;
  /** Canonical SHA-256 over the trace content (everything but this field). */
  readonly traceDigest: string;
}

/** The digest-stable content projection of a trace (everything but traceDigest). */
export function traceContent(trace: Omit<ExecutionTrace, 'traceDigest'>): JsonValue {
  return {
    schemaVersion: trace.schemaVersion,
    traceId: trace.traceId,
    scenarioId: trace.scenarioId,
    scenarioDigest: trace.scenarioDigest,
    driverName: trace.driverName,
    steps: trace.steps,
    finalStateDigest: trace.finalStateDigest,
  } as unknown as JsonValue;
}

/** Seal: compute the trace digest over the trace content. */
export function sealTrace(trace: Omit<ExecutionTrace, 'traceDigest'>): ExecutionTrace {
  return { ...trace, traceDigest: canonicalDigest(traceContent(trace)) };
}

export type TraceVerification =
  | { ok: true }
  | { ok: false; error: { code: 'trace-digest-mismatch'; message: string } };

/** Verify: recompute the trace digest over the content and compare. */
export function verifyTrace(trace: ExecutionTrace): TraceVerification {
  const recomputed = canonicalDigest(traceContent(trace));
  if (recomputed === trace.traceDigest) {
    return { ok: true };
  }
  return {
    ok: false,
    error: {
      code: 'trace-digest-mismatch',
      message: `trace "${trace.traceId}" claims digest ${trace.traceDigest} but the content recomputes to ${recomputed}`,
    },
  };
}

/** Canonical JSON serialization of a sealed trace (byte-stable). */
export function serializeTrace(trace: ExecutionTrace): string {
  return JSON.stringify(traceContent(trace));
}

/** Digest of a step definition (used for the per-step trace address). */
export function stepDigest(step: ScenarioStep): string {
  return canonicalDigest(step as unknown as JsonValue);
}

/** The outcome class implied by a call step's report. */
export function outcomeOf(report: {
  ok: boolean;
  denial: unknown | null;
  authorityRejection: unknown | null;
}): StepOutcome {
  if (report.ok) {
    return 'ok';
  }
  if (report.denial !== null) {
    return 'denied';
  }
  if (report.authorityRejection !== null) {
    return 'authority-rejected';
  }
  return 'rejected';
}

/** Type narrows for step kinds (kept local + exported for the runner). */
export function asCallStep(step: ScenarioStep): CallStep {
  return step as CallStep;
}

export function asAssertStep(step: ScenarioStep): AssertStep {
  return step as AssertStep;
}
