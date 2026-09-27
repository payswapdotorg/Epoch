// W032 — the RECOVERY evidence over the cross-domain lifecycle stream:
// replay determinism (twice in-process + from a restored snapshot),
// mid-stream tamper detection (the typed digest-mismatch), and
// verified-prefix continuation (the fold continues from the verified
// prefix, byte-identical to folding the untampered records to the same
// point).
import { describe, expect, it } from 'vitest';
import { canonicalDigest } from '@epoch/agent-protocol';
import { EventLog, type EventRecord } from '@epoch/event-log';
import { runScenario } from '@epoch/test-harness';
import { DELIVERY_STREAM_ID } from '../scenarios/shared';
import { RECOVERY_TAMPER_INDEX } from '../scenarios/cross-domain-delivery';
import { crossDomainDeliveryScenario } from '../scenarios/cross-domain-delivery';
import { crossDomainDriver, latestWorld } from '../scenarios/cross-domain-driver';

describe('cross-domain-recovery', () => {
  const run = runScenario(crossDomainDeliveryScenario(), crossDomainDriver);
  expect(run.ok).toBe(true);
  if (!run.ok) {
    throw new Error('the cross-domain scenario failed to run');
  }
  const world = latestWorld();
  const records: readonly EventRecord[] = (() => {
    const read = world.log.readStream(DELIVERY_STREAM_ID);
    if (!read.ok) throw new Error(`recovery test: stream read failed: ${read.error.code}`);
    return read.value;
  })();

  it('the lifecycle stream is non-trivial (the replay model has real state to fold)', () => {
    expect(records.length).toBeGreaterThanOrEqual(RECOVERY_TAMPER_INDEX + 2);
    // Sequence + causal chain line up (W010 discipline).
    for (const [index, record] of records.entries()) {
      expect(record.event.sequence).toBe(index + 1);
      expect(record.event.causalParent?.sequence ?? null).toBe(index === 0 ? null : index);
    }
  });

  it('replay determinism: folding the stream twice produces the byte-identical state digest', () => {
    const foldOne = foldAll(records);
    const foldTwo = foldAll(records);
    expect(stateDigestOf(foldTwo)).toBe(stateDigestOf(foldOne));
    // The in-scenario replay step recorded the same digest.
    expect(stateDigestOf(foldOne)).toBe(world.recovery?.replayedStateDigest);
  });

  it('replay from a RESTORED log snapshot reproduces the identical state digest', () => {
    const restored = EventLog.fromSnapshot(world.log.snapshot());
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    const restoredRecords = restored.value.readStream(DELIVERY_STREAM_ID);
    expect(restoredRecords.ok).toBe(true);
    if (!restoredRecords.ok) return;
    expect(stateDigestOf(foldAll(restoredRecords.value))).toBe(world.recovery?.replayedStateDigest);
  });

  it('the replayed state AGREES with the live kernel state (event-sourced reconstruction === authority)', () => {
    const state = foldAll(records);
    expect(state.solutionDigest).toBe(world.solution?.contentDigest);
    expect(state.baselineApprovalDigest).toBe(world.approval?.baselineDigest);
    expect(state.programDigest).toBe(world.program?.contentDigest);
    expect(state.deliveryDigest).toBe(world.delivery?.contentDigest);
    expect(Object.keys(state.observations).sort()).toEqual(
      world.delivery?.observations.map((observation) => observation.recordId).sort(),
    );
    expect(state.varianceDigests).toEqual(world.variances.map((variance) => variance.contentDigest).sort());
  });

  it('mid-stream TAMPER is detected: the verified fold halts with the typed digest-mismatch at the tamper index', () => {
    const tampered: EventRecord[] = records.map((record, index) => {
      if (index !== RECOVERY_TAMPER_INDEX) return record;
      return {
        event: {
          ...record.event,
          payload: {
            ...record.event.payload,
            data: {
              ...(record.event.payload.data as Record<string, unknown>),
              contentDigest: 'f'.repeat(64),
            },
          },
        },
        contentDigest: record.contentDigest,
      };
    });
    const fold = foldVerified(tampered);
    expect(fold.verifiedCount).toBe(RECOVERY_TAMPER_INDEX);
    expect(fold.failure?.code).toBe('digest-mismatch');
  });

  it('verified-prefix continuation: the tampered fold CONTINUES from the verified prefix, byte-identical', () => {
    // The driver's in-scenario recovery evidence (recorded in the trace).
    expect(world.recovery?.tamperIndex).toBe(RECOVERY_TAMPER_INDEX);
    expect(world.recovery?.prefixDigest).toBe(world.recovery?.tamperedPrefixDigest);
    expect(world.recovery?.continued).toBe(true);
    // Recomputed here from the raw stream: the prefix fold of the
    // UNTAMPERED records equals the tampered fold's halted state.
    const tampered: EventRecord[] = records.map((record, index) => {
      if (index !== RECOVERY_TAMPER_INDEX) return record;
      return {
        event: {
          ...record.event,
          payload: {
            ...record.event.payload,
            data: {
              ...(record.event.payload.data as Record<string, unknown>),
              contentDigest: 'f'.repeat(64),
            },
          },
        },
        contentDigest: record.contentDigest,
      };
    });
    const prefixFold = foldVerified(records.slice(0, RECOVERY_TAMPER_INDEX));
    const tamperedFold = foldVerified(tampered);
    expect(stateDigestOf(tamperedFold.state)).toBe(stateDigestOf(prefixFold.state));
    expect(tamperedFold.verifiedCount).toBe(prefixFold.verifiedCount);
    expect(stateDigestOf(prefixFold.state)).toBe(world.recovery?.prefixDigest);
  });

  it('the recovery steps are recorded in the trace with their derived evidence digests', () => {
    const replayEntry = run.value.trace.steps.find((candidate) => candidate.stepId === 'step:recovery-replay');
    expect(replayEntry?.outcome).toBe('ok');
    expect(replayEntry?.provenance.length).toBe(records.length);
    const prefixEntry = run.value.trace.steps.find((candidate) => candidate.stepId === 'step:recovery-prefix-continue');
    expect(prefixEntry?.outcome).toBe('ok');
    const prefixReport = run.value.reports.find((candidate) => candidate.stepId === 'step:recovery-prefix-continue');
    expect(prefixReport?.valueDigest).toMatch(/^[0-9a-f]{64}$/);
  });
});

// --------------------------------------------------------------------------------
// The verified fold (mirrors the driver's, for independent recomputation).
// --------------------------------------------------------------------------------

interface LifecycleFoldState {
  solutionDigest: string | null;
  baselineApprovalDigest: string | null;
  programDigest: string | null;
  observations: Record<string, string>;
  deliveryDigest: string | null;
  varianceDigests: string[];
}

function emptyState(): LifecycleFoldState {
  return { solutionDigest: null, baselineApprovalDigest: null, programDigest: null, observations: {}, deliveryDigest: null, varianceDigests: [] };
}

function applyEvent(state: LifecycleFoldState, event: EventRecord['event']): LifecycleFoldState {
  const data = event.payload.data as Record<string, unknown>;
  switch (event.payload.discriminator) {
    case 'delivery:solution-sealed':
      return { ...state, solutionDigest: String(data.contentDigest) };
    case 'delivery:baseline-approved':
      return { ...state, baselineApprovalDigest: String(data.baselineDigest) };
    case 'delivery:program-built':
      return { ...state, programDigest: String(data.contentDigest) };
    case 'delivery:observation-recorded':
      return { ...state, observations: { ...state.observations, [String(data.observationId)]: String(data.contentDigest) } };
    case 'delivery:actualization-applied':
      return { ...state, deliveryDigest: String(data.deliveryDigest) };
    case 'delivery:variance-computed':
      return { ...state, varianceDigests: [...state.varianceDigests, String(data.contentDigest)].sort() };
    default:
      return state;
  }
}

function stateDigestOf(state: LifecycleFoldState): string {
  return canonicalDigest(state as never);
}

function foldAll(records: readonly EventRecord[]): LifecycleFoldState {
  const fold = foldVerified(records);
  if (fold.failure !== null) {
    throw new Error(`recovery test: untampered fold failed at ${fold.verifiedCount}: ${fold.failure.code}`);
  }
  return fold.state;
}

function foldVerified(records: readonly EventRecord[]): { state: LifecycleFoldState; verifiedCount: number; failure: { code: string } | null } {
  let state = emptyState();
  for (const [index, record] of records.entries()) {
    const verified = verifyDigest(record);
    if (!verified) {
      return { state, verifiedCount: index, failure: { code: 'digest-mismatch' } };
    }
    state = applyEvent(state, record.event);
  }
  return { state, verifiedCount: records.length, failure: null };
}

function verifyDigest(record: EventRecord): boolean {
  // Independent recomputation (NOT the kernel's verifier): canonical
  // digest over the event content must equal the claimed digest.
  return canonicalDigest(record.event as never) === record.contentDigest;
}
